// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadToS3, getPresignedUploadUrl, generateS3Key, S3_PREFIXES, isS3Configured } from "@/lib/s3";

export const runtime = "nodejs";

/* ── POST /api/compliance-docs/upload-url ──
 *  Two modes:
 *  1. FormData with "file" field → server-side S3 upload (for files up to ~4MB on Vercel)
 *  2. JSON with { filename, contentType } → returns presigned S3 upload URL (for larger files)
 *
 *  The client tries mode 1 first. If the file is >4MB, it falls back to mode 2.
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

    const ct = req.headers.get("content-type") || "";

    // ── MODE 1: Server-side upload via FormData ──
    if (ct.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
      }

      const filename = file.name;
      const contentType = file.type || "application/octet-stream";
      const sizeBytes = file.size;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const s3Key = generateS3Key(S3_PREFIXES.COMPLIANCE_DOCS, filename, user.id);
      await uploadToS3(s3Key, buffer, contentType, {
        uploadedBy: user.id,
        originalFilename: filename,
      });

      return NextResponse.json({
        ok: true,
        mode: "server",
        s3Key,
        filename,
        contentType,
        sizeBytes,
      });
    }

    // ── MODE 2: Presigned URL for client-side upload (large files) ──
    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { ok: false, error: "filename and contentType are required" },
        { status: 400 },
      );
    }

    const s3Key = generateS3Key(S3_PREFIXES.COMPLIANCE_DOCS, filename, user.id);
    const uploadUrl = await getPresignedUploadUrl(s3Key, contentType, 600);

    return NextResponse.json({
      ok: true,
      mode: "presigned",
      uploadUrl,
      s3Key,
    });
  } catch (err: any) {
    console.error("Error in compliance upload:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
