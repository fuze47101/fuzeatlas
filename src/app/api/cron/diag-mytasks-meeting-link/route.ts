// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/diag-mytasks-meeting-link
 *
 * Verifies BUG 2 (Scott Smith cmpwzk1yw0001jv04eb58u6tk):
 *  - every OPEN MeetingActionItem with an assignee resolves to a
 *    MeetingNote with a non-null id
 *  - that meeting note id is reachable for the deep-link from
 *    /my-tasks → /meeting-notes/<id>?task=<taskId>
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const open = await (prisma as any).meetingActionItem.findMany({
    where: { status: "OPEN", assigneeId: { not: null } },
    take: 500,
    select: {
      id: true,
      meetingNoteId: true,
      meetingNote: { select: { id: true, title: true } },
    },
  });

  const orphaned = open.filter((t: any) => !t.meetingNote?.id);
  const linked = open.length - orphaned.length;

  return NextResponse.json({
    ok: true,
    totalOpenAssignedTasks: open.length,
    linkedToMeetingCount: linked,
    orphanedCount: orphaned.length,
    sampleLinkedDeepLinks: open
      .filter((t: any) => t.meetingNote?.id)
      .slice(0, 3)
      .map((t: any) => `/meeting-notes/${t.meetingNote.id}?task=${t.id}`),
    sampleOrphanedIds: orphaned.slice(0, 5).map((t: any) => t.id),
    verdict:
      orphaned.length === 0
        ? "All open assigned tasks have a resolvable meeting note id — deep link works for every row."
        : `${orphaned.length} task(s) have no meeting note — those rows render an inert "—" instead of a broken link.`,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 30;
