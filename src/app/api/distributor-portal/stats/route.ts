// @ts-nocheck
/**
 * GET /api/distributor-portal/stats
 *
 * Powers the distributor portal homepage. Returns:
 *
 *   INVENTORY (Tina's #P1 review — operations view, not the old
 *              CFO/invoices view)
 *     - stockLiters         · liters currently in their warehouse
 *                             (DistributorInventory.fuzeStockLiters)
 *     - stockBottles        · count of 19L carboys equivalent
 *     - reorderPointLiters  · admin-set low-water mark
 *     - lastShipmentDate    · when the last DistributorRestockOrder was DELIVERED
 *     - lastShipmentLiters  · volume on that last shipment
 *     - last90DaysOutbound  · liters shipped TO factories from this dist in 90d
 *     - daysOfStockLeft     · projected runout based on rolling 90-day burn
 *     - lowStock            · stockLiters <= reorderPointLiters
 *
 *   PORTFOLIO
 *     - activeFactories     · count of Factory rows linked to this dist
 *
 *   FINANCE (kept from earlier shape so the old card row still works)
 *     - totalInvoices, unpaidInvoices, outstandingAmount, totalDocuments
 *
 * Internal users (admin/employee) can pass ?distributorId=... to view
 * any distributor's stats — useful for the upcoming admin all-distributors
 * inventory dashboard.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(
      user.role,
    );
    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const distributorId = isDistributor
      ? user.distributorId
      : url.searchParams.get("distributorId");

    if (!distributorId) {
      return NextResponse.json(
        { ok: false, error: "No distributor linked to this account" },
        { status: 400 },
      );
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [
      distributor,
      inventory,
      lastDelivered,
      outboundAgg,
      totalInvoices,
      unpaidInvoices,
      outstandingResult,
      totalDocuments,
      activeFactories,
    ] = await Promise.all([
      prisma.distributor.findUnique({
        where: { id: distributorId },
        select: {
          id: true,
          name: true,
          country: true,
          fuzeRestockPricePerLiter: true,
          fuzeRestockCurrency: true,
        },
      }),
      prisma.distributorInventory.findFirst({
        where: { distributorId },
        select: {
          fuzeStockLiters: true,
          fuzeStockBottles: true,
          reorderPointLiters: true,
          updatedAt: true,
        },
      }),
      prisma.distributorRestockOrder.findFirst({
        where: { distributorId, status: { in: ["DELIVERED", "RECEIVED"] } },
        orderBy: { deliveredDate: "desc" },
        select: {
          id: true,
          orderNumber: true,
          totalLiters: true,
          deliveredDate: true,
          status: true,
        },
      }),
      // Liters shipped FROM this dist TO factories in last 90 days. We
      // join FuzeOrder via distributorId — these are the orders the dist
      // fulfilled, which is what burns down inventory.
      prisma.fuzeOrder.aggregate({
        where: {
          distributorId,
          shippedDate: { gte: ninetyDaysAgo },
        },
        _sum: { volumeLiters: true },
      }),
      prisma.invoice.count({ where: { distributorId } }),
      prisma.invoice.count({
        where: { distributorId, status: { in: ["SENT", "OVERDUE"] } },
      }),
      prisma.invoice.aggregate({
        where: {
          distributorId,
          status: { in: ["SENT", "OVERDUE"] },
        },
        _sum: { amount: true },
      }),
      prisma.distributorDocument.count({ where: { distributorId } }),
      prisma.factory.count({ where: { distributorId } }),
    ]);

    const stockLiters = inventory?.fuzeStockLiters || 0;
    const stockBottles = inventory?.fuzeStockBottles || 0;
    const reorderPointLiters = inventory?.reorderPointLiters || 0;
    const lowStock = stockLiters > 0 && stockLiters <= reorderPointLiters;
    const last90DaysOutbound = outboundAgg._sum.volumeLiters || 0;

    // Projected days of stock left, using rolling 90-day burn rate.
    // If burn rate is zero (new dist or quiet period), report null
    // rather than Infinity — UI shows "no recent shipments yet" instead
    // of a misleading "runs out in 99,999 days".
    const dailyBurn = last90DaysOutbound / 90;
    const daysOfStockLeft =
      dailyBurn > 0 ? Math.round(stockLiters / dailyBurn) : null;

    return NextResponse.json({
      ok: true,
      distributor,
      stats: {
        // ─── New inventory view ──────────────────────
        stockLiters,
        stockBottles,
        reorderPointLiters,
        lowStock,
        lastShipmentDate: lastDelivered?.deliveredDate || null,
        lastShipmentLiters: lastDelivered?.totalLiters || null,
        lastShipmentOrderNumber: lastDelivered?.orderNumber || null,
        last90DaysOutbound,
        dailyBurn: Math.round(dailyBurn * 10) / 10,
        daysOfStockLeft,
        inventoryUpdatedAt: inventory?.updatedAt || null,
        activeFactories,
        // ─── Legacy CFO view (kept for compatibility) ──
        totalInvoices,
        unpaidInvoices,
        outstandingAmount: outstandingResult._sum.amount || 0,
        totalDocuments,
      },
    });
  } catch (e: any) {
    console.error("Distributor stats error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
