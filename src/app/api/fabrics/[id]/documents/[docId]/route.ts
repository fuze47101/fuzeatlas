// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uploadToS3, generateS3Key, S3_PREFIXES, isS3Configured } from "@/lib/s3";

/**
 * /api/fabrics/[id]/documents/[docId]
 *
 * Replace + Soft-delete operations for a Document attached to a fabric
 * (via the document's FabricSubmission relation).
 *
 * PATCH  multipart/form-data { file }     — replace the underlying S3 file
 * DELETE                                  — soft-delete (set deletedAt)
 *
 * ACL:
 *   ADMIN, EMPLOYEE              → any fabric
 *   FACTORY_USER, FACTORY_LEAD   → only when Fabric.factoryId matches
 *   BRAND_USER, BRAND_MANAGER    → only when Fabric.brandId matches
 *   anyone else                  → 403
 *
 * Both operations append a one-line audit entry to Fabric.note.
 */

const FACTORY_ROLES = new Set(["FACTORY_USER", "FACTORY_LEAD", "FACTORY_MANAGER"]);
const BRAND_ROLES = new Set(["BRAND_USER", "BRAND_MANAGER"]);
const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE"]);

interface ResolvedContext {
  fabric: { id: string; fuzeNumber: number | null; brandId: string | null; factoryId: string | null; note: string | null };
  doc: any;
}

async function resolveAndAuthorize(
  fabricId: string,
  docId: string,
  user: any,
): Promise<ResolvedContext | { error: string; status: number }> {
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { submission: { select: { fabricId: true, brandId: true, factoryId: true } } },
  });
  if (!doc) return { error: "Document not found", status: 404 };

  // Doc must attach to a submission that belongs to the URL fabric.
  if (doc.submission?.fabricId !== fabricId) {
    return { error: "Document does not belong to this fabric", status: 404 };
  }

  const fabric = await prisma.fabric.findUnique({
    where: { id: fabricId },
    select: { id: true, fuzeNumber: true, brandId: true, factoryId: true, note: true },
  });
  if (!fabric) return { error: "Fabric not found", status: 404 };

  let allowed = false;
  if (ADMIN_ROLES.has(user.role)) allowed = true;
  else if (FACTORY_ROLES.has(user.role)) {
    if (user.factoryId && fabric.factoryId && user.factoryId === fabric.factoryId) allowed = true;
  } else if (BRAND_ROLES.has(user.role)) {
    if (user.brandId && fabric.brandId && user.brandId === fabric.brandId) allowed = true;
  }
  if (!allowed) return { error: "Forbidden", status: 403 };

  return { fabric, doc };
}

function appendFabricNote(existing: string | null, line: string): string {
  const stamp = `[${new Date().toISOString().slice(0, 16).replace("T", " ")}] ${line}`;
  return existing ? `${existing}\n${stamp}` : stamp;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id: fabricId, docId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const ctx = await resolveAndAuthorize(fabricId, docId, user);
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const { fabric, doc } = ctx;

  if (!isS3Configured()) {
    return NextResponse.json({ ok: false, error: "S3 not configured" }, { status: 500 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "multipart/form-data required" }, { status: 400 });
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, error: "file field required" }, { status: 400 });
  }
  const blob = file as File;
  const filename = blob.name || doc.filename || "document.pdf";
  const contentType = blob.type || doc.contentType || "application/octet-stream";
  const buffer = Buffer.from(await blob.arrayBuffer());

  // Always write to a fresh S3 key so a presigned URL on the old key
  // can't accidentally serve the new file. Old key is left in S3 (cheap)
  // — out-of-band cleanup if storage cost becomes a concern.
  const s3Key = generateS3Key(S3_PREFIXES.PRODUCT_DOCUMENTS, filename, fabricId);
  const uploaded = await uploadToS3(s3Key, buffer, contentType, {
    fabricId,
    docId,
    uploaderId: user.id,
    action: "replace",
  });

  const updated = await prisma.document.update({
    where: { id: docId },
    data: {
      filename,
      contentType,
      sizeBytes: buffer.length,
      bucket: uploaded.bucket,
      key: uploaded.key,
      url: uploaded.url,
    },
    select: {
      id: true,
      filename: true,
      contentType: true,
      sizeBytes: true,
      kind: true,
      updatedAt: true,
    },
  });

  const auditor = user.name || user.email || user.id;
  await prisma.fabric.update({
    where: { id: fabric.id },
    data: {
      note: appendFabricNote(
        fabric.note,
        `Document "${doc.filename || docId}" replaced with "${filename}" by ${auditor}`,
      ),
    },
  });

  return NextResponse.json({ ok: true, document: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id: fabricId, docId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const ctx = await resolveAndAuthorize(fabricId, docId, user);
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const { fabric, doc } = ctx;

  await prisma.document.update({
    where: { id: docId },
    data: { deletedAt: new Date() },
  });

  const auditor = user.name || user.email || user.id;
  await prisma.fabric.update({
    where: { id: fabric.id },
    data: {
      note: appendFabricNote(
        fabric.note,
        `Document "${doc.filename || docId}" soft-deleted by ${auditor}`,
      ),
    },
  });

  return NextResponse.json({ ok: true, filename: doc.filename });
}
