// @ts-nocheck
/**
 * GET /api/admin/lab-review — Phase 10J.
 *
 * Aggregates the weekly meeting agenda:
 *   1. TestRun rows whose AiTestReview.recommendedAction is
 *      RETEST / REJECT / REVIEW
 *   2. FabricSubmission rows with brandApprovalStatus=REJECTED
 *      in the last 7 days
 *   3. (Hook for future: anomaly-flagged outbound notifications.)
 *
 * Returns a single sorted stream so the page can render one
 * checklist.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ADMIN_ROLES = ["ADMIN", "EMPLOYEE", "TESTING_MANAGER"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const since7 = new Date(Date.now() - 7 * 86400_000);

  const [reviews, rejected] = await Promise.all([
    prisma.aiTestReview.findMany({
      where: {
        recommendedAction: { in: ["RETEST", "REJECT", "REVIEW"] },
        reviewedAt: { gte: since7 },
      },
      orderBy: { reviewedAt: "desc" },
      take: 100,
    }),
    prisma.fabricSubmission.findMany({
      where: {
        brandApprovalStatus: "REJECTED",
        updatedAt: { gte: since7 },
      },
      take: 50,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        fuzeFabricNumber: true,
        brandRejectionReason: true,
        updatedAt: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
      },
    }),
  ]);

  const testRunIds = reviews.map((r) => r.testRunId);
  const testRuns = testRunIds.length
    ? await prisma.testRun.findMany({
        where: { id: { in: testRunIds } },
        select: {
          id: true,
          testType: true,
          testReportNumber: true,
          testDate: true,
          lab: { select: { id: true, name: true } },
          submission: {
            select: {
              fuzeFabricNumber: true,
              brand: { select: { id: true, name: true } },
              factory: { select: { id: true, name: true } },
              fabric: { select: { fuzeNumber: true } },
            },
          },
        },
      })
    : [];
  const trMap = new Map(testRuns.map((t) => [t.id, t]));

  const items = [
    ...reviews.map((r) => {
      const tr = trMap.get(r.testRunId);
      return {
        kind: "AI_REVIEW",
        id: `aireview:${r.id}`,
        at: r.reviewedAt.toISOString(),
        title: `${r.recommendedAction} · ${tr?.testType || "—"} · FUZE-${tr?.submission?.fuzeFabricNumber || tr?.submission?.fabric?.fuzeNumber || "?"}`,
        brand: tr?.submission?.brand || null,
        factory: tr?.submission?.factory || null,
        lab: tr?.lab || null,
        flags: r.flags,
        action: r.recommendedAction,
        notes: r.reviewedNotes,
        link: `/test-results/${r.testRunId}`,
      };
    }),
    ...rejected.map((s) => ({
      kind: "REJECTION",
      id: `rejection:${s.id}`,
      at: s.updatedAt.toISOString(),
      title: `Rejected · FUZE-${s.fuzeFabricNumber || "?"}`,
      brand: s.brand,
      factory: s.factory,
      lab: null,
      reason: s.brandRejectionReason,
      action: "REVIEW_REJECTION",
      link: `/fabrics/by-fuze/${s.fuzeFabricNumber}/timeline`,
    })),
  ];

  items.sort((a, b) => b.at.localeCompare(a.at));

  return NextResponse.json({
    ok: true,
    items,
  });
}
