// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { extractActionItems } from "@/lib/meeting-mentions";
import { sendImmediateAssignmentEmail } from "@/lib/meeting-emails";

const INTERNAL_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
  "FACTORY_MANAGER",
]);

function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

/**
 * POST /api/meeting-notes/[id]/entries
 *   Body: { bodyMd: string, editsEntryId?: string }
 *
 * Creates a MeetingNoteEntry, appends the body to MeetingNote.notesMd
 * with an author header line, runs the @mention parser to spawn
 * MeetingActionItem rows, fires immediate-assignment emails +
 * in-app notifications.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const bodyMd = String(body?.bodyMd || "").trim();
  if (!bodyMd) return NextResponse.json({ ok: false, error: "bodyMd required" }, { status: 400 });

  const note = await (prisma as any).meetingNote.findUnique({
    where: { id },
    select: { id: true, notesMd: true },
  });
  if (!note) return NextResponse.json({ ok: false, error: "Meeting note not found" }, { status: 404 });

  // Create the entry row.
  const entry = await (prisma as any).meetingNoteEntry.create({
    data: {
      meetingNoteId: id,
      authorId: user.id,
      bodyMd,
      isEdit: Boolean(body?.editsEntryId),
      editsId: body?.editsEntryId || null,
    },
    select: { id: true, createdAt: true },
  });

  // Append to the markdown body with an attribution header.
  const stamp = `**[${user.name || user.email}, ${new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " ")}]**`;
  const appended = note.notesMd
    ? `${note.notesMd}\n\n${stamp}\n${bodyMd}`
    : `${stamp}\n${bodyMd}`;
  await (prisma as any).meetingNote.update({
    where: { id },
    data: { notesMd: appended, status: "IN_PROGRESS" },
  });

  // Pull all internal users for @mention matching.
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: Array.from(INTERNAL_ROLES) } },
    select: { id: true, name: true, email: true, updatedAt: true },
  });
  const extracted = extractActionItems(bodyMd, users as any);

  const createdActionIds: string[] = [];
  for (const ex of extracted) {
    const item = await (prisma as any).meetingActionItem.create({
      data: {
        meetingNoteId: id,
        sourceEntryId: entry.id,
        description: ex.description,
        assigneeId: ex.assigneeId,
        priority: ex.priority,
        dueDate: ex.dueDate,
        createdById: user.id,
      },
      select: { id: true, assigneeId: true },
    });
    createdActionIds.push(item.id);

    // Immediate fan-out — in-app + email — when an assignee is set.
    if (item.assigneeId) {
      await prisma.notification
        .create({
          data: {
            userId: item.assigneeId,
            type: "SYSTEM",
            title: `New action item: ${ex.description.slice(0, 60)}`,
            message: `${user.name || user.email} assigned this to you in a meeting.`,
            link: `/meeting-notes/${id}`,
          },
        })
        .catch(() => null);
      void sendImmediateAssignmentEmail({ actionItemId: item.id }).catch(() => null);
    }
  }

  return NextResponse.json({
    ok: true,
    entry: { id: entry.id, createdAt: entry.createdAt },
    actionItems: createdActionIds,
  });
}
