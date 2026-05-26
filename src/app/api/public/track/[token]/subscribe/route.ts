// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/public/track/[token]/subscribe
 *
 * Phase 17 T7 — public subscribe form. No auth required.
 * Body: { email: string, channels?: string }  (default EMAIL only)
 */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ ok: false, error: "Token required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }

  const tt = await (prisma as any).testTrackingToken.findUnique({
    where: { token },
    select: { testRequestId: true, expiresAt: true },
  });
  if (!tt) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (tt.expiresAt && new Date(tt.expiresAt) < new Date()) {
    return NextResponse.json({ ok: false, error: "Token expired" }, { status: 410 });
  }

  const channels = String(body?.channels || "EMAIL").toUpperCase();

  // Re-subscribe if previously unsubscribed.
  const existing = await (prisma as any).testTrackingSubscription.findFirst({
    where: { testRequestId: tt.testRequestId, email },
  });
  if (existing) {
    const updated = await (prisma as any).testTrackingSubscription.update({
      where: { id: existing.id },
      data: { unsubscribedAt: null, channels },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: updated.id, status: "resubscribed" });
  }
  const created = await (prisma as any).testTrackingSubscription.create({
    data: {
      testRequestId: tt.testRequestId,
      email,
      channels,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: created.id, status: "subscribed" });
}
