// @ts-nocheck
/**
 * GET    /api/admin/red-rover/[id]/attachments        — list (non-deleted)
 * POST   /api/admin/red-rover/[id]/attachments        — record an uploaded
 *   Document (called after the S3 PUT). Body: filename, contentType,
 *   sizeBytes, s3Key/bucket/publicUrl.
 * DELETE /api/admin/red-rover/[id]/attachments?docId=  — soft-delete.
 *
 * getRealUser gate; Next 15 params awaited. Reuses the Document model.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);

async function gate() {
  const user = await getRealUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if (!ADMIN_ROLES.has(user.role))
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.error) return g.error;
  const { id } = await params;
  const docs = await prisma.document.findMany({
    where: { redRoverTargetId: id, deletedAt: null },
    select: { id: true, filename: true, contentType: true, sizeBytes: true, url: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ok: true, attachments: docs });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.error) return g.error;
  const { id } = await params;

  const target = await prisma.redRoverTarget.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ ok: false, error: "Target not found" }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const filename = (body.filename || "").trim();
  if (!filename) return NextResponse.json({ ok: false, error: "filename required" }, { status: 400 });

  const doc = await prisma.document.create({
    data: {
      kind: "OTHER",
      filename,
      contentType: body.contentType || null,
      sizeBytes: Number.isFinite(body.sizeBytes) ? Math.trunc(body.sizeBytes) : null,
      bucket: body.bucket || null,
      key: body.s3Key || null,
      url: body.publicUrl || body.url || null,
      redRoverTargetId: id,
    },
    select: { id: true, filename: true, url: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, attachment: doc });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.error) return g.error;
  const { id } = await params;
  const url = new URL(req.url);
  const docId = url.searchParams.get("docId");
  if (!docId) return NextResponse.json({ ok: false, error: "docId required" }, { status: 400 });

  const existing = await prisma.document.findFirst({
    where: { id: docId, redRoverTargetId: id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ ok: false, error: "Attachment not found" }, { status: 404 });

  await prisma.document.update({ where: { id: docId }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true, deleted: docId });
}
