// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed backfill: walk the existing relations and
 * upsert SupplyChainLink rows for each. Idempotent via the table's
 * five-tuple unique constraint (fromType, fromId, toType, toId,
 * relation) — re-running is safe.
 *
 * Backfill rules (Phase 4A spec):
 *   - Every Fabric.brandId + Fabric.factoryId pair (active fabrics)
 *     →  fromType=FACTORY, toType=BRAND, relation=SUPPLIES
 *   - Every BrandFactory join row
 *     →  fromType=FACTORY, toType=BRAND, relation=SUPPLIES
 *     (BrandFactory captures explicit brand-factory designation; some
 *      pairs there have no Fabric yet and would be missed otherwise.)
 *   - Every active FuzeOrder.factoryId + FuzeOrder.distributorId
 *     →  fromType=DISTRIBUTOR, toType=FACTORY, relation=DISTRIBUTES_TO
 *   - Every Factory.distributorId (default distributor)
 *     →  fromType=DISTRIBUTOR, toType=FACTORY, relation=DISTRIBUTES_TO
 *   - Every TestRun.labId joined to a submission with factoryId set
 *     →  fromType=LAB, toType=FACTORY, relation=TESTS_FOR
 *
 * Returns counts of links created vs already-present per category.
 *
 * Auth: Bearer $CRON_SECRET. DELETE this file after backfill is run
 * and verified — it's a one-off.
 *
 * Usage:
 *   fzcron backfill-supply-chain-links
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

interface PairCount {
  inserted: number;
  alreadyPresent: number;
}

async function upsertLink(
  fromType: string,
  fromId: string,
  toType: string,
  toId: string,
  relation: string,
): Promise<"inserted" | "alreadyPresent"> {
  // Use createMany with skipDuplicates for the unique constraint —
  // returns count, so we know whether it was a no-op.
  const res = await prisma.supplyChainLink.createMany({
    data: [{ fromType, fromId, toType, toId, relation, active: true }],
    skipDuplicates: true,
  });
  return res.count > 0 ? "inserted" : "alreadyPresent";
}

async function tally<T>(
  rows: T[],
  toLink: (row: T) => { fromType: string; fromId: string; toType: string; toId: string; relation: string } | null,
): Promise<PairCount> {
  const out: PairCount = { inserted: 0, alreadyPresent: 0 };
  for (const row of rows) {
    const link = toLink(row);
    if (!link) continue;
    const status = await upsertLink(link.fromType, link.fromId, link.toType, link.toId, link.relation);
    out[status]++;
  }
  return out;
}

export async function GET(req: Request) {
  return runBackfill(req);
}
export async function POST(req: Request) {
  return runBackfill(req);
}

async function runBackfill(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== process.env.CRON_SECRET) return unauthorized();

  // 1) Fabric → BRAND ← SUPPLIES → FACTORY (factory supplies brand).
  // Take only fabrics with both ids set.
  const fabricPairs = await prisma.fabric.findMany({
    where: {
      brandId: { not: null },
      factoryId: { not: null },
    },
    select: { brandId: true, factoryId: true },
    distinct: ["brandId", "factoryId"],
  });
  const fabricResult = await tally(fabricPairs, (r: any) => ({
    fromType: "FACTORY",
    fromId: r.factoryId!,
    toType: "BRAND",
    toId: r.brandId!,
    relation: "SUPPLIES",
  }));

  // 2) BrandFactory join rows (the existing CRM-side mapping). Some
  // brand-factory pairs are designated here without any Fabric yet.
  const bfPairs = await prisma.brandFactory.findMany({
    select: { brandId: true, factoryId: true },
  });
  const bfResult = await tally(bfPairs, (r: any) => ({
    fromType: "FACTORY",
    fromId: r.factoryId,
    toType: "BRAND",
    toId: r.brandId,
    relation: "SUPPLIES",
  }));

  // 3) FuzeOrder.distributorId + factoryId pairs — distributor
  // distributes-to factory.
  const orderPairs = await prisma.fuzeOrder.findMany({
    where: {
      distributorId: { not: null },
      factoryId: { not: null },
    },
    select: { distributorId: true, factoryId: true },
    distinct: ["distributorId", "factoryId"],
  });
  const orderResult = await tally(orderPairs, (r: any) => ({
    fromType: "DISTRIBUTOR",
    fromId: r.distributorId!,
    toType: "FACTORY",
    toId: r.factoryId!,
    relation: "DISTRIBUTES_TO",
  }));

  // 4) Factory.distributorId — the default-distributor relationship
  // (factories that haven't ordered yet but are tied to a distributor
  // by setup).
  const factoryDistPairs = await prisma.factory.findMany({
    where: { distributorId: { not: null } },
    select: { id: true, distributorId: true },
  });
  const factoryDistResult = await tally(factoryDistPairs, (r: any) => ({
    fromType: "DISTRIBUTOR",
    fromId: r.distributorId!,
    toType: "FACTORY",
    toId: r.id,
    relation: "DISTRIBUTES_TO",
  }));

  // 5) TestRun.labId joined via submission.factoryId — lab tests-for
  // factory. We use a raw groupBy to keep the result set small.
  const labFactoryPairs = (await prisma.$queryRawUnsafe(`
    SELECT DISTINCT t."labId", s."factoryId"
    FROM "TestRun" t
    JOIN "FabricSubmission" s ON t."submissionId" = s."id"
    WHERE t."labId" IS NOT NULL AND s."factoryId" IS NOT NULL
  `)) as Array<{ labId: string; factoryId: string }>;
  const labResult = await tally(labFactoryPairs, (r) => ({
    fromType: "LAB",
    fromId: r.labId,
    toType: "FACTORY",
    toId: r.factoryId,
    relation: "TESTS_FOR",
  }));

  // Total count after the run
  const total = await prisma.supplyChainLink.count();

  return NextResponse.json({
    ok: true,
    results: {
      fabricsBrandFactory: fabricResult,
      brandFactoryJoin: bfResult,
      fuzeOrderDistributorFactory: orderResult,
      factoryDefaultDistributor: factoryDistResult,
      testRunLabFactory: labResult,
    },
    totalLinks: total,
  });
}
