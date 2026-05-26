// @ts-nocheck
/**
 * Phase 18 schema bundle. Idempotent. Bearer-authed.
 *
 *   T1 — BrandFactoryAlias table (brandId, factoryId, csvName)
 *
 * Run with `fzcron migrate-18-bundle` after Vercel goes green.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const steps: { sql: string; ok: boolean; error?: string }[] = [];
  const run = async (label: string, sql: string) => {
    try {
      await prisma.$executeRawUnsafe(sql);
      steps.push({ sql: label, ok: true });
    } catch (e: any) {
      steps.push({ sql: label, ok: false, error: e?.message || String(e) });
    }
  };

  await run(
    "BrandFactoryAlias table",
    `CREATE TABLE IF NOT EXISTS "BrandFactoryAlias" (
       "id"         TEXT PRIMARY KEY,
       "brandId"    TEXT NOT NULL,
       "factoryId"  TEXT NOT NULL,
       "csvName"    TEXT NOT NULL,
       "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT "BrandFactoryAlias_brand_csv_unique" UNIQUE ("brandId","csvName")
     )`,
  );
  await run(
    "BrandFactoryAlias brand idx",
    `CREATE INDEX IF NOT EXISTS "BrandFactoryAlias_brandId_idx" ON "BrandFactoryAlias"("brandId")`,
  );
  await run(
    "BrandFactoryAlias factory idx",
    `CREATE INDEX IF NOT EXISTS "BrandFactoryAlias_factoryId_idx" ON "BrandFactoryAlias"("factoryId")`,
  );

  const failed = steps.filter((s) => !s.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    summary: `${steps.length - failed.length}/${steps.length} steps ok`,
    steps,
  });
}
