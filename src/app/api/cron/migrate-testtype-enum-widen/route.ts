// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-testtype-enum-widen
 *
 * 2026-05-27 Kaylee Pace fix — widens the TestType Postgres enum so
 * the LabService seed values (ANTIMICROBIAL / RECIPE_DEVELOPMENT /
 * PERFORMANCE / SOLAR_PERFORMANCE / HEAT_DEFLECTION + ANTIVIRAL) are
 * accepted by TestRequestLine.testType.
 *
 * Postgres ALTER TYPE ... ADD VALUE IF NOT EXISTS is the idempotent
 * way to extend a Prisma enum at runtime. Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;
const NEW_VALUES = [
  "ANTIMICROBIAL",
  "ANTIVIRAL",
  "RECIPE_DEVELOPMENT",
  "PERFORMANCE",
  "SOLAR_PERFORMANCE",
  "HEAT_DEFLECTION",
];

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const log: string[] = [];
  for (const v of NEW_VALUES) {
    try {
      // ALTER TYPE ... ADD VALUE cannot run inside a transaction block; use
      // $executeRawUnsafe which runs each statement as its own implicit tx.
      await prisma.$executeRawUnsafe(`ALTER TYPE "TestType" ADD VALUE IF NOT EXISTS '${v}';`);
      log.push(`ensured TestType.${v}`);
    } catch (e: any) {
      log.push(`TestType.${v} failed: ${e?.message || e}`);
    }
  }
  // Read back enum values for verification.
  let current: string[] = [];
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'TestType' ORDER BY e.enumsortorder;`,
    );
    current = rows.map((r) => r.enumlabel);
  } catch (e: any) {
    log.push(`enum read-back failed: ${e?.message || e}`);
  }
  return NextResponse.json({
    ok: true,
    verdict: "TestType enum widened.",
    currentValues: current,
    log,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
