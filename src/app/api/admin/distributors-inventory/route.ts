// @ts-nocheck
/**
 * GET /api/admin/distributors-inventory
 *
 * Single-screen inventory + burn-rate roll-up for every active
 * distributor. Built for the admin dashboard so Andrew can spot-check
 * "who's about to run out" without paging through individual cards.
 *
 * For each distributor: stockLiters, reorder point, last shipment in,
 * 90-day outbound, daily burn, days-of-stock-left, and a flag for
 * "low stock" (stock <= reorder point) or "no recent activity"
 * (no shipments in 90 days, possibly idle).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [distributors, lastDelivered, outboundAgg] = await Promise.all([
      prisma.distributor.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          country: true,
          city: true,
          localCurrency: true,
          fuzeRestockPricePerLiter: true,
          fuzeRestockCurrency: true,
          inventory: {
            select: {
              fuzeStockLiters: true,
              fuzeStockBottles: true,
              reorderPointLiters: true,
              lastStockUpdate: true,
            },
          },
          _count: { select: { factories: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.distributorRestockOrder.findMany({
        where: {
          status: { in: ["DELIVERED", "RECEIVED"] },
          deliveredDate: { not: null },
        },
        orderBy: { deliveredDate: "desc" },
        select: {
          distributorId: true,
          totalLiters: true,
          deliveredDate: true,
          orderNumber: true,
        },
      }),
      prisma.fuzeOrder.groupBy({
        by: ["distributorId"],
        where: {
          distributorId: { not: null },
          shippedDate: { gte: ninetyDaysAgo },
        },
        _sum: { volumeLiters: true },
        _count: { _all: true },
      }),
    ]);

    // Latest delivered per distributor
    const lastByDist: Record<string, any> = {};
    for (const r of lastDelivered) {
      if (r.distributorId && !lastByDist[r.distributorId]) {
        lastByDist[r.distributorId] = r;
      }
    }
    const outboundByDist: Record<string, { liters: number; orders: number }> = {};
    for (const r of outboundAgg) {
      if (r.distributorId) {
        outboundByDist[r.distributorId] = {
          liters: r._sum.volumeLiters || 0,
          orders: r._count?._all ?? 0,
        };
      }
    }

    const rows = distributors.map((d: any) => {
      const stockLiters = d.inventory?.fuzeStockLiters || 0;
      const reorderPoint = d.inventory?.reorderPointLiters || 0;
      const last = lastByDist[d.id];
      const outbound = outboundByDist[d.id] || { liters: 0, orders: 0 };
      const dailyBurn = outbound.liters / 90;
      const daysOfStockLeft =
        dailyBurn > 0 ? Math.round(stockLiters / dailyBurn) : null;
      const lowStock = stockLiters > 0 && stockLiters <= reorderPoint;
      const idle = outbound.orders === 0;
      const noPriceSet = !d.fuzeRestockPricePerLiter;
      const noFactories = d._count.factories === 0;

      return {
        id: d.id,
        name: d.name,
        country: d.country,
        city: d.city,
        factoryCount: d._count.factories,
        stockLiters,
        stockBottles: d.inventory?.fuzeStockBottles || 0,
        reorderPointLiters: reorderPoint,
        lowStock,
        idle,
        noPriceSet,
        noFactories,
        lastShipmentDate: last?.deliveredDate || null,
        lastShipmentLiters: last?.totalLiters || null,
        lastShipmentOrderNumber: last?.orderNumber || null,
        last90DaysOutbound: outbound.liters,
        last90DaysOrderCount: outbound.orders,
        dailyBurn: Math.round(dailyBurn * 10) / 10,
        daysOfStockLeft,
        fuzeRestockPricePerLiter: d.fuzeRestockPricePerLiter,
        fuzeRestockCurrency: d.fuzeRestockCurrency,
        inventoryUpdatedAt: d.inventory?.lastStockUpdate || null,
      };
    });

    // Sort: low-stock first, then idle, then by days-of-stock-left ascending
    rows.sort((a: any, b: any) => {
      if (a.lowStock !== b.lowStock) return a.lowStock ? -1 : 1;
      if (a.idle !== b.idle) return a.idle ? -1 : 1;
      const aDays = a.daysOfStockLeft ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysOfStockLeft ?? Number.POSITIVE_INFINITY;
      return aDays - bDays;
    });

    return NextResponse.json({
      ok: true,
      distributors: rows,
      summary: {
        total: rows.length,
        lowStock: rows.filter((r) => r.lowStock).length,
        idle: rows.filter((r) => r.idle).length,
        noPriceSet: rows.filter((r) => r.noPriceSet).length,
        noFactories: rows.filter((r) => r.noFactories).length,
        totalStockLiters: rows.reduce((s, r) => s + r.stockLiters, 0),
        totalDailyBurn:
          Math.round(rows.reduce((s, r) => s + r.dailyBurn, 0) * 10) / 10,
      },
    });
  } catch (e: any) {
    console.error("Admin distributors-inventory error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
