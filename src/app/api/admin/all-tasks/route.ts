// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);

/**
 * GET /api/admin/all-tasks
 *   ?status=OPEN|DONE|... (default OPEN)
 *
 * Returns every action item grouped by assignee for the admin rollup.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") || "OPEN";
  const where: any = {};
  if (statusFilter !== "ALL") where.status = statusFilter;

  const items = await (prisma as any).meetingActionItem.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      meetingNote: { select: { id: true, title: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    take: 1000,
  });

  const groups: Record<string, any> = {};
  for (const it of items) {
    const key = it.assignee?.id || "_unassigned";
    if (!groups[key]) {
      groups[key] = {
        assignee: it.assignee || { id: null, name: "Unassigned", email: null },
        count: 0,
        items: [] as any[],
      };
    }
    groups[key].count++;
    groups[key].items.push(it);
  }

  const list = Object.values(groups).sort((a: any, b: any) => b.count - a.count);
  return NextResponse.json({ ok: true, totalItems: items.length, groups: list });
}
