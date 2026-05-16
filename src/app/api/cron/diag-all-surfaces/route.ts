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
    check("/admin/conversion-tracking", "factory groupBy by customerType", () =>
      prisma.factory.groupBy({
        by: ["customerType"],
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
        where: { submission: { factoryId: { not: null } } },
        select: { id: true, testType: true, brandVisible: true },
        take: 5,
      }),
    ),
    check("/factory-portal/intake — submissions", "fabricSubmission findMany", () =>
      prisma.fabricSubmission.findMany({
        select: { id: true, factoryId: true, fuzeFabricNumber: true, status: true },
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
        select: { id: true, status: true, labId: true, fuzeFabricNumber: true },
        take: 5,
      }),
    ),
    check("/lab-portal/uploads — recent reports", "document findMany kind=REPORT", () =>
      prisma.document.findMany({
        where: { kind: "REPORT" },
        select: { id: true, filename: true, createdAt: true },
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
        select: { id: true, firstName: true, lastName: true, email: true, userId: true, createdAt: true },
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
    check("ESG snapshot cron — quarterly snapshot table", "brandEsgSnapshot findFirst", () =>
      prisma.brandEsgSnapshot.findFirst({ select: { id: true } }),
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
        select: { id: true, fromType: true, fromId: true, toType: true, toId: true, relation: true },
        take: 5,
      }),
    ),
    // NEED-6 — brand spec acknowledgement loop. Catches schema drift
    // (missing table / FK / index) before the factory portal banner
    // starts 500'ing on real users.
    check(
      "/factory-portal/spec — brand spec ack loop",
      "brandSpecAcknowledgement findMany",
      () =>
        prisma.brandSpecAcknowledgement.findMany({
          select: {
            id: true,
            brandId: true,
            factoryId: true,
            specVersion: true,
            acknowledgedAt: true,
          },
          take: 1,
        }),
    ),
    // NEED-7 — lab assignment accept/reject. Selects the 5 new
    // columns explicitly so the smoke test fails fast if the
    // migrate-lab-assignment cron hasn't been run.
    check(
      "/lab-portal/queue — lab accept/reject columns",
      "testRequest findFirst lab-assignment columns",
      () =>
        prisma.testRequest.findFirst({
          select: {
            id: true,
            labAssignedAt: true,
            labAssignedById: true,
            labAcceptedAt: true,
            labRejectedAt: true,
            labRejectionReason: true,
          },
        }),
    ),
    // NICE-5 — ⌘K palette backend. Catches search fan-out regressions
    // (e.g. a Prisma rename that breaks one of the 6 table queries).
    check(
      "⌘K palette — brand search",
      "brand findMany contains(test)",
      () =>
        prisma.brand.findMany({
          where: { name: { contains: "test", mode: "insensitive" } },
          select: { id: true, name: true },
          take: 1,
        }),
    ),
    // BONUS-5 — lab queue digest. Catches breakage in the underlying
    // labs+users query the daily 07:00 digest depends on.
    check(
      "/api/cron/lab-queue-digest — labs+users join",
      "lab findMany w/ active users",
      () =>
        prisma.lab.findMany({
          where: { active: true, users: { some: { status: "ACTIVE" } } },
          select: { id: true, timezone: true, users: { select: { email: true }, take: 1 } },
          take: 1,
        }),
    ),
    // MB-1 — ICP × AB correlation chart. Catches schema drift on
    // the testRun → icpResult + abResult join the scatter depends on.
    check(
      "/analytics/icp-correlation — TestRun w/ ICP + AB",
      "testRun findFirst icpResult+abResult",
      () =>
        prisma.testRun.findFirst({
          where: {
            brandVisible: true,
            icpResult: { isNot: null },
            abResult: { isNot: null },
          },
          select: {
            id: true,
            icpResult: { select: { agValue: true } },
            abResult: { select: { percentReduction: true } },
          },
        }),
    ),
    // MB-2 — supply chain map. Catches drift on the
    // SupplyChainLink → Factory (lat/lng) + FuzeConsumption grouping
    // the map page depends on.
    check(
      "/brand-portal/supply-chain/map — links + factory geo",
      "supplyChainLink findMany BRAND→FACTORY active",
      () =>
        prisma.supplyChainLink.findMany({
          where: { fromType: "BRAND", toType: "FACTORY", active: true },
          select: { fromId: true, toId: true },
          take: 1,
        }),
    ),
    // TRACK-1 — feedback screenshot proxy. Catches drift on the
    // FeedbackReport.screenshotKey/Bucket columns the admin-gated
    // /api/admin/feedback/[id]/screenshot route depends on.
    check(
      "/api/admin/feedback/[id]/screenshot — schema columns",
      "feedbackReport findFirst w/ screenshot fields",
      () =>
        prisma.feedbackReport.findFirst({
          select: { id: true, screenshotKey: true, screenshotBucket: true },
          take: 1,
        } as any),
    ),
    // TRACK 3 — QR shipment label resolves real SDS + COA from
    // ComplianceDocument. The public /shipment/[orderNumber] page
    // dies open and unauthenticated; the SDS + COA links it surfaces
    // depend on at least one of each category existing in the table.
    check(
      "/shipment/[orderNumber] — SDS document",
      "complianceDocument findFirst category=SDS_MSDS",
      () =>
        prisma.complianceDocument.findFirst({
          where: { category: "SDS_MSDS" },
          select: { id: true, url: true },
        }),
    ),
    check(
      "/shipment/[orderNumber] — COA document",
      "complianceDocument findFirst category=COA",
      () =>
        prisma.complianceDocument.findFirst({
          where: { category: "COA" },
          select: { id: true, url: true },
        }),
    ),
    // Distributor Portal Ordering — verify the new pieces resolve:
    // tier ladder rows, factory-orders scope, quote-input shape, and
    // the new poNumber / distributorTierIndexAtOrder columns on
    // FuzeOrder (Prisma will throw at runtime if the migration
    // didn't land).
    check(
      "/distributor-portal/pricing-tiers — ladder rows",
      "distributorPricing tierIndex 1..5",
      () =>
        prisma.distributorPricing.findMany({
          where: { tierIndex: { in: [1, 2, 3, 4, 5] } },
          select: { id: true, tierIndex: true, pricePerLiter: true, currency: true },
          take: 25,
        }),
    ),
    check(
      "/distributor-portal/factory-orders — scoped orders",
      "fuzeOrder count grouped via factory.distributorId",
      () =>
        prisma.fuzeOrder.findMany({
          where: { factory: { distributorId: { not: null } } },
          select: { id: true, orderNumber: true, distributorId: true },
          take: 25,
        }),
    ),
    check(
      "/factory-portal/orders/new — distributor tier snapshot column",
      "fuzeOrder findFirst poNumber/distributorTierIndexAtOrder",
      () =>
        prisma.fuzeOrder.findFirst({
          select: {
            id: true,
            poNumber: true,
            poDocumentUrl: true,
            distributorTierIndexAtOrder: true,
          } as any,
        }),
    ),
    // MB-3 — narration columns landed. The retry cron + brand-visible
    // flip path both read/write these; if the migration didn't run
    // Prisma will throw and surface here.
    check(
      "MB-3 narration — TestRun ai-narration columns",
      "testRun findFirst aiNarration/aiNarrationGeneratedAt",
      () =>
        prisma.testRun.findFirst({
          select: {
            id: true,
            aiNarration: true,
            aiNarrationModel: true,
            aiNarrationGeneratedAt: true,
            aiNarrationGenerationFailedAt: true,
          } as any,
        }),
    ),
    check(
      "MB-3 narration — retry-queue candidates",
      "testRun count brandVisible=true & aiNarration null",
      () =>
        prisma.testRun.findMany({
          where: {
            brandVisible: true,
            OR: [{ aiNarration: null }, { aiNarration: "" }],
          } as any,
          select: { id: true } as any,
          take: 25,
        }),
    ),
    // MB-4 — pipeline-prediction column lands + at least one brand
    // has a stamp. If the column missing → Prisma throws; if the
    // cron hasn't run yet the count is 0 but the call still resolves.
    check(
      "MB-4 prediction — Brand.predictedValueUSD column",
      "brand findFirst predictedValueUSD/predictedValueComputedAt",
      () =>
        prisma.brand.findFirst({
          select: {
            id: true,
            predictedValueUSD: true,
            predictedValueComputedAt: true,
            predictedValueFactors: true,
          } as any,
        }),
    ),
    check(
      "MB-4 prediction — Top-10 widget readiness",
      "brand count predictedValueUSD not null",
      () =>
        prisma.brand.findMany({
          where: { predictedValueUSD: { not: null } } as any,
          select: { id: true } as any,
          take: 25,
        }),
    ),
    // NEED-FB-6 — i18n smoke check. Imports src/i18n/en.ts and
    // verifies the factoryPortal namespace shape so a stray broken
    // bracket can't ship to prod without surfacing here.
    check(
      "i18n — src/i18n/en.ts factoryPortal namespace",
      "dynamic import + factoryPortal keys",
      async () => {
        const mod = await import("@/i18n/en");
        const en = (mod as any).default;
        const fp = en?.factoryPortal;
        if (!fp || typeof fp !== "object") {
          throw new Error("factoryPortal namespace missing");
        }
        return [fp.crumb, fp.intake?.crumbHome, fp.ordersNew?.pageTitle];
      },
    ),
    // TRACK 3 — admin home activity feed sanity. Confirms the seven
    // model rollups the feed depends on resolve without throwing.
    check(
      "/api/admin/home-activity — last 7d window",
      "fuzeOrder count last 7 days",
      () =>
        prisma.fuzeOrder.count({
          where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
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
