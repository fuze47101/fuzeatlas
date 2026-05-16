// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/brand-portal/supply-chain
 *
 * Returns the list of factories that are part of this brand's supply
 * chain — every distinct factory that has at least one fabric tagged
 * with this brand, plus rollup stats per factory:
 *
 *   - factory: id, name, country, city
 *   - fabricCount: how many fabrics for this brand they make
 *   - submissionCount: total submissions for this brand
 *   - lastSubmissionAt: most-recent FabricSubmission for this brand
 *   - testRunsTotal: total TestRuns across this brand+factory pair
 *   - testRunsPassed: count of PASSED tests
 *   - openTestRequests: TestRequest rows for this brand+factory not yet
 *     COMPLETE / CANCELLED / REJECTED — what's currently in flight
 *   - lastTestRun: { date, type, result } for the most-recent test
 *   - consumptionLitersTotal: cumulative liters of FUZE consumed for
 *     this brand at this factory (FuzeConsumption rollup)
 *   - lastConsumptionAt: most-recent FuzeConsumption record
 *
 * The page Joseph at KUIU opens to verify the supply-chain visibility
 * we promised him in the May 7 email — "you get visibility over all
 * factories in your supply chain that are supplying fabrics."
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const brandId = user.brandId;
    // Allow internal users to view any brand via the existing admin
    // pattern: they pass ?brandId=… on a sibling endpoint. For now this
    // endpoint scopes strictly to the caller's brand, the same way the
    // rest of /api/brand-portal does.
    if (!brandId) {
      return NextResponse.json(
        { ok: false, error: "No brand associated with this account" },
        { status: 403 },
      );
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        // Brand-stipulated spec — surfaces in the supply-chain header
        // so brand users can see what they're holding factories to.
        requiredFuzeTier: true,
        icpCadenceEveryNBatches: true,
        icpCadenceEveryLitersConsumed: true,
        protocolDocUrl: true,
        brandSpecUpdatedAt: true,
      },
    });
    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    // Find every factory that supplies this brand. Read SupplyChainLink
    // first (Phase 4A keystone — single source of truth), falling back
    // to the legacy Fabric.brandId join when no links exist for this
    // brand yet. The fallback keeps the page working for any brand
    // that hasn't been backfilled — once backfill-supply-chain-links
    // has run for everyone the fallback becomes dead code we can delete.
    const supplyLinks = await prisma.supplyChainLink.findMany({
      where: {
        toType: "BRAND",
        toId: brandId,
        fromType: "FACTORY",
        relation: "SUPPLIES",
        active: true,
      },
      select: { fromId: true },
    });

    const factoriesWithFabrics =
      supplyLinks.length > 0
        ? await prisma.factory.findMany({
            where: { id: { in: supplyLinks.map((l: any) => l.fromId) } },
            select: { id: true, name: true, country: true, city: true },
            orderBy: { name: "asc" },
          })
        : await prisma.factory.findMany({
            // Fallback: derive from fabrics tagged with this brand.
            // Some fabrics have null factoryId (intake without a
            // factory yet) — they contribute to brand stats but not
            // to a row in this view. Same as the original behaviour.
            where: { fabrics: { some: { brandId } } },
            select: { id: true, name: true, country: true, city: true },
            orderBy: { name: "asc" },
          });

    const rows = await Promise.all(
      factoriesWithFabrics.map(async (f: any) => {
        const [
          fabricCount,
          submissionAgg,
          testRuns,
          openTestRequests,
          consumptionAgg,
          lastConsumption,
        ] = await Promise.all([
          prisma.fabric.count({ where: { brandId, factoryId: f.id } }),

          prisma.fabricSubmission.aggregate({
            where: { brandId, factoryId: f.id },
            _count: { _all: true },
            _max: { createdAt: true },
          }),

          // TestRun has no status enum — pass/fail lives on the
          // per-type result row. Pull all relevant tests with their
          // result rows in one shot, then classify in memory.
          // Brand-visible filter so we don't surface drafts.
          prisma.testRun.findMany({
            where: {
              submission: { brandId, factoryId: f.id },
              brandVisible: true,
            },
            select: {
              id: true,
              testType: true,
              testDate: true,
              brandVisible: true,
              icpResult: { select: { agValue: true } },
              abResult: { select: { pass: true } },
              fungalResult: { select: { pass: true } },
              odorResult: { select: { pass: true } },
            },
            orderBy: [{ testDate: "desc" }, { createdAt: "desc" }],
          }),

          prisma.testRequest.count({
            where: {
              brandId,
              OR: [
                { submission: { factoryId: f.id } },
                { fabric: { factoryId: f.id } },
              ],
              status: { notIn: ["COMPLETE", "CANCELLED", "REJECTED"] },
            },
          }),

          prisma.fuzeConsumption.aggregate({
            where: { brandId, factoryId: f.id },
            _sum: { litersUsed: true },
          }),

          prisma.fuzeConsumption.findFirst({
            where: { brandId, factoryId: f.id },
            orderBy: { usageDate: "desc" },
            select: { usageDate: true, litersUsed: true, fuzeTier: true },
          }),
        ]);

        // Classify each TestRun pass/fail using the same rule the
        // notify path uses (batch-stamp/route.ts and tests/[id]
        // sendResultsReadyEmail block).
        const passOf = (t: any): boolean => {
          if (t.testType === "ICP") {
            return typeof t.icpResult?.agValue === "number" && t.icpResult.agValue >= 0.25;
          }
          if (t.testType === "ANTIBACTERIAL") return t.abResult?.pass === true;
          if (t.testType === "FUNGAL") return t.fungalResult?.pass === true;
          if (t.testType === "ODOR") return t.odorResult?.pass === true;
          return false;
        };
        const testRunsTotal = testRuns.length;
        const testRunsPassed = testRuns.filter(passOf).length;
        const last = testRuns[0] || null;
        const lastTestRun = last
          ? {
              id: last.id,
              testDate: last.testDate,
              testType: last.testType,
              passed: passOf(last),
              brandVisible: last.brandVisible,
            }
          : null;

        return {
          factoryId: f.id,
          factoryName: f.name,
          country: f.country,
          city: f.city,
          fabricCount,
          submissionCount: submissionAgg._count._all || 0,
          lastSubmissionAt: submissionAgg._max.createdAt,
          testRunsTotal,
          testRunsPassed,
          openTestRequests,
          lastTestRun,
          consumptionLitersTotal: consumptionAgg._sum.litersUsed || 0,
          lastConsumptionAt: lastConsumption?.usageDate || null,
          lastConsumptionTier: lastConsumption?.fuzeTier || null,
        };
      }),
    );

    // Sort by total consumption descending — biggest production
    // contributors at the top, brand sees their biggest suppliers
    // first. Falls back to most-recent submission for factories with
    // no consumption data yet.
    rows.sort((a, b) => {
      if (b.consumptionLitersTotal !== a.consumptionLitersTotal) {
        return b.consumptionLitersTotal - a.consumptionLitersTotal;
      }
      const aDate = a.lastSubmissionAt ? new Date(a.lastSubmissionAt).getTime() : 0;
      const bDate = b.lastSubmissionAt ? new Date(b.lastSubmissionAt).getTime() : 0;
      return bDate - aDate;
    });

    // Brand-level totals that summarise the whole supply chain.
    const totals = {
      factories: rows.length,
      fabrics: rows.reduce((s, r) => s + r.fabricCount, 0),
      submissions: rows.reduce((s, r) => s + r.submissionCount, 0),
      testsTotal: rows.reduce((s, r) => s + r.testRunsTotal, 0),
      testsPassed: rows.reduce((s, r) => s + r.testRunsPassed, 0),
      openTestRequests: rows.reduce((s, r) => s + r.openTestRequests, 0),
      consumptionLitersTotal: rows.reduce((s, r) => s + r.consumptionLitersTotal, 0),
    };

    return NextResponse.json({
      ok: true,
      brand,
      totals,
      factories: rows,
    });
  } catch (e: any) {
    console.error("[brand-portal/supply-chain] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load supply chain" },
      { status: 500 },
    );
  }
}
