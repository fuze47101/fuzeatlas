// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed migration for BrandProfile (Phase 4B).
 * Idempotent: every statement uses IF NOT EXISTS / DO blocks for
 * the FK constraint.
 *
 * Usage:
 *   fzcron apply-brand-profile
 *
 * DELETE this file after the apply succeeds — it's a one-off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "create_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "BrandProfile" (
        "id"            TEXT NOT NULL,
        "brandId"       TEXT NOT NULL,
        "logoUrl"       TEXT,
        "primaryColor"  TEXT,
        "heroHeadline"  TEXT,
        "heroSubhead"   TEXT,
        "supportEmail"  TEXT,
        "supportPhone"  TEXT,
        "departments"   JSONB,
        "publicSlug"    TEXT,
        "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"     TIMESTAMP(3) NOT NULL,
        CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
      )
    `,
  },
  {
    label: "create_unique_brandId",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "BrandProfile_brandId_key"
        ON "BrandProfile"("brandId")
    `,
  },
  {
    label: "create_unique_publicSlug",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "BrandProfile_publicSlug_key"
        ON "BrandProfile"("publicSlug")
    `,
  },
  {
    label: "add_fk_brand",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'BrandProfile_brandId_fkey'
        ) THEN
          ALTER TABLE "BrandProfile"
            ADD CONSTRAINT "BrandProfile_brandId_fkey"
            FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
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
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'BrandProfile') AS exists`,
  )) as Array<{ exists: boolean }>;

  const fkExists = (await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BrandProfile_brandId_fkey') AS exists`,
  )) as Array<{ exists: boolean }>;

  return NextResponse.json({
    ok: ran.every((r) => r.ok),
    statements: ran,
    verify: {
      table: { exists: tableExists[0]?.exists ?? false },
      fk: { exists: fkExists[0]?.exists ?? false },
    },
  });
}
