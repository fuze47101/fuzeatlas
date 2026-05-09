// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Cross-factory volume rollup + pricing tier check.
 *
 * KUIU promise (Andrew → Joseph, May 7 2026): "we can then calculate
 * and control pricing reductions based on volume across all factories."
 *
 * GET /api/brand-portal/pricing-rollup
 *
 * Returns:
 *   - lifetime FuzeConsumption.litersUsed across every factory in
 *     this brand's supply chain
 *   - lifetime FuzeOrder.volumeLiters (production+sample orders)
 *     across the same supply chain — separate from consumption
 *     because not all ordered FUZE has been used yet
 *   - the brand's BrandPricingTier ladder, sorted ascending
 *   - the currently-qualifying tier (highest threshold ≤ consumed)
 *   - the next tier and the gap to it
 *   - per-factory breakdown of consumption (so brand can see who
 *     contributed what)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const brandId = user.brandId;
    if (!brandId) {
      return NextResponse.json(
        { ok: false, error: "No brand associated with this account" },
        { status: 403 },
      );
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true },
    });
    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    // Lifetime consumption (sum + per-factory breakdown).
    const consumptionByFactory = await prisma.fuzeConsumption.groupBy({
      by: ["factoryId"],
      where: { brandId },
      _sum: { litersUsed: true },
      orderBy: undefined,
    });

    const factoryIds = consumptionByFactory.map((c: any) => c.factoryId).filter(Boolean);
    const factoryNames =
      factoryIds.length > 0
        ? await prisma.factory.findMany({
            where: { id: { in: factoryIds } },
            select: { id: true, name: true, country: true },
          })
        : [];
    const factoryMap = new Map(factoryNames.map((f: any) => [f.id, f]));

    const consumptionLitersTotal = consumptionByFactory.reduce(
      (sum: number, row: any) => sum + (row._sum.litersUsed || 0),
      0,
    );

    // Lifetime ordered (volumeLiters across non-cancelled production +
    // sample orders for this brand).
    const orderAgg = await prisma.fuzeOrder.aggregate({
      where: {
        brandId,
        orderType: { in: ["PRODUCTION", "SAMPLE"] },
        status: { notIn: ["CANCELLED", "DRAFT"] },
      },
      _sum: { volumeLiters: true },
      _count: { _all: true },
    });
    const orderLitersTotal = orderAgg._sum.volumeLiters || 0;
    const orderCount = orderAgg._count._all || 0;

    // Pricing ladder.
    const tiers = await prisma.brandPricingTier.findMany({
      where: { brandId, active: true },
      orderBy: { thresholdLiters: "asc" },
      select: {
        id: true,
        thresholdLiters: true,
        discountPct: true,
        label: true,
      },
    });

    // Current tier = highest threshold ≤ consumption. Next tier =
    // first threshold > consumption.
    const currentTier =
      tiers.filter((t: any) => consumptionLitersTotal >= t.thresholdLiters).slice(-1)[0] || null;
    const nextTier = tiers.find((t: any) => consumptionLitersTotal < t.thresholdLiters) || null;
    const litersToNextTier = nextTier
      ? Math.max(0, nextTier.thresholdLiters - consumptionLitersTotal)
      : null;

    return NextResponse.json({
      ok: true,
      brand,
      totals: {
        consumptionLitersTotal,
        orderLitersTotal,
        orderCount,
        factoryCount: factoryIds.length,
      },
      currentTier,
      nextTier,
      litersToNextTier,
      tiers,
      perFactory: consumptionByFactory
        .map((row: any) => ({
          factoryId: row.factoryId,
          factoryName: factoryMap.get(row.factoryId)?.name || "Unknown factory",
          country: factoryMap.get(row.factoryId)?.country || null,
          litersUsed: row._sum.litersUsed || 0,
        }))
        .sort((a: any, b: any) => b.litersUsed - a.litersUsed),
    });
  } catch (e: any) {
    console.error("[brand-portal/pricing-rollup] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load pricing rollup" },
      { status: 500 },
    );
  }
}
