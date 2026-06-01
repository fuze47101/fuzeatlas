// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { extractActionItems } from "@/lib/meeting-mentions";
import { sendImmediateAssignmentEmail } from "@/lib/meeting-emails";

/**
 * POST /api/admin/projects/[id]/weekly-update
 *
 * Phase 54.5 Track 2/3 — quick-fire weekly status drop on a project.
 *
 *   Body: { weeklyStatusMd?: string,
 *           extraTasks?: Array<{ description, assigneeId?, priority?, dueDate? }>,
 *           markComplete?: boolean,
 *           closingNotes?: string }
 *
 *  1. Stamps Project.weeklyStatus + lastUpdatedAt.
 *  2. Appends a MeetingNoteEntry on the project's kickoff MeetingNote
 *     (so @mentions extract action items naturally).
 *  3. Creates explicit-form extraTasks against the same kickoff note.
 *  4. If markComplete, stamps closedAt/closedById/closingNotes and
 *     flips stage to COMPLETE.
 *  5. Fires email-on-assign for every assignee touched.
 */
const ALLOWED_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
]);
const VALID_PRIORITY = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

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

  const project = await (prisma as any).project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      kickoffMeetingNoteId: true,
      closedAt: true,
    } as any,
  });
  if (!project) return bad("Project not found", 404);

  const body = await req.json().catch(() => ({}));
  const weeklyStatusMd = body?.weeklyStatusMd ? String(body.weeklyStatusMd).trim() : "";
  const extraTasks = Array.isArray(body?.extraTasks) ? body.extraTasks : [];
  const markComplete = Boolean(body?.markComplete);
  const closingNotes = body?.closingNotes ? String(body.closingNotes).trim() : null;

  if (!weeklyStatusMd && extraTasks.length === 0 && !markComplete) {
    return bad("weeklyStatusMd, extraTasks, or markComplete required");
  }
  for (const t of extraTasks) {
    if (!t?.description || !String(t.description).trim()) continue;
    if (t.priority && !VALID_PRIORITY.has(String(t.priority).toUpperCase())) {
      return bad(`invalid priority: ${t.priority}`);
    }
  }

  let kickoffNoteId: string | null = project.kickoffMeetingNoteId || null;

  // If the project somehow has no kickoff note, create one on the fly.
  if (!kickoffNoteId) {
    const k = await (prisma as any).meetingNote.create({
      data: {
        title: `Project Kickoff — ${project.name}`,
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

  // Build entry body — header + status narrative + explicit tasks list.
  const stamp = `**[${user.name || user.email}, ${new Date().toISOString().slice(0, 16).replace("T", " ")}]**`;
  const sections: string[] = [stamp];
  if (weeklyStatusMd) sections.push(`## Weekly Update\n\n${weeklyStatusMd}`);
  const cleanExtras = extraTasks.filter(
    (t: any) => t?.description && String(t.description).trim(),
  );
  if (cleanExtras.length > 0) {
    const lines = cleanExtras
      .map((t: any) => {
        const dueLabel = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "unset";
        return `- ${String(t.description).trim()} (${String(t.priority || "NORMAL").toUpperCase()}, due ${dueLabel})`;
      })
      .join("\n");
    sections.push(`## New Tasks\n\n${lines}`);
  }
  if (markComplete) sections.push(`## Project Complete\n\n${closingNotes || "(no closing notes)"}`);

  const entryBody = sections.join("\n\n");

  // Action items extracted from the @mention parser on the
  // weeklyStatusMd body (so "@Tina to send SDS" auto-spawns).
  const internalUsers = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, email: true, updatedAt: true },
  });
  const extracted = extractActionItems(weeklyStatusMd || "", internalUsers as any);

  const created = await prisma.$transaction(async (tx) => {
    const entry = await (tx as any).meetingNoteEntry.create({
      data: {
        meetingNoteId: kickoffNoteId,
        authorId: user.id,
        bodyMd: entryBody,
      },
      select: { id: true },
    });

    // Append to MeetingNote.notesMd so the timeline renders directly.
    const note = await (tx as any).meetingNote.findUnique({
      where: { id: kickoffNoteId },
      select: { notesMd: true },
    });
    const appended = note?.notesMd
      ? `${note.notesMd}\n\n${entryBody}`
      : entryBody;
    await (tx as any).meetingNote.update({
      where: { id: kickoffNoteId },
      data: { notesMd: appended, status: markComplete ? "COMPLETED" : "IN_PROGRESS" },
    });

    const newActionItems: Array<{ id: string; assigneeId: string | null }> = [];

    // 1. @mention-parsed action items from weeklyStatusMd.
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
      newActionItems.push(ai);
    }
    // 2. Explicit-form extraTasks.
    for (const t of cleanExtras) {
      const ai = await (tx as any).meetingActionItem.create({
        data: {
          meetingNoteId: kickoffNoteId,
          sourceEntryId: entry.id,
          description: String(t.description).trim(),
          assigneeId: t.assigneeId || null,
          priority: String(t.priority || "NORMAL").toUpperCase(),
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          status: "OPEN",
          createdById: user.id,
        },
        select: { id: true, assigneeId: true },
      });
      newActionItems.push(ai);
    }

    // Stamp project fields.
    const projectPatch: any = {
      lastUpdatedAt: new Date(),
    };
    if (weeklyStatusMd) projectPatch.weeklyStatus = weeklyStatusMd;
    if (markComplete) {
      projectPatch.closedAt = new Date();
      projectPatch.closedById = user.id;
      projectPatch.stage = "COMPLETE";
      if (closingNotes) projectPatch.closingNotes = closingNotes;
    }
    await tx.project.update({ where: { id: project.id }, data: projectPatch as any });

    return { entryId: entry.id, actionItems: newActionItems };
  });

  // Best-effort email fan-out post-commit.
  for (const ai of created.actionItems) {
    if (ai.assigneeId) {
      void sendImmediateAssignmentEmail({ actionItemId: ai.id }).catch(() => null);
    }
  }

  return NextResponse.json({
    ok: true,
    projectId: project.id,
    kickoffMeetingNoteId: kickoffNoteId,
    entryId: created.entryId,
    actionItemsCreated: created.actionItems.length,
    markedComplete: markComplete,
  });
}
