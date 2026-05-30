// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendImmediateAssignmentEmail } from "@/lib/meeting-emails";

/**
 * POST /api/meeting-notes/[id]/project-blocks/[blockId]/tasks
 *   Body: { description, assigneeId?, priority?, dueDate? }
 *   Creates a MeetingActionItem attached to the block. Fires
 *   in-app notification + email-on-assignment when assignee set.
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

function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const { id, blockId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const block = await (prisma as any).meetingProjectBlock.findUnique({
    where: { id: blockId },
    select: { id: true, meetingNoteId: true },
  });
  if (!block || block.meetingNoteId !== id) {
    return NextResponse.json({ ok: false, error: "Block not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const description = String(body?.description || "").trim();
  if (!description) {
    return NextResponse.json({ ok: false, error: "description required" }, { status: 400 });
  }
  const priority = VALID_PRIORITY.has(String(body?.priority || "").toUpperCase())
    ? String(body.priority).toUpperCase()
    : "NORMAL";
  const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
  const assigneeId = body?.assigneeId || null;

  const item = await (prisma as any).meetingActionItem.create({
    data: {
      meetingNoteId: id,
      projectBlockId: blockId,
      description,
      priority,
      dueDate,
      assigneeId,
      createdById: user.id,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  if (item.assigneeId) {
    await prisma.notification
      .create({
        data: {
          userId: item.assigneeId,
          type: "SYSTEM",
          title: `New action item: ${description.slice(0, 60)}`,
          message: `${user.name || user.email} assigned this to you in a meeting.`,
          link: `/my-tasks`,
        },
      })
      .catch(() => null);
    void sendImmediateAssignmentEmail({ actionItemId: item.id }).catch(() => null);
  }

  return NextResponse.json({ ok: true, task: item });
}
