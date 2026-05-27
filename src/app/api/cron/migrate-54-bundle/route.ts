// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-54-bundle
 *
 * Phase 54 idempotent runtime migration. Adds Project columns
 * (projectType / ownerId / goalMd / kickoffMeetingNoteId) +
 * MeetingNote.projectId. Re-runnable. Bearer-authed.
 *
 * Spec used kickoffMeetingId/Meeting; Phase 53 shipped the model as
 * MeetingNote (the existing calendar Meeting model already took the
 * name). Column names mirror MeetingNote.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const log: string[] = [];
  try {
    // Project columns
    await prisma.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectType" TEXT NOT NULL DEFAULT 'BRAND';`);
    log.push("ensured Project.projectType");
    await prisma.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;`);
    log.push("ensured Project.ownerId");
    await prisma.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "goalMd" TEXT;`);
    log.push("ensured Project.goalMd");
    await prisma.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "kickoffMeetingNoteId" TEXT;`);
    log.push("ensured Project.kickoffMeetingNoteId");

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Project_projectType_idx" ON "Project"("projectType");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Project_ownerId_idx" ON "Project"("ownerId");`);
    // Partial unique index — the spec called this out so kickoff is 1:1
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Project_kickoffMeetingNoteId_key" ON "Project"("kickoffMeetingNoteId") WHERE "kickoffMeetingNoteId" IS NOT NULL;`);
    log.push("indexed Project columns");

    // MeetingNote.projectId
    await prisma.$executeRawUnsafe(`ALTER TABLE "MeetingNote" ADD COLUMN IF NOT EXISTS "projectId" TEXT;`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingNote_projectId_idx" ON "MeetingNote"("projectId");`);
    log.push("ensured MeetingNote.projectId + index");

    // FKs — best-effort.
    const fks: Array<[string, string]> = [
      ["Project_ownerId_fkey", `ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
      ["Project_kickoffMeetingNoteId_fkey", `ALTER TABLE "Project" ADD CONSTRAINT "Project_kickoffMeetingNoteId_fkey" FOREIGN KEY ("kickoffMeetingNoteId") REFERENCES "MeetingNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
      ["MeetingNote_projectId_fkey", `ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
    ];
    for (const [label, sql] of fks) {
      try {
        await prisma.$executeRawUnsafe(sql);
        log.push(`attached FK ${label}`);
      } catch (e: any) {
        if (!String(e?.message).includes("already exists")) log.push(`fk ${label}: ${e?.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      verdict: "Phase 54 migration bundle applied.",
      log,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "migration failed", log }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 120;
