// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureTrackingToken, generateTrackingToken } from "@/lib/test-tracking";

/**
 * Phase 17 T4 — admin endpoint to fetch / rotate / expire the
 * public tracking token for a TestRequest.
 *
 * GET   — returns { token, expiresAt, publicUrl }
 * POST  — body { action: "rotate" | "expire" | "extend", expiresAt? }
 */

const PUBLIC_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

async function authorize() {
  const user = await getCurrentUser();
  if (!user) return null;
  const role = user.role;
  if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BRAND_MANAGER", "BRAND_USER"].includes(role)) {
    return null;
  }
  return user;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authorize();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  const { id } = await params;

  await ensureTrackingToken(id);
  const tt = await (prisma as any).testTrackingToken.findUnique({
    where: { testRequestId: id },
    select: { token: true, expiresAt: true, viewCount: true, lastViewedAt: true },
  });
  if (!tt) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    token: tt.token,
    expiresAt: tt.expiresAt,
    viewCount: tt.viewCount,
    lastViewedAt: tt.lastViewedAt,
    publicUrl: `${PUBLIC_BASE}/track/${tt.token}`,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authorize();
  if (!user || !["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "rotate");

  if (action === "rotate") {
    const newToken = generateTrackingToken();
    const updated = await (prisma as any).testTrackingToken.upsert({
      where: { testRequestId: id },
      create: { testRequestId: id, token: newToken },
      update: { token: newToken, expiresAt: null, viewCount: 0, lastViewedAt: null },
      select: { token: true },
    });
    return NextResponse.json({
      ok: true,
      token: updated.token,
      publicUrl: `${PUBLIC_BASE}/track/${updated.token}`,
    });
  }

  if (action === "expire") {
    const updated = await (prisma as any).testTrackingToken.update({
      where: { testRequestId: id },
      data: { expiresAt: new Date() },
      select: { token: true },
    });
    return NextResponse.json({ ok: true, token: updated.token, expired: true });
  }

  if (action === "extend") {
    const when = body?.expiresAt ? new Date(body.expiresAt) : null;
    const updated = await (prisma as any).testTrackingToken.update({
      where: { testRequestId: id },
      data: { expiresAt: when },
      select: { token: true, expiresAt: true },
    });
    return NextResponse.json({
      ok: true,
      token: updated.token,
      expiresAt: updated.expiresAt,
    });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
