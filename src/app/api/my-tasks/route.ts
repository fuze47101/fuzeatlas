// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

/**
 * GET /api/my-tasks
 *   ?status=OPEN|DONE|BLOCKED|CANCELLED (default OPEN)
 *   ?priority=URGENT|HIGH|NORMAL|LOW
 *   ?sort=priority|due|created|meeting
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") || "OPEN";
  const priorityFilter = url.searchParams.get("priority");
  const sort = url.searchParams.get("sort") || "priority";

  const where: any = { assigneeId: user.id };
  if (statusFilter && statusFilter !== "ALL") where.status = statusFilter;
  if (priorityFilter) where.priority = priorityFilter;

  const items = await (prisma as any).meetingActionItem.findMany({
    where,
    include: {
      meetingNote: { select: { id: true, title: true, meetingDate: true } },
      createdBy: { select: { id: true, name: true } },
    },
    take: 500,
  });

  items.sort((a: any, b: any) => {
    if (sort === "priority") {
      const ar = PRIORITY_RANK[a.priority] ?? 9;
      const br = PRIORITY_RANK[b.priority] ?? 9;
      if (ar !== br) return ar - br;
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    }
    if (sort === "due") {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    }
    if (sort === "meeting") {
      const am = a.meetingNote?.meetingDate ? new Date(a.meetingNote.meetingDate).getTime() : 0;
      const bm = b.meetingNote?.meetingDate ? new Date(b.meetingNote.meetingDate).getTime() : 0;
      return bm - am;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return NextResponse.json({
    ok: true,
    count: items.length,
    items,
  });
}
