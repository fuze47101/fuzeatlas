// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendImmediateAssignmentEmail } from "@/lib/meeting-emails";

/**
 * PATCH  /api/meeting-notes/[id]/project-blocks/[blockId]/tasks/[taskId]
 *   Body: any subset of { description, assigneeId, priority,
 *     dueDate, status }
 *   Reassignment fires the email-on-assign loop again.
 *
 * DELETE /api/meeting-notes/[id]/project-blocks/[blockId]/tasks/[taskId]
 */
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

const VALID_PRIORITY = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);
const VALID_STATUS = new Set(["OPEN", "IN_PROGRESS", "DONE", "BLOCKED", "CANCELLED"]);

function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; blockId: string; taskId: string }> },
) {
  const { id, blockId, taskId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const existing = await (prisma as any).meetingActionItem.findUnique({
    where: { id: taskId },
    select: { id: true, meetingNoteId: true, projectBlockId: true, assigneeId: true, description: true },
  });
  if (!existing || existing.meetingNoteId !== id) {
    return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.description !== undefined) data.description = String(body.description);
  if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId || null;
  if (body.priority !== undefined) {
    const p = String(body.priority || "").toUpperCase();
    if (!VALID_PRIORITY.has(p)) return NextResponse.json({ ok: false, error: "priority invalid" }, { status: 400 });
    data.priority = p;
  }
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.status !== undefined) {
    const s = String(body.status || "").toUpperCase();
    if (!VALID_STATUS.has(s)) return NextResponse.json({ ok: false, error: "status invalid" }, { status: 400 });
    data.status = s;
    if (s === "DONE" && !existing.completedAt) data.completedAt = new Date();
  }
  // Allow moving a task to a different block on this meeting.
  if (body.projectBlockId !== undefined) {
    if (body.projectBlockId) {
      const targetBlock = await (prisma as any).meetingProjectBlock.findUnique({
        where: { id: body.projectBlockId },
        select: { id: true, meetingNoteId: true },
      });
      if (!targetBlock || targetBlock.meetingNoteId !== id) {
        return NextResponse.json({ ok: false, error: "target block not on this meeting" }, { status: 400 });
      }
    }
    data.projectBlockId = body.projectBlockId || null;
  }

  const task = await (prisma as any).meetingActionItem.update({
    where: { id: taskId },
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  // Reassignment → fire email + notification.
  const reassigned =
    data.assigneeId !== undefined && data.assigneeId && data.assigneeId !== existing.assigneeId;
  if (reassigned) {
    await prisma.notification
      .create({
        data: {
          userId: task.assigneeId,
          type: "SYSTEM",
          title: `Action item reassigned to you`,
          message: `${user.name || user.email} reassigned this to you: ${String(task.description).slice(0, 80)}`,
          link: `/my-tasks`,
        },
      })
      .catch(() => null);
    void sendImmediateAssignmentEmail({ actionItemId: task.id }).catch(() => null);
  }

  return NextResponse.json({ ok: true, task });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; blockId: string; taskId: string }> },
) {
  const { id, blockId, taskId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const existing = await (prisma as any).meetingActionItem.findUnique({
    where: { id: taskId },
    select: { id: true, meetingNoteId: true },
  });
  if (!existing || existing.meetingNoteId !== id) {
    return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  }

  await (prisma as any).meetingActionItem.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
