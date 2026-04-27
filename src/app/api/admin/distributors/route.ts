// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/distributors
 * Returns all distributors with full details, inventory, pricing, factory counts, order stats.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const distributors = await prisma.distributor.findMany({
      include: {
        inventory: true,
        pricing: { take: 5, orderBy: { createdAt: "desc" } },
        factories: { select: { id: true, name: true, country: true } },
        contacts: { select: { id: true, name: true, email: true, phone: true, title: true } },
        users: { select: { id: true, name: true, email: true, role: true, status: true } },
        _count: {
          select: {
            fuzeOrders: true,
            invoices: true,
            documents: true,
            factories: true,
          },
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    // Get order volume stats per distributor
    const orderStats = await prisma.fuzeOrder.groupBy({
      by: ["distributorId"],
      where: { distributorId: { not: null } },
      _sum: { volumeLiters: true, totalPrice: true },
      _count: true,
    });

    const statsMap: Record<string, { totalLiters: number; totalRevenue: number; orderCount: number }> = {};
    for (const s of orderStats) {
      if (s.distributorId) {
        statsMap[s.distributorId] = {
          totalLiters: s._sum.volumeLiters || 0,
          totalRevenue: s._sum.totalPrice || 0,
          orderCount: s._count,
        };
      }
    }

    const result = distributors.map((d) => {
      const stats = statsMap[d.id] || { totalLiters: 0, totalRevenue: 0, orderCount: 0 };
      let coverageCountries: string[] = [];
      try {
        coverageCountries = d.coverageCountries ? JSON.parse(d.coverageCountries) : [];
      } catch { coverageCountries = []; }

      return {
        id: d.id,
        name: d.name,
        chineseName: d.chineseName,
        specialty: d.specialty,
        country: d.country,
        region: d.region,
        city: d.city,
        address: d.address,
        email: d.email,
        phone: d.phone,
        website: d.website,
        status: d.status,
        active: d.active,
        coverageCountries,
        localCurrency: d.localCurrency,
        notes: d.notes,
        // FUZE wholesale pricing — used by the restock-from-FUZE flow.
        fuzeRestockPricePerLiter: d.fuzeRestockPricePerLiter,
        fuzeRestockCurrency: d.fuzeRestockCurrency,
        fuzeRestockNotes: d.fuzeRestockNotes,
        // Inventory
        stockLiters: d.inventory?.fuzeStockLiters || 0,
        stockKg: (d.inventory?.fuzeStockLiters || 0) * 0.03,
        stockBottles: d.inventory?.fuzeStockBottles || 0,
        reorderThresholdLiters: d.inventory?.reorderPointLiters || 0,
        lowStock: (d.inventory?.fuzeStockLiters || 0) <= (d.inventory?.reorderPointLiters || 0),
        // Counts
        factoryCount: d._count.factories,
        orderCount: d._count.fuzeOrders,
        invoiceCount: d._count.invoices,
        documentCount: d._count.documents,
        // Order stats
        totalLitersShipped: Math.round(stats.totalLiters * 100) / 100,
        totalRevenue: Math.round(stats.totalRevenue * 100) / 100,
        // Relations
        factories: d.factories.slice(0, 10),
        contacts: d.contacts,
        users: d.users,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      };
    });

    const active = result.filter((d) => d.active);
    const inactive = result.filter((d) => !d.active);

    return NextResponse.json({
      ok: true,
      distributors: result,
      summary: {
        total: result.length,
        active: active.length,
        inactive: inactive.length,
        lowStock: result.filter((d) => d.lowStock && d.active).length,
        totalStockLiters: Math.round(active.reduce((s, d) => s + d.stockLiters, 0) * 100) / 100,
        totalRevenue: Math.round(result.reduce((s, d) => s + d.totalRevenue, 0) * 100) / 100,
      },
    });
  } catch (e: any) {
    console.error("Admin distributors error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load distributors" }, { status: 500 });
  }
}
