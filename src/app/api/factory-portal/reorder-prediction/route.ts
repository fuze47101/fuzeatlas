// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/factory-portal/reorder-prediction
 *
 * NICE-7 — predict when this factory will run out of FUZE so the
 * landing page can prompt a reorder before they actually empty.
 *
 * Math:
 *   onHandLiters       = SUM(FuzeOrder.volumeLiters where shipped/delivered)
 *                        − SUM(FuzeConsumption.litersUsed)
 *   dailyBurnLiters    = SUM(consumption over last 30d) / 30
 *   daysOfStockLeft    = onHandLiters / dailyBurnLiters
 *   projectedEmptyDate = today + daysOfStockLeft
 *   suggestedUnit      = the standard unit (CARBOY / GAYLORD / CONTAINER_20)
 *                        whose volume covers ~60 days at the current burn,
 *                        biased toward GAYLORD as the international default.
 *
 * Returns null `dailyBurnLiters` when this factory has no
 * consumption history yet — the UI shows a softer onboarding hint
 * instead of a panic CTA.
 */

const STANDARD_UNITS = [
  { unit: "CARBOY", liters: 19, label: "carboy" },
  { unit: "GAYLORD", liters: 608, label: "gaylord" },
  { unit: "CONTAINER_20", liters: 6080, label: "20 ft container" },
  { unit: "CONTAINER_40", liters: 12160, label: "40 ft container" },
];

const TARGET_DAYS_FORWARD = 60;

function pickReorderUnit(dailyBurn: number) {
  if (dailyBurn <= 0) {
    return { unit: "GAYLORD", liters: 608, label: "gaylord", qty: 1 };
  }
  const target = dailyBurn * TARGET_DAYS_FORWARD;
  for (const u of STANDARD_UNITS) {
    if (u.liters >= target) {
      return { ...u, qty: 1 };
    }
  }
  // Burn is so high a single 40 ft container doesn't carry 60 days — quantize.
  const top = STANDARD_UNITS[STANDARD_UNITS.length - 1];
  return { ...top, qty: Math.max(1, Math.ceil(target / top.liters)) };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.factoryId)
    return NextResponse.json({ ok: false, error: "Not a factory user" }, { status: 403 });

  const since30 = new Date(Date.now() - 30 * 86400_000);

  // Orders received → on-hand liters in / consumption out.
  const [ordersAgg, consumptionTotalAgg, consumption30Agg, mostRecentConsumption] =
    await Promise.all([
      prisma.fuzeOrder
        .aggregate({
          where: {
            factoryId: user.factoryId,
            // Treat anything past shipping as "in the factory's hands".
            status: { in: ["DELIVERED", "SHIPPED", "PROCESSING"] },
          },
          _sum: { volumeLiters: true },
        })
        .catch(() => ({ _sum: { volumeLiters: 0 } } as any)),
      prisma.fuzeConsumption
        .aggregate({
          where: { factoryId: user.factoryId },
          _sum: { litersUsed: true },
        })
        .catch(() => ({ _sum: { litersUsed: 0 } } as any)),
      prisma.fuzeConsumption
        .aggregate({
          where: { factoryId: user.factoryId, usageDate: { gte: since30 } },
          _sum: { litersUsed: true },
        })
        .catch(() => ({ _sum: { litersUsed: 0 } } as any)),
      prisma.fuzeConsumption
        .findFirst({
          where: { factoryId: user.factoryId },
          orderBy: { usageDate: "desc" },
          select: { usageDate: true },
        })
        .catch(() => null),
    ]);

  const totalReceivedLiters = ordersAgg._sum?.volumeLiters || 0;
  const totalConsumedLiters = consumptionTotalAgg._sum?.litersUsed || 0;
  const onHandLiters = Math.max(0, totalReceivedLiters - totalConsumedLiters);
  const consumed30Liters = consumption30Agg._sum?.litersUsed || 0;
  const dailyBurnLiters = consumed30Liters > 0 ? consumed30Liters / 30 : 0;

  const hasHistory = !!mostRecentConsumption;
  let daysOfStockLeft: number | null = null;
  let projectedEmptyDate: string | null = null;
  let urgency: "ok" | "soon" | "now" | "unknown" = "unknown";

  if (dailyBurnLiters > 0) {
    daysOfStockLeft = onHandLiters / dailyBurnLiters;
    const empty = new Date(Date.now() + daysOfStockLeft * 86400_000);
    projectedEmptyDate = empty.toISOString();
    urgency = daysOfStockLeft < 14 ? "now" : daysOfStockLeft < 30 ? "soon" : "ok";
  }

  const suggested = pickReorderUnit(dailyBurnLiters);

  return NextResponse.json({
    ok: true,
    onHandLiters: Math.round(onHandLiters * 100) / 100,
    consumed30Liters: Math.round(consumed30Liters * 100) / 100,
    dailyBurnLiters: dailyBurnLiters > 0 ? Math.round(dailyBurnLiters * 100) / 100 : null,
    daysOfStockLeft: daysOfStockLeft != null ? Math.round(daysOfStockLeft) : null,
    projectedEmptyDate,
    urgency,
    hasHistory,
    suggested,
    targetDaysForward: TARGET_DAYS_FORWARD,
  });
}
