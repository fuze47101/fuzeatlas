// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPresignedUploadUrl, generateS3Key, S3_PREFIXES, isS3Configured } from "@/lib/s3";

/* ── POST /api/admin/product-documents/upload-url ──
 *  Returns a presigned S3 upload URL so the client can drag-drop
 *  a PDF/DOCX/XLSX directly to S3 instead of pasting a URL.
 *  Bypasses Vercel's ~4.5MB serverless body limit.
 *
 *  Mirrors /api/compliance-docs/upload-url; scoped to ADMIN |
 *  EMPLOYEE because product documents are FUZE-issued, not
 *  per-tenant content.
 *
 *  Closes cmpfklb840001lb041mh46187 (Kaylee).
 * ────────────────────────────────────────── */

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) {
      return NextResponse.json({ ok: false, error: "Only admins can upload" }, { status: 403 });
    }

    if (!isS3Configured()) {
      return NextResponse.json(
        { ok: false, error: "S3 storage is not configured. Contact your administrator." },
        { status: 503 },
      );
    }

    const { filename, contentType, docType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { ok: false, error: "filename and contentType are required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { ok: false, error: "Only PDF, DOC/DOCX, and XLS/XLSX are accepted" },
        { status: 400 },
      );
    }

    const prefix = docType
      ? `${S3_PREFIXES.PRODUCT_DOCUMENTS}/${String(docType).toLowerCase()}`
      : S3_PREFIXES.PRODUCT_DOCUMENTS;
    const s3Key = generateS3Key(prefix, filename, user.id);
    const uploadUrl = await getPresignedUploadUrl(s3Key, contentType, 600);

    const region = process.env.AWS_REGION || "us-west-2";
    const bucket = process.env.S3_BUCKET || "fuzeatlas";
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

    return NextResponse.json({ ok: true, uploadUrl, s3Key, publicUrl });
  } catch (err: any) {
    console.error("Error generating product-document upload URL:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
