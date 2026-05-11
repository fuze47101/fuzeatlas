// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/diag-all-surfaces
 *
 * Cross-platform smoke test. Runs the underlying data query that powers
 * every major dashboard / widget across all five portals, isolated with
 * try/catch. Catches Phase 9-style "Unknown field" regressions before
 * customers see them.
 *
 * Each entry in `checks` is a query that powers a real surface in the
 * UI. If the smoke test reports a failure, the corresponding page is
 * either 500-ing or showing an empty state. The `surface` field tells
 * you which page/widget is affected.
 *
 * Add new checks here whenever you ship a new dashboard. This is the
 * "have I broken anything" sweep we should have had from day one.
 */

const CRON_SECRET = process.env.CRON_SECRET;

async function check(
  surface: string,
  query: string,
  fn: () => Promise<any>,
) {
  const start = Date.now();
  try {
    const result = await fn();
    const count = Array.isArray(result)
      ? result.length
      : typeof result === "number"
        ? result
        : result == null
          ? 0
          : 1;
    return {
      surface,
      query,
      ok: true,
      count,
      ms: Date.now() - start,
    };
  } catch (e: any) {
    return {
      surface,
      query,
      ok: false,
      error: e?.message || String(e),
      code: e?.code || null,
      meta: e?.meta || null,
      ms: Date.now() - start,
    };
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const since30 = new Date(Date.now() - 30 * 86400_000);
  const since90 = new Date(Date.now() - 90 * 86400_000);
  const ADVANCED_STAGES = [
    "BRAND_TESTING",
    "FACTORY_ONBOARDING",
    "FACTORY_TESTING",
    "PRODUCTION",
    "BRAND_EXPANSION",
    "CUSTOMER_WON",
  ];

  const checks = await Promise.all([
    // ── Sales & Pipeline ────────────────────────────────────────
    check("/admin/bd/scoreboard — outreach roll-up", "outreachMessage findMany 30d", () =>
      prisma.outreachMessage.findMany({
        where: { sentAt: { gte: since30 } },
        select: { sentBy: true, channel: true, contactId: true, openedAt: true, repliedAt: true },
        take: 1,
      }),
    ),
    check("/admin/bd/scoreboard — meetings velocity", "meeting findMany w/brandId", () =>
      prisma.meeting.findMany({
        where: { brandId: { not: null }, startTime: { gte: since30 } },
        select: { organizerId: true, brandId: true, startTime: true, createdAt: true },
        take: 1,
      }),
    ),
    check("/admin/bd/scoreboard — closed-won contribution", "brand groupBy CUSTOMER_WON 90d", () =>
      prisma.brand.groupBy({
        by: ["salesRepId"],
        where: { pipelineStage: "CUSTOMER_WON", updatedAt: { gte: since90 } },
        _count: { _all: true },
      }),
    ),
    check("/admin/brand-pipeline — pipeline list", "brand findMany active stages", () =>
      prisma.brand.findMany({
        where: { pipelineStage: { in: ["LEAD", "PRESENTATION", ...ADVANCED_STAGES] } },
        select: { id: true, name: true, pipelineStage: true, salesRepId: true },
        take: 5,
      }),
    ),
    check("/admin/conversion-tracking", "factory groupBy by status", () =>
      prisma.factory.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ),
    check("/admin/bd/sequences — active sequences", "bDSequence findMany active", () =>
      prisma.bDSequence.findMany({
        where: { status: "active" },
        select: { id: true, brandId: true, repId: true, totalSteps: true },
        take: 5,
      }),
    ),

    // ── Factory portal ──────────────────────────────────────────
    check("/factory-portal — stats", "fabric.count + submission.count", () =>
      Promise.all([
        prisma.fabric.count(),
        prisma.fabricSubmission.count(),
        prisma.testRun.count(),
      ]).then((r) => r.length),
    ),
    check("/factory-portal/tests — test results", "testRun findMany w/submission scoping", () =>
      prisma.testRun.findMany({
        where: {
          OR: [
            { fabric: { factoryId: { not: null } } },
            { submission: { factoryId: { not: null } } },
          ],
        },
        select: { id: true, fuzeNumber: true, brandVisible: true },
        take: 5,
      }),
    ),
    check("/factory-portal/intake — submissions", "fabricSubmission findMany", () =>
      prisma.fabricSubmission.findMany({
        select: { id: true, factoryId: true, fuzeNumber: true, status: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ),

    // ── Brand portal ────────────────────────────────────────────
    check("/brand-portal/supply-chain", "brand → factories rollup", () =>
      prisma.brand.findMany({
        where: { fabrics: { some: {} } },
        select: {
          id: true,
          name: true,
          fabrics: { select: { factoryId: true }, take: 1 },
        },
        take: 3,
      }),
    ),
    check("/brand-portal/spec — brand spec fields", "brand select required spec cols", () =>
      prisma.brand.findFirst({
        select: {
          id: true,
          requiredFuzeTier: true,
          icpCadenceEveryNBatches: true,
          icpCadenceEveryLitersConsumed: true,
          protocolDocUrl: true,
          brandSpecUpdatedAt: true,
        },
      }),
    ),
    check("/brand-portal/pricing — pricing tier ladder", "brandPricingTier findMany", () =>
      prisma.brandPricingTier.findMany({
        select: { id: true, brandId: true, thresholdLiters: true, discountPct: true },
        take: 5,
      }),
    ),
    check("/brand-portal/pricing — consumption rollup", "fuzeConsumption groupBy brand", () =>
      prisma.fuzeConsumption.groupBy({
        by: ["brandId"],
        where: { brandId: { not: null } },
        _sum: { litersUsed: true },
      }),
    ),

    // ── Distributor portal ──────────────────────────────────────
    check("/distributor-portal — inventory", "distributorInventory findMany", () =>
      prisma.distributorInventory.findMany({
        select: { id: true, distributorId: true, fuzeStockLiters: true, reorderPointLiters: true },
        take: 5,
      }),
    ),
    check("/distributor-portal/orders — recent orders", "fuzeOrder findMany", () =>
      prisma.fuzeOrder.findMany({
        select: { id: true, distributorId: true, factoryId: true, status: true, volumeLiters: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ),

    // ── Lab portal ──────────────────────────────────────────────
    check("/lab-portal/queue — pending test requests", "testRequest findMany pending", () =>
      prisma.testRequest.findMany({
        where: { status: { in: ["APPROVED", "SUBMITTED", "IN_PROGRESS"] } },
        select: { id: true, status: true, labId: true, fuzeNumber: true },
        take: 5,
      }),
    ),
    check("/lab-portal/uploads — recent reports", "document findMany kind=REPORT", () =>
      prisma.document.findMany({
        where: { kind: "REPORT" },
        select: { id: true, name: true, createdAt: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ),

    // ── Admin / system ──────────────────────────────────────────
    check("sidebar pending count — test requests", "testRequest count PENDING_APPROVAL", () =>
      prisma.testRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    ),
    check("/admin/feedback — open tickets", "feedbackReport count open", () =>
      prisma.feedbackReport.count({
        where: { status: { in: ["NEW", "TRIAGED", "ACCEPTED", "IN_PROGRESS"] } },
      }),
    ),
    check("/admin/notifications — unread", "notification count read=false", () =>
      prisma.notification.count({ where: { read: false } }),
    ),
    check("/admin/access-requests", "accessRequest findMany pending", () =>
      prisma.accessRequest.findMany({
        where: { status: "PENDING" },
        select: { id: true, requestedByUserId: true, createdAt: true },
        take: 5,
      }),
    ),
    check("auto-reorder cron — inventory below threshold", "distributorInventory below reorderPoint", () =>
      prisma.distributorInventory.findMany({
        where: { fuzeStockLiters: { lt: prisma.distributorInventory.fields?.reorderPointLiters ?? 0 } },
        select: { id: true, distributorId: true, fuzeStockLiters: true },
        take: 5,
      }),
    ),
    check("test-cadence cron — brand cadence brands", "brand findMany cadence non-null", () =>
      prisma.brand.findMany({
        where: {
          OR: [
            { icpCadenceEveryNBatches: { not: null } },
            { icpCadenceEveryLitersConsumed: { not: null } },
          ],
        },
        select: { id: true, name: true },
        take: 5,
      }),
    ),
    check("ESG snapshot cron — quarterly snapshot table", "esgSnapshot findFirst", () =>
      prisma.esgSnapshot.findFirst({ select: { id: true, brandId: true, periodEnd: true } }),
    ),

    // ── User / org integrity ────────────────────────────────────
    check("user roster — active users by role", "user groupBy role status=ACTIVE", () =>
      prisma.user.groupBy({
        by: ["role"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
      }),
    ),
    check("entity managers", "entityManager findMany", () =>
      prisma.entityManager.findMany({
        select: { id: true, entityType: true, entityId: true, userId: true, role: true },
        take: 5,
      }),
    ),
    check("supply chain links", "supplyChainLink findMany", () =>
      prisma.supplyChainLink.findMany({
        select: { id: true, brandId: true, factoryId: true },
        take: 5,
      }),
    ),
  ]);

  const failures = checks.filter((c) => !c.ok);
  const slowest = [...checks].sort((a, b) => b.ms - a.ms).slice(0, 5);

  return NextResponse.json({
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      total: checks.length,
      passed: checks.length - failures.length,
      failed: failures.length,
    },
    failures: failures.map((f) => ({
      surface: f.surface,
      query: f.query,
      error: f.error,
      code: f.code,
      meta: f.meta,
    })),
    slowestQueries: slowest.map((s) => ({ surface: s.surface, ms: s.ms })),
    allChecks: checks.map((c) => ({
      surface: c.surface,
      ok: c.ok,
      count: c.count,
      ms: c.ms,
      ...(c.ok ? {} : { error: c.error }),
    })),
    verdict:
      failures.length === 0
        ? `all ${checks.length} surfaces healthy`
        : `${failures.length}/${checks.length} surface(s) broken — see failures[]`,
  });
}
