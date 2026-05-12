// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-org-invitation
 *
 * Bearer-authed one-shot migration that creates the `OrgInvitation`
 * table in the live production DB. Standing DSN-drift workaround
 * pattern: local Prisma can't reach the canonical prod DSN, so we
 * run the DDL inside the Vercel runtime where the connection works.
 *
 * Idempotent — every statement uses IF NOT EXISTS, so calling this
 * twice is a no-op. Safe to ship + fire repeatedly.
 *
 * Run from Andrew's Mac:
 *   fzcron migrate-org-invitation
 *
 * After this lands, the NEED-7a flow becomes live.
 */

const CRON_SECRET = process.env.CRON_SECRET;

const STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "create OrgInvitation table",
    sql: `
      CREATE TABLE IF NOT EXISTS "OrgInvitation" (
        "id" TEXT NOT NULL,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "invitedByUserId" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "firstName" TEXT,
        "lastName" TEXT,
        "jobTitle" TEXT,
        "notes" TEXT,
        "token" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "acceptedAt" TIMESTAMP(3),
        "acceptedByUserId" TEXT,
        "revokedAt" TIMESTAMP(3),
        "revokedByUserId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OrgInvitation_pkey" PRIMARY KEY ("id")
      );
    `,
  },
  {
    name: "unique index on token",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "OrgInvitation_token_key" ON "OrgInvitation"("token");`,
  },
  {
    name: "index on (entityType, entityId, status)",
    sql: `CREATE INDEX IF NOT EXISTS "OrgInvitation_entityType_entityId_status_idx" ON "OrgInvitation"("entityType", "entityId", "status");`,
  },
  {
    name: "index on (email, status)",
    sql: `CREATE INDEX IF NOT EXISTS "OrgInvitation_email_status_idx" ON "OrgInvitation"("email", "status");`,
  },
  {
    name: "index on (status, expiresAt)",
    sql: `CREATE INDEX IF NOT EXISTS "OrgInvitation_status_expiresAt_idx" ON "OrgInvitation"("status", "expiresAt");`,
  },
  {
    name: "FK invitedByUserId → User",
    sql: `
      DO $fk$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'OrgInvitation_invitedByUserId_fkey'
        ) THEN
          ALTER TABLE "OrgInvitation"
            ADD CONSTRAINT "OrgInvitation_invitedByUserId_fkey"
            FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $fk$;
    `,
  },
  {
    name: "FK acceptedByUserId → User",
    sql: `
      DO $fk$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'OrgInvitation_acceptedByUserId_fkey'
        ) THEN
          ALTER TABLE "OrgInvitation"
            ADD CONSTRAINT "OrgInvitation_acceptedByUserId_fkey"
            FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
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
      verdict: `OrgInvitation table + indexes + FKs present (${results.length} statements applied).`,
      results,
    });
  } catch (e: any) {
    console.error("[migrate-org-invitation] failed:", e);
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
