// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPresignedUploadUrl, generateS3Key, S3_PREFIXES, isS3Configured } from "@/lib/s3";

/**
 * POST /api/fabrics/photo-upload-url
 *
 * Returns a presigned S3 PUT URL for a fabric intake or receipt
 * photo (T6 phase 16 — Kaylee's "I want to see the sample as it
 * arrived" ask).
 *
 * Body: { kind: "intake" | "received", fabricId?: string,
 *         filename: string, contentType: string }
 *
 * Any authenticated user can request a URL — fabric ownership /
 * write authority is enforced at the consuming endpoint
 * (/api/fabrics POST for intake, /api/fabrics/[id] PATCH for
 * received) when the URL is recorded against the row.
 *
 * Bucket layout: fabric-photos/<fabricId|orphan>/<intake|received>-<ts>.<ext>
 */

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (!isS3Configured()) {
    return NextResponse.json(
      { ok: false, error: "S3 storage is not configured" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({} as any));
  const kind = body?.kind === "received" ? "received" : "intake";
  const fabricId = body?.fabricId ? String(body.fabricId) : "orphan";
  const filename = String(body?.filename || "").trim();
  const contentType = String(body?.contentType || "").trim();

  if (!filename || !contentType) {
    return NextResponse.json(
      { ok: false, error: "filename and contentType required" },
      { status: 400 },
    );
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json(
      { ok: false, error: "Only JPEG, PNG, WebP, HEIC photos are accepted" },
      { status: 400 },
    );
  }

  const stem = `${kind}-${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const s3Key = `${S3_PREFIXES.FABRIC_PHOTOS}/${fabricId}/${stem}`;
  const uploadUrl = await getPresignedUploadUrl(s3Key, contentType, 600);

  const region = process.env.AWS_REGION || "us-west-2";
  const bucket = process.env.S3_BUCKET || "fuzeatlas";
  const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

  return NextResponse.json({ ok: true, uploadUrl, s3Key, publicUrl });
}
