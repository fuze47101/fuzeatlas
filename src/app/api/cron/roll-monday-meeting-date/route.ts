// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/roll-monday-meeting-date
 *
 * Rolls the seeded FUZE Global Meeting's `meetingDate` forward to
 * the most recent Monday at 19:00 Mountain (the actual time Andrew
 * runs the call). Idempotent: if the meeting already shows that
 * Monday, it's a no-op.
 *
 * Default target: the Monday immediately before "today" (today
 * included if today is Monday). Override with ?date=YYYY-MM-DD.
 *
 * Defaults to meeting id cmpr5ob9i0001jy04k5uyt8ss (the seeded
 * 2026-05-27 row). Override with ?meetingId=<id>.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;
const DEFAULT_MEETING_ID = "cmpr5ob9i0001jy04k5uyt8ss";

function lastMondayUtc(now = new Date()): Date {
  // Monday = 1 in JS getUTCDay. Subtract days to reach the most
  // recent Monday in UTC.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const delta = dow === 0 ? 6 : dow - 1; // days to subtract to reach Monday
  d.setUTCDate(d.getUTCDate() - delta);
  // Meeting time is 19:00 Mountain (UTC-6), so 01:00 UTC the next day.
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(1, 0, 0, 0);
  return d;
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const meetingId = url.searchParams.get("meetingId") || DEFAULT_MEETING_ID;
  const overrideDate = url.searchParams.get("date");
  const target = overrideDate
    ? new Date(`${overrideDate}T01:00:00.000Z`)
    : lastMondayUtc();

  const existing = await (prisma as any).meetingNote.findUnique({
    where: { id: meetingId },
    select: { id: true, title: true, meetingDate: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "MeetingNote not found" }, { status: 404 });
  }

  if (new Date(existing.meetingDate).getTime() === target.getTime()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "meeting already at target date",
      meetingId,
      meetingDate: existing.meetingDate,
    });
  }

  const newTitle = `FUZE Global Meeting — ${target.toISOString().slice(0, 10).replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, d) => {
    // Render as YYYY-MM-DD of the Monday in Mountain time
    const mountain = new Date(target.getTime() - 6 * 60 * 60 * 1000);
    return mountain.toISOString().slice(0, 10);
  })}`;

  const updated = await (prisma as any).meetingNote.update({
    where: { id: meetingId },
    data: { meetingDate: target, title: newTitle },
    select: { id: true, title: true, meetingDate: true },
  });

  return NextResponse.json({
    ok: true,
    meetingId: updated.id,
    title: updated.title,
    meetingDate: updated.meetingDate,
    previousDate: existing.meetingDate,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 30;
