// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/factory-portal/inventory  (Phase 4F — DO+OVERSEE)
 *
 * Factory-side stock + recent consumption + projected run-out.
 * Aggregates FuzeOrder.volumeLiters (received) minus
 * FuzeConsumption.litersUsed (consumed) for the caller's factory.
 *
 * 30-day burn rate is the average daily consumption over the last
 * 30 days, used to project days-of-stock-remaining.
 */

const RECEIVED_STATUSES = ["APPROVED", "PROCESSING", "SHIPPED", "DELIVERED"];

const ACK_ROLES = ["ADMIN", "EMPLOYEE", "FACTORY_USER", "FACTORY_MANAGER"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ACK_ROLES.includes(user.role)) return forbidden();
  if (!user.factoryId) return forbidden();

  const factoryId = user.factoryId;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [ordersAgg, consumptionAgg, recent30Agg, recentRows] = await Promise.all([
    prisma.fuzeOrder.aggregate({
      where: { factoryId, status: { in: RECEIVED_STATUSES } },
      _sum: { volumeLiters: true },
    }),
    prisma.fuzeConsumption.aggregate({
      where: { factoryId },
      _sum: { litersUsed: true },
    }),
    prisma.fuzeConsumption.aggregate({
      where: { factoryId, usageDate: { gte: since30 } },
      _sum: { litersUsed: true },
    }),
    prisma.fuzeConsumption.findMany({
      where: { factoryId },
      orderBy: { usageDate: "desc" },
      take: 20,
      select: {
        id: true,
        usageDate: true,
        litersUsed: true,
        fuzeTier: true,
        brand: { select: { id: true, name: true } },
      },
    }),
  ]);

  const ordersTotal = ordersAgg._sum.volumeLiters || 0;
  const consumedTotal = consumptionAgg._sum.litersUsed || 0;
  const consumed30 = recent30Agg._sum.litersUsed || 0;
  const onHand = Math.max(0, ordersTotal - consumedTotal);
  const dailyBurn = consumed30 / 30;
  const daysRemaining =
    dailyBurn > 0 ? Math.floor(onHand / dailyBurn) : null;

  return NextResponse.json({
    ok: true,
    summary: {
      ordersTotalLiters: ordersTotal,
      consumedTotalLiters: consumedTotal,
      onHandLiters: onHand,
      consumedLast30Liters: consumed30,
      dailyBurnLiters: dailyBurn,
      daysRemaining,
    },
    recent: recentRows,
  });
}
