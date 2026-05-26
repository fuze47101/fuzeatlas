// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { medianDwellHours, TRACKING_STATES } from "@/lib/test-tracking-eta";

/**
 * GET /api/admin/test-tracking
 *
 * Phase 17 T5 — admin dashboard data feed. Returns every TestRequest
 * with a non-COMPLETE / non-CANCELLED trackingState, sorted by oldest
 * time-in-current-state. Flags stuck-tests (current state > 2x median
 * dwell time).
 *
 * Optional filters: ?state= / ?brandId= / ?labId= / ?stuckOnly=true
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const stateFilter = url.searchParams.get("state");
  const brandIdFilter = url.searchParams.get("brandId");
  const labIdFilter = url.searchParams.get("labId");
  const stuckOnly = url.searchParams.get("stuckOnly") === "true";

  const where: any = {
    trackingState: stateFilter
      ? stateFilter
      : { notIn: ["COMPLETE", "CANCELLED"], not: null },
  };
  if (brandIdFilter) where.brandId = brandIdFilter;
  if (labIdFilter) where.labId = labIdFilter;

  const requests = await prisma.testRequest.findMany({
    where,
    orderBy: { trackingUpdatedAt: "asc" },
    take: 200,
    select: {
      id: true,
      poNumber: true,
      status: true,
      trackingState: true,
      trackingUpdatedAt: true,
      createdAt: true,
      brand: { select: { id: true, name: true } },
      lab: { select: { id: true, name: true } },
      trackingToken: { select: { token: true } },
    },
  });

  // Compute median dwell time per next-state transition (memoized via the helper).
  const items: any[] = [];
  for (const r of requests) {
    const cur = r.trackingState as string | null;
    if (!cur) continue;
    const idx = TRACKING_STATES.indexOf(cur as any);
    const next = idx >= 0 && idx < TRACKING_STATES.length - 1 ? TRACKING_STATES[idx + 1] : null;
    let medianH: number | null = null;
    let stuck = false;
    if (next) {
      medianH = await medianDwellHours(cur, next);
      const enteredAt = r.trackingUpdatedAt || r.createdAt;
      const ageH = (Date.now() - new Date(enteredAt).getTime()) / 36e5;
      stuck = medianH > 0 && ageH > medianH * 2;
    }
    if (stuckOnly && !stuck) continue;
    items.push({
      id: r.id,
      poNumber: r.poNumber,
      status: r.status,
      trackingState: cur,
      trackingUpdatedAt: r.trackingUpdatedAt,
      brandName: r.brand?.name || null,
      brandId: r.brand?.id || null,
      labName: r.lab?.name || null,
      labId: r.lab?.id || null,
      token: r.trackingToken?.token || null,
      medianHoursToNext: medianH,
      stuck,
    });
  }

  return NextResponse.json({
    ok: true,
    count: items.length,
    items,
  });
}
