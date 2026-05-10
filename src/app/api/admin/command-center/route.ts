// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/command-center  (Phase 8C)
 *
 * One big aggregation behind /admin/command-center. Cached for
 * 30s edge-side. ADMIN/EMPLOYEE only.
 *
 * Returns:
 *   metrics — top counts (active brands, shipping factories,
 *             testing labs, low-stock distributors, pending
 *             approvals, overdue ICP cadences).
 *   brandFactoryMatrix — every (brand, factory) pair currently
 *             linked via SupplyChainLink with last-activity stamp
 *             + in-spec health.
 *   recentActivity — last 25 Notification rows across the system.
 *   distributorAlerts — DistributorInventory rows below
 *             reorderPointLiters.
 *   approvalQueues — { brandId, brandName, pending } counts.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CADENCE_OVERDUE_DAYS = 30; // proxy for "last test was a while ago"

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN" && user.role !== "EMPLOYEE") return forbidden();

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    activeBrands,
    shippingFactories,
    testingLabs,
    lowStockDistInventory,
    pendingApprovalsCount,
    matrixLinks,
    recentNotifications,
    approvalCounts,
  ] = await Promise.all([
    prisma.brand.count({ where: { lastActivityAt: { gte: since30 } } }),
    prisma.fuzeOrder.findMany({
      where: { status: { in: ["SHIPPED", "DELIVERED"] }, shippedDate: { gte: since30 } },
      select: { factoryId: true },
      distinct: ["factoryId"],
    }),
    prisma.testRun.findMany({
      where: { createdAt: { gte: since30 } },
      select: { labId: true },
      distinct: ["labId"],
    }),
    prisma.distributorInventory.findMany({
      where: {
        AND: [
          { reorderPointLiters: { not: null } },
          { reorderPointLiters: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        distributorId: true,
        fuzeStockLiters: true,
        reorderPointLiters: true,
        distributor: { select: { id: true, name: true, country: true } },
      },
    }),
    prisma.fabricSubmission.count({ where: { brandApprovalStatus: "PENDING" } }).then(
      async (subs) => {
        const tests = await prisma.testRun.count({
          where: { brandApprovalStatus: "PENDING", brandVisible: true },
        });
        const orders = await prisma.fuzeOrder.count({
          where: { brandApprovalStatus: "PENDING", orderType: "PRODUCTION" },
        });
        return subs + tests + orders;
      },
    ),
    prisma.supplyChainLink.findMany({
      where: {
        fromType: "FACTORY",
        toType: "BRAND",
        relation: "SUPPLIES",
        active: true,
      },
      select: { fromId: true, toId: true },
      take: 500,
    }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.$queryRawUnsafe(
      `SELECT
        b.id AS "brandId", b.name AS "brandName",
        (
          (SELECT COUNT(*) FROM "FabricSubmission" WHERE "brandId" = b.id AND "brandApprovalStatus" = 'PENDING')
          +
          (SELECT COUNT(*) FROM "TestRun" tr JOIN "FabricSubmission" fs ON tr."submissionId" = fs.id
            WHERE fs."brandId" = b.id AND tr."brandVisible" = true AND tr."brandApprovalStatus" = 'PENDING')
          +
          (SELECT COUNT(*) FROM "FuzeOrder" WHERE "brandId" = b.id AND "orderType" = 'PRODUCTION' AND "brandApprovalStatus" = 'PENDING')
        )::int AS pending
       FROM "Brand" b
       WHERE EXISTS (
         SELECT 1 FROM "FabricSubmission" WHERE "brandId" = b.id AND "brandApprovalStatus" = 'PENDING'
       )
       OR EXISTS (
         SELECT 1 FROM "TestRun" tr JOIN "FabricSubmission" fs ON tr."submissionId" = fs.id
           WHERE fs."brandId" = b.id AND tr."brandVisible" = true AND tr."brandApprovalStatus" = 'PENDING'
       )
       OR EXISTS (
         SELECT 1 FROM "FuzeOrder" WHERE "brandId" = b.id AND "orderType" = 'PRODUCTION' AND "brandApprovalStatus" = 'PENDING'
       )
       ORDER BY pending DESC
       LIMIT 25`,
    ),
  ]);

  const lowStockDistributors = lowStockDistInventory
    .filter(
      (i: any) =>
        typeof i.reorderPointLiters === "number" &&
        i.fuzeStockLiters < i.reorderPointLiters,
    )
    .map((i: any) => ({
      distributorId: i.distributorId,
      name: i.distributor?.name || "—",
      country: i.distributor?.country || null,
      onHandLiters: i.fuzeStockLiters,
      reorderPointLiters: i.reorderPointLiters,
    }));

  // Build the brand × factory health matrix. For each link, attach
  // last-submission, last-test, ICP-overdue flag, and in-spec
  // (best-effort: requiredFuzeTier match on most-recent FuzeOrder).
  const brandIds = Array.from(new Set(matrixLinks.map((l: any) => l.toId)));
  const factoryIds = Array.from(new Set(matrixLinks.map((l: any) => l.fromId)));
  const [brandsCtx, factoriesCtx] = await Promise.all([
    prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: {
        id: true,
        name: true,
        requiredFuzeTier: true,
        icpCadenceEveryNBatches: true,
      },
    }),
    prisma.factory.findMany({
      where: { id: { in: factoryIds } },
      select: { id: true, name: true, country: true },
    }),
  ]);
  const brandMap = new Map(brandsCtx.map((b: any) => [b.id, b]));
  const factoryMap = new Map(factoriesCtx.map((f: any) => [f.id, f]));

  const matrix = await Promise.all(
    matrixLinks.map(async (link: any) => {
      const brand = brandMap.get(link.toId);
      const factory = factoryMap.get(link.fromId);
      const [lastSub, lastIcp] = await Promise.all([
        prisma.fabricSubmission.findFirst({
          where: { brandId: link.toId, factoryId: link.fromId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.testRun.findFirst({
          where: {
            testType: "ICP",
            brandVisible: true,
            submission: { brandId: link.toId, factoryId: link.fromId },
          },
          orderBy: { testDate: "desc" },
          select: { testDate: true, createdAt: true },
        }),
      ]);
      const icpAt = lastIcp?.testDate || lastIcp?.createdAt || null;
      const overdue =
        !!brand?.icpCadenceEveryNBatches &&
        (!icpAt ||
          Date.now() - new Date(icpAt).getTime() > CADENCE_OVERDUE_DAYS * 24 * 60 * 60 * 1000);
      return {
        brandId: link.toId,
        brandName: brand?.name || "—",
        factoryId: link.fromId,
        factoryName: factory?.name || "—",
        lastSubmissionAt: lastSub?.createdAt || null,
        lastIcpAt: icpAt,
        cadenceOverdue: overdue,
      };
    }),
  );

  const overdueCadences = matrix.filter((m) => m.cadenceOverdue).length;

  const res = NextResponse.json({
    ok: true,
    metrics: {
      activeBrands,
      shippingFactories: shippingFactories.length,
      testingLabs: testingLabs.length,
      lowStockDistributors: lowStockDistributors.length,
      pendingApprovals: pendingApprovalsCount,
      overdueCadences,
    },
    brandFactoryMatrix: matrix,
    recentActivity: recentNotifications,
    distributorAlerts: lowStockDistributors,
    approvalQueues: approvalCounts,
  });
  res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
  return res;
}
