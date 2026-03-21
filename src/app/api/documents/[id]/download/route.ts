// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPresignedDownloadUrl, isS3Configured } from "@/lib/s3";

/* ── GET /api/documents/[id]/download ──
 *  Returns a presigned S3 URL for secure document download.
 *  Falls back to the stored URL (base64 or external link) if not on S3.
 * ────────────────────────────────────────── */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, key: true, bucket: true, url: true, filename: true, contentType: true },
    });

    if (!doc) return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });

    // If stored in S3, generate a presigned download URL
    if (doc.key && isS3Configured()) {
      const presignedUrl = await getPresignedDownloadUrl(doc.key, 3600, doc.filename || undefined);
      return NextResponse.redirect(presignedUrl);
    }

    // Otherwise redirect to stored URL (base64 data URL or external link)
    if (doc.url) {
      // For base64 data URLs, return them directly since they can't be redirected
      if (doc.url.startsWith("data:")) {
        return NextResponse.json({ ok: true, url: doc.url });
      }
      return NextResponse.redirect(doc.url);
    }

    return NextResponse.json({ ok: false, error: "No file available" }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
