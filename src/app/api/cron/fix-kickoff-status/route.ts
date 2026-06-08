// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/fix-kickoff-status
 *
 * 2026-06-08 — historical fix. Every Project Kickoff MeetingNote
 * was created with status="COMPLETED" because the Phase 54 wizard
 * had that value hardcoded. New code now writes "IN_PROGRESS"; this
 * cron back-fills the existing rows.
 *
 * Scope: only kickoff notes whose linked Project is still active
 * (closedAt is null AND stage != "COMPLETE"). Closed projects keep
 * their COMPLETED kickoff — correct.
 *
 * Idempotent. Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Pull the candidate kickoff notes — ones currently COMPLETED but
  // tied via Project.kickoffMeetingNoteId to an active Project.
  const activeProjects = await (prisma as any).project.findMany({
    where: {
      AND: [
        { closedAt: null },
        { stage: { not: "COMPLETE" } },
        { kickoffMeetingNoteId: { not: null } },
      ],
    } as any,
    select: { id: true, name: true, kickoffMeetingNoteId: true } as any,
  });

  const kickoffIds = activeProjects
    .map((p: any) => p.kickoffMeetingNoteId)
    .filter(Boolean);

  if (kickoffIds.length === 0) {
    return NextResponse.json({
      ok: true,
      flipped: 0,
      verdict: "No active-project kickoff notes to inspect.",
    });
  }

  // updateMany filtered to status=COMPLETED only — rows already in
  // any other state stay untouched (idempotent on re-run).
  const r = await (prisma as any).meetingNote.updateMany({
    where: {
      id: { in: kickoffIds },
      status: "COMPLETED",
    },
    data: { status: "IN_PROGRESS" },
  });

  return NextResponse.json({
    ok: true,
    candidatesScanned: kickoffIds.length,
    flipped: r.count,
    verdict:
      r.count > 0
        ? `Flipped ${r.count} kickoff note(s) COMPLETED → IN_PROGRESS.`
        : "No kickoff notes needed flipping (idempotent).",
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
