// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getPresignedUploadUrl,
  generateS3Key,
  S3_PREFIXES,
  isS3Configured,
  getS3Bucket,
  getS3Region,
} from "@/lib/s3";

/**
 * POST /api/tests/upload-url
 *
 * Returns a presigned S3 PUT URL for a test report PDF so the file
 * goes browser → S3 directly. This bypasses Vercel's ~4.5 MB request
 * body limit on serverless functions — the limit was rejecting big
 * PDFs with a plain-text 413 BEFORE /api/tests/upload could run,
 * which the client then JSON-parsed and crashed with
 * "Unexpected token 'R', 'Request En'... is not valid JSON".
 *
 * Mirrors the pattern at:
 *   - /api/fabrics/photo-upload-url
 *   - /api/compliance-docs/upload-url
 *   - /api/admin/product-documents/upload-url
 *
 * Body: { filename: string, contentType: string, fileSize?: number }
 * Reply: { ok, uploadUrl, bucket, key, fileName, contentType }
 *
 * The browser then PUTs the file to `uploadUrl` directly and POSTs
 * the small JSON metadata payload (linkage + key) to /api/tests/upload
 * to write the Document + parse the PDF.
 */
const ALLOWED_CONTENT_TYPES = new Set(["application/pdf"]);
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB hard cap (matches handler)

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req).catch(() => null);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!isS3Configured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "S3 storage is not configured. Contact your administrator (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY missing).",
        },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const filename = String(body?.filename || "").trim();
    const contentType = String(body?.contentType || "").trim();
    const fileSize = Number(body?.fileSize ?? 0);

    if (!filename || !contentType) {
      return NextResponse.json(
        { ok: false, error: "filename and contentType are required" },
        { status: 400 },
      );
    }
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { ok: false, error: "Only application/pdf is accepted for test reports" },
        { status: 400 },
      );
    }
    if (Number.isFinite(fileSize) && fileSize > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: `File too large (max 25MB, got ${Math.round(fileSize / 1024 / 1024)}MB)` },
        { status: 400 },
      );
    }

    // Key path: test-reports/<userId>/<ts>-<sanitized-filename>.pdf
    const key = generateS3Key(S3_PREFIXES.TEST_REPORTS, filename, user.id);
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 600);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      bucket: getS3Bucket(),
      key,
      region: getS3Region(),
      fileName: filename,
      contentType,
    });
  } catch (err: any) {
    console.error("[tests/upload-url] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
