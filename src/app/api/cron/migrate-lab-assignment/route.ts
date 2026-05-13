// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-lab-assignment
 *
 * NEED-7 runtime migration. Adds 5 columns to TestRequest for the
 * lab assignment accept/reject loop. Idempotent — IF NOT EXISTS.
 *
 * Run from Andrew's Mac:  fzcron migrate-lab-assignment
 */

const CRON_SECRET = process.env.CRON_SECRET;

const STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "add labAssignedAt",
    sql: `ALTER TABLE "TestRequest" ADD COLUMN IF NOT EXISTS "labAssignedAt" TIMESTAMP(3);`,
  },
  {
    name: "add labAssignedById",
    sql: `ALTER TABLE "TestRequest" ADD COLUMN IF NOT EXISTS "labAssignedById" TEXT;`,
  },
  {
    name: "add labAcceptedAt",
    sql: `ALTER TABLE "TestRequest" ADD COLUMN IF NOT EXISTS "labAcceptedAt" TIMESTAMP(3);`,
  },
  {
    name: "add labRejectedAt",
    sql: `ALTER TABLE "TestRequest" ADD COLUMN IF NOT EXISTS "labRejectedAt" TIMESTAMP(3);`,
  },
  {
    name: "add labRejectionReason",
    sql: `ALTER TABLE "TestRequest" ADD COLUMN IF NOT EXISTS "labRejectionReason" TEXT;`,
  },
  {
    name: "index (status, labAssignedAt) for SLA escalation",
    sql: `CREATE INDEX IF NOT EXISTS "TestRequest_status_labAssignedAt_idx" ON "TestRequest"("status", "labAssignedAt");`,
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
      verdict: `TestRequest lab-assignment columns present (${results.length} statements applied).`,
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
