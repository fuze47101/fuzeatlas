// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-59-bundle
 *
 * Phase 59 (Barth 2026-06-05) — adds Contact.isPrimary + index.
 * Idempotent. Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const log: string[] = [];
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;`,
    );
    log.push("ensured Contact.isPrimary column");
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Contact_isPrimary_idx" ON "Contact"("isPrimary");`,
    );
    log.push("ensured Contact.isPrimary index");
    return NextResponse.json({ ok: true, verdict: "Phase 59 migration applied", log });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message, log }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
