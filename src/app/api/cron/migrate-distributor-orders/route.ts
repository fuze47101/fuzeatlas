// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST/GET /api/cron/migrate-distributor-orders
 *
 * Distributor Portal Ordering — runtime schema migration. Adds three
 * nullable columns to FuzeOrder:
 *
 *   - poNumber                       text  — factory's PO when they
 *                                            approve a quote
 *   - poDocumentUrl                  text  — uploaded PO file URL
 *   - distributorTierIndexAtOrder    int   — snapshot of the tier the
 *                                            order was priced at, so
 *                                            later tier-ladder edits
 *                                            don't retroactively
 *                                            reprice historical orders
 *
 * Idempotent — every ALTER guards with `IF NOT EXISTS`. Safe to run
 * repeatedly.
 *
 * Run from Andrew's Mac:  fzcron migrate-distributor-orders
 */

const CRON_SECRET = process.env.CRON_SECRET;

const STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "FuzeOrder.poNumber",
    sql: `ALTER TABLE "FuzeOrder" ADD COLUMN IF NOT EXISTS "poNumber" TEXT;`,
  },
  {
    name: "FuzeOrder.poDocumentUrl",
    sql: `ALTER TABLE "FuzeOrder" ADD COLUMN IF NOT EXISTS "poDocumentUrl" TEXT;`,
  },
  {
    name: "FuzeOrder.distributorTierIndexAtOrder",
    sql: `ALTER TABLE "FuzeOrder" ADD COLUMN IF NOT EXISTS "distributorTierIndexAtOrder" INTEGER;`,
  },
  {
    name: "index FuzeOrder.poNumber",
    sql: `CREATE INDEX IF NOT EXISTS "FuzeOrder_poNumber_idx" ON "FuzeOrder"("poNumber");`,
  },
];

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results: any[] = [];
  try {
    for (const { name, sql } of STATEMENTS) {
      const t = Date.now();
      await prisma.$executeRawUnsafe(sql);
      results.push({ name, ok: true, ms: Date.now() - t });
    }
    return NextResponse.json({
      ok: true,
      verdict: `FuzeOrder distributor-order columns + index present (${results.length} statements applied).`,
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e), results },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
