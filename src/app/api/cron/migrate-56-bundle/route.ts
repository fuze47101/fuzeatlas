// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-56-bundle
 *
 * Phase 56 — MeetingProjectBlock.projectId nullable FK so "Project
 * Complete" on a block can call the existing Phase 54.5
 * weekly-update markComplete path against the linked Project row.
 *
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
      `ALTER TABLE "MeetingProjectBlock" ADD COLUMN IF NOT EXISTS "projectId" TEXT;`,
    );
    log.push("ensured MeetingProjectBlock.projectId column");
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "MeetingProjectBlock_projectId_idx" ON "MeetingProjectBlock"("projectId");`,
    );
    log.push("ensured MeetingProjectBlock.projectId index");
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "MeetingProjectBlock" ADD CONSTRAINT "MeetingProjectBlock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
      );
      log.push("attached MeetingProjectBlock.projectId → Project FK");
    } catch (e: any) {
      if (!String(e?.message).includes("already exists")) {
        log.push(`FK error: ${e?.message || e}`);
      }
    }
    return NextResponse.json({ ok: true, verdict: "Phase 56 migration applied", log });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message, log }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
