// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-57-bundle
 *
 * Phase 57 — TriageRun audit table for the daily auto-triage
 * GitHub Actions workflow. Idempotent. Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const log: string[] = [];
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TriageRun" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "runUrl" TEXT,
        "newTicketCount" INTEGER NOT NULL DEFAULT 0,
        "ticketsAttempted" INTEGER NOT NULL DEFAULT 0,
        "ticketsSkipped" INTEGER NOT NULL DEFAULT 0,
        "prsCreated" INTEGER NOT NULL DEFAULT 0,
        "errorMessage" TEXT,
        "attemptedIds" TEXT,
        "skippedReasons" TEXT,
        "prUrls" TEXT
      );
    `);
    log.push("ensured TriageRun table");
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "TriageRun_runAt_idx" ON "TriageRun"("runAt");`,
    );
    log.push("ensured TriageRun.runAt index");
    return NextResponse.json({ ok: true, verdict: "Phase 57 migration applied", log });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message, log }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
