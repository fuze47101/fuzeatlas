// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST/GET /api/cron/migrate-test-narration
 *
 * MB-3 runtime schema migration. Adds four nullable columns to
 * TestRun:
 *   - aiNarration                    text  — generated paragraph
 *   - aiNarrationModel               text  — Claude model id used
 *   - aiNarrationGeneratedAt         ts    — when persisted
 *   - aiNarrationGenerationFailedAt  ts    — last failure stamp;
 *                                            cron picks failures > 1h
 *                                            old for retry
 *
 * Idempotent. Run from Andrew's Mac:  fzcron migrate-test-narration
 */

const CRON_SECRET = process.env.CRON_SECRET;

const STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "TestRun.aiNarration",
    sql: `ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "aiNarration" TEXT;`,
  },
  {
    name: "TestRun.aiNarrationModel",
    sql: `ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "aiNarrationModel" TEXT;`,
  },
  {
    name: "TestRun.aiNarrationGeneratedAt",
    sql: `ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "aiNarrationGeneratedAt" TIMESTAMP(3);`,
  },
  {
    name: "TestRun.aiNarrationGenerationFailedAt",
    sql: `ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "aiNarrationGenerationFailedAt" TIMESTAMP(3);`,
  },
  {
    name: "index TestRun.aiNarrationGenerationFailedAt (retry cron)",
    sql: `CREATE INDEX IF NOT EXISTS "TestRun_aiNarrationGenerationFailedAt_idx" ON "TestRun"("aiNarrationGenerationFailedAt");`,
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
      verdict: `TestRun ai-narration columns + index present (${results.length} statements applied).`,
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
