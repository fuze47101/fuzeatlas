// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed migration: extend ProductDocument with
 * category, audience[], productLine columns (Phase 6A).
 * Idempotent — every column add uses IF NOT EXISTS.
 *
 * Usage:
 *   fzcron apply-product-doc-category
 *
 * DELETE this file after the apply succeeds.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "add_category",
    sql: `
      ALTER TABLE "ProductDocument"
        ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'tds_sds'
    `,
  },
  {
    label: "add_audience",
    sql: `
      ALTER TABLE "ProductDocument"
        ADD COLUMN IF NOT EXISTS "audience" TEXT[] NOT NULL DEFAULT ARRAY['BRAND','FACTORY','DISTRIBUTOR','LAB']
    `,
  },
  {
    label: "add_productLine",
    sql: `
      ALTER TABLE "ProductDocument"
        ADD COLUMN IF NOT EXISTS "productLine" TEXT
    `,
  },
  {
    label: "idx_category",
    sql: `
      CREATE INDEX IF NOT EXISTS "ProductDocument_category_idx"
        ON "ProductDocument"("category")
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

  const cols = (await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'ProductDocument'
       AND column_name IN ('category','audience','productLine')`,
  )) as Array<{ column_name: string }>;

  return NextResponse.json({
    ok: ran.every((r) => r.ok),
    statements: ran,
    verify: { columns: cols.map((c) => c.column_name) },
  });
}
