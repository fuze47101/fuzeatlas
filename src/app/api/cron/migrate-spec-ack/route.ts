// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-spec-ack
 *
 * NEED-6 runtime migration. Creates BrandSpecAcknowledgement table
 * via $executeRawUnsafe with IF NOT EXISTS guards. Idempotent.
 *
 * Run from Andrew's Mac:  fzcron migrate-spec-ack
 */

const CRON_SECRET = process.env.CRON_SECRET;

const STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "create BrandSpecAcknowledgement table",
    sql: `
      CREATE TABLE IF NOT EXISTS "BrandSpecAcknowledgement" (
        "id" TEXT NOT NULL,
        "brandId" TEXT NOT NULL,
        "factoryId" TEXT NOT NULL,
        "specVersion" TIMESTAMP(3) NOT NULL,
        "acknowledgedByUserId" TEXT NOT NULL,
        "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "acknowledgedTier" TEXT,
        "acknowledgedCadenceBatches" INTEGER,
        "acknowledgedCadenceLiters" DOUBLE PRECISION,
        "acknowledgedProtocolDocUrl" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BrandSpecAcknowledgement_pkey" PRIMARY KEY ("id")
      );
    `,
  },
  {
    name: "index (brandId, factoryId, specVersion)",
    sql: `CREATE INDEX IF NOT EXISTS "BrandSpecAcknowledgement_brandId_factoryId_specVersion_idx" ON "BrandSpecAcknowledgement"("brandId", "factoryId", "specVersion");`,
  },
  {
    name: "index (factoryId, specVersion)",
    sql: `CREATE INDEX IF NOT EXISTS "BrandSpecAcknowledgement_factoryId_specVersion_idx" ON "BrandSpecAcknowledgement"("factoryId", "specVersion");`,
  },
  {
    name: "FK brandId → Brand",
    sql: `
      DO $fk$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'BrandSpecAcknowledgement_brandId_fkey'
        ) THEN
          ALTER TABLE "BrandSpecAcknowledgement"
            ADD CONSTRAINT "BrandSpecAcknowledgement_brandId_fkey"
            FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $fk$;
    `,
  },
  {
    name: "FK factoryId → Factory",
    sql: `
      DO $fk$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'BrandSpecAcknowledgement_factoryId_fkey'
        ) THEN
          ALTER TABLE "BrandSpecAcknowledgement"
            ADD CONSTRAINT "BrandSpecAcknowledgement_factoryId_fkey"
            FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $fk$;
    `,
  },
  {
    name: "FK acknowledgedByUserId → User",
    sql: `
      DO $fk$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'BrandSpecAcknowledgement_acknowledgedByUserId_fkey'
        ) THEN
          ALTER TABLE "BrandSpecAcknowledgement"
            ADD CONSTRAINT "BrandSpecAcknowledgement_acknowledgedByUserId_fkey"
            FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $fk$;
    `,
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
      verdict: `BrandSpecAcknowledgement table + indexes + FKs present (${results.length} statements applied).`,
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
