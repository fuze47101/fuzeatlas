// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed migration for FuzeHQInventory (Phase 4D).
 * Idempotent: CREATE TABLE / CREATE UNIQUE INDEX with IF NOT EXISTS.
 *
 * Usage:
 *   fzcron apply-fuze-hq-inventory
 *
 * DELETE this file after the apply succeeds — it's a one-off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "create_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "FuzeHQInventory" (
        "id"               TEXT NOT NULL,
        "sku"              TEXT NOT NULL,
        "description"      TEXT NOT NULL,
        "onHandLiters"     DOUBLE PRECISION NOT NULL DEFAULT 0,
        "reservedLiters"   DOUBLE PRECISION NOT NULL DEFAULT 0,
        "reorderThreshold" DOUBLE PRECISION,
        "lastInventoryAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "notes"            TEXT,
        "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"        TIMESTAMP(3) NOT NULL,
        CONSTRAINT "FuzeHQInventory_pkey" PRIMARY KEY ("id")
      )
    `,
  },
  {
    label: "create_unique_sku",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "FuzeHQInventory_sku_key"
        ON "FuzeHQInventory"("sku")
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
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FuzeHQInventory') AS exists`,
  )) as Array<{ exists: boolean }>;

  return NextResponse.json({
    ok: ran.every((r) => r.ok),
    statements: ran,
    verify: { table: { exists: tableExists[0]?.exists ?? false } },
  });
}
