// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeBrandEsg } from "@/lib/esg-math";

/**
 * GET /api/brand-portal/esg-snapshot
 *
 * NICE-6 — drives the 3-stat ESG strip on /brand-portal:
 *   - Total FUZE liters used across this brand's supply chain
 *   - kg fabric treated (sums metersProcessed, falls back to GSM
 *     estimate via esg-math)
 *   - kg CO₂e avoided vs PFAS alternative
 *
 * Aggregates FuzeConsumption rows where brandId == caller's brand.
 * For best kg estimate the consumption rows are joined to Fabric so
 * we can use weightGsm × meters when both exist.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.brandId) {
    return NextResponse.json({ ok: false, error: "Not a brand user" }, { status: 403 });
  }

  const brand = await prisma.brand.findUnique({
    where: { id: user.brandId },
    select: { id: true, name: true },
  });
  if (!brand) {
    return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
  }

  // Aggregate FuzeConsumption for this brand. Pull fabric weightGsm
  // alongside so we can compute kg with the best signal available.
  const rows = await prisma.fuzeConsumption.findMany({
    where: { brandId: brand.id },
    select: {
      litersUsed: true,
      metersProcessed: true,
      fabric: { select: { weightGsm: true } },
    },
  });

  let totalLitersUsed = 0;
  let totalMetersProcessed = 0;
  let totalKgFromFabricWeights = 0;
  let rowsWithFabricWeight = 0;

  for (const r of rows) {
    totalLitersUsed += r.litersUsed || 0;
    const meters = r.metersProcessed || 0;
    totalMetersProcessed += meters;
    if (r.fabric?.weightGsm && meters > 0) {
      // gsm × meters = grams (assumes ~1m wide standard)
      totalKgFromFabricWeights += (r.fabric.weightGsm * meters) / 1000;
      rowsWithFabricWeight++;
    }
  }

  const stats = computeBrandEsg({
    totalLitersUsed,
    totalMetersProcessed,
    totalKgFromFabricWeights,
  });

  return NextResponse.json({
    ok: true,
    brand: { id: brand.id, name: brand.name },
    stats: {
      ...stats,
      consumptionRowCount: rows.length,
      rowsWithFabricWeight,
    },
  });
}
