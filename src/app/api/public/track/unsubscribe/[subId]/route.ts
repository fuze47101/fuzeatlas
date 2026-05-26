// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET/POST /api/public/track/unsubscribe/[subId]
 *
 * Phase 17 T7 — one-click unsubscribe link. Hard-stamps unsubscribedAt.
 * No auth (subscription id is sufficient — the id itself is the
 * unguessable token here).
 */
async function handle(_req: Request, { params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params;
  if (!subId) return NextResponse.json({ ok: false, error: "Subscription id required" }, { status: 400 });

  const sub = await (prisma as any).testTrackingSubscription
    .update({
      where: { id: subId },
      data: { unsubscribedAt: new Date() },
      select: { id: true, email: true },
    })
    .catch(() => null);

  if (!sub) {
    return NextResponse.json({ ok: false, error: "Subscription not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, unsubscribed: sub.id });
}

export async function GET(req: Request, ctx: any) { return handle(req, ctx); }
export async function POST(req: Request, ctx: any) { return handle(req, ctx); }
