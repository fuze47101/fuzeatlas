// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed migration: brand approval workflow (Phase 7A).
 * Parallel approval columns on TestRun + FabricSubmission + FuzeOrder
 * + Brand.requiresApproval boolean toggle.
 *
 * Idempotent — every column add uses IF NOT EXISTS.
 *
 * Usage:
 *   fzcron apply-brand-approval
 *
 * DELETE this file after the apply succeeds.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  // TestRun
  { label: "tr_status", sql: `ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "brandApprovalStatus" TEXT` },
  { label: "tr_reason", sql: `ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "brandRejectionReason" TEXT` },

  // FabricSubmission
  { label: "fs_status", sql: `ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "brandApprovalStatus" TEXT` },
  { label: "fs_by", sql: `ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "brandApprovedById" TEXT` },
  { label: "fs_at", sql: `ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "brandApprovedAt" TIMESTAMP(3)` },
  { label: "fs_reason", sql: `ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "brandRejectionReason" TEXT` },
  {
    label: "fs_idx",
    sql: `CREATE INDEX IF NOT EXISTS "FabricSubmission_brandApprovalStatus_idx" ON "FabricSubmission"("brandApprovalStatus")`,
  },

  // FuzeOrder
  { label: "fo_status", sql: `ALTER TABLE "FuzeOrder" ADD COLUMN IF NOT EXISTS "brandApprovalStatus" TEXT` },
  { label: "fo_by", sql: `ALTER TABLE "FuzeOrder" ADD COLUMN IF NOT EXISTS "brandApprovedById" TEXT` },
  { label: "fo_at", sql: `ALTER TABLE "FuzeOrder" ADD COLUMN IF NOT EXISTS "brandApprovedAt" TIMESTAMP(3)` },
  { label: "fo_reason", sql: `ALTER TABLE "FuzeOrder" ADD COLUMN IF NOT EXISTS "brandRejectionReason" TEXT` },
  {
    label: "fo_idx",
    sql: `CREATE INDEX IF NOT EXISTS "FuzeOrder_brandApprovalStatus_idx" ON "FuzeOrder"("brandApprovalStatus")`,
  },

  // Brand.requiresApproval — default true. Backfill happens automatically
  // when the column gets a default.
  {
    label: "brand_requires_approval",
    sql: `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT true`,
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

  // Verify each model now has the new columns.
  const verify = (await prisma.$queryRawUnsafe(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE (table_name = 'TestRun' AND column_name IN ('brandApprovalStatus','brandRejectionReason'))
        OR (table_name = 'FabricSubmission' AND column_name IN ('brandApprovalStatus','brandApprovedById','brandApprovedAt','brandRejectionReason'))
        OR (table_name = 'FuzeOrder' AND column_name IN ('brandApprovalStatus','brandApprovedById','brandApprovedAt','brandRejectionReason'))
        OR (table_name = 'Brand' AND column_name = 'requiresApproval')`,
  )) as Array<{ table_name: string; column_name: string }>;

  return NextResponse.json({
    ok: ran.every((r) => r.ok),
    statements: ran,
    verify: { columns: verify },
  });
}
