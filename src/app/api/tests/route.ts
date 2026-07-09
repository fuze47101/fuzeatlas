// @ts-nocheck
/**
 * GET /api/tests
 *
 * Original behavior (admin Tests page) is preserved; query params now also
 * power the Brand Portal searchable test-results library (ticket #34).
 *
 * Query params:
 *   type            existing — filter by testType
 *   project         existing — filter by projectId
 *   brandId         existing — filter to one brand's submissions
 *   brandVisible    existing — only "stamped" runs (true/false)
 *   page            existing — pagination
 *
 *   q               NEW — fuzzy search across testReportNumber,
 *                   testMethodStd, lab.name, fuzeFabricNumber, factory name
 *   washMin         NEW — washCount >= washMin
 *   washMax         NEW — washCount <= washMax
 *   similarTo       NEW — fabricId; returns runs whose submission.fabric
 *                   shares fabricCategory with the given fabric
 *   sort            NEW — "fantastic" | "recent" (default: recent)
 *   withResults     NEW — include scored result payload (default: true when
 *                   sort=fantastic, false otherwise)
 *   protectFails    NEW — scrub FAIL data + relabel DAVR; default off for
 *                   admin callers, on for brand portal callers
 *
 * The brand portal calls with:
 *   /api/tests?brandId=X&brandVisible=true&sort=fantastic
 *             &withResults=true&protectFails=true
 */
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { scoreTestRun, toBrandSafeView } from "@/lib/test-result-scoring";
import { getCurrentUser, hasMinRole } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const me = await getCurrentUser();
    // Non-admin callers (brand/factory/distributor portals) cannot opt
    // out of protectFails. Only ADMIN+ may see raw FAIL data.
    const callerIsAdmin = me ? hasMinRole(me.role, "ADMIN") : false;

    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get("type") || "";
    const filterProject = searchParams.get("project") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = 50;

    const brandId = searchParams.get("brandId") || "";
    const brandVisible = searchParams.get("brandVisible") || "";
    // D2 (Bureau Veritas) — orphan filter for the "Needs association"
    // chip on /tests. Matches runs with no submission OR raw.needsAssociation.
    const needsAssociationFilter = searchParams.get("needsAssociation") === "true";

    // Ticket #34 additions ───────────────────────────────────────
    const q = (searchParams.get("q") || "").trim();
    const washMinRaw = searchParams.get("washMin");
    const washMaxRaw = searchParams.get("washMax");
    const washMin = washMinRaw ? parseInt(washMinRaw, 10) : null;
    const washMax = washMaxRaw ? parseInt(washMaxRaw, 10) : null;
    const similarTo = searchParams.get("similarTo") || "";
    const sort = (searchParams.get("sort") || "recent").toLowerCase();
    // Brand portal sets protectFails=true. Admins may set protectFails=false
    // to see raw PASS/FAIL; non-admins are FORCED to true regardless of
    // what they put on the URL — never expose FAIL detail to brand users.
    const requestedProtect = searchParams.get("protectFails") === "true";
    const protectFails = callerIsAdmin ? requestedProtect : true;
    const withResults =
      searchParams.get("withResults") === "true" || sort === "fantastic";

    // K (2026-07) — the "needs association" queue is scoped to runs
    // with testDate in the last 6 months. A legacy bulk import
    // backdated ~1,275 orphan rows by insert date — those are
    // unrecoverable and only floodedthe banner. Runs with a null
    // testDate fall outside the gte filter and are treated as legacy.
    // Defined ONCE here and reused by both the filter branch (below)
    // and the orphanCount query further down so the list count and
    // the admin-landing count can never drift.
    const sixMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 183);

    const where: any = {};
    if (filterType) where.testType = filterType;
    if (filterProject) where.projectId = filterProject;
    if (brandId) where.submission = { brandId };
    if (brandVisible === "true") where.brandVisible = true;
    if (needsAssociationFilter) {
      where.testDate = { ...(where.testDate || {}), gte: sixMonthsAgo };
      where.OR = [
        ...(where.OR || []),
        { submissionId: null },
        { raw: { path: ["needsAssociation"], equals: true } },
      ];
    }

    if (washMin != null || washMax != null) {
      where.washCount = {};
      if (washMin != null) where.washCount.gte = washMin;
      if (washMax != null) where.washCount.lte = washMax;
    }

    // Search — case-insensitive across the most useful row-level fields.
    if (q) {
      const num = Number(q.replace(/[^\d]/g, ""));
      const numericFuze = Number.isFinite(num) && num > 0 ? num : null;
      where.OR = [
        { testReportNumber: { contains: q, mode: "insensitive" } },
        { fuzeInternalReportNumber: { contains: q, mode: "insensitive" } },
        { testMethodStd: { contains: q, mode: "insensitive" } },
        { testMethodRaw: { contains: q, mode: "insensitive" } },
        { lab: { name: { contains: q, mode: "insensitive" } } },
        { submission: { factory: { name: { contains: q, mode: "insensitive" } } } },
        { submission: { brand: { name: { contains: q, mode: "insensitive" } } } },
        ...(numericFuze ? [{ submission: { fuzeFabricNumber: numericFuze } }] : []),
      ];
    }

    // "Similar fabrics": same fabricCategory as the given fabric.
    if (similarTo) {
      const ref = await prisma.fabric.findUnique({
        where: { id: similarTo },
        select: { fabricCategory: true },
      });
      const cat = ref?.fabricCategory;
      if (cat) {
        where.submission = {
          ...(where.submission || {}),
          fabric: { fabricCategory: cat },
        };
      }
    }

    const includeShape: any = {
      lab: { select: { name: true } },
      submission: {
        select: {
          fuzeFabricNumber: true,
          brand: { select: { name: true } },
          factory: { select: { name: true } },
          fabric: {
            select: { id: true, fabricCategory: true, fuzeNumber: true },
          },
        },
      },
      project: { select: { id: true, name: true } },
    };
    if (withResults) {
      includeShape.icpResult = true;
      includeShape.abResult = true;
      includeShape.fungalResult = true;
      includeShape.odorResult = true;
    }

    // For "fantastic" sort we have to fetch a wider page and sort in
    // memory — score is a heuristic, not a column. Cap fetch at 500 for
    // sanity; the brand portal rarely has more than a few dozen visible.
    const take = sort === "fantastic" ? 500 : pageSize;
    const skip = sort === "fantastic" ? 0 : (page - 1) * pageSize;

    const [
      testRuns,
      byType,
      filteredCount,
      recentRuns,
      icpCount,
      abCount,
      fungalCount,
      odorCount,
      orphanCount,
    ] = await Promise.all([
      prisma.testRun.count(),
      prisma.testRun.groupBy({ by: ["testType"], _count: { id: true } }),
      prisma.testRun.count({ where }),
      prisma.testRun.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: includeShape,
      }),
      prisma.icpResult.count(),
      prisma.antibacterialResult.count(),
      prisma.fungalResult.count(),
      prisma.odorResult.count(),
      // D2 — orphan count: unassigned OR flagged needsAssociation,
      // scoped to the same 6-month testDate window the needsAssociation
      // filter branch uses (K, 2026-07). Legacy backdated rows stay out
      // of both the count AND the list so they can't drift.
      prisma.testRun
        .count({
          where: {
            testDate: { gte: sixMonthsAgo },
            OR: [
              { submissionId: null },
              { raw: { path: ["needsAssociation"], equals: true } },
            ],
          },
        })
        .catch(() => 0),
    ]);

    const typeBreakdown = byType.map((t) => ({
      type: t.testType || "UNKNOWN",
      count: t._count.id,
    }));

    let runs = recentRuns.map((r) => {
      const rawFlag =
        r.raw && typeof r.raw === "object" && (r.raw as any).needsAssociation === true;
      const base: any = {
        id: r.id,
        testType: r.testType,
        testReportNumber: r.testReportNumber || null,
        testDate: r.testDate || null,
        testMethodStd: r.testMethodStd || null,
        washCount: r.washCount || null,
        lab: r.lab?.name || null,
        brand: r.submission?.brand?.name || null,
        factory: r.submission?.factory?.name || null,
        fuzeNumber: r.submission?.fuzeFabricNumber || null,
        fabricId: r.submission?.fabric?.id || null,
        fabricCategory: r.submission?.fabric?.fabricCategory || null,
        projectId: r.project?.id || null,
        project: r.project?.name || null,
        hasIcp: r.icpResult != null,
        hasAb: r.abResult != null,
        hasFungal: r.fungalResult != null,
        hasOdor: r.odorResult != null,
        brandVisible: r.brandVisible || false,
        submissionId: r.submissionId || null,
        needsAssociation: !r.submissionId || rawFlag,
      };
      if (withResults) {
        const scored = scoreTestRun({
          testType: r.testType,
          icpResult: r.icpResult,
          abResult: r.abResult,
          fungalResult: r.fungalResult,
          odorResult: r.odorResult,
        });
        base.fantasticScore = scored.fantasticScore;
        base.rawStatus = scored.rawStatus;
        base.view = toBrandSafeView(scored, { protectFails });
        // When protecting, strip raw numeric result bodies so the wire
        // payload itself doesn't leak FAIL detail to a brand console.
        if (!protectFails) {
          base.icpResult = r.icpResult || null;
          base.abResult = r.abResult || null;
          base.fungalResult = r.fungalResult || null;
          base.odorResult = r.odorResult || null;
        } else if (scored.rawStatus !== "FAIL") {
          // Brand sees PASS/MEASUREMENT detail but not FAIL detail.
          base.icpResult = r.icpResult || null;
          base.abResult = r.abResult
            ? {
                percentReduction: r.abResult.percentReduction,
                activityValue: r.abResult.activityValue,
                organism: r.abResult.organism,
                testMethodStd: r.abResult.testMethodStd,
              }
            : null;
        }
      }
      return base;
    });

    // In-memory sort + paginate for "fantastic" mode.
    if (sort === "fantastic") {
      runs.sort((a, b) => {
        const sa = a.fantasticScore ?? -1;
        const sb = b.fantasticScore ?? -1;
        if (sb !== sa) return sb - sa;
        const da = a.testDate ? new Date(a.testDate).getTime() : 0;
        const db = b.testDate ? new Date(b.testDate).getTime() : 0;
        return db - da;
      });
      const start = (page - 1) * pageSize;
      runs = runs.slice(start, start + pageSize);
    }

    return NextResponse.json({
      ok: true,
      total: testRuns,
      filteredCount,
      page,
      pageSize,
      totalPages: Math.ceil(filteredCount / pageSize),
      typeBreakdown,
      runs,
      resultCounts: {
        icp: icpCount,
        antibacterial: abCount,
        fungal: fungalCount,
        odor: odorCount,
      },
      orphanCount,
    });
  } catch (e: any) {
    console.error("Tests API error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
