// @ts-nocheck
/**
 * Shared approval-queue loader for /api/brand-portal/approvals
 * and /api/admin/brands/[id]/approvals (Phase 7B/7C).
 */

import { prisma } from "@/lib/prisma";

function daysSince(iso: string | Date | null) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}
function severityFor(days: number): "fresh" | "watch" | "overdue" {
  if (days >= 5) return "overdue";
  if (days >= 2) return "watch";
  return "fresh";
}

export async function loadApprovalsForBrand(brandId: string) {
  const [submissions, tests, orders] = await Promise.all([
    prisma.fabricSubmission.findMany({
      where: { brandId, brandApprovalStatus: "PENDING" },
      select: {
        id: true,
        fuzeFabricNumber: true,
        customerFabricCode: true,
        submissionDate: true,
        createdAt: true,
        factory: { select: { id: true, name: true } },
        brandApprovalStatus: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.testRun.findMany({
      where: {
        brandVisible: true,
        brandApprovalStatus: "PENDING",
        submission: { brandId },
      },
      select: {
        id: true,
        testType: true,
        testReportNumber: true,
        testDate: true,
        createdAt: true,
        lab: { select: { id: true, name: true } },
        submission: {
          select: {
            id: true,
            factoryId: true,
            factory: { select: { id: true, name: true } },
            fuzeFabricNumber: true,
          },
        },
        brandApprovalStatus: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.fuzeOrder.findMany({
      where: {
        brandId,
        orderType: "PRODUCTION",
        brandApprovalStatus: "PENDING",
      },
      select: {
        id: true,
        orderNumber: true,
        volumeLiters: true,
        fuzeTier: true,
        createdAt: true,
        factory: { select: { id: true, name: true } },
        brandApprovalStatus: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const annotate = (rows: any[]) =>
    rows.map((r) => {
      const days = daysSince(r.createdAt);
      return { ...r, daysPending: days, severity: severityFor(days) };
    });

  return {
    pendingSubmissions: annotate(submissions),
    pendingTestResults: annotate(tests),
    pendingOrders: annotate(orders),
  };
}
