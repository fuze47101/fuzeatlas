// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed endpoint that resolves the TestRun.testType
 * drift between prisma/schema.prisma (declared as the TestType enum)
 * and the live DB column shape.
 *
 * PATH A (clean conversion): create the enum type if missing, then
 * cast the column to it. Idempotent via:
 *   - DO block + pg_type check before CREATE TYPE
 *   - DO block + information_schema check before ALTER COLUMN TYPE
 *
 * The inspect-testtype endpoint reported the live column is already
 * USER-DEFINED with udt_name='TestType' and every distinct value is
 * a Prisma enum member, so this endpoint is expected to no-op (both
 * DO blocks skip), but running it confirms state and re-runs cleanly
 * if any partial drift remains. The verification queries at the end
 * of the response prove the column type after the run.
 *
 * Auth: Bearer $CRON_SECRET. Middleware exempts /api/cron/*.
 *
 * Usage:
 *   fzcron apply-testtype-fix
 *
 * DELETE this file and inspect-testtype in a follow-up commit once
 * `prisma db push` reports "Already in sync".
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mirrors enum TestType in prisma/schema.prisma exactly.
const ENUM_VALUES = ["ICP", "ANTIBACTERIAL", "FUNGAL", "ODOR", "UV", "MICROFIBER", "OTHER"];

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "create_enum_type_if_missing",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TestType') THEN
          CREATE TYPE "TestType" AS ENUM (${ENUM_VALUES.map((v) => `'${v}'`).join(", ")});
        END IF;
      END $$;
    `,
  },
  {
    label: "alter_column_to_enum_if_still_string",
    // Only fires if the live column is still text/varchar (not already
    // USER-DEFINED). When the column is already 'TestType', the EXISTS
    // check returns false and the ALTER never runs.
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'TestRun'
            AND column_name = 'testType'
            AND data_type IN ('text', 'character varying')
        ) THEN
          ALTER TABLE "TestRun"
            ALTER COLUMN "testType" TYPE "TestType"
            USING "testType"::"TestType";
        END IF;
      END $$;
    `,
  },
];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  return runFix(req);
}

export async function POST(req: Request) {
  return runFix(req);
}

async function runFix(req: Request) {
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

  // Verify post-run state.
  const columnMeta = (await prisma.$queryRawUnsafe(
    `
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'TestRun' AND column_name = 'testType'
    `,
  )) as any[];

  const enumTypeExists = (await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TestType') AS exists`,
  )) as Array<{ exists: boolean }>;

  const enumValues = (await prisma.$queryRawUnsafe(
    `
    SELECT enumlabel AS value
    FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE typname = 'TestType'
    ORDER BY enumsortorder
    `,
  )) as Array<{ value: string }>;

  const isResolved =
    columnMeta[0]?.data_type === "USER-DEFINED" &&
    columnMeta[0]?.udt_name === "TestType" &&
    enumTypeExists[0]?.exists === true;

  return NextResponse.json({
    ok: ran.every((r) => r.ok) && isResolved,
    statements: ran,
    verify: {
      column: columnMeta[0] || null,
      enumTypeExists: enumTypeExists[0]?.exists ?? false,
      enumValues: enumValues.map((r) => r.value),
      isResolved,
    },
  });
}
