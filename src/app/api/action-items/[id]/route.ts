// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendImmediateAssignmentEmail } from "@/lib/meeting-emails";

/**
 * PATCH /api/action-items/[id]
 *   Body: { status?, priority?, dueDate?, assigneeId?, description? }
 *
 * Used by the /my-tasks board to mark done / reassign / change priority
 * / change due date. ACL: assignee can self-act; admins can act on any.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const item = await (prisma as any).meetingActionItem.findUnique({
    where: { id },
    select: { id: true, assigneeId: true, createdById: true, meetingNoteId: true },
  });
  if (!item) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user.role);
  const isAssignee = item.assigneeId === user.id;
  const isCreator = item.createdById === user.id;
  if (!isAdmin && !isAssignee && !isCreator) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  let newAssignee = false;
  if (body.status !== undefined) {
    data.status = String(body.status);
    if (data.status === "DONE") {
      data.doneAt = new Date();
      data.doneById = user.id;
    }
  }
  if (body.priority !== undefined) data.priority = String(body.priority);
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.description !== undefined) data.description = String(body.description);
  if (body.assigneeId !== undefined && body.assigneeId !== item.assigneeId) {
    data.assigneeId = body.assigneeId || null;
    newAssignee = Boolean(body.assigneeId);
  }

  const updated = await (prisma as any).meetingActionItem.update({
    where: { id },
    data,
    select: { id: true, status: true, priority: true, dueDate: true, assigneeId: true, description: true },
  });

  // Reassignment triggers a fresh immediate-assignment email to the
  // new assignee.
  if (newAssignee && updated.assigneeId) {
    void sendImmediateAssignmentEmail({ actionItemId: id }).catch(() => null);
    await prisma.notification
      .create({
        data: {
          userId: updated.assigneeId,
          type: "SYSTEM",
          title: `Action item reassigned to you: ${updated.description.slice(0, 60)}`,
          message: `${user.name || user.email} reassigned this to you.`,
          link: item.meetingNoteId ? `/meeting-notes/${item.meetingNoteId}` : `/my-tasks`,
        },
      })
      .catch(() => null);
  }

  return NextResponse.json({ ok: true, item: updated });
}
