// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/cleanup-distributors
 *
 * 1. Deactivates all distributors that are NOT in the real distributor list
 * 2. Updates the real distributors with proper region/coverage/currency data
 * 3. Creates any missing distributors (Mercado Global, SRS-Turkey, Texwell, Hi-Goal)
 * 4. Runs the seed (inventory + pricing) for all real distributors
 *
 * Run from browser console:
 * fetch('/api/admin/cleanup-distributors', { method: 'POST' }).then(r=>r.json()).then(console.log)
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    // ─── Real distributor definitions ───
    const realDistributors = [
      {
        name: "Harris & Menuk",
        region: "South Asia",
        country: "India",
        city: "Mumbai",
        coverageCountries: JSON.stringify(["India", "Bangladesh", "Sri Lanka", "Pakistan"]),
        localCurrency: "INR",
        email: null,
        stockLiters: 380,
        reorderThreshold: 100,
      },
      {
        name: "SRS",
        region: "Middle East",
        country: "UAE",
        city: "Dubai",
        coverageCountries: JSON.stringify(["UAE", "Saudi Arabia", "Oman", "Qatar", "Bahrain", "Kuwait"]),
        localCurrency: "AED",
        email: null,
        stockLiters: 380,
        reorderThreshold: 100,
      },
      {
        name: "SRS-Turkey",
        region: "Europe",
        country: "Turkey",
        city: "Istanbul",
        coverageCountries: JSON.stringify(["Turkey", "Germany", "Italy", "Portugal", "Spain", "Poland", "Romania", "Bulgaria"]),
        localCurrency: "EUR",
        email: null,
        stockLiters: 190,
        reorderThreshold: 50,
      },
      {
        name: "Mercado Global",
        region: "Latin America",
        country: "Mexico",
        city: null,
        coverageCountries: JSON.stringify(["Mexico", "Guatemala", "Honduras", "El Salvador", "Colombia", "Peru", "Brazil", "Argentina", "Chile"]),
        localCurrency: "USD",
        email: null,
        stockLiters: 190,
        reorderThreshold: 50,
      },
      {
        name: "Global Shine Trading Co., Ltd",
        region: "East Asia",
        country: "Taiwan",
        city: "Taipei",
        coverageCountries: JSON.stringify(["Taiwan", "Vietnam", "Philippines"]),
        localCurrency: "TWD",
        email: null,
        stockLiters: 380,
        reorderThreshold: 100,
      },
      {
        name: "Texwell",
        region: "East Asia",
        country: "China",
        city: null,
        coverageCountries: JSON.stringify(["China"]),
        localCurrency: "CNY",
        email: null,
        stockLiters: 380,
        reorderThreshold: 100,
      },
      {
        name: "Hi-Goal",
        region: "East Asia",
        country: "China",
        city: null,
        coverageCountries: JSON.stringify(["China"]),
        localCurrency: "CNY",
        notes: "New distributor — onboarding",
        stockLiters: 0,
        reorderThreshold: 50,
      },
    ];

    const realNames = realDistributors.map(d => d.name);
    const log: string[] = [];

    // ─── Step 1: Deactivate all non-real distributors ───
    const allDistributors = await prisma.distributor.findMany({ select: { id: true, name: true, active: true, status: true } });

    for (const dist of allDistributors) {
      const isReal = realNames.some(rn => dist.name.toLowerCase().includes(rn.toLowerCase()) || rn.toLowerCase().includes(dist.name.toLowerCase()));
      if (!isReal) {
        await prisma.distributor.update({
          where: { id: dist.id },
          data: { active: false, status: "INACTIVE", notes: "Deactivated during cleanup — not a real distributor. May be a prospect/chemical supplier." },
        });
        log.push(`DEACTIVATED: ${dist.name} (${dist.id})`);
      }
    }

    // ─── Step 2: Upsert real distributors ───
    for (const rd of realDistributors) {
      // Try to find existing by name (case-insensitive partial match)
      let existing = allDistributors.find(d =>
        d.name.toLowerCase().includes(rd.name.toLowerCase()) ||
        rd.name.toLowerCase().includes(d.name.toLowerCase())
      );

      let distributorId: string;

      if (existing) {
        // Update existing
        await prisma.distributor.update({
          where: { id: existing.id },
          data: {
            region: rd.region,
            country: rd.country,
            city: rd.city,
            coverageCountries: rd.coverageCountries,
            localCurrency: rd.localCurrency,
            active: true,
            status: rd.name === "Hi-Goal" ? "ONBOARDING" : "ACTIVE",
            notes: rd.notes || null,
          },
        });
        distributorId = existing.id;
        log.push(`UPDATED: ${rd.name} (${existing.id})`);
      } else {
        // Create new
        const created = await prisma.distributor.create({
          data: {
            name: rd.name,
            region: rd.region,
            country: rd.country,
            city: rd.city,
            coverageCountries: rd.coverageCountries,
            localCurrency: rd.localCurrency,
            active: true,
            status: rd.name === "Hi-Goal" ? "ONBOARDING" : "ACTIVE",
            notes: rd.notes || null,
          },
        });
        distributorId = created.id;
        log.push(`CREATED: ${rd.name} (${created.id})`);
      }

      // ─── Upsert inventory ───
      const existingInv = await prisma.distributorInventory.findUnique({
        where: { distributorId },
      });

      const stockKg = rd.stockLiters * 0.03;  // 30 mg/L = 0.03 kg/L
      const stockBottles = Math.floor(rd.stockLiters / 19);

      if (existingInv) {
        await prisma.distributorInventory.update({
          where: { distributorId },
          data: {
            reorderPointLiters: rd.reorderThreshold,
            // Only set stock if it was 0 (don't overwrite real data)
            ...(existingInv.fuzeStockLiters === 0
              ? { fuzeStockLiters: rd.stockLiters, fuzeStockBottles: stockBottles }
              : {}),
          },
        });
        log.push(`  inventory updated for ${rd.name}`);
      } else {
        await prisma.distributorInventory.create({
          data: {
            distributorId,
            fuzeStockLiters: rd.stockLiters,
            fuzeStockBottles: stockBottles,
            reorderPointLiters: rd.reorderThreshold,
          },
        });
        log.push(`  inventory created for ${rd.name}`);
      }

      // ─── Upsert default pricing ───
      const existingPricing = await prisma.distributorPricing.findFirst({
        where: { distributorId, isDefault: true },
      });

      if (!existingPricing) {
        await prisma.distributorPricing.create({
          data: {
            distributorId,
            pricePerLiter: 36.0,
            currency: "USD",
            isDefault: true,
            volumeDiscounts: JSON.stringify([
              { minLiters: 100, discountPct: 5 },
              { minLiters: 500, discountPct: 10 },
              { minLiters: 1000, discountPct: 15 },
            ]),
          },
        });
        log.push(`  default pricing created for ${rd.name}`);
      }
    }

    // ─── Summary ───
    const finalActive = await prisma.distributor.count({ where: { active: true } });
    const finalInactive = await prisma.distributor.count({ where: { active: false } });

    return NextResponse.json({
      ok: true,
      summary: {
        activeDistributors: finalActive,
        inactiveDistributors: finalInactive,
        actions: log.length,
      },
      log,
    });
  } catch (e: any) {
    console.error("Cleanup distributors error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Cleanup failed" }, { status: 500 });
  }
}
