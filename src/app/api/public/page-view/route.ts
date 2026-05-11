// @ts-nocheck
/**
 * POST /api/public/page-view — Phase 12G.
 *
 * Public endpoint. Records one PublicPageView row per call. Fire-
 * and-forget from the client via navigator.sendBeacon. Hashes the
 * caller IP (first 8 chars SHA-256) for unique-visitor estimation
 * — never stores raw IP.
 *
 * Body: { path: string, brandId?: string, referer?: string }
 *
 * The brandId is resolved server-side from the path when path
 * looks like /verified/[slug]; the client-supplied brandId is
 * ignored for trust reasons.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";

function shortIpHash(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 8);
}

async function resolveBrandFromPath(path: string): Promise<string | null> {
  // /verified/[slug] → BrandProfile.publicSlug → brandId
  const m = path.match(/^\/verified\/([^\/?#]+)/);
  if (!m) return null;
  const slug = m[1];
  if (slug === "qr") return null;
  const profile = await prisma.brandProfile.findUnique({
    where: { publicSlug: slug },
    select: { brandId: true, publicEnabled: true },
  });
  if (!profile?.publicEnabled) return null;
  return profile.brandId;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const path = typeof body?.path === "string" ? body.path.slice(0, 512) : null;
  if (!path) return NextResponse.json({ ok: false }, { status: 400 });

  // Only allow logging for our intended public surfaces — defense
  // against the endpoint being weaponized to write garbage.
  const allowed =
    path.startsWith("/verified/") ||
    path === "/claims" ||
    path === "/press";
  if (!allowed) return NextResponse.json({ ok: false }, { status: 400 });

  const brandId = await resolveBrandFromPath(path);
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 512);
  const referer = (body.referer || req.headers.get("referer") || "").slice(0, 512);

  try {
    await prisma.publicPageView.create({
      data: {
        path,
        brandId,
        ipHash: shortIpHash(req),
        userAgent: userAgent || null,
        referer: referer || null,
      },
    });
  } catch (err) {
    console.warn("[page-view] write failed:", err);
  }
  return NextResponse.json({ ok: true });
}
