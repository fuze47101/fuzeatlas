// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/orders-dashboard
 *
 * Bird's-eye view of the entire FUZE order pipeline for admins.
 * Combines:
 *   - FuzeOrder (factory orders flowing through distributors)
 *   - DistributorRestockOrder (distributors restocking from FUZE HQ)
 *   - FuzeConsumption (actual FUZE used on fabric)
 *   - DistributorInventory (stock on hand globally)
 *
 * Returns:
 *   - Top-line KPIs (active orders, L shipped this week/month, pending $, pipeline value)
 *   - Orders by status (for the status strip)
 *   - Weekly volume trend (last 8 weeks)
 *   - Top factories by volume
 *   - Top brands by allocated liters
 *   - Open orders requiring action
 *   - Low-stock distributors
 *   - Recent lifecycle events
 */

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

    // ── TOP-LINE KPIs ──
    const [
      totalActiveOrders,
      pendingApprovalCount,
      shippedThisWeek,
      shippedThisMonth,
      consumedThisMonth,
      openPipelineValue,
      totalDistributorStock,
      distributorRestockOpen,
    ] = await Promise.all([
      prisma.fuzeOrder.count({
        where: { status: { in: ["QUOTED", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "SHIPPED"] } },
      }),
      prisma.fuzeOrder.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.fuzeOrder.aggregate({
        where: { shippedDate: { gte: weekAgo } },
        _sum: { volumeLiters: true },
        _count: true,
      }),
      prisma.fuzeOrder.aggregate({
        where: { shippedDate: { gte: monthAgo } },
        _sum: { volumeLiters: true, totalPrice: true },
        _count: true,
      }),
      prisma.fuzeConsumption.aggregate({
        where: { usageDate: { gte: monthAgo } },
        _sum: { litersUsed: true, metersProcessed: true },
      }),
      prisma.fuzeOrder.aggregate({
        where: { status: { in: ["QUOTED", "PENDING_APPROVAL", "APPROVED", "PROCESSING"] } },
        _sum: { totalPrice: true, volumeLiters: true },
      }),
      prisma.distributorInventory.aggregate({ _sum: { fuzeStockLiters: true } }),
      prisma.distributorRestockOrder.count({
        where: { status: { notIn: ["RECEIVED", "CANCELLED"] } },
      }),
    ]);

    // ── ORDERS BY STATUS (for strip) ──
    const byStatus = await prisma.fuzeOrder.groupBy({
      by: ["status"],
      _count: true,
      _sum: { volumeLiters: true },
    });

    // ── WEEKLY VOLUME TREND (last 8 weeks shipped) ──
    const recentShipped = await prisma.fuzeOrder.findMany({
      where: { shippedDate: { gte: eightWeeksAgo } },
      select: { shippedDate: true, volumeLiters: true, totalPrice: true },
    });

    const weekly: Record<string, { liters: number; value: number; orders: number }> = {};
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      const key = weekStart.toISOString().slice(0, 10);
      weekly[key] = { liters: 0, value: 0, orders: 0 };
    }
    const weekKeys = Object.keys(weekly).sort();
    for (const o of recentShipped) {
      if (!o.shippedDate) continue;
      const d = new Date(o.shippedDate);
      // Find the week bucket this shipment falls into
      let bucket = weekKeys[0];
      for (const wk of weekKeys) {
        if (new Date(wk) <= d) bucket = wk;
      }
      weekly[bucket].liters += o.volumeLiters || 0;
      weekly[bucket].value += o.totalPrice || 0;
      weekly[bucket].orders += 1;
    }
    const weeklyTrend = Object.entries(weekly).map(([date, v]) => ({
      date,
      liters: Math.round(v.liters),
      value: Math.round(v.value),
      orders: v.orders,
    }));

    // ── TOP FACTORIES (last 90 days) ──
    const ninetyAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const topFactoriesRaw = await prisma.fuzeOrder.groupBy({
      by: ["factoryId"],
      where: { createdAt: { gte: ninetyAgo }, status: { not: "CANCELLED" } },
      _sum: { volumeLiters: true, totalPrice: true },
      _count: true,
      orderBy: { _sum: { volumeLiters: "desc" } },
      take: 10,
    });
    const factoryIds = topFactoriesRaw.map((f) => f.factoryId);
    const factories = await prisma.factory.findMany({
      where: { id: { in: factoryIds } },
      select: { id: true, name: true, country: true },
    });
    const factoryMap = new Map(factories.map((f) => [f.id, f]));
    const topFactories = topFactoriesRaw.map((f) => ({
      id: f.factoryId,
      name: factoryMap.get(f.factoryId)?.name || "?",
      country: factoryMap.get(f.factoryId)?.country || "",
      liters: Math.round(f._sum.volumeLiters || 0),
      value: Math.round(f._sum.totalPrice || 0),
      orders: f._count,
    }));

    // ── TOP BRANDS (via OrderBrandAllocation) ──
    const topBrandsRaw = await prisma.orderBrandAllocation.groupBy({
      by: ["brandId"],
      where: { order: { createdAt: { gte: ninetyAgo }, status: { not: "CANCELLED" } } },
      _sum: { allocatedLiters: true },
      _count: true,
      orderBy: { _sum: { allocatedLiters: "desc" } },
      take: 10,
    });
    const brandIds = topBrandsRaw.map((b) => b.brandId);
    const brands = await prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, name: true },
    });
    const brandMap = new Map(brands.map((b) => [b.id, b]));
    const topBrands = topBrandsRaw.map((b) => ({
      id: b.brandId,
      name: brandMap.get(b.brandId)?.name || "?",
      liters: Math.round(b._sum.allocatedLiters || 0),
      orders: b._count,
    }));

    // ── OPEN ORDERS REQUIRING ATTENTION ──
    const actionable = await prisma.fuzeOrder.findMany({
      where: {
        status: { in: ["PENDING_APPROVAL", "QUOTED", "APPROVED", "PROCESSING"] },
      },
      include: {
        factory: { select: { id: true, name: true, country: true } },
        distributor: { select: { name: true } },
        brand: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 15,
    });

    // ── LOW-STOCK DISTRIBUTORS ──
    const inventories = await prisma.distributorInventory.findMany({
      include: { distributor: { select: { id: true, name: true, country: true, active: true } } },
    });
    const lowStock = inventories
      .filter((i) => i.distributor?.active && i.reorderPointLiters && i.fuzeStockLiters < i.reorderPointLiters)
      .map((i) => ({
        distributorId: i.distributorId,
        name: i.distributor?.name,
        country: i.distributor?.country,
        stockLiters: i.fuzeStockLiters || 0,
        reorderAt: i.reorderPointLiters || 0,
        deficit: (i.reorderPointLiters || 0) - (i.fuzeStockLiters || 0),
      }))
      .sort((a, b) => b.deficit - a.deficit);

    // ── RECENT LIFECYCLE EVENTS ──
    const recentEvents = await prisma.orderLifecycleEvent.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            orderNumber: true,
            factory: { select: { name: true } },
          },
        },
      },
    });

    // ── DISTRIBUTOR RESTOCK IN FLIGHT ──
    const restockInFlight = await prisma.distributorRestockOrder.findMany({
      where: { status: { notIn: ["RECEIVED", "CANCELLED"] } },
      include: { distributor: { select: { name: true, country: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      ok: true,
      kpis: {
        totalActiveOrders,
        pendingApprovalCount,
        shippedThisWeek: {
          count: shippedThisWeek._count,
          liters: Math.round(shippedThisWeek._sum.volumeLiters || 0),
        },
        shippedThisMonth: {
          count: shippedThisMonth._count,
          liters: Math.round(shippedThisMonth._sum.volumeLiters || 0),
          value: Math.round(shippedThisMonth._sum.totalPrice || 0),
        },
        consumedThisMonth: {
          liters: Math.round(consumedThisMonth._sum.litersUsed || 0),
          meters: Math.round(consumedThisMonth._sum.metersProcessed || 0),
        },
        openPipeline: {
          value: Math.round(openPipelineValue._sum.totalPrice || 0),
          liters: Math.round(openPipelineValue._sum.volumeLiters || 0),
        },
        totalDistributorStock: Math.round(totalDistributorStock._sum.fuzeStockLiters || 0),
        distributorRestockOpen,
      },
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
        liters: Math.round(s._sum.volumeLiters || 0),
      })),
      weeklyTrend,
      topFactories,
      topBrands,
      actionable,
      lowStock,
      recentEvents,
      restockInFlight,
    });
  } catch (e: any) {
    console.error("Orders dashboard error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
