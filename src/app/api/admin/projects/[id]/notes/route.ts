// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { extractActionItems } from "@/lib/meeting-mentions";
import { sendImmediateAssignmentEmail } from "@/lib/meeting-emails";

/**
 * POST /api/admin/projects/[id]/notes
 *
 * 2026-06-08 — plain dated note append. Differs from the existing
 * weekly-update endpoint by not touching weeklyStatus / markComplete
 * / explicit task rows. Body is just bodyMd. The entry lands on
 * the project's kickoff MeetingNote so /admin/projects/[id]
 * renders it in the chronological log; the @mention parser still
 * runs so "@Tina to send Silvadur SDS by Friday" auto-spawns an
 * assigned MeetingActionItem.
 *
 * Body: { bodyMd: string }
 *
 * ACL: ADMIN / EMPLOYEE / SALES_MANAGER / SALES_REP / BD_REP /
 *      TESTING_MANAGER / FABRIC_MANAGER.
 */
const ALLOWED_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
]);

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return bad("Unauthorized", 401);
  if (!ALLOWED_ROLES.has(user.role)) return bad("Forbidden", 403);

  const body = await req.json().catch(() => ({}));
  const bodyMd = String(body?.bodyMd || "").trim();
  if (!bodyMd) return bad("bodyMd required");

  const project = await (prisma as any).project.findUnique({
    where: { id },
    select: { id: true, name: true, kickoffMeetingNoteId: true } as any,
  });
  if (!project) return bad("Project not found", 404);

  let kickoffNoteId: string | null = project.kickoffMeetingNoteId || null;
  if (!kickoffNoteId) {
    const k = await (prisma as any).meetingNote.create({
      data: {
        title: project.name,
        meetingDate: new Date(),
        status: "IN_PROGRESS",
        notesMd: "",
        projectId: project.id,
        createdById: user.id,
      },
      select: { id: true },
    });
    kickoffNoteId = k.id;
    await prisma.project.update({
      where: { id: project.id },
      data: { kickoffMeetingNoteId: kickoffNoteId } as any,
    });
  }

  const internalUsers = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, email: true, updatedAt: true },
  });
  const extracted = extractActionItems(bodyMd, internalUsers as any);

  const result = await prisma.$transaction(async (tx) => {
    const entry = await (tx as any).meetingNoteEntry.create({
      data: {
        meetingNoteId: kickoffNoteId,
        authorId: user.id,
        bodyMd,
      },
      select: { id: true, createdAt: true },
    });

    // Append into MeetingNote.notesMd so the timeline view renders
    // immediately if anyone falls back to the raw markdown viewer.
    const stamp = `**[${user.name || user.email}, ${new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " ")}]**`;
    const note = await (tx as any).meetingNote.findUnique({
      where: { id: kickoffNoteId },
      select: { notesMd: true },
    });
    const appended = note?.notesMd
      ? `${note.notesMd}\n\n${stamp}\n${bodyMd}`
      : `${stamp}\n${bodyMd}`;
    await (tx as any).meetingNote.update({
      where: { id: kickoffNoteId },
      data: { notesMd: appended },
    });

    // @mention-parsed action items.
    const created: Array<{ id: string; assigneeId: string | null }> = [];
    for (const ex of extracted) {
      const ai = await (tx as any).meetingActionItem.create({
        data: {
          meetingNoteId: kickoffNoteId,
          sourceEntryId: entry.id,
          description: ex.description,
          assigneeId: ex.assigneeId || null,
          priority: ex.priority,
          dueDate: ex.dueDate || null,
          status: "OPEN",
          createdById: user.id,
        },
        select: { id: true, assigneeId: true },
      });
      created.push(ai);
    }

    // Stamp project.lastUpdatedAt so the weekly view recognises
    // activity. Don't touch weeklyStatus / closedAt — plain note.
    await tx.project.update({
      where: { id: project.id },
      data: { lastUpdatedAt: new Date() } as any,
    });

    return { entryId: entry.id, createdAt: entry.createdAt, actionItems: created };
  });

  // Best-effort post-commit email fan-out.
  for (const ai of result.actionItems) {
    if (ai.assigneeId) {
      void sendImmediateAssignmentEmail({ actionItemId: ai.id }).catch(() => null);
    }
  }

  return NextResponse.json({
    ok: true,
    entryId: result.entryId,
    createdAt: result.createdAt,
    actionItemsCreated: result.actionItems.length,
  });
}
