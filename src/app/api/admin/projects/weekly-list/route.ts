// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/projects/weekly-list
 *
 * Phase 54.5 Track 2 — feed the /admin/projects/weekly page.
 *
 *   ?status=closed  → returns only closed projects (closedAt is not null)
 *   default         → active projects (closedAt is null) sorted by
 *                     lastUpdatedAt asc (nulls first → oldest stale on top).
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

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const closedOnly = status === "closed";

  // Hide INTERNAL projects from non-admin roles.
  const baseWhere: any = closedOnly
    ? { closedAt: { not: null } }
    : { closedAt: null };
  if (user.role !== "ADMIN") {
    baseWhere.projectType = { not: "INTERNAL" };
  }

  const projects = await prisma.project.findMany({
    where: baseWhere,
    select: {
      id: true,
      name: true,
      stage: true,
      projectType: true,
      priority: true,
      weeklyStatus: true,
      lastUpdatedAt: true,
      closedAt: true,
      brand: { select: { id: true, name: true, subtype: true } },
      factory: { select: { id: true, name: true } },
      distributor: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      kickoffMeetingNoteId: true,
      createdAt: true,
    } as any,
  });

  // Sort: null lastUpdatedAt first (most stale), then oldest asc.
  projects.sort((a: any, b: any) => {
    const da = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
    const db = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
    if (da === db) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return da - db;
  });

  const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  // Secondary stable sort: surface URGENT to the top even if recently
  // updated. Use Array.prototype.sort which is stable in V8.
  if (closedOnly) {
    // already in stale order; no priority re-sort for closed view
  } else {
    projects.sort((a: any, b: any) => {
      const ra = PRIORITY_RANK[a.priority || ""] ?? 4;
      const rb = PRIORITY_RANK[b.priority || ""] ?? 4;
      if (ra !== rb) return ra - rb;
      return 0;
    });
  }

  return NextResponse.json({ ok: true, projects });
}
