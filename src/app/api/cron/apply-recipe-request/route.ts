// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed migration for RecipeRequest (Phase 4C).
 * Idempotent: every statement uses IF NOT EXISTS / DO blocks for
 * the FK constraints.
 *
 * Usage:
 *   fzcron apply-recipe-request
 *
 * DELETE this file after the apply succeeds — it's a one-off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "create_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "RecipeRequest" (
        "id"                TEXT NOT NULL,
        "brandId"           TEXT NOT NULL,
        "factoryId"         TEXT NOT NULL,
        "fabricId"          TEXT,
        "requestedTier"     TEXT,
        "notes"             TEXT,
        "status"            TEXT NOT NULL DEFAULT 'OPEN',
        "requestedById"     TEXT,
        "requestedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "fulfilledRecipeId" TEXT,
        "fulfilledAt"       TIMESTAMP(3),
        "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"         TIMESTAMP(3) NOT NULL,
        CONSTRAINT "RecipeRequest_pkey" PRIMARY KEY ("id")
      )
    `,
  },
  {
    label: "create_idx_brand_status",
    sql: `
      CREATE INDEX IF NOT EXISTS "RecipeRequest_brandId_status_idx"
        ON "RecipeRequest"("brandId", "status")
    `,
  },
  {
    label: "create_idx_factory_status",
    sql: `
      CREATE INDEX IF NOT EXISTS "RecipeRequest_factoryId_status_idx"
        ON "RecipeRequest"("factoryId", "status")
    `,
  },
  {
    label: "create_idx_fabric",
    sql: `
      CREATE INDEX IF NOT EXISTS "RecipeRequest_fabricId_idx"
        ON "RecipeRequest"("fabricId")
    `,
  },
  {
    label: "add_fk_brand",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'RecipeRequest_brandId_fkey'
        ) THEN
          ALTER TABLE "RecipeRequest"
            ADD CONSTRAINT "RecipeRequest_brandId_fkey"
            FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `,
  },
  {
    label: "add_fk_factory",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'RecipeRequest_factoryId_fkey'
        ) THEN
          ALTER TABLE "RecipeRequest"
            ADD CONSTRAINT "RecipeRequest_factoryId_fkey"
            FOREIGN KEY ("factoryId") REFERENCES "Factory"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `,
  },
];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  return runMigration(req);
}
export async function POST(req: Request) {
  return runMigration(req);
}

async function runMigration(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== process.env.CRON_SECRET) return unauthorized();

  const ran: Array<{ label: string; ok: boolean; error?: string }> = [];
  for (const stmt of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(stmt.sql);
      ran.push({ label: stmt.label, ok: true });
    } catch (e: any) {
      ran.push({ label: stmt.label, ok: false, error: e?.message || String(e) });
    }
  }

  const tableExists = (await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RecipeRequest') AS exists`,
  )) as Array<{ exists: boolean }>;

  const fkBrandExists = (await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecipeRequest_brandId_fkey') AS exists`,
  )) as Array<{ exists: boolean }>;

  const fkFactoryExists = (await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecipeRequest_factoryId_fkey') AS exists`,
  )) as Array<{ exists: boolean }>;

  return NextResponse.json({
    ok: ran.every((r) => r.ok),
    statements: ran,
    verify: {
      table: { exists: tableExists[0]?.exists ?? false },
      fkBrand: { exists: fkBrandExists[0]?.exists ?? false },
      fkFactory: { exists: fkFactoryExists[0]?.exists ?? false },
    },
  });
}
