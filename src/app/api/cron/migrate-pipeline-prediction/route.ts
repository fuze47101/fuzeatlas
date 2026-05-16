// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST/GET /api/cron/migrate-pipeline-prediction
 *
 * MB-4 runtime schema migration. Adds three nullable columns to
 * Brand:
 *   - predictedValueUSD        float   — predicted $ value
 *   - predictedValueComputedAt ts      — last cron stamp
 *   - predictedValueFactors    jsonb   — { vertical, baseAnnualL,
 *                                          engagementMult, relevanceMult,
 *                                          stage, stageProbability, ... }
 *
 * Idempotent. Run from Andrew's Mac: fzcron migrate-pipeline-prediction
 */

const CRON_SECRET = process.env.CRON_SECRET;

const STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "Brand.predictedValueUSD",
    sql: `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "predictedValueUSD" DOUBLE PRECISION;`,
  },
  {
    name: "Brand.predictedValueComputedAt",
    sql: `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "predictedValueComputedAt" TIMESTAMP(3);`,
  },
  {
    name: "Brand.predictedValueFactors",
    sql: `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "predictedValueFactors" JSONB;`,
  },
  {
    name: "index Brand.predictedValueUSD (ranking sort)",
    sql: `CREATE INDEX IF NOT EXISTS "Brand_predictedValueUSD_idx" ON "Brand"("predictedValueUSD" DESC);`,
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
      verdict: `Brand pipeline-prediction columns + index present (${results.length} statements applied).`,
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
