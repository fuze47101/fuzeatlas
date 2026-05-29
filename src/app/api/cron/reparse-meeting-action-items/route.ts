// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractActionItems } from "@/lib/meeting-mentions";

/**
 * POST /api/cron/reparse-meeting-action-items?meetingId=<id>
 *
 * Re-runs the @mention parser against each MeetingNoteEntry tied to
 * the given MeetingNote and updates the priority of the
 * corresponding MeetingActionItem rows when the new value differs.
 *
 * Use case: when the parser is enhanced (e.g. section-header
 * priority inheritance), back-fill priorities on already-seeded
 * meetings without manually re-creating action items.
 *
 * Matching strategy: per-entry, we re-extract action items by
 * order-of-appearance and pair them to the stored MeetingActionItem
 * rows that share the same sourceEntryId, also ordered by createdAt.
 * Position-based pairing is safe because extractActionItems is
 * deterministic given the same bodyMd + users.
 *
 * Only priority + dueDate are reconciled — assignee, description,
 * status (DONE etc.) are preserved.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;
const INTERNAL_ROLES = [
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
  "FACTORY_MANAGER",
];

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const meetingId = url.searchParams.get("meetingId");
  if (!meetingId) {
    return NextResponse.json(
      { ok: false, error: "meetingId query param required" },
      { status: 400 },
    );
  }

  const meeting = await (prisma as any).meetingNote.findUnique({
    where: { id: meetingId },
    select: { id: true, title: true },
  });
  if (!meeting) {
    return NextResponse.json({ ok: false, error: "MeetingNote not found" }, { status: 404 });
  }

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: INTERNAL_ROLES } },
    select: { id: true, name: true, email: true, updatedAt: true },
  });

  const entries = await (prisma as any).meetingNoteEntry.findMany({
    where: { meetingNoteId: meetingId },
    orderBy: { createdAt: "asc" },
    select: { id: true, bodyMd: true, createdAt: true },
  });

  const updates: any[] = [];

  for (const entry of entries) {
    const extracted = extractActionItems(entry.bodyMd, users as any, new Date(entry.createdAt));
    const existingItems = await (prisma as any).meetingActionItem.findMany({
      where: { sourceEntryId: entry.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, description: true, priority: true, dueDate: true, assigneeId: true, status: true },
    });

    // Position-based pairing — extractActionItems is deterministic on
    // the same input, so out[i] matches existingItems[i] in creation
    // order.
    const pairCount = Math.min(extracted.length, existingItems.length);
    for (let i = 0; i < pairCount; i++) {
      const ex = extracted[i];
      const ai = existingItems[i];
      const newPriority = ex.priority;
      const newDue = ex.dueDate ? new Date(ex.dueDate).toISOString() : null;
      const oldDue = ai.dueDate ? new Date(ai.dueDate).toISOString() : null;
      const priorityChanged = newPriority !== ai.priority;
      const dueChanged = newDue !== oldDue;
      if (!priorityChanged && !dueChanged) continue;
      await (prisma as any).meetingActionItem.update({
        where: { id: ai.id },
        data: {
          ...(priorityChanged ? { priority: newPriority } : {}),
          ...(dueChanged ? { dueDate: ex.dueDate } : {}),
        },
      });
      updates.push({
        actionItemId: ai.id,
        description: ai.description,
        oldPriority: ai.priority,
        newPriority: priorityChanged ? newPriority : ai.priority,
        oldDue,
        newDue: dueChanged ? newDue : oldDue,
        changed: { priority: priorityChanged, dueDate: dueChanged },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    meetingId,
    meetingTitle: meeting.title,
    entriesScanned: entries.length,
    updatesApplied: updates.length,
    updates,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
