// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const DISTRIBUTORS = [
  {
    name: "Harris & Menuk",
    country: "India",
    region: "South Asia",
    city: "Mumbai",
    coverageCountries: JSON.stringify(["India", "Bangladesh", "Sri Lanka"]),
    localCurrency: "INR",
    specialty: "Textile chemicals distribution — South Asian subcontinent",
    status: "ACTIVE",
    active: true,
  },
  {
    name: "SRS",
    country: "UAE",
    region: "Middle East",
    city: "Dubai",
    coverageCountries: JSON.stringify(["UAE", "Saudi Arabia", "Oman", "Qatar", "Bahrain", "Kuwait"]),
    localCurrency: "AED",
    specialty: "Textile chemicals — Middle East hub",
    status: "ACTIVE",
    active: true,
  },
  {
    name: "SRS-Turkey",
    country: "Turkey",
    region: "Europe",
    city: "Istanbul",
    coverageCountries: JSON.stringify(["Turkey", "Germany", "Italy", "Portugal", "Spain", "UK", "France"]),
    localCurrency: "EUR",
    specialty: "Textile chemicals — European distribution",
    status: "ACTIVE",
    active: true,
  },
  {
    name: "Mercado Global",
    country: "Mexico",
    region: "Latin America",
    city: "Mexico City",
    coverageCountries: JSON.stringify(["Mexico", "Guatemala", "Honduras", "El Salvador", "Colombia", "Peru", "Brazil", "Chile", "Argentina"]),
    localCurrency: "USD",
    specialty: "Textile chemicals — Central and South America",
    status: "ACTIVE",
    active: true,
  },
  {
    name: "Global Shine",
    country: "Taiwan",
    region: "East Asia",
    city: "Taipei",
    coverageCountries: JSON.stringify(["Taiwan"]),
    localCurrency: "TWD",
    specialty: "Textile chemicals — Taiwan market",
    status: "ACTIVE",
    active: true,
  },
  {
    name: "Texwell",
    country: "China",
    region: "East Asia",
    city: "Shanghai",
    coverageCountries: JSON.stringify(["China"]),
    localCurrency: "CNY",
    specialty: "Textile chemicals — China distribution",
    status: "ACTIVE",
    active: true,
  },
  {
    name: "Hi-Goal",
    country: "China",
    region: "East Asia",
    city: "Guangzhou",
    coverageCountries: JSON.stringify(["China"]),
    localCurrency: "CNY",
    specialty: "Textile chemicals — China distribution (new partner)",
    status: "ONBOARDING",
    active: true,
  },
];

// Default pricing: $36/L USD base, adjusted per region
const REGIONAL_PRICING: Record<string, { pricePerLiter: number; currency: string; hangtagPricePerUnit: number; leadTimeDays: number }> = {
  "Harris & Menuk": { pricePerLiter: 36, currency: "USD", hangtagPricePerUnit: 0.12, leadTimeDays: 5 },
  "SRS":            { pricePerLiter: 36, currency: "USD", hangtagPricePerUnit: 0.15, leadTimeDays: 3 },
  "SRS-Turkey":     { pricePerLiter: 38, currency: "USD", hangtagPricePerUnit: 0.15, leadTimeDays: 5 },
  "Mercado Global": { pricePerLiter: 36, currency: "USD", hangtagPricePerUnit: 0.12, leadTimeDays: 7 },
  "Global Shine":   { pricePerLiter: 36, currency: "USD", hangtagPricePerUnit: 0.12, leadTimeDays: 4 },
  "Texwell":        { pricePerLiter: 36, currency: "USD", hangtagPricePerUnit: 0.10, leadTimeDays: 3 },
  "Hi-Goal":        { pricePerLiter: 36, currency: "USD", hangtagPricePerUnit: 0.10, leadTimeDays: 3 },
};

// Default starting inventory per distributor (liters) — adjust as needed
const STARTING_INVENTORY: Record<string, { liters: number; bottles: number; hangtags: number; reorderPoint: number }> = {
  "Harris & Menuk": { liters: 380, bottles: 20, hangtags: 5000, reorderPoint: 190 },
  "SRS":            { liters: 380, bottles: 20, hangtags: 3000, reorderPoint: 190 },
  "SRS-Turkey":     { liters: 190, bottles: 10, hangtags: 2000, reorderPoint: 95 },
  "Mercado Global": { liters: 190, bottles: 10, hangtags: 2000, reorderPoint: 95 },
  "Global Shine":   { liters: 190, bottles: 10, hangtags: 2000, reorderPoint: 95 },
  "Texwell":        { liters: 380, bottles: 20, hangtags: 5000, reorderPoint: 190 },
  "Hi-Goal":        { liters: 0,   bottles: 0,  hangtags: 0,    reorderPoint: 95 },
};

/**
 * POST /api/admin/seed-distributors
 * Seeds all FUZE distributors with inventory and default pricing.
 * Admin only. Idempotent — skips existing distributors by name.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const results: any[] = [];

    for (const dist of DISTRIBUTORS) {
      // Check if already exists
      const existing = await prisma.distributor.findFirst({
        where: { name: dist.name },
      });

      let distributor;
      if (existing) {
        // Update existing with new fields
        distributor = await prisma.distributor.update({
          where: { id: existing.id },
          data: {
            country: dist.country,
            region: dist.region,
            city: dist.city,
            coverageCountries: dist.coverageCountries,
            localCurrency: dist.localCurrency,
            specialty: dist.specialty,
            status: dist.status,
            active: dist.active,
          },
        });
        results.push({ name: dist.name, action: "UPDATED", id: distributor.id });
      } else {
        // Create new
        distributor = await prisma.distributor.create({
          data: {
            name: dist.name,
            country: dist.country,
            region: dist.region,
            city: dist.city,
            coverageCountries: dist.coverageCountries,
            localCurrency: dist.localCurrency,
            specialty: dist.specialty,
            agentForFuze: "Yes",
            status: dist.status,
            active: dist.active,
          },
        });
        results.push({ name: dist.name, action: "CREATED", id: distributor.id });
      }

      // Upsert inventory
      const inv = STARTING_INVENTORY[dist.name];
      if (inv) {
        await prisma.distributorInventory.upsert({
          where: { distributorId: distributor.id },
          create: {
            distributorId: distributor.id,
            fuzeStockLiters: inv.liters,
            fuzeStockBottles: inv.bottles,
            hangtagStock: inv.hangtags,
            reorderPointLiters: inv.reorderPoint,
            lastStockUpdate: new Date(),
          },
          update: {
            // Only update reorder point — don't overwrite real inventory data
            reorderPointLiters: inv.reorderPoint,
          },
        });
      }

      // Upsert default pricing
      const pricing = REGIONAL_PRICING[dist.name];
      if (pricing) {
        const existingPricing = await prisma.distributorPricing.findFirst({
          where: { distributorId: distributor.id, isDefault: true },
        });
        if (!existingPricing) {
          await prisma.distributorPricing.create({
            data: {
              distributorId: distributor.id,
              pricePerLiter: pricing.pricePerLiter,
              currency: pricing.currency,
              hangtagPricePerUnit: pricing.hangtagPricePerUnit,
              leadTimeDays: pricing.leadTimeDays,
              isDefault: true,
              active: true,
              volumeDiscounts: JSON.stringify([
                { minLiters: 190, discountPct: 0 },
                { minLiters: 570, discountPct: 5 },
                { minLiters: 1900, discountPct: 10 },
                { minLiters: 3800, discountPct: 15 },
              ]),
            },
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Seeded ${results.length} distributors with inventory and pricing`,
      results,
    });
  } catch (e: any) {
    console.error("Seed distributors error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to seed" }, { status: 500 });
  }
}
