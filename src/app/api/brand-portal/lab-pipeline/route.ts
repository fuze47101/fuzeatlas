// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/brand-portal/lab-pipeline  (Phase 4F — DO+OVERSEE)
 *
 * Cross-cutting view of every TestRequest + brand-visible TestRun
 * for fabrics in the caller's brand's supply chain. Groups by
 * status into:
 *   pending  — TestRequests not yet COMPLETE/CANCELLED/REJECTED
 *   results  — TestRuns with brandVisible=true (recent first)
 *   summary  — counts by status + by lab + by factory
 *
 * Brand OVERSEE: full visibility into what's in flight at every
 * lab handling their fabrics.
 */

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!user.brandId) return forbidden();
  const brandId = user.brandId;

  // Pending requests — anything not closed.
  const pending = await prisma.testRequest.findMany({
    where: {
      brandId,
      status: { notIn: ["COMPLETE", "CANCELLED", "REJECTED"] },
    },
    select: {
      id: true,
      poNumber: true,
      status: true,
      requestedAt: true,
      pricingTier: true,
      lab: { select: { id: true, name: true, city: true, country: true } },
      fabric: { select: { id: true, fuzeNumber: true, customerCode: true } },
      submission: {
        select: {
          id: true,
          factoryId: true,
          factory: { select: { id: true, name: true } },
          fuzeFabricNumber: true,
        },
      },
      lines: { select: { id: true, testType: true } },
    },
    orderBy: [{ requestedAt: "desc" }],
    take: 200,
  });

  // Brand-visible results — most recent 100.
  const results = await prisma.testRun.findMany({
    where: {
      brandVisible: true,
      submission: { brandId },
    },
    select: {
      id: true,
      testType: true,
      testReportNumber: true,
      testDate: true,
      brandVisible: true,
      submission: {
        select: {
          id: true,
          factoryId: true,
          factory: { select: { id: true, name: true } },
          fuzeFabricNumber: true,
        },
      },
      lab: { select: { id: true, name: true } },
      fabric: { select: { id: true, fuzeNumber: true } },
      icpResult: { select: { agValue: true } },
      abResult: { select: { pass: true } },
      fungalResult: { select: { pass: true } },
      odorResult: { select: { pass: true } },
    },
    orderBy: [{ testDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  // Lightweight summary buckets.
  const byStatus: Record<string, number> = {};
  const byLab: Record<string, { name: string; count: number }> = {};
  const byFactory: Record<string, { name: string; count: number }> = {};
  for (const r of pending) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.lab?.id) {
      const k = r.lab.id;
      byLab[k] = byLab[k] || { name: r.lab.name, count: 0 };
      byLab[k].count++;
    }
    const fName = r.submission?.factory?.name || "—";
    const fId = r.submission?.factoryId || "_";
    byFactory[fId] = byFactory[fId] || { name: fName, count: 0 };
    byFactory[fId].count++;
  }

  return NextResponse.json({
    ok: true,
    summary: {
      pendingTotal: pending.length,
      resultsTotal: results.length,
      byStatus,
      byLab: Object.entries(byLab).map(([id, v]) => ({ id, ...v })),
      byFactory: Object.entries(byFactory).map(([id, v]) => ({ id, ...v })),
    },
    pending,
    results,
  });
}
