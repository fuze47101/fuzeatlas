// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-fabric-dev-status
 *
 * Adds Fabric.developmentStatus column to prod. Bearer-authed runtime
 * migration following the standing pattern (migrate-spec-ack,
 * migrate-lab-assignment, migrate-distributor-orders).
 *
 * Source: Tina spreadsheet replacement May 18. The column captures
 * the development/trial/AM-test/bulk-production workflow status that
 * Tina previously maintained in a separate Excel file per brand.
 *
 * Idempotent — re-running is safe (IF NOT EXISTS guards).
 */

const CRON_SECRET = process.env.CRON_SECRET;

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "ADD COLUMN Fabric.developmentStatus",
    sql: `ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "developmentStatus" TEXT;`,
  },
  {
    label: "CREATE INDEX Fabric_developmentStatus_idx",
    sql: `CREATE INDEX IF NOT EXISTS "Fabric_developmentStatus_idx" ON "Fabric"("developmentStatus");`,
  },
];

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results: any[] = [];
  let appliedCount = 0;

  for (const stmt of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(stmt.sql);
      results.push({ label: stmt.label, ok: true });
      appliedCount += 1;
    } catch (e: any) {
      results.push({
        label: stmt.label,
        ok: false,
        error: e?.message || String(e),
      });
    }
  }

  // Verify the column landed by attempting a no-op read.
  let verify: any = null;
  try {
    const probe = await prisma.fabric.findFirst({
      select: { id: true, developmentStatus: true },
    });
    verify = {
      ok: true,
      sample: probe ? { id: probe.id, developmentStatus: probe.developmentStatus } : null,
    };
  } catch (e: any) {
    verify = { ok: false, error: e?.message || String(e) };
  }

  const allOk = results.every((r) => r.ok) && verify.ok;

  return NextResponse.json({
    ok: allOk,
    verdict: allOk
      ? `Fabric.developmentStatus column + index present (${appliedCount} statements applied).`
      : `Migration FAILED — see results / verify.`,
    results,
    verify,
    generatedAt: new Date().toISOString(),
  });
}
