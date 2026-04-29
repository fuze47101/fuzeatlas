// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPresignedDownloadUrl, isS3Configured } from "@/lib/s3";

/* ── GET /api/documents/[id] ── return document with base64 URL for viewing */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const doc = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        contentType: true,
        sizeBytes: true,
        url: true,
        bucket: true,
        key: true,
        kind: true,
      },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    // If the URL is a base64 data URL, we can return it directly as a PDF
    if (doc.url && doc.url.startsWith("data:")) {
      // Extract base64 content
      const matches = doc.url.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const contentType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, "base64");

        return new Response(buffer, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="${doc.filename || "report.pdf"}"`,
            "Content-Length": String(buffer.length),
          },
        });
      }
    }

    // If we have an S3 key, generate a presigned URL for secure access
    if (doc.key && isS3Configured()) {
      const presignedUrl = await getPresignedDownloadUrl(
        doc.key,
        3600, // 1 hour
        doc.filename || undefined,
      );
      return NextResponse.redirect(presignedUrl);
    }

    // Fallback: redirect to stored URL (may not work for private S3 objects)
    if (doc.url) {
      return NextResponse.redirect(doc.url);
    }

    return NextResponse.json({ ok: false, error: "No document content available" }, { status: 404 });
  } catch (err: any) {
    console.error("Document download error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── DELETE /api/documents/[id] ── delete a document (lab + admin)
 *
 * Tina (lab tech) needs to delete duplicate uploads — the same PDF
 * gets accidentally re-uploaded a few times during testing or after
 * hand-off mishaps. Permission scope:
 *   - ADMIN / EMPLOYEE → any document
 *   - LAB user → only docs where labId matches their own lab
 *   - DISTRIBUTOR_USER → only docs where raw.uploaderDistributorId
 *     matches their distributor (their own uploads)
 *
 * Refuses to delete a document that's linked to a TestRun — the
 * underlying test run has to be deleted first (via /admin/tests/...)
 * to avoid orphaning test results.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const doc = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        labId: true,
        testRunId: true,
        raw: true,
      },
    });
    if (!doc) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user.role);
    const isLabUser = !!user.labId;
    const isDistributor = user.role === "DISTRIBUTOR_USER";

    // Permission check
    if (!isAdmin) {
      let allowed = false;
      if (isLabUser && doc.labId === user.labId) allowed = true;
      if (isDistributor) {
        const uploaderDistId = (doc.raw as any)?.uploaderDistributorId;
        if (uploaderDistId && uploaderDistId === user.distributorId) {
          allowed = true;
        }
      }
      if (!allowed) {
        return NextResponse.json(
          { ok: false, error: "You can only delete documents you uploaded." },
          { status: 403 },
        );
      }
    }

    // Refuse if linked to a TestRun — admin should delete that first
    if (doc.testRunId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This document is linked to a test run. Delete the test run first (admin only) — the document will cascade.",
        },
        { status: 409 },
      );
    }

    await prisma.document.delete({ where: { id } });
    return NextResponse.json({ ok: true, filename: doc.filename });
  } catch (err: any) {
    console.error("Document delete error:", err);
    return NextResponse.json({ ok: false, error: err.message || "Delete failed" }, { status: 500 });
  }
}
