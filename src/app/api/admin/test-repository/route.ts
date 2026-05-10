// @ts-nocheck
/**
 * GET /api/admin/test-repository — Phase 10E.
 *
 * The big "every test ever, queryable, mineable" endpoint. Returns
 * paginated TestRun rows with joined brand / factory / fabric /
 * lab / per-method result context.
 *
 * Query params:
 *   testType?      ICP | ANTIBACTERIAL | FUNGAL | ODOR | UV | MICROFIBER
 *   labId?
 *   brandId?
 *   factoryId?
 *   fuzeTier?      F1..F4
 *   passed?        "true" | "false"
 *   washCountMin?  number
 *   washCountMax?  number
 *   from?          ISO date — testDate >= from
 *   to?            ISO date — testDate <= to
 *   page?          1-based, defaults 1
 *   pageSize?      default 50, max 200
 *
 * Plus aggregate stats across the filtered set (avgReduction,
 * avgIcpAg, count, passRate) so the dashboard can render
 * "across 142 AATCC 100 tests on 100% polyester at F1, average
 * reduction was 4.2 log, std dev 0.8."
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ADMIN_ROLES = [
  "ADMIN",
  "EMPLOYEE",
  "TESTING_MANAGER",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
];

function bool(v: string | null) {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const testType = url.searchParams.get("testType");
  const labId = url.searchParams.get("labId");
  const brandId = url.searchParams.get("brandId");
  const factoryId = url.searchParams.get("factoryId");
  const fuzeTier = url.searchParams.get("fuzeTier");
  const passed = bool(url.searchParams.get("passed"));
  const washCountMin = url.searchParams.get("washCountMin");
  const washCountMax = url.searchParams.get("washCountMax");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(200, parseInt(url.searchParams.get("pageSize") || "50", 10));

  const where: any = {};
  if (testType) where.testType = testType;
  if (labId) where.labId = labId;
  if (washCountMin || washCountMax) {
    where.washCount = {};
    if (washCountMin) where.washCount.gte = parseInt(washCountMin, 10);
    if (washCountMax) where.washCount.lte = parseInt(washCountMax, 10);
  }
  if (from || to) {
    where.testDate = {};
    if (from) where.testDate.gte = new Date(from);
    if (to) where.testDate.lte = new Date(to);
  }
  // Brand / factory / tier live on the linked submission.
  if (brandId || factoryId || fuzeTier) {
    where.submission = {};
    if (brandId) where.submission.brandId = brandId;
    if (factoryId) where.submission.factoryId = factoryId;
    if (fuzeTier) where.submission.fuzeTier = fuzeTier;
  }

  const [total, rows] = await Promise.all([
    prisma.testRun.count({ where }),
    prisma.testRun.findMany({
      where,
      orderBy: { testDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        testType: true,
        testReportNumber: true,
        testMethodStd: true,
        testDate: true,
        washCount: true,
        brandVisible: true,
        brandApprovalStatus: true,
        lab: { select: { id: true, name: true } },
        icpResult: { select: { agValue: true, auValue: true, unit: true } },
        abResult: {
          select: {
            organism1: true,
            organism2: true,
            result1: true,
            result2: true,
            pass: true,
          },
        },
        fungalResult: { select: { writtenResult: true, pass: true } },
        odorResult: { select: { testedOdor: true, result: true, pass: true } },
        submission: {
          select: {
            id: true,
            fuzeFabricNumber: true,
            fuzeTier: true,
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true, country: true } },
            fabric: {
              select: {
                id: true,
                fuzeNumber: true,
                customerCode: true,
                construction: true,
                weightGsm: true,
                fabricCategory: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // Optional pass-filter applied post-fetch (per-method result lookup).
  const filtered = passed === undefined
    ? rows
    : rows.filter((r) => {
        const p =
          r.testType === "ICP"
            ? typeof r.icpResult?.agValue === "number" && r.icpResult.agValue >= 0.25
            : r.testType === "ANTIBACTERIAL"
              ? r.abResult?.pass === true
              : r.testType === "FUNGAL"
                ? r.fungalResult?.pass === true
                : r.testType === "ODOR"
                  ? r.odorResult?.pass === true
                  : true;
        return p === passed;
      });

  // Aggregates across the FILTERED set (not the full result set).
  const agg = {
    count: filtered.length,
    abReductions: [] as number[],
    icpAgValues: [] as number[],
    passCount: 0,
  };
  for (const r of filtered) {
    if (r.icpResult?.agValue != null) agg.icpAgValues.push(r.icpResult.agValue);
    if (r.abResult?.result1 != null) agg.abReductions.push(r.abResult.result1);
    if (r.abResult?.result2 != null) agg.abReductions.push(r.abResult.result2);
    const p =
      r.testType === "ICP"
        ? typeof r.icpResult?.agValue === "number" && r.icpResult.agValue >= 0.25
        : r.testType === "ANTIBACTERIAL"
          ? r.abResult?.pass === true
          : r.testType === "FUNGAL"
            ? r.fungalResult?.pass === true
            : r.testType === "ODOR"
              ? r.odorResult?.pass === true
              : null;
    if (p === true) agg.passCount++;
  }
  function meanStd(arr: number[]) {
    if (arr.length === 0) return { mean: null, std: null };
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length;
    return { mean: m, std: Math.sqrt(v) };
  }
  const aggOut = {
    count: agg.count,
    passRate: agg.count ? agg.passCount / agg.count : 0,
    abReduction: meanStd(agg.abReductions),
    icpAg: meanStd(agg.icpAgValues),
  };

  return NextResponse.json({
    ok: true,
    total,
    page,
    pageSize,
    rows: filtered,
    aggregates: aggOut,
  });
}
