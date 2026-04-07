// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/consumption
 * Dashboard data: factory orders, consumption, projected run-out, reorder triggers
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    const isFactory = ["FACTORY_USER", "FACTORY_MANAGER"].includes(user.role);

    if (!isInternal && !isFactory) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    // Factory users see only their factory
    const factoryFilter = isFactory && user.factoryId ? { factoryId: user.factoryId } : {};

    // Get all orders with factory info
    const orders = await prisma.fuzeOrder.findMany({
      where: factoryFilter,
      include: {
        factory: { select: { id: true, name: true, country: true } },
        distributor: { select: { id: true, name: true } },
        consumptions: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Get consumption records
    const consumptions = await prisma.fuzeConsumption.findMany({
      where: factoryFilter,
      include: {
        factory: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        fabric: { select: { id: true, fuzeNumber: true, customerCode: true } },
      },
      orderBy: { usageDate: "desc" },
      take: 200,
    });

    // Get sample trials for additional consumption data
    const trials = await prisma.sampleTrialRequest.findMany({
      where: {
        ...factoryFilter,
        status: { in: ["SAMPLE_SHIPPED", "SAMPLE_RECEIVED", "TRIAL_IN_PROGRESS", "COMPLETE"] },
      },
      select: {
        id: true,
        factoryId: true,
        factory: { select: { name: true } },
        sampleVolumeLiters: true,
        targetFuzeTier: true,
        status: true,
        sampleShippedDate: true,
        createdAt: true,
      },
    });

    // Get factories with annual projected usage from fabric specs
    const factories = await prisma.factory.findMany({
      where: isFactory && user.factoryId ? { id: user.factoryId } : { fuzeEnabled: true },
      select: {
        id: true,
        name: true,
        country: true,
        fuzeEnabled: true,
        fuzeApplications: true,
        fabrics: {
          select: {
            id: true,
            fuzeNumber: true,
            targetFuzeTier: true,
            annualFuzeLiters: true,
          },
          where: { annualFuzeLiters: { gt: 0 } },
        },
      },
    });

    // Calculate per-factory stats
    const factoryStats = factories.map((f) => {
      const factoryOrders = orders.filter((o) => o.factoryId === f.id);
      const factoryConsumptions = consumptions.filter((c) => c.factoryId === f.id);
      const factoryTrials = trials.filter((t) => t.factoryId === f.id);

      // Total ordered (delivered + in transit)
      const totalOrderedLiters = factoryOrders
        .filter((o) => ["DELIVERED", "SHIPPED", "CONFIRMED", "PROCESSING"].includes(o.status))
        .reduce((sum, o) => sum + (o.volumeLiters || 0), 0);

      // Total consumed
      const totalConsumedLiters = factoryConsumptions.reduce((sum, c) => sum + c.litersUsed, 0);

      // Trial volume shipped
      const trialLiters = factoryTrials.reduce((sum, t) => sum + (t.sampleVolumeLiters || 0), 0);

      // Remaining inventory (orders delivered minus consumed)
      const deliveredLiters = factoryOrders
        .filter((o) => o.status === "DELIVERED")
        .reduce((sum, o) => sum + (o.volumeLiters || 0), 0);
      const remainingLiters = deliveredLiters + trialLiters - totalConsumedLiters;

      // Projected annual demand from fabric specs
      const annualDemandLiters = f.fabrics.reduce(
        (sum, fab) => sum + (fab.annualFuzeLiters || 0),
        0
      );

      // Daily burn rate (consumption over last 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const recentConsumption = factoryConsumptions.filter(
        (c) => new Date(c.usageDate) > ninetyDaysAgo
      );
      const recentLiters = recentConsumption.reduce((sum, c) => sum + c.litersUsed, 0);
      const daysCovered = recentConsumption.length > 0
        ? Math.max(1, Math.ceil(
            (Date.now() - Math.min(...recentConsumption.map((c) => new Date(c.usageDate).getTime()))) /
              (24 * 60 * 60 * 1000)
          ))
        : 90;
      const dailyBurnRate = recentLiters / daysCovered;

      // Days until run-out
      const daysUntilRunOut = dailyBurnRate > 0 ? Math.floor(remainingLiters / dailyBurnRate) : null;

      // Reorder signal
      const reorderUrgency =
        daysUntilRunOut !== null && daysUntilRunOut <= 14
          ? "CRITICAL"
          : daysUntilRunOut !== null && daysUntilRunOut <= 30
          ? "WARNING"
          : daysUntilRunOut !== null && daysUntilRunOut <= 60
          ? "MONITOR"
          : "OK";

      return {
        factoryId: f.id,
        factoryName: f.name,
        country: f.country,
        fuzeEnabled: f.fuzeEnabled,
        applicationMethods: f.fuzeApplications,
        fabricCount: f.fabrics.length,
        totalOrderedLiters,
        totalConsumedLiters,
        trialLiters,
        remainingLiters: Math.max(0, remainingLiters),
        annualDemandLiters,
        dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
        daysUntilRunOut,
        reorderUrgency,
        lastOrderDate: factoryOrders[0]?.createdAt || null,
        activeOrders: factoryOrders.filter((o) =>
          ["CONFIRMED", "PROCESSING", "SHIPPED"].includes(o.status)
        ).length,
      };
    });

    // Summary stats
    const summary = {
      totalFactories: factories.length,
      activeFactories: factoryStats.filter((f) => f.totalConsumedLiters > 0 || f.totalOrderedLiters > 0).length,
      totalOrderedLiters: orders
        .filter((o) => o.status !== "CANCELLED")
        .reduce((sum, o) => sum + (o.volumeLiters || 0), 0),
      totalConsumedLiters: consumptions.reduce((sum, c) => sum + c.litersUsed, 0),
      pendingOrders: orders.filter((o) => ["DRAFT", "CONFIRMED", "PROCESSING"].includes(o.status)).length,
      criticalReorders: factoryStats.filter((f) => f.reorderUrgency === "CRITICAL").length,
      warningReorders: factoryStats.filter((f) => f.reorderUrgency === "WARNING").length,
      annualProjectedDemand: factoryStats.reduce((sum, f) => sum + f.annualDemandLiters, 0),
    };

    return NextResponse.json({
      ok: true,
      summary,
      factoryStats: factoryStats.sort((a, b) => {
        // Critical first, then warning, then by remaining liters ascending
        const urgencyOrder = { CRITICAL: 0, WARNING: 1, MONITOR: 2, OK: 3 };
        return (urgencyOrder[a.reorderUrgency] || 3) - (urgencyOrder[b.reorderUrgency] || 3);
      }),
      recentOrders: orders.slice(0, 20).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        factory: o.factory,
        volumeLiters: o.volumeLiters,
        bottles: o.bottles,
        status: o.status,
        totalPrice: o.totalPrice,
        shippedDate: o.shippedDate,
        deliveredDate: o.deliveredDate,
        createdAt: o.createdAt,
      })),
      recentConsumptions: consumptions.slice(0, 20).map((c) => ({
        id: c.id,
        factory: c.factory,
        brand: c.brand,
        fabric: c.fabric,
        litersUsed: c.litersUsed,
        metersProcessed: c.metersProcessed,
        applicationMethod: c.applicationMethod,
        fuzeTier: c.fuzeTier,
        usageDate: c.usageDate,
      })),
    });
  } catch (e: any) {
    console.error("Consumption dashboard error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load consumption data" }, { status: 500 });
  }
}

/**
 * POST /api/consumption
 * Create a new order or consumption record
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { type } = body; // "order" or "consumption"

    if (type === "order") {
      const { factoryId, volumeLiters, fuzeTier, bottles, pricePerLiter, distributorId, shippingAddress, notes } = body;

      if (!factoryId || !volumeLiters) {
        return NextResponse.json({ ok: false, error: "Factory and volume required" }, { status: 400 });
      }

      // Generate order number
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const count = await prisma.fuzeOrder.count({ where: { createdAt: { gte: new Date(now.toISOString().slice(0, 10)) } } });
      const orderNumber = `FUZE-ORD-${dateStr}-${String(count + 1).padStart(4, "0")}`;

      const order = await prisma.fuzeOrder.create({
        data: {
          orderNumber,
          factoryId,
          orderedById: user.id,
          volumeLiters: Number(volumeLiters),
          fuzeTier: fuzeTier || null,
          bottles: bottles ? Number(bottles) : Math.ceil(Number(volumeLiters) / 19),
          pricePerLiter: pricePerLiter ? Number(pricePerLiter) : 36,
          totalPrice: Number(volumeLiters) * (pricePerLiter ? Number(pricePerLiter) : 36),
          distributorId: distributorId || null,
          shippingAddress: shippingAddress || null,
          notes: notes || null,
          status: "CONFIRMED",
        },
      });

      return NextResponse.json({ ok: true, order });
    }

    if (type === "consumption") {
      const { factoryId, orderId, litersUsed, metersProcessed, applicationMethod, fuzeTier, brandId, fabricId, usageDate, notes } = body;

      if (!factoryId || !litersUsed) {
        return NextResponse.json({ ok: false, error: "Factory and liters used required" }, { status: 400 });
      }

      const consumption = await prisma.fuzeConsumption.create({
        data: {
          factoryId,
          orderId: orderId || null,
          litersUsed: Number(litersUsed),
          metersProcessed: metersProcessed ? Number(metersProcessed) : null,
          applicationMethod: applicationMethod || null,
          fuzeTier: fuzeTier || null,
          brandId: brandId || null,
          fabricId: fabricId || null,
          usageDate: usageDate ? new Date(usageDate) : new Date(),
          reportedById: user.id,
          notes: notes || null,
        },
      });

      return NextResponse.json({ ok: true, consumption });
    }

    return NextResponse.json({ ok: false, error: "Invalid type — must be 'order' or 'consumption'" }, { status: 400 });
  } catch (e: any) {
    console.error("Consumption POST error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to create record" }, { status: 500 });
  }
}
