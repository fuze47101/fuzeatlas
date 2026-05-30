// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Phase 55 — Structured project blocks for meeting notes.
 *
 * GET    /api/meeting-notes/[id]/project-blocks
 *          → list all blocks for a meeting, sorted by priority A→D
 *          then sortOrder, then createdAt.
 *
 * POST   /api/meeting-notes/[id]/project-blocks
 *          Body: { customerType: 'BRAND'|'FACTORY'|'OTHER',
 *                  brandId?, factoryId?, internalLabel?,
 *                  ownerId?, priority?, discussionMd? }
 *          → create a new block on the meeting.
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

const PRIORITY_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
function sortBlocks(rows: any[]): any[] {
  return [...rows].sort((a, b) => {
    const ra = PRIORITY_RANK[a.priority || ""] || 99;
    const rb = PRIORITY_RANK[b.priority || ""] || 99;
    if (ra !== rb) return ra - rb;
    if ((a.sortOrder || 0) !== (b.sortOrder || 0)) return (a.sortOrder || 0) - (b.sortOrder || 0);
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const rows = await (prisma as any).meetingProjectBlock.findMany({
    where: { meetingNoteId: id },
    include: blockInclude(),
  });
  return NextResponse.json({ ok: true, blocks: sortBlocks(rows) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const customerType = String(body?.customerType || "").toUpperCase();
  if (!["BRAND", "FACTORY", "OTHER"].includes(customerType)) {
    return NextResponse.json({ ok: false, error: "customerType must be BRAND, FACTORY, or OTHER" }, { status: 400 });
  }
  const priority = body?.priority && ["A", "B", "C", "D"].includes(String(body.priority).toUpperCase())
    ? String(body.priority).toUpperCase()
    : null;

  const note = await (prisma as any).meetingNote.findUnique({ where: { id }, select: { id: true } });
  if (!note) return NextResponse.json({ ok: false, error: "Meeting not found" }, { status: 404 });

  const block = await (prisma as any).meetingProjectBlock.create({
    data: {
      meetingNoteId: id,
      customerType,
      brandId: customerType === "BRAND" ? (body?.brandId || null) : null,
      factoryId: customerType === "FACTORY" ? (body?.factoryId || null) : null,
      internalLabel: customerType === "OTHER" ? (body?.internalLabel || null) : null,
      ownerId: body?.ownerId || null,
      priority,
      discussionMd: String(body?.discussionMd || ""),
      sortOrder: Number(body?.sortOrder || 0) | 0,
      createdById: user.id,
    },
    include: blockInclude(),
  });

  if (block.ownerId && block.owner?.email) {
    await prisma.notification
      .create({
        data: {
          userId: block.ownerId,
          type: "SYSTEM",
          title: `You're the lead on a meeting project`,
          message: `${user.name || user.email} put you in charge of a project block.`,
          link: `/meeting-notes/${id}`,
        },
      })
      .catch(() => null);
  }

  return NextResponse.json({ ok: true, block });
}
