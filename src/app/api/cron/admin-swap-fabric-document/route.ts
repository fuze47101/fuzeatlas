// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/admin-swap-fabric-document
 *
 * Bearer-authed admin shortcut. Andrew uploads the corrected PDF to S3
 * out-of-band (e.g. via the AWS console, an existing presigned-upload
 * helper, or a curl PUT with a presigned URL), then calls this endpoint
 * to point the existing Document row at the new key without touching
 * the UI. Surfaces a clear path when a customer has emailed the right
 * file but can't or won't use the in-app Replace button.
 *
 * Body:
 *   { fabricId, docId, s3Key, filename, contentType, sizeBytes?, bucket? }
 *
 * Idempotent — running twice with the same key is a no-op visible diff.
 * Stamps a one-line audit entry on Fabric.note for traceability.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const DEFAULT_BUCKET = process.env.S3_BUCKET || "fuzeatlas";
const DEFAULT_REGION = process.env.AWS_REGION || "us-east-1";

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const fabricId = String(body?.fabricId || "").trim();
  const docId = String(body?.docId || "").trim();
  const s3Key = String(body?.s3Key || "").trim();
  const filename = String(body?.filename || "").trim();
  const contentType = String(body?.contentType || "application/pdf").trim();

  if (!fabricId || !docId || !s3Key || !filename) {
    return NextResponse.json(
      { ok: false, error: "fabricId, docId, s3Key, filename are required" },
      { status: 400 },
    );
  }

  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { submission: { select: { fabricId: true } } },
  });
  if (!doc) return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  if (doc.submission?.fabricId !== fabricId) {
    return NextResponse.json(
      { ok: false, error: "Document does not belong to this fabric" },
      { status: 404 },
    );
  }

  const bucket = body?.bucket || DEFAULT_BUCKET;
  const url = `https://${bucket}.s3.${DEFAULT_REGION}.amazonaws.com/${s3Key}`;

  const updated = await prisma.document.update({
    where: { id: docId },
    data: {
      filename,
      contentType,
      sizeBytes: typeof body?.sizeBytes === "number" ? body.sizeBytes : null,
      bucket,
      key: s3Key,
      url,
    },
    select: {
      id: true,
      filename: true,
      contentType: true,
      sizeBytes: true,
      bucket: true,
      key: true,
      url: true,
      updatedAt: true,
    },
  });

  // Append audit line to the fabric.
  const fabric = await prisma.fabric.findUnique({
    where: { id: fabricId },
    select: { note: true },
  });
  const stamp = `[${new Date().toISOString().slice(0, 16).replace("T", " ")}] Document "${doc.filename || docId}" swapped to "${filename}" via admin cron`;
  await prisma.fabric.update({
    where: { id: fabricId },
    data: { note: fabric?.note ? `${fabric.note}\n${stamp}` : stamp },
  });

  return NextResponse.json({ ok: true, document: updated });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
