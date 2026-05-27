// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET/POST /api/cron/create-next-meeting-notes
 *
 * Phase 53 T2 — hourly cron. For each active MeetingSeries with a
 * cadence set, computes the next meeting date and auto-creates a
 * MeetingNote when we're within 24h of that date.
 *
 * Idempotent: skips when a meeting already exists for the computed
 * next date in the series.
 *
 * Cadence values:
 *   weekly   = previous meeting date + 7 days
 *   biweekly = previous meeting date + 14 days
 *   monthly  = previous meeting date + 30 days
 *   adhoc    = never auto-create
 */
const CRON_SECRET = process.env.CRON_SECRET;
const MS_PER_DAY = 86_400_000;

function nextDateFor(cadence: string | null | undefined, anchor: Date): Date | null {
  const c = String(cadence || "").toLowerCase();
  if (c === "weekly") return new Date(anchor.getTime() + 7 * MS_PER_DAY);
  if (c === "biweekly") return new Date(anchor.getTime() + 14 * MS_PER_DAY);
  if (c === "monthly") return new Date(anchor.getTime() + 30 * MS_PER_DAY);
  return null;
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 3600 * 1000); // 24h ahead

  const series = await (prisma as any).meetingSeries.findMany({
    where: { active: true, cadence: { not: null } },
    select: {
      id: true,
      name: true,
      cadence: true,
      templateMd: true,
      brandId: true,
      factoryId: true,
      createdById: true,
      meetings: {
        select: { id: true, meetingDate: true },
        orderBy: { meetingDate: "desc" },
        take: 1,
      },
    },
  });

  const created: any[] = [];
  const skipped: any[] = [];

  for (const s of series) {
    const last = s.meetings?.[0];
    const anchor = last?.meetingDate ? new Date(last.meetingDate) : now;
    const nextDate = nextDateFor(s.cadence, anchor);
    if (!nextDate) {
      skipped.push({ seriesId: s.id, reason: "no cadence" });
      continue;
    }
    if (nextDate.getTime() > horizon.getTime()) {
      skipped.push({ seriesId: s.id, reason: "next-date not within 24h horizon", nextDate });
      continue;
    }

    // Idempotent guard — if a meeting already exists within 12h of the
    // computed nextDate, skip.
    const twelveHrs = 12 * 3600 * 1000;
    const dupCheck = await (prisma as any).meetingNote.findFirst({
      where: {
        seriesId: s.id,
        meetingDate: {
          gte: new Date(nextDate.getTime() - twelveHrs),
          lte: new Date(nextDate.getTime() + twelveHrs),
        },
      },
      select: { id: true },
    });
    if (dupCheck) {
      skipped.push({ seriesId: s.id, reason: "already-created", existingId: dupCheck.id });
      continue;
    }

    const title = `${s.name} — ${nextDate.toISOString().slice(0, 10)}`;
    const note = await (prisma as any).meetingNote.create({
      data: {
        seriesId: s.id,
        title,
        meetingDate: nextDate,
        notesMd: s.templateMd || "",
        status: "DRAFT",
        brandId: s.brandId,
        factoryId: s.factoryId,
        createdById: s.createdById,
      },
      select: { id: true, title: true },
    });
    created.push({ seriesId: s.id, meetingNoteId: note.id, title: note.title });

    // Notify the series creator (best-effort)
    if (s.createdById) {
      await prisma.notification
        .create({
          data: {
            userId: s.createdById,
            type: "SYSTEM",
            title: `Next meeting auto-created — ${s.name}`,
            message: `${title} is in your queue. Add agenda items before the meeting.`,
            link: `/meeting-notes/${note.id}`,
          },
        })
        .catch(() => null);
    }
  }

  return NextResponse.json({
    ok: true,
    verdict: `Auto-created ${created.length} meeting note(s); skipped ${skipped.length}.`,
    created,
    skipped,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
