// @ts-nocheck
/**
 * GET /api/cron/generate-esg-snapshot — Phase 12C.
 *
 * Bearer-authed. Registered quarterly at the 1st of Jan / Apr /
 * Jul / Oct at 06:00 UTC: `0 6 1 1,4,7,10 *`.
 *
 * For every Brand whose BrandProfile.publicEnabled = true, compute
 * the snapshot for the CURRENT quarter (the one that just closed
 * when this cron runs at 06:00 UTC on the 1st). Upserts a
 * BrandEsgSnapshot row keyed on (brandId, period).
 *
 * The PDF rendering (publicPdfUrl) is left blank — admin attaches
 * a published PDF manually via /admin/brands/[id]/esg-snapshots.
 * Auto-PDF deferred until a brand asks for one.
 *
 * Idempotent: re-runs upsert the same quarter row in place. Safe
 * to invoke ad-hoc via `fzcron generate-esg-snapshot`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function priorQuarter(now: Date = new Date()): {
  period: string;
  periodStart: Date;
  periodEnd: Date;
} {
  // The "current snapshot" is the quarter that just closed. If
  // today is Apr 1 we want Q1: Jan 1 – Mar 31.
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0..11
  // Compute the quarter that just ended.
  let q: number, qYear: number;
  if (month === 0 || (month === 1 && now.getUTCDate() < 2)) {
    // Edge — Jan first half = prior year Q4
    q = 4;
    qYear = year - 1;
  } else if (month < 4) {
    q = 1;
    qYear = year;
  } else if (month < 7) {
    q = 2;
    qYear = year;
  } else if (month < 10) {
    q = 3;
    qYear = year;
  } else {
    q = 4;
    qYear = year;
  }
  const startMonth = (q - 1) * 3;
  const periodStart = new Date(Date.UTC(qYear, startMonth, 1));
  const periodEnd = new Date(Date.UTC(qYear, startMonth + 3, 1));
  periodEnd.setUTCMilliseconds(-1);
  return { period: `${qYear}-Q${q}`, periodStart, periodEnd };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const periodOverride = url.searchParams.get("period"); // optional manual: 2026-Q2

  const { period: autoPeriod, periodStart: autoStart, periodEnd: autoEnd } = priorQuarter();
  let period = autoPeriod;
  let periodStart = autoStart;
  let periodEnd = autoEnd;
  if (periodOverride) {
    const m = periodOverride.match(/^(\d{4})-Q([1-4])$/);
    if (m) {
      const yr = parseInt(m[1], 10);
      const q = parseInt(m[2], 10);
      const startMonth = (q - 1) * 3;
      periodStart = new Date(Date.UTC(yr, startMonth, 1));
      periodEnd = new Date(Date.UTC(yr, startMonth + 3, 1));
      periodEnd.setUTCMilliseconds(-1);
      period = periodOverride;
    }
  }

  const brands = await prisma.brand.findMany({
    where: {
      profile: { publicEnabled: true },
    },
    select: { id: true, name: true },
  });

  const results: any[] = [];
  for (const b of brands) {
    try {
      // fabricsCertified — distinct fabricIds in approved submissions over period
      const subs = await prisma.fabricSubmission.findMany({
        where: {
          brandId: b.id,
          brandApprovalStatus: "APPROVED",
          updatedAt: { gte: periodStart, lte: periodEnd },
        },
        select: { fabricId: true, factoryId: true },
      });
      const fabricsCertified = new Set(subs.map((s) => s.fabricId).filter(Boolean)).size;
      const factoryCountActive = new Set(
        subs.map((s) => s.factoryId).filter(Boolean),
      ).size;

      const testsRunCount = await prisma.testRun.count({
        where: {
          submission: { brandId: b.id },
          testDate: { gte: periodStart, lte: periodEnd },
        },
      });
      const testsPassedCount = await prisma.testRun.count({
        where: {
          submission: { brandId: b.id },
          brandApprovalStatus: "APPROVED",
          testDate: { gte: periodStart, lte: periodEnd },
        },
      });

      // FUZE consumption in liters tied to this brand over period
      const consAgg = await prisma.fuzeConsumption.aggregate({
        where: {
          brandId: b.id,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { litersUsed: true },
      });
      const fuzeConsumedLiters = consAgg._sum.litersUsed || 0;

      // zeroPfasFabricCount — count of distinct fabrics on approved
      // submissions in period. FUZE is PFAS-free by chemistry, so
      // every certified fabric qualifies. (When PFAS-status becomes
      // a per-fabric column we can refine.)
      const zeroPfasFabricCount = fabricsCertified;

      const snap = await prisma.brandEsgSnapshot.upsert({
        where: { brandId_period: { brandId: b.id, period } },
        create: {
          brandId: b.id,
          period,
          periodStart,
          periodEnd,
          fabricsCertified,
          testsRunCount,
          testsPassedCount,
          fuzeConsumedLiters,
          factoryCountActive,
          zeroPfasFabricCount,
        },
        update: {
          fabricsCertified,
          testsRunCount,
          testsPassedCount,
          fuzeConsumedLiters,
          factoryCountActive,
          zeroPfasFabricCount,
          generatedAt: new Date(),
        },
      });
      results.push({
        brandId: b.id,
        name: b.name,
        period,
        snapshotId: snap.id,
        fabricsCertified,
        testsRunCount,
        testsPassedCount,
        fuzeConsumedLiters,
      });
    } catch (err: any) {
      results.push({ brandId: b.id, name: b.name, error: err?.message || String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    brandsConsidered: brands.length,
    results,
  });
}
