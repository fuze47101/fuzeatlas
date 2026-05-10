// @ts-nocheck
/**
 * GET /api/tracking/open/{token} — Phase 9A.
 *
 * Open-tracking pixel. Returns a 1×1 transparent GIF on every hit
 * (Cache-Control: no-store) and increments openCount + stamps
 * openedAt (first hit) / lastOpenedAt (every hit) on the matching
 * OutreachMessage. Public route — exempt from middleware via the
 * /api/tracking prefix added to PUBLIC_PATHS.
 *
 * Honors `DNT: 1` — we still return the pixel (so the email layout
 * doesn't break) but skip the database write so we don't track
 * users who've opted out.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TRANSPARENT_GIF_BUFFER } from "@/lib/email-tracking";

function pixelResponse(): NextResponse {
  const res = new NextResponse(TRANSPARENT_GIF_BUFFER, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF_BUFFER.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
  return res;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const dnt = req.headers.get("dnt") === "1";

  if (token && !dnt) {
    try {
      const msg = await prisma.outreachMessage.findUnique({
        where: { trackingToken: token },
        select: { id: true, openedAt: true },
      });
      if (msg) {
        const now = new Date();
        await prisma.outreachMessage.update({
          where: { id: msg.id },
          data: {
            openCount: { increment: 1 },
            lastOpenedAt: now,
            ...(msg.openedAt ? {} : { openedAt: now }),
          },
        });
      }
    } catch (err) {
      // Never fail the pixel response — tracking is best-effort.
      console.error("[tracking/open] write failed:", err);
    }
  }

  return pixelResponse();
}
