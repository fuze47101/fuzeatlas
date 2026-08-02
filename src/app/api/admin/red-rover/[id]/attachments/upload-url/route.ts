// @ts-nocheck
/**
 * POST /api/admin/red-rover/[id]/attachments/upload-url — presigned S3
 * upload URL for a target attachment (NDA / term sheet / dossier PDF).
 * Bypasses Vercel's ~4.5MB body limit. getRealUser gate; Next 15 params.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";
import { getPresignedUploadUrl, generateS3Key, S3_PREFIXES, isS3Configured } from "@/lib/s3";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);
const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRealUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.has(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.redRoverTarget.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ ok: false, error: "Target not found" }, { status: 404 });

  if (!isS3Configured()) {
    return NextResponse.json({ ok: false, error: "S3 storage is not configured." }, { status: 503 });
  }

  const { filename, contentType } = await req.json();
  if (!filename || !contentType) {
    return NextResponse.json({ ok: false, error: "filename and contentType are required" }, { status: 400 });
  }
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json({ ok: false, error: "Only PDF, DOC/DOCX, XLS/XLSX, PNG, JPEG accepted" }, { status: 400 });
  }

  const s3Key = generateS3Key(`${S3_PREFIXES.RED_ROVER}`, filename, id);
  const uploadUrl = await getPresignedUploadUrl(s3Key, contentType, 600);
  const region = process.env.AWS_REGION || "us-west-2";
  const bucket = process.env.S3_BUCKET || "fuzeatlas";
  const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

  return NextResponse.json({ ok: true, uploadUrl, s3Key, publicUrl, bucket });
}
