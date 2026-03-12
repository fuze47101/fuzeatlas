// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPresignedUploadUrl, generateS3Key, S3_PREFIXES, isS3Configured } from "@/lib/s3";

/* ── POST /api/compliance-docs/upload-url ──
 *  Returns a presigned S3 upload URL so the client can upload directly to S3.
 *  This bypasses Vercel's ~4.5MB body size limit for serverless functions.
 *  Requires S3 CORS to be configured on the bucket for fuzeatlas.com.
 * ────────────────────────────────────────── */
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

    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { ok: false, error: "filename and contentType are required" },
        { status: 400 },
      );
    }

    const s3Key = generateS3Key(S3_PREFIXES.COMPLIANCE_DOCS, filename, user.id);
    const uploadUrl = await getPresignedUploadUrl(s3Key, contentType, 600); // 10 min expiry

    return NextResponse.json({
      ok: true,
      uploadUrl,
      s3Key,
    });
  } catch (err: any) {
    console.error("Error generating compliance upload URL:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
