// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed migration for LabFormTemplate (Phase 4E).
 * Idempotent statements with FK guarded by pg_constraint check.
 *
 * Usage:
 *   fzcron apply-lab-form-template
 *
 * DELETE this file after the apply succeeds — it's a one-off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "create_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "LabFormTemplate" (
        "id"        TEXT NOT NULL,
        "labId"     TEXT NOT NULL,
        "name"      TEXT NOT NULL,
        "fields"    JSONB NOT NULL,
        "active"    BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "LabFormTemplate_pkey" PRIMARY KEY ("id")
      )
    `,
  },
  {
    label: "create_idx_lab_active",
    sql: `
      CREATE INDEX IF NOT EXISTS "LabFormTemplate_labId_active_idx"
        ON "LabFormTemplate"("labId", "active")
    `,
  },
  {
    label: "add_fk_lab",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'LabFormTemplate_labId_fkey'
        ) THEN
          ALTER TABLE "LabFormTemplate"
            ADD CONSTRAINT "LabFormTemplate_labId_fkey"
            FOREIGN KEY ("labId") REFERENCES "Lab"("id")
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
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LabFormTemplate') AS exists`,
  )) as Array<{ exists: boolean }>;
  const fkExists = (await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabFormTemplate_labId_fkey') AS exists`,
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
