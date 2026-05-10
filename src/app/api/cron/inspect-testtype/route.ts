// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-off bearer-authed inspector for the TestRun.testType drift.
 *
 * Background: prisma/schema.prisma declares `testType TestType` (enum).
 * The live DB has it as a plain string column. `prisma db push` refuses
 * to migrate because of the type mismatch. This endpoint runs read-only
 * queries against the live DB to expose:
 *
 *   1. The actual column metadata (data_type, udt_name)
 *   2. The distinct values currently stored + their row counts
 *
 * The next step's migration path is decided from the response:
 *   PATH A — column is text/varchar AND every distinct value is a member
 *            of the Prisma TestType enum → safe to ALTER COLUMN TYPE
 *   PATH B — there are legacy values not in the enum → run a cleanup
 *            UPDATE first to coerce them, then PATH A
 *   STOP   — anything ambiguous (unknown column shape) → log + halt
 *
 * Bearer-authed via CRON_SECRET. Middleware exempts /api/cron/*.
 *
 * Usage:
 *   fzcron inspect-testtype
 *
 * DELETE THIS FILE after the testType drift is resolved — it's a one-off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mirror of enum TestType in prisma/schema.prisma. Keeping this list
// inline (instead of importing the enum object from @prisma/client)
// avoids bootstrapping a dependency on the very type we're trying to
// reconcile.
const PRISMA_ENUM_MEMBERS = [
  "ICP",
  "ANTIBACTERIAL",
  "FUNGAL",
  "ODOR",
  "UV",
  "MICROFIBER",
  "OTHER",
] as const;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== process.env.CRON_SECRET) return unauthorized();

  try {
    // 1) Column metadata — what the DB actually has, not what Prisma thinks.
    const columnMeta = (await prisma.$queryRawUnsafe(
      `
      SELECT column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'TestRun' AND column_name = 'testType'
      `,
    )) as any[];

    // 2) Existence of a Prisma-style enum type. Tells us whether we're
    //    going to have to CREATE TYPE in PATH A or whether it's already
    //    there from a prior partial run.
    const enumTypeExists = (await prisma.$queryRawUnsafe(
      `SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TestType') AS exists`,
    )) as Array<{ exists: boolean }>;

    // 3) Distinct values + counts (cast to text so BigInt doesn't break JSON).
    const distinctValues = (await prisma.$queryRawUnsafe(
      `
      SELECT "testType" AS value, COUNT(*)::text AS count
      FROM "TestRun"
      GROUP BY "testType"
      ORDER BY COUNT(*) DESC
      `,
    )) as Array<{ value: string | null; count: string }>;

    const seenValues = new Set(distinctValues.map((r) => r.value));
    const unexpectedValues = [...seenValues].filter(
      (v) => v != null && !PRISMA_ENUM_MEMBERS.includes(v as any),
    );

    const colShape = columnMeta[0]?.data_type ?? null;
    const isStringColumn = colShape === "text" || colShape === "character varying";
    const isPathACandidate = isStringColumn && unexpectedValues.length === 0;
    const isPathBCandidate = isStringColumn && unexpectedValues.length > 0;

    return NextResponse.json({
      ok: true,
      column: columnMeta[0] || null,
      enumTypeExists: enumTypeExists[0]?.exists ?? false,
      distinctValues,
      enumMembers: PRISMA_ENUM_MEMBERS,
      unexpectedValues,
      decision: {
        path: isPathACandidate ? "A" : isPathBCandidate ? "B" : "STOP",
        reason: isPathACandidate
          ? "Column is string-typed and every value is a Prisma enum member — safe to ALTER COLUMN TYPE."
          : isPathBCandidate
            ? `Column is string-typed but ${unexpectedValues.length} value(s) outside the enum — run cleanup before conversion.`
            : `Column shape ${JSON.stringify(colShape)} doesn't fit the known migration paths — halt and inspect manually.`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
