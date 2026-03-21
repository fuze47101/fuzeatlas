// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToS3, generateS3Key, deleteFromS3, isS3Configured, S3_PREFIXES } from "@/lib/s3";

/* ── POST /api/labs/[id]/documents ── upload a lab form ── */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { filename, contentType, sizeBytes, base64Data, url } = body;

    if (!filename) {
      return NextResponse.json({ ok: false, error: "Filename required" }, { status: 400 });
    }

    const lab = await prisma.lab.findUnique({ where: { id } });
    if (!lab) {
      return NextResponse.json({ ok: false, error: "Lab not found" }, { status: 404 });
    }

    let fileUrl = url || null;
    let s3Bucket: string | null = null;
    let s3Key: string | null = null;

    // Upload base64 data to S3 if available and configured
    if (base64Data && isS3Configured()) {
      const buffer = Buffer.from(base64Data, "base64");
      const key = generateS3Key(S3_PREFIXES.LAB_DOCS, filename, id);
      const s3Result = await uploadToS3(key, buffer, contentType || "application/pdf", {
        labId: id,
        originalFilename: filename,
      });
      fileUrl = s3Result.url;
      s3Bucket = s3Result.bucket;
      s3Key = s3Result.key;
    }

    const doc = await prisma.document.create({
      data: {
        kind: "LAB_FORM",
        filename: filename,
        contentType: contentType || "application/pdf",
        sizeBytes: sizeBytes || null,
        labId: id,
        url: fileUrl,
        bucket: s3Bucket,
        key: s3Key,
        // Legacy fallback: store base64 in raw if S3 not configured
        raw: (!isS3Configured() && base64Data) ? { base64: base64Data } : null,
      },
    });

    return NextResponse.json({ ok: true, document: { id: doc.id, filename: doc.filename, contentType: doc.contentType, sizeBytes: doc.sizeBytes, createdAt: doc.createdAt } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── DELETE /api/labs/[id]/documents?docId=xxx ── delete a lab document ── */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ ok: false, error: "docId query param required" }, { status: 400 });
    }

    // Verify doc belongs to this lab
    const doc = await prisma.document.findFirst({
      where: { id: docId, labId: id },
    });
    if (!doc) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    // Delete from S3 if stored there
    if (doc.key && isS3Configured()) {
      try { await deleteFromS3(doc.key); } catch (e) { console.error("S3 delete error:", e); }
    }

    await prisma.document.delete({ where: { id: docId } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── GET /api/labs/[id]/documents ── list lab forms ── */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const docs = await prisma.document.findMany({
      where: { labId: id, kind: "LAB_FORM" },
      select: {
        id: true,
        filename: true,
        contentType: true,
        sizeBytes: true,
        url: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, documents: docs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
