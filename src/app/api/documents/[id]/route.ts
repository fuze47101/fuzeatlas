// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // If it's a regular URL, redirect to it
    if (doc.url) {
      return NextResponse.redirect(doc.url);
    }

    return NextResponse.json({ ok: false, error: "No document content available" }, { status: 404 });
  } catch (err: any) {
    console.error("Document download error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
