// @ts-nocheck
/**
 * GET /api/tracking/click/{token}?to=<encoded URL> — Phase 9A.
 *
 * Click-tracking redirector. Reads the `to` query param (the original
 * URL the rep put in their email), records an OutreachLinkClick row,
 * bumps OutreachMessage.clickCount + clickedAt/lastClickedAt, then
 * 302 redirects the recipient to the destination.
 *
 * Honors DNT: 1 — we still redirect, but skip the DB write.
 *
 * Failure modes: missing/invalid token → redirect to /. Missing `to`
 * → also /. We never want a broken email link to dead-end the
 * recipient — better to land them on the home page than 404.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";

function safeRedirect(target: string): NextResponse {
  // Resolve relative URLs against the app origin so we never 302 to a
  // user-controlled scheme. Reject javascript: / data: / non-http(s).
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return NextResponse.redirect("https://fuzeatlas.com/");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return NextResponse.redirect("https://fuzeatlas.com/");
  }
  return NextResponse.redirect(url.toString(), 302);
}

function shortIpHash(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : null;
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 8);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const dnt = req.headers.get("dnt") === "1";

  if (!to) {
    return safeRedirect("https://fuzeatlas.com/");
  }

  let destination: string;
  try {
    destination = decodeURIComponent(to);
  } catch {
    destination = to;
  }

  if (token && !dnt) {
    try {
      const msg = await prisma.outreachMessage.findUnique({
        where: { trackingToken: token },
        select: { id: true, clickedAt: true },
      });
      if (msg) {
        const now = new Date();
        await prisma.$transaction([
          prisma.outreachLinkClick.create({
            data: {
              messageId: msg.id,
              url: destination,
              userAgent: req.headers.get("user-agent") || null,
              ipHash: shortIpHash(req),
            },
          }),
          prisma.outreachMessage.update({
            where: { id: msg.id },
            data: {
              clickCount: { increment: 1 },
              lastClickedAt: now,
              ...(msg.clickedAt ? {} : { clickedAt: now }),
            },
          }),
        ]);
      }
    } catch (err) {
      console.error("[tracking/click] write failed:", err);
    }
  }

  return safeRedirect(destination);
}
