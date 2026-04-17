// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/feedback
 * Admin + employee-only. Returns all feedback with optional status/category filters.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "ADMIN" && user.role !== "EMPLOYEE") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const limit = parseInt(url.searchParams.get("limit") || "200", 10);

  const where: any = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const reports = await prisma.feedbackReport.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(limit, 500),
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // Summary counts by status
  const counts = await prisma.feedbackReport.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  counts.forEach((c: any) => {
    byStatus[c.status] = c._count._all;
  });

  return NextResponse.json({ ok: true, reports, byStatus });
}
