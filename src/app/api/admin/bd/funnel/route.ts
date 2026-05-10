// @ts-nocheck
/**
 * GET /api/admin/bd/funnel — Phase 9E.
 *
 * Pipeline funnel — current count per stage + 30/60/90 day inflow vs
 * outflow + average days spent at the stage before moving forward +
 * conversion rate to the next stage. Reads BrandStageTransition for
 * the audit trail; brands that pre-date the audit log show up only
 * in the current-count column.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const BD_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

const STAGES = [
  "LEAD",
  "PRESENTATION",
  "BRAND_TESTING",
  "FACTORY_ONBOARDING",
  "FACTORY_TESTING",
  "PRODUCTION",
  "BRAND_EXPANSION",
  "CUSTOMER_WON",
] as const;

type Stage = (typeof STAGES)[number];

function nextStage(stage: Stage): Stage | null {
  const idx = STAGES.indexOf(stage);
  if (idx < 0 || idx === STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BD_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400_000);
  const d60 = new Date(now.getTime() - 60 * 86400_000);
  const d90 = new Date(now.getTime() - 90 * 86400_000);

  // Current count per stage.
  const currentCounts = await prisma.brand.groupBy({
    by: ["pipelineStage"],
    where: { pipelineStage: { in: STAGES as any } },
    _count: { _all: true },
  });
  const currentByStage: Record<string, number> = {};
  for (const c of currentCounts) {
    currentByStage[c.pipelineStage] = c._count._all;
  }

  // Pull every transition in the last 90 days. Small dataset by
  // construction — even an aggressive BD team only flips stages a
  // few times per brand per quarter.
  const transitions = await prisma.brandStageTransition.findMany({
    where: { transitionedAt: { gte: d90 } },
    orderBy: { transitionedAt: "asc" },
    select: { brandId: true, fromStage: true, toStage: true, transitionedAt: true },
  });

  // Bucket per stage: count brand-entries (transitions where toStage =
  // this stage) and brand-exits (transitions where fromStage = this
  // stage). Track per-brand dwell time using a per-brand timeline.
  type Bucket = {
    inflow30: number;
    inflow60: number;
    inflow90: number;
    outflow30: number;
    outflow60: number;
    outflow90: number;
    dwellSum: number;
    dwellN: number;
    convertedToNext: number;
    convertedTotalExits: number;
  };
  const buckets: Record<string, Bucket> = {};
  for (const s of STAGES) {
    buckets[s] = {
      inflow30: 0,
      inflow60: 0,
      inflow90: 0,
      outflow30: 0,
      outflow60: 0,
      outflow90: 0,
      dwellSum: 0,
      dwellN: 0,
      convertedToNext: 0,
      convertedTotalExits: 0,
    };
  }

  for (const t of transitions) {
    if (STAGES.includes(t.toStage as Stage)) {
      const b = buckets[t.toStage];
      if (t.transitionedAt >= d30) b.inflow30++;
      if (t.transitionedAt >= d60) b.inflow60++;
      if (t.transitionedAt >= d90) b.inflow90++;
    }
    if (t.fromStage && STAGES.includes(t.fromStage as Stage)) {
      const b = buckets[t.fromStage];
      if (t.transitionedAt >= d30) b.outflow30++;
      if (t.transitionedAt >= d60) b.outflow60++;
      if (t.transitionedAt >= d90) b.outflow90++;
      const next = nextStage(t.fromStage as Stage);
      b.convertedTotalExits++;
      if (next && t.toStage === next) {
        b.convertedToNext++;
      }
    }
  }

  // Per-brand dwell: for each brand, walk the timeline in order, take
  // the (toStage, transitionedAt) tuples and for each consecutive pair
  // record dwell = next.at - prev.at attributed to prev.toStage.
  const byBrand = new Map<string, typeof transitions>();
  for (const t of transitions) {
    const arr = byBrand.get(t.brandId) || [];
    arr.push(t);
    byBrand.set(t.brandId, arr);
  }
  for (const arr of byBrand.values()) {
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i];
      const b = arr[i + 1];
      const stage = a.toStage;
      if (!STAGES.includes(stage as Stage)) continue;
      const days = (b.transitionedAt.getTime() - a.transitionedAt.getTime()) / 86400_000;
      if (days < 0) continue;
      buckets[stage].dwellSum += days;
      buckets[stage].dwellN += 1;
    }
  }

  const stages = STAGES.map((s) => {
    const b = buckets[s];
    const conv =
      b.convertedTotalExits > 0
        ? b.convertedToNext / b.convertedTotalExits
        : 0;
    return {
      stage: s,
      next: nextStage(s),
      currentCount: currentByStage[s] || 0,
      inflow30: b.inflow30,
      inflow60: b.inflow60,
      inflow90: b.inflow90,
      outflow30: b.outflow30,
      outflow60: b.outflow60,
      outflow90: b.outflow90,
      avgDaysAtStage: b.dwellN > 0 ? b.dwellSum / b.dwellN : null,
      conversionToNext: conv,
      conversionDenom: b.convertedTotalExits,
    };
  });

  return NextResponse.json({
    ok: true,
    asOf: now.toISOString(),
    stages,
  });
}
