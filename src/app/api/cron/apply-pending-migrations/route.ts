// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed endpoint to apply the two pending schema
 * migrations against whatever DATABASE_URL the Vercel runtime is
 * actually using. Bypasses the local DSN-detective rabbit hole that
 * the prisma db execute path got stuck in (Vercel keeps DATABASE_URL
 * as a Sensitive var, so we can't see it from CLI).
 *
 * All statements are idempotent (IF NOT EXISTS) so this can be run
 * multiple times safely.
 *
 * Auth: Bearer $CRON_SECRET (same pattern as /api/cron/feedback-list,
 * /api/cron/admin-resolve). Middleware exempts /api/cron/*.
 *
 * Usage:
 *   fzcron apply-pending-migrations
 *
 * After it returns ok, smoke-test with:
 *   fzcron test-cadence
 *
 * DELETE THIS FILE after the migrations land — it's a one-off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 20260509000000_brand_spec — five additive columns on Brand.
const BRAND_SPEC_STATEMENTS = [
  `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "requiredFuzeTier" TEXT`,
  `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "icpCadenceEveryNBatches" INTEGER`,
  `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "icpCadenceEveryLitersConsumed" DOUBLE PRECISION`,
  `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "protocolDocUrl" TEXT`,
  `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "brandSpecUpdatedAt" TIMESTAMP(3)`,
];

// 20260509010000_brand_pricing_tier — new table + index + FK.
const BRAND_PRICING_TIER_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "BrandPricingTier" (
     "id" TEXT NOT NULL,
     "brandId" TEXT NOT NULL,
     "thresholdLiters" DOUBLE PRECISION NOT NULL,
     "discountPct" DOUBLE PRECISION NOT NULL,
     "label" TEXT,
     "active" BOOLEAN NOT NULL DEFAULT true,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL,
     CONSTRAINT "BrandPricingTier_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX IF NOT EXISTS "BrandPricingTier_brandId_thresholdLiters_idx"
     ON "BrandPricingTier"("brandId", "thresholdLiters")`,
  // Add FK only if not already present. Wrapped in DO block since
  // ADD CONSTRAINT has no IF NOT EXISTS clause in Postgres.
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'BrandPricingTier_brandId_fkey'
     ) THEN
       ALTER TABLE "BrandPricingTier"
         ADD CONSTRAINT "BrandPricingTier_brandId_fkey"
         FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
];

async function runStatements(label: string, statements: string[]) {
  const results: any[] = [];
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      results.push({ migration: label, ok: true, statement: stmt.slice(0, 80).replace(/\s+/g, " ") });
    } catch (e: any) {
      results.push({
        migration: label,
        ok: false,
        error: e?.message || String(e),
        statement: stmt.slice(0, 80).replace(/\s+/g, " "),
      });
    }
  }
  return results;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const a = await runStatements("brand_spec", BRAND_SPEC_STATEMENTS);
  const b = await runStatements("brand_pricing_tier", BRAND_PRICING_TIER_STATEMENTS);
  const all = [...a, ...b];
  const failures = all.filter((r) => !r.ok);

  // Verify the new column actually exists now.
  let verifyBrandColumn: any = null;
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'Brand' AND column_name = 'icpCadenceEveryNBatches'`,
    );
    verifyBrandColumn = { exists: rows.length > 0, rowCount: rows.length };
  } catch (e: any) {
    verifyBrandColumn = { error: e?.message || String(e) };
  }
  let verifyPricingTable: any = null;
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('"BrandPricingTier"') AS exists`,
    );
    verifyPricingTable = { exists: rows[0]?.exists !== null };
  } catch (e: any) {
    verifyPricingTable = { error: e?.message || String(e) };
  }

  return NextResponse.json({
    ok: failures.length === 0,
    statementsRun: all.length,
    failures,
    results: all,
    verify: {
      brandIcpCadenceColumn: verifyBrandColumn,
      brandPricingTierTable: verifyPricingTable,
    },
  });
}
