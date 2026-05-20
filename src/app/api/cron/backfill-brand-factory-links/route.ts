// @ts-nocheck
/**
 * POST /api/cron/backfill-brand-factory-links
 *
 * The Factories tile + "No factory linked" suggested-next-move card both
 * read from junction tables (BrandFactory + SupplyChainLink) that nobody
 * has been populating. The per-fabric Fabric.factoryId column is the de-
 * facto source of truth, but the tile + suggestion engine don't know
 * that. Result: SanMar shows "1 Factory" + "No factory linked" warning
 * even though 9 distinct factories are reachable through its fabrics.
 *
 * This endpoint walks every fabric, computes (brandId, factoryId) pairs,
 * and upserts both BrandFactory and SupplyChainLink rows for any pair
 * that doesn't have them yet. Idempotent — re-running is safe.
 *
 * Optional ?brandId= scopes the backfill to one brand for testing.
 *
 * Run: curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *      https://fuzeatlas.com/api/cron/backfill-brand-factory-links
 *
 * Or scoped:
 *      ...?brandId=cmm5e21b304lxo8tr8801tmmu   (SanMar)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scopedBrandId = url.searchParams.get("brandId") || undefined;

  const log: string[] = [];

  // 1. Pull every (brandId, factoryId) pair that exists via Fabric.
  const fabricPairs = await prisma.fabric.findMany({
    where: {
      brandId: scopedBrandId ? scopedBrandId : { not: null },
      factoryId: { not: null },
    },
    select: { brandId: true, factoryId: true },
    distinct: ["brandId", "factoryId"],
  });

  log.push(`✓ Found ${fabricPairs.length} distinct (brand, factory) pairs from fabrics${scopedBrandId ? ` (scoped to brand ${scopedBrandId})` : ""}`);

  let bfCreated = 0;
  let bfSkipped = 0;
  let sclCreated = 0;
  let sclSkipped = 0;

  for (const { brandId, factoryId } of fabricPairs) {
    if (!brandId || !factoryId) continue;

    // 2. Upsert BrandFactory row (drives the Factories tile count).
    try {
      const existing = await prisma.brandFactory.findUnique({
        where: { brandId_factoryId: { brandId, factoryId } },
        select: { id: true },
      });
      if (existing) {
        bfSkipped++;
      } else {
        await prisma.brandFactory.create({
          data: { brandId, factoryId, note: "Backfilled from Fabric.factoryId" },
        });
        bfCreated++;
      }
    } catch (e: any) {
      log.push(`⚠ BrandFactory upsert failed for ${brandId} → ${factoryId}: ${e?.message}`);
    }

    // 3. Upsert SupplyChainLink row (drives the no-supply-chain warning).
    try {
      const existing = await prisma.supplyChainLink.findUnique({
        where: {
          supply_chain_link_unique: {
            fromType: "BRAND",
            fromId: brandId,
            toType: "FACTORY",
            toId: factoryId,
            relation: "SUPPLIES",
          },
        },
        select: { id: true },
      });
      if (existing) {
        sclSkipped++;
      } else {
        await prisma.supplyChainLink.create({
          data: {
            fromType: "BRAND",
            fromId: brandId,
            toType: "FACTORY",
            toId: factoryId,
            relation: "SUPPLIES",
            active: true,
            notes: "Backfilled from Fabric.factoryId",
          },
        });
        sclCreated++;
      }
    } catch (e: any) {
      log.push(`⚠ SupplyChainLink upsert failed for ${brandId} → ${factoryId}: ${e?.message}`);
    }
  }

  log.push(`✓ BrandFactory: ${bfCreated} created, ${bfSkipped} already existed`);
  log.push(`✓ SupplyChainLink: ${sclCreated} created, ${sclSkipped} already existed`);

  return NextResponse.json({
    ok: true,
    summary: {
      pairsConsidered: fabricPairs.length,
      brandFactoryCreated: bfCreated,
      brandFactorySkipped: bfSkipped,
      supplyChainLinkCreated: sclCreated,
      supplyChainLinkSkipped: sclSkipped,
      scopedBrandId: scopedBrandId || null,
    },
    log,
  });
}
