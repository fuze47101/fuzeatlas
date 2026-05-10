// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed backfill: walk the existing relations and
 * upsert SupplyChainLink rows for each. Idempotent via the table's
 * five-tuple unique constraint (fromType, fromId, toType, toId,
 * relation) — re-running is safe.
 *
 * Each step wraps in try/catch and reports per-step results so a
 * failure on one source doesn't block the rest of the backfill.
 *
 * Auth: Bearer $CRON_SECRET. DELETE this file after backfill is run
 * and verified — it's a one-off.
 *
 * Usage:
 *   fzcron backfill-supply-chain-links
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StepResult {
  ok: boolean;
  rowsScanned: number;
  inserted: number;
  alreadyPresent: number;
  error?: string;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

async function insertEdges(
  edges: Array<{ fromType: string; fromId: string; toType: string; toId: string; relation: string }>,
): Promise<{ inserted: number; alreadyPresent: number }> {
  if (edges.length === 0) return { inserted: 0, alreadyPresent: 0 };
  // Deduplicate inside this batch first (the SQL queries can return
  // duplicate rows when a brand-factory pair has many fabrics).
  const seen = new Set<string>();
  const unique = edges.filter((e) => {
    const k = `${e.fromType}|${e.fromId}|${e.toType}|${e.toId}|${e.relation}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const res = await prisma.supplyChainLink.createMany({
    data: unique.map((e) => ({ ...e, active: true })),
    skipDuplicates: true,
  });
  return { inserted: res.count, alreadyPresent: unique.length - res.count };
}

async function step(
  fn: () => Promise<{ rowsScanned: number; inserted: number; alreadyPresent: number }>,
): Promise<StepResult> {
  try {
    const r = await fn();
    return { ok: true, ...r };
  } catch (e: any) {
    return { ok: false, rowsScanned: 0, inserted: 0, alreadyPresent: 0, error: e?.message || String(e) };
  }
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

  // 1) Fabric — factory supplies brand.
  const fabricsResult = await step(async () => {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT DISTINCT "brandId", "factoryId" FROM "Fabric"
       WHERE "brandId" IS NOT NULL AND "factoryId" IS NOT NULL`,
    )) as Array<{ brandId: string; factoryId: string }>;
    const dedup = await insertEdges(
      rows.map((r) => ({
        fromType: "FACTORY",
        fromId: r.factoryId,
        toType: "BRAND",
        toId: r.brandId,
        relation: "SUPPLIES",
      })),
    );
    return { rowsScanned: rows.length, ...dedup };
  });

  // 2) BrandFactory join.
  const bfResult = await step(async () => {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "brandId", "factoryId" FROM "BrandFactory"`,
    )) as Array<{ brandId: string; factoryId: string }>;
    const dedup = await insertEdges(
      rows.map((r) => ({
        fromType: "FACTORY",
        fromId: r.factoryId,
        toType: "BRAND",
        toId: r.brandId,
        relation: "SUPPLIES",
      })),
    );
    return { rowsScanned: rows.length, ...dedup };
  });

  // 3) FuzeOrder — distributor distributes-to factory.
  const ordersResult = await step(async () => {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT DISTINCT "distributorId", "factoryId" FROM "FuzeOrder"
       WHERE "distributorId" IS NOT NULL AND "factoryId" IS NOT NULL`,
    )) as Array<{ distributorId: string; factoryId: string }>;
    const dedup = await insertEdges(
      rows.map((r) => ({
        fromType: "DISTRIBUTOR",
        fromId: r.distributorId,
        toType: "FACTORY",
        toId: r.factoryId,
        relation: "DISTRIBUTES_TO",
      })),
    );
    return { rowsScanned: rows.length, ...dedup };
  });

  // 4) Factory.distributorId — default distributor.
  const factoryDistResult = await step(async () => {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id", "distributorId" FROM "Factory"
       WHERE "distributorId" IS NOT NULL`,
    )) as Array<{ id: string; distributorId: string }>;
    const dedup = await insertEdges(
      rows.map((r) => ({
        fromType: "DISTRIBUTOR",
        fromId: r.distributorId,
        toType: "FACTORY",
        toId: r.id,
        relation: "DISTRIBUTES_TO",
      })),
    );
    return { rowsScanned: rows.length, ...dedup };
  });

  // 5) TestRun.labId via submission.factoryId — lab tests-for factory.
  const labResult = await step(async () => {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT DISTINCT t."labId", s."factoryId"
       FROM "TestRun" t
       JOIN "FabricSubmission" s ON t."submissionId" = s."id"
       WHERE t."labId" IS NOT NULL AND s."factoryId" IS NOT NULL`,
    )) as Array<{ labId: string; factoryId: string }>;
    const dedup = await insertEdges(
      rows.map((r) => ({
        fromType: "LAB",
        fromId: r.labId,
        toType: "FACTORY",
        toId: r.factoryId,
        relation: "TESTS_FOR",
      })),
    );
    return { rowsScanned: rows.length, ...dedup };
  });

  // Total count after the run.
  let total = 0;
  try {
    total = await prisma.supplyChainLink.count();
  } catch {
    /* count failure shouldn't fail the response */
  }

  return NextResponse.json({
    ok:
      fabricsResult.ok &&
      bfResult.ok &&
      ordersResult.ok &&
      factoryDistResult.ok &&
      labResult.ok,
    results: {
      fabricsBrandFactory: fabricsResult,
      brandFactoryJoin: bfResult,
      fuzeOrderDistributorFactory: ordersResult,
      factoryDefaultDistributor: factoryDistResult,
      testRunLabFactory: labResult,
    },
    totalLinks: total,
  });
}
