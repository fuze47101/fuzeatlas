// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * PATCH /api/admin/projects/[id]
 *
 * Phase 54 T5 — partial project updates. Owner-change supported with
 * tighter ACL: ADMIN / EMPLOYEE / SALES_MANAGER or the current
 * project.ownerId can reassign. Other roles can only edit name +
 * goalMd if they're the owner.
 */
const STAFF_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);
const READ_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
  "FACTORY_MANAGER",
]);

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/**
 * GET /api/admin/projects/[id]
 *
 * Header + Overview/Tasks/Meetings tab data. Sample grid stays on
 * /api/admin/projects/[id]/grid (Phase 52 T3).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return bad("Unauthorized", 401);
  if (!READ_ROLES.has(user.role)) return bad("Forbidden", 403);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true } },
      factory: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } } as any,
      meetingNotes: {
        orderBy: { meetingDate: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          meetingDate: true,
          createdBy: { select: { id: true, name: true } },
          _count: { select: { entries: true, actionItems: true } },
        },
      } as any,
    },
  });
  if (!project) return bad("Project not found", 404);

  const actionItems = await (prisma as any).meetingActionItem.findMany({
    where: { meetingNote: { projectId: id } },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      meetingNote: { select: { id: true, title: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });

  const openActionItems = actionItems.filter((a: any) => a.status === "OPEN").length;
  const meetingCount = (project as any).meetingNotes?.length || 0;
  const testRequestsCount = await prisma.testRequest
    .count({ where: { projectId: id } })
    .catch(() => 0);

  // Last 5 MeetingNoteEntry rows across every meeting note tied to
  // this project — drives the "Recent activity" strip in the inline
  // expanded row.
  const recentEntries = await (prisma as any).meetingNoteEntry.findMany({
    where: { meetingNote: { projectId: id } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      bodyMd: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
      meetingNote: { select: { id: true, title: true } },
    },
  });

  // Prev/Next sibling so the detail page can offer "← previous /
  // next →" navigation without bouncing back to the list. Order
  // matches /admin/projects/weekly: closed projects excluded, then
  // sorted by lastUpdatedAt asc (most stale first), createdAt asc
  // as tiebreaker.
  // 2026-06-08 — was `where: { closedAt: null }`. That excluded the
  // current project when it was closed (idx === -1, prev/next both
  // null), so opening any project directly via deep-link showed no
  // navigation. Include every project; the user wants to walk
  // Prev→Next through all of them while taking notes.
  const siblings = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      lastUpdatedAt: true,
      createdAt: true,
    } as any,
  });
  siblings.sort((a: any, b: any) => {
    const da = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
    const db = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
    if (da !== db) return da - db;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const idx = siblings.findIndex((s: any) => s.id === id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return NextResponse.json({
    ok: true,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      stage: project.stage,
      projectType: (project as any).projectType || "BRAND",
      goalMd: (project as any).goalMd || null,
      ownerId: (project as any).ownerId || null,
      owner: (project as any).owner || null,
      brandId: project.brandId,
      brandName: project.brand?.name || null,
      factoryId: project.factoryId,
      factoryName: project.factory?.name || null,
      kickoffMeetingNoteId: (project as any).kickoffMeetingNoteId || null,
      projectedValue: project.projectedValue,
      annualVolumeMeters: project.annualVolumeMeters,
      fuzeTier: project.fuzeTier,
      createdAt: project.createdAt,
    },
    counts: {
      openActionItems,
      totalActionItems: actionItems.length,
      meetings: meetingCount,
      testRequests: testRequestsCount,
    },
    actionItems,
    meetings: (project as any).meetingNotes || [],
    recentEntries,
    siblings: {
      prev: prev ? { id: prev.id, name: prev.name } : null,
      next: next ? { id: next.id, name: next.name } : null,
      position: idx + 1,
      total: siblings.length,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return bad("Unauthorized", 401);

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, ownerId: true, name: true } as any,
  });
  if (!project) return bad("Project not found", 404);

  const isStaff = STAFF_ROLES.has(user.role);
  const isOwner = (project as any).ownerId === user.id;
  if (!isStaff && !isOwner) return bad("Forbidden", 403);

  const body = await req.json().catch(() => ({}));
  const data: any = {};

  // Owner-change — staff OR the outgoing owner.
  if (body.ownerId !== undefined) {
    if (!isStaff && !isOwner) return bad("Owner change requires staff or current owner", 403);
    const newOwnerId = String(body.ownerId);
    const newOwner = await prisma.user.findUnique({
      where: { id: newOwnerId },
      select: { id: true, name: true, email: true },
    });
    if (!newOwner) return bad("new owner user not found", 404);
    data.ownerId = newOwnerId;
  }

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.goalMd !== undefined) data.goalMd = body.goalMd ? String(body.goalMd) : null;

  // Stage / projectType / brand / factory edits are staff-only.
  if (body.stage !== undefined) {
    if (!isStaff) return bad("stage change requires staff", 403);
    data.stage = String(body.stage);
  }
  if (body.projectType !== undefined) {
    if (!isStaff) return bad("projectType change requires staff", 403);
    data.projectType = String(body.projectType).toUpperCase();
  }
  if (body.brandId !== undefined) {
    if (!isStaff) return bad("brand change requires staff", 403);
    data.brandId = body.brandId || null;
  }
  if (body.factoryId !== undefined) {
    if (!isStaff) return bad("factory change requires staff", 403);
    data.factoryId = body.factoryId || null;
  }

  const updated = await prisma.project.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      ownerId: true,
      goalMd: true,
      stage: true,
      projectType: true,
      brandId: true,
      factoryId: true,
    } as any,
  });

  // Owner-change notification — fire after the row commits.
  if (data.ownerId && data.ownerId !== (project as any).ownerId) {
    await prisma.notification
      .create({
        data: {
          userId: data.ownerId,
          type: "SYSTEM",
          title: `You've been assigned ownership of project: ${updated.name}`,
          message: `${user.name || user.email} reassigned ownership to you.`,
          link: `/admin/projects/${id}`,
        },
      })
      .catch(() => null);
  }

  return NextResponse.json({ ok: true, project: updated });
}

/**
 * DELETE /api/admin/projects/[id]
 *
 * Phase 56 — destructive permanent delete. Cascade-clears the
 * kickoff MeetingNote, every MeetingActionItem tied to it, and
 * detaches any MeetingProjectBlock pointing at this project (via
 * onDelete: SetNull on MeetingProjectBlock.projectId). ACL:
 * ADMIN / EMPLOYEE only — destructive.
 */
const DELETE_ALLOWED = new Set(["ADMIN", "EMPLOYEE"]);
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return bad("Unauthorized", 401);
  if (!DELETE_ALLOWED.has(user.role)) return bad("Forbidden", 403);

  const existing = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, kickoffMeetingNoteId: true } as any,
  });
  if (!existing) return bad("Project not found", 404);

  try {
    await prisma.$transaction(async (tx) => {
      // Detach MeetingProjectBlock rows pointing at this project so
      // the SET NULL FK doesn't fight us.
      await (tx as any).meetingProjectBlock.updateMany({
        where: { projectId: id } as any,
        data: { projectId: null } as any,
      });
      // Delete kickoff MeetingNote (cascades to its entries +
      // action items via Prisma onDelete: Cascade).
      if ((existing as any).kickoffMeetingNoteId) {
        await (tx as any).meetingNote.delete({
          where: { id: (existing as any).kickoffMeetingNoteId },
        }).catch(() => null);
      }
      await tx.project.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true, deletedId: id, deletedName: (existing as any).name });
  } catch (e: any) {
    console.error("[DELETE /api/admin/projects/[id]] failed:", e?.message, e?.code, e?.meta);
    return NextResponse.json(
      { ok: false, error: e?.message || "delete failed", code: e?.code || null, meta: e?.meta || null },
      { status: 500 },
    );
  }
}
