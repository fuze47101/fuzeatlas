// @ts-nocheck
/**
 * Bearer-authed runtime migration — Phase 12 schema bundle.
 *
 * Adds:
 *   - BrandProfile.publicEnabled (12A)
 *   - HangtagQR table (12B)
 *   - BrandEsgSnapshot table (12C)
 *   - PressKitItem table (12E)
 *   - PublicPageView table (12G)
 *
 * Idempotent.
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

  // 12A — BrandProfile.publicEnabled
  await run(
    "BrandProfile.publicEnabled",
    `ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "publicEnabled" BOOLEAN NOT NULL DEFAULT false`,
  );

  // 12B — HangtagQR
  await run(
    "HangtagQR table",
    `CREATE TABLE IF NOT EXISTS "HangtagQR" (
       "id"             TEXT PRIMARY KEY,
       "token"          TEXT NOT NULL UNIQUE,
       "brandId"        TEXT NOT NULL,
       "fabricId"       TEXT,
       "productSku"     TEXT,
       "batchCode"      TEXT,
       "printedAt"      TIMESTAMP(3),
       "scannedCount"   INTEGER NOT NULL DEFAULT 0,
       "firstScannedAt" TIMESTAMP(3),
       "lastScannedAt"  TIMESTAMP(3),
       "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "HangtagQR brand FK",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HangtagQR_brandId_fkey') THEN
         ALTER TABLE "HangtagQR"
           ADD CONSTRAINT "HangtagQR_brandId_fkey"
           FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$;`,
  );
  await run(
    "HangtagQR fabric FK",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HangtagQR_fabricId_fkey') THEN
         ALTER TABLE "HangtagQR"
           ADD CONSTRAINT "HangtagQR_fabricId_fkey"
           FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE SET NULL ON UPDATE CASCADE;
       END IF;
     END $$;`,
  );
  await run(
    "HangtagQR brand idx",
    `CREATE INDEX IF NOT EXISTS "HangtagQR_brandId_idx" ON "HangtagQR"("brandId")`,
  );
  await run(
    "HangtagQR fabric idx",
    `CREATE INDEX IF NOT EXISTS "HangtagQR_fabricId_idx" ON "HangtagQR"("fabricId")`,
  );

  // 12C — BrandEsgSnapshot
  await run(
    "BrandEsgSnapshot table",
    `CREATE TABLE IF NOT EXISTS "BrandEsgSnapshot" (
       "id"                  TEXT PRIMARY KEY,
       "brandId"             TEXT NOT NULL,
       "period"              TEXT NOT NULL,
       "periodStart"         TIMESTAMP(3) NOT NULL,
       "periodEnd"           TIMESTAMP(3) NOT NULL,
       "fabricsCertified"    INTEGER NOT NULL,
       "testsRunCount"       INTEGER NOT NULL,
       "testsPassedCount"    INTEGER NOT NULL,
       "fuzeConsumedLiters"  DOUBLE PRECISION NOT NULL,
       "factoryCountActive"  INTEGER NOT NULL,
       "zeroPfasFabricCount" INTEGER NOT NULL,
       "publicPdfUrl"        TEXT,
       "generatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "publishedAt"         TIMESTAMP(3)
     )`,
  );
  await run(
    "BrandEsgSnapshot brand FK",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BrandEsgSnapshot_brandId_fkey') THEN
         ALTER TABLE "BrandEsgSnapshot"
           ADD CONSTRAINT "BrandEsgSnapshot_brandId_fkey"
           FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$;`,
  );
  await run(
    "BrandEsgSnapshot unique",
    `CREATE UNIQUE INDEX IF NOT EXISTS "BrandEsgSnapshot_brandId_period_key" ON "BrandEsgSnapshot"("brandId","period")`,
  );
  await run(
    "BrandEsgSnapshot brand idx",
    `CREATE INDEX IF NOT EXISTS "BrandEsgSnapshot_brandId_periodStart_idx" ON "BrandEsgSnapshot"("brandId","periodStart")`,
  );

  // 12E — PressKitItem
  await run(
    "PressKitItem table",
    `CREATE TABLE IF NOT EXISTS "PressKitItem" (
       "id"          TEXT PRIMARY KEY,
       "type"        TEXT NOT NULL,
       "url"         TEXT NOT NULL,
       "caption"     TEXT,
       "releaseDate" TIMESTAMP(3),
       "active"      BOOLEAN NOT NULL DEFAULT true,
       "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "PressKitItem type idx",
    `CREATE INDEX IF NOT EXISTS "PressKitItem_type_active_idx" ON "PressKitItem"("type","active")`,
  );

  // 12G — PublicPageView
  await run(
    "PublicPageView table",
    `CREATE TABLE IF NOT EXISTS "PublicPageView" (
       "id"        TEXT PRIMARY KEY,
       "path"      TEXT NOT NULL,
       "brandId"   TEXT,
       "ipHash"    TEXT NOT NULL,
       "userAgent" TEXT,
       "referer"   TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "PublicPageView brand idx",
    `CREATE INDEX IF NOT EXISTS "PublicPageView_brandId_createdAt_idx" ON "PublicPageView"("brandId","createdAt")`,
  );
  await run(
    "PublicPageView path idx",
    `CREATE INDEX IF NOT EXISTS "PublicPageView_path_createdAt_idx" ON "PublicPageView"("path","createdAt")`,
  );

  const failed = steps.filter((s) => !s.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    totalSteps: steps.length,
    failed: failed.length,
    steps,
  });
}
