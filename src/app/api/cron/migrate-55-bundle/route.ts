// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-55-bundle
 *
 * Phase 55 idempotent runtime migration:
 *   - MeetingProjectBlock table
 *   - MeetingActionItem.projectBlockId column + index
 *
 * Bearer-authed.
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
      CREATE TABLE IF NOT EXISTS "MeetingProjectBlock" (
        "id" TEXT NOT NULL,
        "meetingNoteId" TEXT NOT NULL,
        "customerType" TEXT NOT NULL,
        "brandId" TEXT,
        "factoryId" TEXT,
        "internalLabel" TEXT,
        "ownerId" TEXT,
        "priority" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "discussionMd" TEXT NOT NULL DEFAULT '',
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MeetingProjectBlock_pkey" PRIMARY KEY ("id")
      );
    `);
    log.push("ensured MeetingProjectBlock");

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingProjectBlock_meetingNoteId_priority_idx" ON "MeetingProjectBlock"("meetingNoteId", "priority");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingProjectBlock_brandId_idx" ON "MeetingProjectBlock"("brandId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingProjectBlock_factoryId_idx" ON "MeetingProjectBlock"("factoryId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingProjectBlock_ownerId_idx" ON "MeetingProjectBlock"("ownerId");`);
    log.push("indexed MeetingProjectBlock");

    await prisma.$executeRawUnsafe(`ALTER TABLE "MeetingActionItem" ADD COLUMN IF NOT EXISTS "projectBlockId" TEXT;`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingActionItem_projectBlockId_idx" ON "MeetingActionItem"("projectBlockId");`);
    log.push("ensured MeetingActionItem.projectBlockId + index");

    const fks: Array<[string, string]> = [
      ["MeetingProjectBlock_meetingNoteId_fkey", `ALTER TABLE "MeetingProjectBlock" ADD CONSTRAINT "MeetingProjectBlock_meetingNoteId_fkey" FOREIGN KEY ("meetingNoteId") REFERENCES "MeetingNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;`],
      ["MeetingProjectBlock_brandId_fkey", `ALTER TABLE "MeetingProjectBlock" ADD CONSTRAINT "MeetingProjectBlock_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
      ["MeetingProjectBlock_factoryId_fkey", `ALTER TABLE "MeetingProjectBlock" ADD CONSTRAINT "MeetingProjectBlock_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
      ["MeetingProjectBlock_ownerId_fkey", `ALTER TABLE "MeetingProjectBlock" ADD CONSTRAINT "MeetingProjectBlock_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
      ["MeetingProjectBlock_createdById_fkey", `ALTER TABLE "MeetingProjectBlock" ADD CONSTRAINT "MeetingProjectBlock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
      ["MeetingActionItem_projectBlockId_fkey", `ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_projectBlockId_fkey" FOREIGN KEY ("projectBlockId") REFERENCES "MeetingProjectBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
    ];
    for (const [label, sql] of fks) {
      try { await prisma.$executeRawUnsafe(sql); log.push(`attached FK ${label}`); }
      catch (e: any) { if (!String(e?.message).includes("already exists")) log.push(`fk ${label}: ${e?.message}`); }
    }

    return NextResponse.json({ ok: true, verdict: "Phase 55 migration bundle applied.", log });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "migration failed", log }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 120;
