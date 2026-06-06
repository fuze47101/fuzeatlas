// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/projects/[id]/reopen
 *
 * Phase 54.5 Fix 2 — re-open a project that was marked complete.
 *
 * Clears closedAt / closedById, sets stage back to DEVELOPMENT, and
 * stamps lastUpdatedAt so the project lands at the top of the stale
 * list for re-engagement.
 *
 * ACL: ADMIN / EMPLOYEE / SALES_MANAGER / SALES_REP / BD_REP — same
 * gate as the weekly-update endpoint.
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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.project.findUnique({
    where: { id },
    select: { id: true, closedAt: true } as any,
  });
  if (!existing) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  if (!(existing as any).closedAt) {
    return NextResponse.json({ ok: true, alreadyOpen: true });
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      closedAt: null,
      closedById: null,
      stage: "DEVELOPMENT",
      lastUpdatedAt: new Date(),
    } as any,
    select: { id: true, name: true, stage: true } as any,
  });

  return NextResponse.json({ ok: true, project });
}
