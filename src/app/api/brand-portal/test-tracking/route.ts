// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { medianDwellHours, TRACKING_STATES } from "@/lib/test-tracking-eta";

/**
 * GET /api/brand-portal/test-tracking
 *
 * Phase 17 T8 — brand-scoped tracking dashboard data. Returns every
 * TestRequest for the caller's brand with live trackingState + ETA.
 */
export async function GET(_req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.brandId) {
    return NextResponse.json({ ok: false, error: "Brand context required" }, { status: 403 });
  }

  const requests = await prisma.testRequest.findMany({
    where: { brandId: user.brandId, status: { notIn: ["DRAFT", "CANCELLED"] } },
    orderBy: [{ trackingUpdatedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      poNumber: true,
      status: true,
      trackingState: true,
      trackingUpdatedAt: true,
      createdAt: true,
      fuzeFabricNumber: true,
      customerFabricCode: true,
      lab: { select: { name: true } },
      trackingToken: { select: { token: true } },
      trackingSubscriptions: {
        where: { userId: user.id, unsubscribedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  });

  const items: any[] = [];
  for (const r of requests) {
    const cur = r.trackingState as string | null;
    let medianH: number | null = null;
    let nextState: string | null = null;
    if (cur) {
      const idx = TRACKING_STATES.indexOf(cur as any);
      if (idx >= 0 && idx < TRACKING_STATES.length - 1) {
        nextState = TRACKING_STATES[idx + 1];
        medianH = await medianDwellHours(cur, nextState);
      }
    }
    items.push({
      id: r.id,
      poNumber: r.poNumber,
      status: r.status,
      trackingState: cur,
      trackingUpdatedAt: r.trackingUpdatedAt || r.createdAt,
      fuzeFabricNumber: r.fuzeFabricNumber,
      customerFabricCode: r.customerFabricCode,
      labName: r.lab?.name || null,
      token: r.trackingToken?.token || null,
      nextState,
      medianHoursToNext: medianH,
      watching: (r.trackingSubscriptions || []).length > 0,
    });
  }

  return NextResponse.json({ ok: true, count: items.length, items });
}

/**
 * POST /api/brand-portal/test-tracking
 * Body: { action: "watch" | "unwatch", testRequestId }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.brandId) {
    return NextResponse.json({ ok: false, error: "Brand context required" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const testRequestId = String(body?.testRequestId || "");
  const action = String(body?.action || "watch");
  if (!testRequestId) {
    return NextResponse.json({ ok: false, error: "testRequestId required" }, { status: 400 });
  }

  // Verify ownership: TestRequest must belong to caller's brand.
  const tr = await prisma.testRequest.findUnique({
    where: { id: testRequestId },
    select: { brandId: true },
  });
  if (!tr || tr.brandId !== user.brandId) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  if (action === "watch") {
    const existing = await (prisma as any).testTrackingSubscription.findFirst({
      where: { testRequestId, userId: user.id },
    });
    if (existing) {
      await (prisma as any).testTrackingSubscription.update({
        where: { id: existing.id },
        data: { unsubscribedAt: null, channels: "EMAIL,IN_APP" },
      });
      return NextResponse.json({ ok: true, status: "resubscribed" });
    }
    await (prisma as any).testTrackingSubscription.create({
      data: {
        testRequestId,
        userId: user.id,
        email: user.email,
        channels: "EMAIL,IN_APP",
      },
    });
    return NextResponse.json({ ok: true, status: "watching" });
  }

  if (action === "unwatch") {
    await (prisma as any).testTrackingSubscription.updateMany({
      where: { testRequestId, userId: user.id },
      data: { unsubscribedAt: new Date() },
    });
    return NextResponse.json({ ok: true, status: "unwatched" });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
