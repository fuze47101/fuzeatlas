// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/worldwide-inventory
 * Master control dashboard: worldwide inventory totals, distributor breakdown,
 * weekly consumption, shipment source tracking.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    // ─── 1. Distributor inventory breakdown ───
    const distributors = await prisma.distributor.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        country: true,
        region: true,
        city: true,
        inventory: {
          select: {
            fuzeStockLiters: true,
            fuzeStockBottles: true,
            hangtagStock: true,
            reorderPointLiters: true,
            lastStockUpdate: true,
          },
        },
      },
    });

    const distributorBreakdown = distributors.map((d) => {
      const inv = d.inventory;
      const stockLiters = inv?.fuzeStockLiters || 0;
      const stockKg = stockLiters * 1.0; // FUZE density ~1.0 kg/L (water-based solution)
      const bottles = inv?.fuzeStockBottles || 0;
      const belowThreshold = inv?.reorderPointLiters ? stockLiters < inv.reorderPointLiters : false;

      return {
        distributorId: d.id,
        name: d.name,
        country: d.country || "Unknown",
        region: d.region || null,
        city: d.city || null,
        location: [d.city, d.country].filter(Boolean).join(", ") || "Unknown",
        stockLiters,
        stockKg: Math.round(stockKg * 100) / 100,
        bottles,
        hangtagStock: inv?.hangtagStock || 0,
        reorderThreshold: inv?.reorderPointLiters || null,
        belowThreshold,
        lastUpdated: inv?.lastStockUpdate || null,
      };
    });

    // ─── 2. Worldwide totals ───
    const totalLiters = distributorBreakdown.reduce((sum, d) => sum + d.stockLiters, 0);
    const totalKg = distributorBreakdown.reduce((sum, d) => sum + d.stockKg, 0);
    const totalBottles = distributorBreakdown.reduce((sum, d) => sum + d.bottles, 0);
    const totalHangtags = distributorBreakdown.reduce((sum, d) => sum + d.hangtagStock, 0);
    const locationsWithStock = distributorBreakdown.filter((d) => d.stockLiters > 0).length;
    const lowStockLocations = distributorBreakdown.filter((d) => d.belowThreshold).length;

    // ─── 3. Weekly consumption from delivered orders (last 12 weeks) ───
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const deliveredOrders = await prisma.fuzeOrder.findMany({
      where: {
        status: "DELIVERED",
        deliveredDate: { gte: twelveWeeksAgo },
      },
      select: {
        id: true,
        orderNumber: true,
        volumeLiters: true,
        bottles: true,
        orderType: true,
        deliveredDate: true,
        shippedDate: true,
        fulfillmentSource: true,
        distributorId: true,
        distributor: { select: { id: true, name: true, country: true } },
        factory: { select: { id: true, name: true, country: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { deliveredDate: "desc" },
    });

    // Group by ISO week
    const weeklyConsumption: Record<string, {
      weekLabel: string;
      weekStart: string;
      totalLiters: number;
      totalKg: number;
      orderCount: number;
      bySource: Record<string, { name: string; liters: number; orders: number }>;
    }> = {};

    deliveredOrders.forEach((order) => {
      const delivered = order.deliveredDate ? new Date(order.deliveredDate) : new Date(order.shippedDate || Date.now());
      const weekStart = getWeekStart(delivered);
      const weekKey = weekStart.toISOString().slice(0, 10);
      const weekLabel = formatWeekLabel(weekStart);

      if (!weeklyConsumption[weekKey]) {
        weeklyConsumption[weekKey] = {
          weekLabel,
          weekStart: weekKey,
          totalLiters: 0,
          totalKg: 0,
          orderCount: 0,
          bySource: {},
        };
      }

      const vol = order.volumeLiters || 0;
      weeklyConsumption[weekKey].totalLiters += vol;
      weeklyConsumption[weekKey].totalKg += vol * 1.0;
      weeklyConsumption[weekKey].orderCount += 1;

      // Track by fulfillment source
      const sourceId = order.distributorId || "DIRECT_USA";
      const sourceName = order.distributor?.name || "Direct (USA)";
      if (!weeklyConsumption[weekKey].bySource[sourceId]) {
        weeklyConsumption[weekKey].bySource[sourceId] = { name: sourceName, liters: 0, orders: 0 };
      }
      weeklyConsumption[weekKey].bySource[sourceId].liters += vol;
      weeklyConsumption[weekKey].bySource[sourceId].orders += 1;
    });

    // Sort weeks chronologically
    const weeklyData = Object.values(weeklyConsumption)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((w) => ({
        ...w,
        totalLiters: Math.round(w.totalLiters * 100) / 100,
        totalKg: Math.round(w.totalKg * 100) / 100,
        bySource: Object.values(w.bySource).map((s) => ({
          ...s,
          liters: Math.round(s.liters * 100) / 100,
        })),
      }));

    // ─── 4. Shipment source summary (all time) ───
    const allShippedOrders = await prisma.fuzeOrder.findMany({
      where: {
        status: { in: ["SHIPPED", "DELIVERED"] },
      },
      select: {
        volumeLiters: true,
        fulfillmentSource: true,
        distributorId: true,
        distributor: { select: { name: true, country: true } },
      },
    });

    const shipmentSources: Record<string, { name: string; country: string; totalLiters: number; orderCount: number }> = {};
    allShippedOrders.forEach((o) => {
      const key = o.distributorId || "DIRECT_USA";
      if (!shipmentSources[key]) {
        shipmentSources[key] = {
          name: o.distributor?.name || "Direct (Salt Lake City, USA)",
          country: o.distributor?.country || "USA",
          totalLiters: 0,
          orderCount: 0,
        };
      }
      shipmentSources[key].totalLiters += o.volumeLiters || 0;
      shipmentSources[key].orderCount += 1;
    });

    // ─── 5. In-transit orders (reducing inventory soon) ───
    const inTransitOrders = await prisma.fuzeOrder.findMany({
      where: { status: { in: ["PROCESSING", "SHIPPED"] } },
      select: {
        orderNumber: true,
        volumeLiters: true,
        bottles: true,
        status: true,
        carrier: true,
        trackingNumber: true,
        distributor: { select: { name: true, country: true } },
        factory: { select: { name: true, country: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const inTransitLiters = inTransitOrders.reduce((sum, o) => sum + (o.volumeLiters || 0), 0);

    return NextResponse.json({
      ok: true,
      worldwide: {
        totalLiters: Math.round(totalLiters * 100) / 100,
        totalKg: Math.round(totalKg * 100) / 100,
        totalBottles,
        totalHangtags,
        distributorCount: distributors.length,
        locationsWithStock,
        lowStockLocations,
        inTransitLiters: Math.round(inTransitLiters * 100) / 100,
      },
      distributors: distributorBreakdown.sort((a, b) => b.stockLiters - a.stockLiters),
      weeklyConsumption: weeklyData,
      shipmentSources: Object.values(shipmentSources)
        .map((s) => ({
          ...s,
          totalLiters: Math.round(s.totalLiters * 100) / 100,
        }))
        .sort((a, b) => b.totalLiters - a.totalLiters),
      inTransit: inTransitOrders,
    });
  } catch (e: any) {
    console.error("Worldwide inventory error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load worldwide inventory" }, { status: 500 });
  }
}

// ─── Helpers ───

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(weekStart)} - ${fmt(end)}`;
}
