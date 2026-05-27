// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-53-bundle
 *
 * Phase 53 idempotent runtime migration:
 *   MeetingSeries, MeetingNote, MeetingNoteEntry, MeetingActionItem
 *
 * Seeds one initial MeetingSeries: "Monday Global Meeting" (weekly,
 * cadenceDay=1 Mon, cadenceHour=2 UTC = Sunday 7pm Mountain).
 *
 * Re-runnable. Bearer-authed.
 */

const CRON_SECRET = process.env.CRON_SECRET;

const MONDAY_TEMPLATE = `## Monday Global Meeting — agenda

### 1. Headlines this week

-

### 2. Customer / brand updates

-

### 3. Lab + testing pipeline

-

### 4. Distributors + factories

-

### 5. Blockers + asks

-

### 6. Action items
(Use \`@username\` to assign an action item with optional priority + due date.
 Examples:
   \`@tina to send Silvadur SDS by Friday URGENT\`
   \`@andrew review KUIU response (high priority) by 2026-06-01\`)
`;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  try {
    // MeetingSeries
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MeetingSeries" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "cadence" TEXT,
        "cadenceDay" INTEGER,
        "cadenceHour" INTEGER,
        "templateMd" TEXT,
        "brandId" TEXT,
        "factoryId" TEXT,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MeetingSeries_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingSeries_active_idx" ON "MeetingSeries"("active");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingSeries_brandId_idx" ON "MeetingSeries"("brandId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingSeries_factoryId_idx" ON "MeetingSeries"("factoryId");`);
    log.push("ensured MeetingSeries");

    // MeetingNote
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MeetingNote" (
        "id" TEXT NOT NULL,
        "seriesId" TEXT,
        "title" TEXT NOT NULL,
        "meetingDate" TIMESTAMP(3) NOT NULL,
        "notesMd" TEXT NOT NULL DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "brandId" TEXT,
        "factoryId" TEXT,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MeetingNote_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingNote_meetingDate_idx" ON "MeetingNote"("meetingDate");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingNote_seriesId_idx" ON "MeetingNote"("seriesId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingNote_brandId_idx" ON "MeetingNote"("brandId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingNote_factoryId_idx" ON "MeetingNote"("factoryId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingNote_status_idx" ON "MeetingNote"("status");`);
    log.push("ensured MeetingNote");

    // MeetingNoteEntry
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MeetingNoteEntry" (
        "id" TEXT NOT NULL,
        "meetingNoteId" TEXT NOT NULL,
        "authorId" TEXT NOT NULL,
        "bodyMd" TEXT NOT NULL,
        "isEdit" BOOLEAN NOT NULL DEFAULT false,
        "editsId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MeetingNoteEntry_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingNoteEntry_meetingNoteId_idx" ON "MeetingNoteEntry"("meetingNoteId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingNoteEntry_authorId_idx" ON "MeetingNoteEntry"("authorId");`);
    log.push("ensured MeetingNoteEntry");

    // MeetingActionItem
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MeetingActionItem" (
        "id" TEXT NOT NULL,
        "meetingNoteId" TEXT NOT NULL,
        "sourceEntryId" TEXT,
        "description" TEXT NOT NULL,
        "assigneeId" TEXT,
        "priority" TEXT NOT NULL DEFAULT 'NORMAL',
        "dueDate" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'OPEN',
        "doneAt" TIMESTAMP(3),
        "doneById" TEXT,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MeetingActionItem_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingActionItem_assigneeId_status_idx" ON "MeetingActionItem"("assigneeId","status");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingActionItem_meetingNoteId_idx" ON "MeetingActionItem"("meetingNoteId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingActionItem_dueDate_idx" ON "MeetingActionItem"("dueDate");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingActionItem_priority_idx" ON "MeetingActionItem"("priority");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingActionItem_status_idx" ON "MeetingActionItem"("status");`);
    log.push("ensured MeetingActionItem");

    // Foreign keys — best-effort (ignore if already attached).
    const fks: Array<[string, string]> = [
      ["MeetingNote", `ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "MeetingSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
      ["MeetingNoteEntry-meeting", `ALTER TABLE "MeetingNoteEntry" ADD CONSTRAINT "MeetingNoteEntry_meetingNoteId_fkey" FOREIGN KEY ("meetingNoteId") REFERENCES "MeetingNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;`],
      ["MeetingNoteEntry-author", `ALTER TABLE "MeetingNoteEntry" ADD CONSTRAINT "MeetingNoteEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`],
      ["MeetingNoteEntry-edits", `ALTER TABLE "MeetingNoteEntry" ADD CONSTRAINT "MeetingNoteEntry_editsId_fkey" FOREIGN KEY ("editsId") REFERENCES "MeetingNoteEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
      ["MeetingActionItem-meeting", `ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_meetingNoteId_fkey" FOREIGN KEY ("meetingNoteId") REFERENCES "MeetingNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;`],
      ["MeetingActionItem-source", `ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "MeetingNoteEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;`],
    ];
    for (const [label, sql] of fks) {
      try {
        await prisma.$executeRawUnsafe(sql);
        log.push(`attached FK ${label}`);
      } catch (e: any) {
        if (!String(e?.message).includes("already exists")) log.push(`fk ${label}: ${e?.message}`);
      }
    }

    // Seed Monday Global Meeting series if none exists.
    const existing = await (prisma as any).meetingSeries.findFirst({
      where: { name: "Monday Global Meeting" },
      select: { id: true },
    });
    let seriesId = existing?.id;
    if (!seriesId) {
      const andrew = await prisma.user.findFirst({
        where: { email: { in: ["andrew@fuze47.com", "andrew@801inc.com"] } },
        select: { id: true },
      });
      const seeded = await (prisma as any).meetingSeries.create({
        data: {
          name: "Monday Global Meeting",
          description: "Weekly all-hands Monday evening standup. Cadence: Mon 02:00 UTC (Sun 7pm Mountain).",
          cadence: "weekly",
          cadenceDay: 1,
          cadenceHour: 2,
          templateMd: MONDAY_TEMPLATE,
          createdById: andrew?.id || null,
        },
        select: { id: true },
      });
      seriesId = seeded.id;
      log.push(`seeded MeetingSeries 'Monday Global Meeting' id=${seriesId}`);
    } else {
      log.push(`MeetingSeries 'Monday Global Meeting' already exists id=${seriesId}`);
    }

    return NextResponse.json({
      ok: true,
      verdict: "Phase 53 migration bundle applied.",
      mondaySeriesId: seriesId,
      log,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "migration failed", log },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 120;
