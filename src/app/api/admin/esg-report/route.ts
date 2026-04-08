// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/esg-report?brandId=xxx&period=Q1-2026
 *
 * Generates Environmental Sustainability & Impact data for a brand.
 *
 * FUZE advantages over competitors (quantified):
 * - ZERO chemical binders required (competitors need 10-30g/L binder)
 * - ZERO curing energy (no heat treatment step — competitors need 150-180°C for 30-60s)
 * - 99.998% ultrapure DI water carrier (competitors use solvents, acids, harsh chemicals)
 * - Recycled electronics feedstock (circular economy)
 * - No additional wastewater treatment chemicals needed
 *
 * Benchmark data for competitive comparison:
 * - Typical antimicrobial binder usage: 15-30 g/L
 * - Typical curing step: 150-180°C, 30-60 seconds → ~0.5 kWh per meter of fabric
 * - Typical wastewater treatment additives: caustic soda, magnesium chloride, activated carbon
 */

// ─── Environmental Constants ───
const BINDER_ELIMINATED_PER_LITER = 20;       // grams of chemical binder NOT used per liter of FUZE (industry avg 15-30g/L)
const CURING_ENERGY_SAVED_PER_METER = 0.5;    // kWh saved per meter (no 150-180°C curing step)
const WASTEWATER_CHEMICALS_PER_LITER = 5;     // grams of wastewater treatment chemicals avoided per liter
const CO2_PER_KWH = 0.5;                      // kg CO2 per kWh (global avg grid emission factor)
const WATER_SAVED_PER_LITER = 2;              // liters of rinse water saved (no binder residue to rinse)
const LITERS_PER_METER_TYPICAL = 0.05;        // Typical FUZE consumption per meter of fabric (varies by method)

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    const isBrand = ["BRAND_USER", "BRAND_MANAGER"].includes(user.role);
    if (!isInternal && !isBrand) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const brandId = url.searchParams.get("brandId");
    const period = url.searchParams.get("period"); // e.g. "Q1-2026", "2025", "all"

    // If brand user, force their brand
    const targetBrandId = isBrand ? user.brandId : brandId;

    // ─── 1. Get brand info ───
    let brandFilter: any = {};
    let brandInfo: any = null;
    if (targetBrandId) {
      brandInfo = await prisma.brand.findUnique({
        where: { id: targetBrandId },
        select: { id: true, name: true, salesRepId: true, salesRep: { select: { name: true } } },
      });
      brandFilter = { brandId: targetBrandId };
    }

    // ─── 2. Date range from period ───
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    if (period && period !== "all") {
      const match = period.match(/^Q(\d)-(\d{4})$/);
      if (match) {
        const q = parseInt(match[1]);
        const y = parseInt(match[2]);
        dateFrom = new Date(y, (q - 1) * 3, 1);
        dateTo = new Date(y, q * 3, 0, 23, 59, 59);
      } else if (/^\d{4}$/.test(period)) {
        dateFrom = new Date(parseInt(period), 0, 1);
        dateTo = new Date(parseInt(period), 11, 31, 23, 59, 59);
      }
    }

    // ─── 3. Fetch orders for this brand ───
    const orderWhere: any = {
      status: "DELIVERED",
      ...brandFilter,
    };
    if (dateFrom && dateTo) {
      orderWhere.deliveredDate = { gte: dateFrom, lte: dateTo };
    }

    // Also check brand allocations for multi-brand orders
    const directOrders = await prisma.fuzeOrder.findMany({
      where: orderWhere,
      select: {
        id: true,
        volumeLiters: true,
        fuzeTier: true,
        deliveredDate: true,
        orderType: true,
        factory: { select: { name: true, country: true } },
        distributor: { select: { name: true, country: true } },
      },
    });

    // Orders via brand allocation (multi-brand orders)
    const allocationWhere: any = {};
    if (targetBrandId) allocationWhere.brandId = targetBrandId;
    if (dateFrom && dateTo) {
      allocationWhere.order = { deliveredDate: { gte: dateFrom, lte: dateTo }, status: "DELIVERED" };
    } else {
      allocationWhere.order = { status: "DELIVERED" };
    }

    const allocations = await prisma.orderBrandAllocation.findMany({
      where: allocationWhere,
      select: {
        allocatedLiters: true,
        allocatedPct: true,
        order: {
          select: {
            id: true,
            volumeLiters: true,
            fuzeTier: true,
            deliveredDate: true,
            factory: { select: { name: true, country: true } },
          },
        },
      },
    });

    // ─── 4. Calculate total volume attributed to this brand ───
    const directLiters = directOrders.reduce((sum, o) => sum + (o.volumeLiters || 0), 0);
    const allocatedLiters = allocations.reduce((sum, a) => {
      if (a.allocatedLiters) return sum + a.allocatedLiters;
      if (a.allocatedPct && a.order?.volumeLiters) return sum + (a.order.volumeLiters * a.allocatedPct / 100);
      return sum;
    }, 0);

    // Use the larger of direct or allocated (avoid double-counting)
    const totalLiters = Math.max(directLiters, allocatedLiters) || directLiters + allocatedLiters;

    // ─── 5. Fetch consumption data for meters processed ───
    const consumptionWhere: any = { ...brandFilter };
    if (dateFrom && dateTo) {
      consumptionWhere.usageDate = { gte: dateFrom, lte: dateTo };
    }
    const consumptions = await prisma.fuzeConsumption.findMany({
      where: consumptionWhere,
      select: {
        litersUsed: true,
        metersProcessed: true,
        applicationMethod: true,
        fuzeTier: true,
      },
    });

    const totalMeters = consumptions.reduce((sum, c) => sum + (c.metersProcessed || 0), 0);
    const estimatedMeters = totalMeters > 0 ? totalMeters : totalLiters / LITERS_PER_METER_TYPICAL;

    // ─── 6. Calculate Environmental Impact ───
    const impact = {
      // Chemical binders eliminated
      binderEliminatedGrams: totalLiters * BINDER_ELIMINATED_PER_LITER,
      binderEliminatedKg: (totalLiters * BINDER_ELIMINATED_PER_LITER) / 1000,

      // Curing energy saved
      curingEnergySavedKwh: estimatedMeters * CURING_ENERGY_SAVED_PER_METER,
      curingCO2AvoidedKg: estimatedMeters * CURING_ENERGY_SAVED_PER_METER * CO2_PER_KWH,

      // Wastewater chemicals avoided
      wastewaterChemicalsAvoidedGrams: totalLiters * WASTEWATER_CHEMICALS_PER_LITER,
      wastewaterChemicalsAvoidedKg: (totalLiters * WASTEWATER_CHEMICALS_PER_LITER) / 1000,

      // Water saved (no binder rinse)
      waterSavedLiters: totalLiters * WATER_SAVED_PER_LITER,

      // Total CO2 equivalent avoided
      totalCO2AvoidedKg: estimatedMeters * CURING_ENERGY_SAVED_PER_METER * CO2_PER_KWH,

      // Recycled electronics impact (FUZE metamaterial from recycled feedstock)
      recycledElectronicsNote: "FUZE metamaterial is produced via liquid laser ablation from recycled electronics, contributing to circular economy and e-waste reduction.",
    };

    // ─── 7. Factory breakdown ───
    const factoryMap: Record<string, { name: string; country: string; liters: number; orders: number }> = {};
    directOrders.forEach((o) => {
      const key = o.factory?.name || "Unknown";
      if (!factoryMap[key]) factoryMap[key] = { name: key, country: o.factory?.country || "", liters: 0, orders: 0 };
      factoryMap[key].liters += o.volumeLiters || 0;
      factoryMap[key].orders += 1;
    });

    // ─── 8. Method breakdown from consumption ───
    const methodMap: Record<string, { method: string; liters: number; meters: number }> = {};
    consumptions.forEach((c) => {
      const method = c.applicationMethod || "unspecified";
      if (!methodMap[method]) methodMap[method] = { method, liters: 0, meters: 0 };
      methodMap[method].liters += c.litersUsed || 0;
      methodMap[method].meters += c.metersProcessed || 0;
    });

    // ─── 9. Competitive comparison benchmarks ───
    const competitorBenchmarks = {
      traditionalAntimicrobial: {
        label: "Traditional Antimicrobials (Silver Chloride, Zinc Pyrithione, Quats)",
        binderRequired: "15-30 g/L chemical binder",
        curingRequired: "150-180°C for 30-60 seconds",
        wastewaterTreatment: "Caustic soda, magnesium chloride, activated carbon required",
        VOCs: "Solvent-based carriers produce VOCs during application",
        leaching: "Active ingredient leaches during laundering, reducing efficacy over time",
      },
      fuze: {
        label: "FUZE Metamaterial Treatment",
        binderRequired: "ZERO — no chemical binder needed",
        curingRequired: "ZERO — no heat curing step",
        wastewaterTreatment: "ZERO — 99.998% ultrapure DI water carrier, no treatment needed",
        VOCs: "ZERO — water-based carrier, no volatile organic compounds",
        leaching: "Metamaterial bonds to fiber without binder — superior wash durability",
      },
    };

    return NextResponse.json({
      ok: true,
      brand: brandInfo ? { id: brandInfo.id, name: brandInfo.name, accountManager: brandInfo.salesRep?.name } : null,
      period: period || "all",
      dateRange: dateFrom && dateTo ? { from: dateFrom.toISOString(), to: dateTo.toISOString() } : null,

      summary: {
        totalLitersDelivered: Math.round(totalLiters * 100) / 100,
        totalKgDelivered: Math.round(totalLiters * 100) / 100, // density ~1.0
        estimatedMetersProcessed: Math.round(estimatedMeters),
        totalOrders: directOrders.length,
        factoriesServed: Object.keys(factoryMap).length,
      },

      environmentalImpact: {
        binderEliminatedKg: Math.round(impact.binderEliminatedKg * 10) / 10,
        curingEnergySavedKwh: Math.round(impact.curingEnergySavedKwh),
        co2AvoidedKg: Math.round(impact.totalCO2AvoidedKg * 10) / 10,
        wastewaterChemicalsAvoidedKg: Math.round(impact.wastewaterChemicalsAvoidedKg * 10) / 10,
        waterSavedLiters: Math.round(impact.waterSavedLiters),
        recycledElectronicsNote: impact.recycledElectronicsNote,
      },

      factoryBreakdown: Object.values(factoryMap).sort((a, b) => b.liters - a.liters),
      methodBreakdown: Object.values(methodMap),
      competitorComparison: competitorBenchmarks,
    });
  } catch (e: any) {
    console.error("ESG report error:", e);
    return NextResponse.json({ ok: false, error: "Failed to generate ESG report" }, { status: 500 });
  }
}
