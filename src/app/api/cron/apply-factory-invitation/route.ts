// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed migration for FactoryInvitation (Phase 5B).
 * Idempotent statements with FK guarded by pg_constraint check.
 *
 * Usage:
 *   fzcron apply-factory-invitation
 *
 * DELETE this file after the apply succeeds — it's a one-off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "create_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "FactoryInvitation" (
        "id"                  TEXT NOT NULL,
        "brandId"             TEXT NOT NULL,
        "invitedFactoryName"  TEXT NOT NULL,
        "invitedContactName"  TEXT,
        "invitedContactEmail" TEXT NOT NULL,
        "invitedContactPhone" TEXT,
        "invitedAddress"      TEXT,
        "invitedCountry"      TEXT,
        "notes"               TEXT,
        "status"              TEXT NOT NULL DEFAULT 'PENDING',
        "linkedFactoryId"     TEXT,
        "invitedById"         TEXT,
        "invitedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "respondedAt"         TIMESTAMP(3),
        "inviteToken"         TEXT NOT NULL,
        "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"           TIMESTAMP(3) NOT NULL,
        CONSTRAINT "FactoryInvitation_pkey" PRIMARY KEY ("id")
      )
    `,
  },
  {
    label: "create_unique_token",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "FactoryInvitation_inviteToken_key"
        ON "FactoryInvitation"("inviteToken")
    `,
  },
  {
    label: "create_idx_brand_status",
    sql: `
      CREATE INDEX IF NOT EXISTS "FactoryInvitation_brandId_status_idx"
        ON "FactoryInvitation"("brandId", "status")
    `,
  },
  {
    label: "create_idx_email",
    sql: `
      CREATE INDEX IF NOT EXISTS "FactoryInvitation_invitedContactEmail_idx"
        ON "FactoryInvitation"("invitedContactEmail")
    `,
  },
  {
    label: "add_fk_brand",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FactoryInvitation_brandId_fkey'
        ) THEN
          ALTER TABLE "FactoryInvitation"
            ADD CONSTRAINT "FactoryInvitation_brandId_fkey"
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
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FactoryInvitation') AS exists`,
  )) as Array<{ exists: boolean }>;
  const fkExists = (await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FactoryInvitation_brandId_fkey') AS exists`,
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
