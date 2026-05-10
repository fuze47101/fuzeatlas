// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed endpoint to apply the SupplyChainLink schema
 * (Phase 4A of ROADMAP_v2) against whatever DATABASE_URL the Vercel
 * runtime is using.
 *
 * Idempotent — every statement uses IF NOT EXISTS / DO blocks so
 * re-running is safe.
 *
 * Auth: Bearer $CRON_SECRET (same pattern as feedback-list,
 * admin-resolve, the prior apply-pending-migrations).
 *
 * Usage:
 *   fzcron apply-supply-chain-link
 *
 * After response shows ok:true and verify.table.exists:true, this
 * file should be deleted in a follow-up commit.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "create_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "SupplyChainLink" (
        "id"        TEXT NOT NULL,
        "fromType"  TEXT NOT NULL,
        "fromId"    TEXT NOT NULL,
        "toType"    TEXT NOT NULL,
        "toId"      TEXT NOT NULL,
        "relation"  TEXT NOT NULL,
        "active"    BOOLEAN NOT NULL DEFAULT true,
        "notes"     TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "SupplyChainLink_pkey" PRIMARY KEY ("id")
      )
    `,
  },
  {
    label: "create_unique",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "SupplyChainLink_fromType_fromId_toType_toId_relation_key"
        ON "SupplyChainLink"("fromType", "fromId", "toType", "toId", "relation")
    `,
  },
  {
    label: "create_idx_from",
    sql: `
      CREATE INDEX IF NOT EXISTS "SupplyChainLink_fromType_fromId_idx"
        ON "SupplyChainLink"("fromType", "fromId")
    `,
  },
  {
    label: "create_idx_to",
    sql: `
      CREATE INDEX IF NOT EXISTS "SupplyChainLink_toType_toId_idx"
        ON "SupplyChainLink"("toType", "toId")
    `,
  },
  {
    label: "create_idx_relation",
    sql: `
      CREATE INDEX IF NOT EXISTS "SupplyChainLink_relation_active_idx"
        ON "SupplyChainLink"("relation", "active")
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

  // Verify the table + unique index exist after the run.
  const tableExists = (await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_name = 'SupplyChainLink'
     ) AS exists`,
  )) as Array<{ exists: boolean }>;

  const uniqueIndexExists = (await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE indexname = 'SupplyChainLink_fromType_fromId_toType_toId_relation_key'
     ) AS exists`,
  )) as Array<{ exists: boolean }>;

  return NextResponse.json({
    ok: ran.every((r) => r.ok),
    statements: ran,
    verify: {
      table: { exists: tableExists[0]?.exists ?? false },
      uniqueIndex: { exists: uniqueIndexExists[0]?.exists ?? false },
    },
  });
}
