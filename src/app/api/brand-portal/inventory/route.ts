// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/brand-portal/inventory  (Phase 4F — DO+OVERSEE)
 *
 * Per-factory FUZE on-hand for the caller's brand's supply chain.
 * Reads SupplyChainLink (FACTORY-SUPPLIES-BRAND) to find the factory
 * set, then for each factory rolls up:
 *   ordersTotalLiters    — SUM(FuzeOrder.volumeLiters) for this brand
 *                          + factory, statuses APPROVED+PROCESSING+
 *                          SHIPPED+DELIVERED.
 *   consumedTotalLiters  — SUM(FuzeConsumption.litersUsed) for this
 *                          brand + factory.
 *   onHandLiters         — ordersTotalLiters − consumedTotalLiters
 *                          (best-effort estimate; factories may also
 *                          consume on other brands' programs from
 *                          shared stock — surfaced as a caveat).
 *   lastConsumptionAt    — most-recent usage timestamp for context.
 *
 * Brand DO surface: nothing direct (consumption is logged factory-
 * side). Brand OVERSEE: stock visibility per supplying factory.
 */

const RECEIVED_STATUSES = ["APPROVED", "PROCESSING", "SHIPPED", "DELIVERED"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!user.brandId) return forbidden();

  const brandId = user.brandId;

  // Resolve factory set via SupplyChainLink first; fall back to the
  // legacy fabric-based join when no links exist.
  const links = await prisma.supplyChainLink.findMany({
    where: {
      toType: "BRAND",
      toId: brandId,
      fromType: "FACTORY",
      relation: "SUPPLIES",
      active: true,
    },
    select: { fromId: true },
  });

  const factories =
    links.length > 0
      ? await prisma.factory.findMany({
          where: { id: { in: links.map((l: any) => l.fromId) } },
          select: { id: true, name: true, country: true, city: true },
          orderBy: { name: "asc" },
        })
      : await prisma.factory.findMany({
          where: { fabrics: { some: { brandId } } },
          select: { id: true, name: true, country: true, city: true },
          orderBy: { name: "asc" },
        });

  const rows = await Promise.all(
    factories.map(async (f: any) => {
      const [ordersAgg, consumptionAgg, lastUsage] = await Promise.all([
        prisma.fuzeOrder.aggregate({
          where: {
            factoryId: f.id,
            status: { in: RECEIVED_STATUSES },
            OR: [
              { brandId },
              { brandAllocations: { some: { brandId } } },
            ],
          },
          _sum: { volumeLiters: true },
        }),
        prisma.fuzeConsumption.aggregate({
          where: { brandId, factoryId: f.id },
          _sum: { litersUsed: true },
        }),
        prisma.fuzeConsumption.findFirst({
          where: { brandId, factoryId: f.id },
          orderBy: { usageDate: "desc" },
          select: { usageDate: true, litersUsed: true, fuzeTier: true },
        }),
      ]);

      const ordersTotal = ordersAgg._sum.volumeLiters || 0;
      const consumedTotal = consumptionAgg._sum.litersUsed || 0;
      const onHand = Math.max(0, ordersTotal - consumedTotal);

      return {
        factoryId: f.id,
        factoryName: f.name,
        country: f.country,
        city: f.city,
        ordersTotalLiters: ordersTotal,
        consumedTotalLiters: consumedTotal,
        onHandLiters: onHand,
        lastConsumptionAt: lastUsage?.usageDate || null,
        lastConsumptionTier: lastUsage?.fuzeTier || null,
      };
    }),
  );

  rows.sort((a, b) => b.onHandLiters - a.onHandLiters);

  const totals = {
    factories: rows.length,
    ordersTotalLiters: rows.reduce((s, r) => s + r.ordersTotalLiters, 0),
    consumedTotalLiters: rows.reduce((s, r) => s + r.consumedTotalLiters, 0),
    onHandLiters: rows.reduce((s, r) => s + r.onHandLiters, 0),
  };

  return NextResponse.json({ ok: true, totals, factories: rows });
}
