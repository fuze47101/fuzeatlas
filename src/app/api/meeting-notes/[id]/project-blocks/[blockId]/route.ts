// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * PATCH /api/meeting-notes/[id]/project-blocks/[blockId]
 *   Body: any subset of { customerType, brandId, factoryId,
 *     internalLabel, ownerId, priority, sortOrder, discussionMd }
 *
 * DELETE /api/meeting-notes/[id]/project-blocks/[blockId]
 *   Cascade clears MeetingActionItem.projectBlockId via SET NULL.
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

function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

function blockInclude() {
  return {
    brand: { select: { id: true, name: true } },
    factory: { select: { id: true, name: true } },
    owner: { select: { id: true, name: true, email: true } },
    createdBy: { select: { id: true, name: true } },
    actionItems: {
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    },
  } as const;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const { id, blockId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const existing = await (prisma as any).meetingProjectBlock.findUnique({
    where: { id: blockId },
    select: { id: true, meetingNoteId: true, ownerId: true },
  });
  if (!existing || existing.meetingNoteId !== id) {
    return NextResponse.json({ ok: false, error: "Block not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: any = {};

  if (body.customerType !== undefined) {
    const ct = String(body.customerType).toUpperCase();
    if (!["BRAND", "FACTORY", "OTHER"].includes(ct)) {
      return NextResponse.json({ ok: false, error: "customerType invalid" }, { status: 400 });
    }
    data.customerType = ct;
    // Clean up other-type fields when switching type.
    if (ct !== "BRAND") data.brandId = null;
    if (ct !== "FACTORY") data.factoryId = null;
    if (ct !== "OTHER") data.internalLabel = null;
  }
  if (body.brandId !== undefined) data.brandId = body.brandId || null;
  if (body.factoryId !== undefined) data.factoryId = body.factoryId || null;
  if (body.internalLabel !== undefined) data.internalLabel = body.internalLabel || null;
  if (body.ownerId !== undefined) data.ownerId = body.ownerId || null;
  if (body.priority !== undefined) {
    const p = body.priority ? String(body.priority).toUpperCase() : null;
    if (p && !["A", "B", "C", "D"].includes(p)) {
      return NextResponse.json({ ok: false, error: "priority must be A|B|C|D" }, { status: 400 });
    }
    data.priority = p;
  }
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) | 0;
  if (body.discussionMd !== undefined) data.discussionMd = String(body.discussionMd);

  const block = await (prisma as any).meetingProjectBlock.update({
    where: { id: blockId },
    data,
    include: blockInclude(),
  });

  // Owner change → notify new owner.
  if (
    data.ownerId !== undefined &&
    data.ownerId &&
    data.ownerId !== existing.ownerId
  ) {
    await prisma.notification
      .create({
        data: {
          userId: data.ownerId,
          type: "SYSTEM",
          title: `You're now the lead on a meeting project`,
          message: `${user.name || user.email} reassigned a project block to you.`,
          link: `/meeting-notes/${id}`,
        },
      })
      .catch(() => null);
  }

  return NextResponse.json({ ok: true, block });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const { id, blockId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const existing = await (prisma as any).meetingProjectBlock.findUnique({
    where: { id: blockId },
    select: { id: true, meetingNoteId: true },
  });
  if (!existing || existing.meetingNoteId !== id) {
    return NextResponse.json({ ok: false, error: "Block not found" }, { status: 404 });
  }

  await (prisma as any).meetingProjectBlock.delete({ where: { id: blockId } });
  return NextResponse.json({ ok: true });
}
