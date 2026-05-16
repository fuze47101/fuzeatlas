// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Helper function to calculate turnaround days
function calculateTurnaroundDays(submission: any, testRun: any): number {
  if (!submission?.createdAt || !testRun?.createdAt) return 0;
  const submissionDate = new Date(submission.createdAt);
  const testDate = new Date(testRun.createdAt);
  return Math.max(
    0,
    Math.round((testDate.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

// Helper to determine if a test passed
function didTestPass(testRun: any): boolean {
  if (
    testRun.icpResult &&
    testRun.icpResult.agValue !== null &&
    testRun.icpResult.auValue !== null
  ) {
    // ICP passes if Ag and Au values are present and > 0
    return testRun.icpResult.agValue > 0 && testRun.icpResult.auValue > 0;
  }
  if (testRun.abResult?.methodPass !== null) return testRun.abResult.methodPass === true;
  if (testRun.fungalResult?.pass !== null) return testRun.fungalResult.pass === true;
  if (testRun.odorResult?.pass !== null) return testRun.odorResult.pass === true;
  return false;
}

// Helper to get ICP tier
function getIcpTier(agValue: number | null, auValue: number | null): string {
  if (agValue === null || auValue === null) return "Unknown";
  // Typical tier definitions (customize as needed)
  if (agValue >= 100 && auValue >= 100) return "F1+";
  if (agValue >= 50 && auValue >= 50) return "F1";
  if (agValue >= 10 && auValue >= 10) return "F2";
  if (agValue >= 1 && auValue >= 1) return "F3";
  if (agValue >= 0.1 && auValue >= 0.1) return "F4";
  return "Below";
}

export async function GET(req: NextRequest) {
  try {
    // Resolve the current user from the auth cookie directly. We used to read
    // x-user-id / x-user-role from request headers, but the middleware writes
    // those on the RESPONSE (wrong direction for downstream routes) so they
    // were never actually set here — the client was sending bogus literal
    // strings ("current-user" / "ADMIN") which this route was then blindly
    // trusting. Fixing both sides: server uses getCurrentUser(), client stops
    // sending fake headers.
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Admin/Employee only
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Admin/Employee access required" },
        { status: 403 },
      );
    }

    // Parse range query parameter
    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "30d";

    let startDate = new Date();
    const endDate = new Date();

    if (range === "7d") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (range === "30d") {
      startDate.setDate(startDate.getDate() - 30);
    } else if (range === "90d") {
      startDate.setDate(startDate.getDate() - 90);
    } else if (range === "all") {
      startDate = new Date("2000-01-01");
    }

    // ─────────────────────────────────────────────
    // OVERVIEW METRICS
    // ─────────────────────────────────────────────

    const allTests = await prisma.testRun.findMany({
      select: {
        id: true,
        testType: true,
        testDate: true,
        createdAt: true,
        testMethodStd: true,
        washCount: true,
        submission: { select: { createdAt: true, brandId: true, factoryId: true } },
        lab: { select: { id: true, name: true } },
        icpResult: true,
        abResult: true,
        fungalResult: true,
        odorResult: true,
      },
    });

    const testsThisPeriod = allTests.filter(
      (t) => t.createdAt >= startDate && t.createdAt <= endDate,
    );
    const testsLastPeriod = allTests.filter(
      (t) =>
        t.createdAt >= new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())) &&
        t.createdAt < startDate,
    );

    const passedThisPeriod = testsThisPeriod.filter((t) => didTestPass(t)).length;
    const passRate =
      testsThisPeriod.length > 0 ? (passedThisPeriod / testsThisPeriod.length) * 100 : 0;

    const turnaroundTimes = testsThisPeriod
      .map((t) => calculateTurnaroundDays(t.submission, t))
      .filter((d) => d > 0);
    const avgTurnaround =
      turnaroundTimes.length > 0
        ? Math.round(turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length)
        : 0;

    // Count active brands and factories
    const activeBrandIds = new Set<string>();
    const activeFactoryIds = new Set<string>();
    testsThisPeriod.forEach((t) => {
      if (t.submission?.brandId) activeBrandIds.add(t.submission.brandId);
      if (t.submission?.factoryId) activeFactoryIds.add(t.submission.factoryId);
    });

    const overview = {
      totalTests: allTests.length,
      passRate: Math.round(passRate * 100) / 100,
      avgTurnaround,
      activeBrands: activeBrandIds.size,
      activeFactories: activeFactoryIds.size,
      testsThisPeriod: testsThisPeriod.length,
      testsLastPeriod: testsLastPeriod.length,
    };

    // ─────────────────────────────────────────────
    // TESTS BY TYPE
    // ─────────────────────────────────────────────

    const testsByType = ["ICP", "ANTIBACTERIAL", "FUNGAL", "ODOR", "UV", "MICROFIBER", "OTHER"]
      .map((type) => {
        const typeTests = testsThisPeriod.filter((t) => t.testType === type);
        const passed = typeTests.filter((t) => didTestPass(t)).length;
        return {
          type,
          count: typeTests.length,
          passRate:
            typeTests.length > 0 ? Math.round((passed / typeTests.length) * 100 * 100) / 100 : 0,
        };
      })
      .filter((t) => t.count > 0);

    // ─────────────────────────────────────────────
    // TESTS BY METHOD (STANDARD)
    // ─────────────────────────────────────────────

    const methodMap = new Map<string, { count: number; passed: number }>();
    testsThisPeriod.forEach((t) => {
      const method = t.testMethodStd || "Unknown";
      const entry = methodMap.get(method) || { count: 0, passed: 0 };
      entry.count++;
      if (didTestPass(t)) entry.passed++;
      methodMap.set(method, entry);
    });

    const testsByMethod = Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        count: data.count,
        passRate: data.count > 0 ? Math.round((data.passed / data.count) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ─────────────────────────────────────────────
    // TESTS TREND (DAILY FOR 30D, WEEKLY FOR 90D)
    // ─────────────────────────────────────────────

    const trendMap = new Map<string, { count: number; passed: number }>();

    if (range === "90d") {
      // Weekly aggregation
      testsThisPeriod.forEach((t) => {
        const date = new Date(t.createdAt);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split("T")[0];

        const entry = trendMap.get(weekKey) || { count: 0, passed: 0 };
        entry.count++;
        if (didTestPass(t)) entry.passed++;
        trendMap.set(weekKey, entry);
      });
    } else {
      // Daily aggregation
      testsThisPeriod.forEach((t) => {
        const dateKey = t.createdAt.toISOString().split("T")[0];
        const entry = trendMap.get(dateKey) || { count: 0, passed: 0 };
        entry.count++;
        if (didTestPass(t)) entry.passed++;
        trendMap.set(dateKey, entry);
      });
    }

    const testsTrend = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        passed: data.passed,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ─────────────────────────────────────────────
    // PIPELINE FLOW (BRAND STAGES)
    // ─────────────────────────────────────────────

    const pipelineStages = [
      "LEAD",
      "PRESENTATION",
      "BRAND_TESTING",
      "FACTORY_ONBOARDING",
      "FACTORY_TESTING",
      "PRODUCTION",
      "BRAND_EXPANSION",
      "ARCHIVE",
      "CUSTOMER_WON",
    ];

    const allBrands = await prisma.brand.findMany({
      select: { id: true, pipelineStage: true },
    });

    const pipelineFlow = pipelineStages.map((stage) => {
      const brandsInStage = allBrands.filter((b) => b.pipelineStage === stage);
      return {
        stage,
        count: brandsInStage.length,
        value: brandsInStage.length * 50000, // Placeholder value
      };
    });

    // ─────────────────────────────────────────────
    // TOP BRANDS
    // ─────────────────────────────────────────────

    const brandTestMap = new Map<
      string,
      { tests: number; passed: number; stage: string; id: string }
    >();

    const allBrandsMap = new Map<string, any>();
    allBrands.forEach((b) => {
      allBrandsMap.set(b.id, { stage: b.pipelineStage });
    });

    testsThisPeriod.forEach((t) => {
      if (!t.submission?.brandId) return;
      const brandId = t.submission.brandId;
      const entry = brandTestMap.get(brandId) || {
        tests: 0,
        passed: 0,
        stage: allBrandsMap.get(brandId)?.stage || "UNKNOWN",
        id: brandId,
      };
      entry.tests++;
      if (didTestPass(t)) entry.passed++;
      brandTestMap.set(brandId, entry);
    });

    const brandsWithNames = await prisma.brand.findMany({
      where: { id: { in: Array.from(brandTestMap.keys()) } },
      select: { id: true, name: true },
    });

    const brandNameMap = new Map(brandsWithNames.map((b) => [b.id, b.name]));

    const topBrands = Array.from(brandTestMap.values())
      .map((entry) => ({
        name: brandNameMap.get(entry.id) || "Unknown",
        tests: entry.tests,
        passRate: entry.tests > 0 ? Math.round((entry.passed / entry.tests) * 100 * 100) / 100 : 0,
        stage: entry.stage,
      }))
      .sort((a, b) => b.tests - a.tests)
      .slice(0, 10);

    // ─────────────────────────────────────────────
    // TOP FACTORIES
    // ─────────────────────────────────────────────

    const factoryTestMap = new Map<string, { tests: number; passed: number; id: string }>();

    testsThisPeriod.forEach((t) => {
      if (!t.submission?.factoryId) return;
      const factoryId = t.submission.factoryId;
      const entry = factoryTestMap.get(factoryId) || {
        tests: 0,
        passed: 0,
        id: factoryId,
      };
      entry.tests++;
      if (didTestPass(t)) entry.passed++;
      factoryTestMap.set(factoryId, entry);
    });

    const factoriesWithDetails = await prisma.factory.findMany({
      where: { id: { in: Array.from(factoryTestMap.keys()) } },
      select: { id: true, name: true, country: true },
    });

    const factoryDetailsMap = new Map(
      factoriesWithDetails.map((f) => [f.id, { name: f.name, country: f.country || "Unknown" }]),
    );

    const topFactories = Array.from(factoryTestMap.values())
      .map((entry) => {
        const details = factoryDetailsMap.get(entry.id) || {
          name: "Unknown",
          country: "Unknown",
        };
        return {
          name: details.name,
          tests: entry.tests,
          passRate:
            entry.tests > 0 ? Math.round((entry.passed / entry.tests) * 100 * 100) / 100 : 0,
          country: details.country,
        };
      })
      .sort((a, b) => b.tests - a.tests)
      .slice(0, 10);

    // ─────────────────────────────────────────────
    // LAB PERFORMANCE
    // ─────────────────────────────────────────────

    const labMap = new Map<string, { tests: number; totalTurnaround: number; labName: string }>();

    testsThisPeriod.forEach((t) => {
      if (!t.lab?.id) return;
      const labId = t.lab.id;
      const turnaround = calculateTurnaroundDays(t.submission, t);
      const entry = labMap.get(labId) || {
        tests: 0,
        totalTurnaround: 0,
        labName: t.lab.name || "Unknown",
      };
      entry.tests++;
      entry.totalTurnaround += turnaround;
      labMap.set(labId, entry);
    });

    const labPerformance = Array.from(labMap.values())
      .map((entry) => ({
        name: entry.labName,
        tests: entry.tests,
        avgTurnaround: entry.tests > 0 ? Math.round(entry.totalTurnaround / entry.tests) : 0,
      }))
      .sort((a, b) => b.tests - a.tests)
      .slice(0, 8);

    // ─────────────────────────────────────────────
    // ICP DISTRIBUTION
    // ─────────────────────────────────────────────

    const icpDistMap = new Map<
      string,
      { count: number; totalAgValue: number; totalAuValue: number }
    >();

    testsThisPeriod.forEach((t) => {
      if (t.icpResult?.agValue !== null && t.icpResult?.auValue !== null) {
        // Use average of Ag and Au for tier determination
        const avgValue = (t.icpResult.agValue + t.icpResult.auValue) / 2;
        const tier = getIcpTier(t.icpResult.agValue, t.icpResult.auValue);

        const entry = icpDistMap.get(tier) || {
          count: 0,
          totalAgValue: 0,
          totalAuValue: 0,
        };
        entry.count++;
        entry.totalAgValue += t.icpResult.agValue;
        entry.totalAuValue += t.icpResult.auValue;
        icpDistMap.set(tier, entry);
      }
    });

    const icpDistribution = ["F1+", "F1", "F2", "F3", "F4", "Below"]
      .map((tier) => {
        const entry = icpDistMap.get(tier);
        return {
          tier,
          count: entry?.count || 0,
          avgValue:
            entry && entry.count > 0
              ? Math.round(((entry.totalAgValue + entry.totalAuValue) / 2 / entry.count) * 100) /
                100
              : 0,
        };
      })
      .filter((t) => t.count > 0);

    // ─────────────────────────────────────────────
    // WASH DURABILITY
    // ─────────────────────────────────────────────

    const washMap = new Map<number, { testCount: number; totalRetention: number }>();

    testsThisPeriod.forEach((t) => {
      if (t.washCount && t.icpResult?.agValue) {
        const entry = washMap.get(t.washCount) || {
          testCount: 0,
          totalRetention: 0,
        };
        // Simulate retention: Ag value represents retention percentage
        entry.testCount++;
        entry.totalRetention += Math.min(t.icpResult.agValue, 100);
        washMap.set(t.washCount, entry);
      }
    });

    const washDurability = Array.from(washMap.entries())
      .map(([washCount, data]) => ({
        washCount,
        avgRetention:
          data.testCount > 0 ? Math.round((data.totalRetention / data.testCount) * 100) / 100 : 0,
        testCount: data.testCount,
      }))
      .sort((a, b) => a.washCount - b.washCount);

    // ─────────────────────────────────────────────
    // COMPLIANCE OVERVIEW
    // ─────────────────────────────────────────────

    const complianceStandards = new Map<string, { tested: number; passed: number }>();

    testsThisPeriod.forEach((t) => {
      if (t.testMethodStd) {
        const entry = complianceStandards.get(t.testMethodStd) || {
          tested: 0,
          passed: 0,
        };
        entry.tested++;
        if (didTestPass(t)) entry.passed++;
        complianceStandards.set(t.testMethodStd, entry);
      }
    });

    const complianceOverview = Array.from(complianceStandards.entries())
      .map(([standard, data]) => ({
        standard,
        tested: data.tested,
        passed: data.passed,
        rate: data.tested > 0 ? Math.round((data.passed / data.tested) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.tested - a.tested)
      .slice(0, 8);

    // ─────────────────────────────────────────────
    // RECENT ACTIVITY
    // ─────────────────────────────────────────────

    const recentActivity = testsThisPeriod
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20)
      .map((t) => ({
        type: t.testType,
        description: `${t.testType} test completed`,
        timestamp: t.createdAt.toISOString(),
      }));

    // ─────────────────────────────────────────────
    // BUILD RESPONSE
    // ─────────────────────────────────────────────

    return NextResponse.json(
      {
        ok: true,
        range,
        overview,
        testsByType,
        testsByMethod,
        testsTrend,
        pipelineFlow,
        topBrands,
        topFactories,
        labPerformance,
        icpDistribution,
        washDurability,
        complianceOverview,
        recentActivity,
      },
      { status: 200 },
    );
  } catch (e: any) {
    console.error("Analytics API error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Internal error" }, { status: 500 });
  }
}
