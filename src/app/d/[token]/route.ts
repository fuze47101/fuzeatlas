// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadFromS3, isS3Configured } from "@/lib/s3";

/* ── GET /d/[token] ──
 *  PUBLIC document download by share token. NO auth check — that is the whole
 *  point: a link that anyone with the URL can open, no Atlas login required.
 *  Middleware exempts /d/ so this handler runs anonymously.
 *
 *  404 for an unknown token, an expired token, or a doc that has no retrievable
 *  file. Streams S3-backed files inline; redirects to an external URL; decodes
 *  a legacy base64 blob. The token is stable across file replacement, so a link
 *  already sent resolves to whatever the current stored file is.
 * ────────────────────────────────────────── */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!token) {
      return new NextResponse("Not found", { status: 404 });
    }

    const doc = await prisma.complianceDocument.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        title: true,
        filename: true,
        contentType: true,
        url: true,
        data: true,
        s3Key: true,
        shareExpiresAt: true,
      },
    });

    // Unknown token, or link expired / never given an expiry → 404.
    if (!doc || !doc.shareExpiresAt || doc.shareExpiresAt.getTime() < Date.now()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const downloadName = doc.filename || `${doc.title || "document"}`;

    // 1) S3-backed file → stream the bytes inline.
    if (doc.s3Key && isS3Configured()) {
      const buf = await downloadFromS3(doc.s3Key);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": doc.contentType || "application/octet-stream",
          "Content-Disposition": `inline; filename="${downloadName.replace(/"/g, "")}"`,
          "Content-Length": String(buf.length),
          "Cache-Control": "private, no-store",
        },
      });
    }

    // 2) Legacy inline base64 blob (data URL or raw base64).
    if (doc.data) {
      let b64 = doc.data;
      let ctype = doc.contentType || "application/octet-stream";
      const m = /^data:([^;]+);base64,(.*)$/s.exec(doc.data);
      if (m) {
        ctype = m[1];
        b64 = m[2];
      }
      const buf = Buffer.from(b64, "base64");
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": ctype,
          "Content-Disposition": `inline; filename="${downloadName.replace(/"/g, "")}"`,
          "Content-Length": String(buf.length),
          "Cache-Control": "private, no-store",
        },
      });
    }

    // 3) External URL → redirect.
    if (doc.url) {
      return NextResponse.redirect(doc.url, 302);
    }

    // Token valid but nothing to serve.
    return new NextResponse("Not found", { status: 404 });
  } catch (err: any) {
    console.error("Error serving shared document:", err);
    return new NextResponse("Not found", { status: 404 });
  }
}
