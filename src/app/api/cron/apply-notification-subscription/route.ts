// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed migration for NotificationSubscription
 * (Phase 5D). Idempotent statements with FK guarded by
 * pg_constraint check.
 *
 * Usage:
 *   fzcron apply-notification-subscription
 *
 * DELETE this file after the apply succeeds — it's a one-off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "create_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "NotificationSubscription" (
        "id"          TEXT NOT NULL,
        "userId"      TEXT NOT NULL,
        "preferences" JSONB NOT NULL DEFAULT '{}',
        "updatedAt"   TIMESTAMP(3) NOT NULL,
        CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
      )
    `,
  },
  {
    label: "create_unique_user",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "NotificationSubscription_userId_key"
        ON "NotificationSubscription"("userId")
    `,
  },
  {
    label: "add_fk_user",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'NotificationSubscription_userId_fkey'
        ) THEN
          ALTER TABLE "NotificationSubscription"
            ADD CONSTRAINT "NotificationSubscription_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
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
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'NotificationSubscription') AS exists`,
  )) as Array<{ exists: boolean }>;
  const fkExists = (await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationSubscription_userId_fkey') AS exists`,
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
