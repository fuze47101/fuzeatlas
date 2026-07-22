// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const construction = url.searchParams.get("construction") || "";
    const testType = url.searchParams.get("testType") || "";
    // Item 10 — search-first library. Two new search axes: by test method
    // (TestRun.testMethodStd) and by organism (abResult.organism/organism1).
    const testMethod = url.searchParams.get("testMethod") || "";
    const organism = url.searchParams.get("organism") || "";
    const passOnly = url.searchParams.get("passOnly") === "true";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = 50;
    const skip = (page - 1) * limit;

    // Build fabric where clause
    const where: any = {};

    // "Search by Fabric Construction" — no FUZE-number search anymore (item 10).
    if (search) {
      where.OR = [
        { construction: { contains: search, mode: "insensitive" } },
        { yarnType: { contains: search, mode: "insensitive" } },
        { fabricCategory: { contains: search, mode: "insensitive" } },
        { endUse: { contains: search, mode: "insensitive" } },
        { weavePattern: { contains: search, mode: "insensitive" } },
        { knitStitchType: { contains: search, mode: "insensitive" } },
      ];
    }

    if (construction) {
      where.construction = { contains: construction, mode: "insensitive" };
    }

    // Narrow to fabrics that have at least one matching test run. Combine the
    // test-type intent (result-driven so legacy label drift still matches —
    // Brian Hyman's #cmo9jnuhp bug) with the new method/organism filters.
    const testRunAnd: any[] = [];
    if (testType === "FUNGAL") {
      testRunAnd.push({ OR: [{ testType: "FUNGAL" }, { fungalResult: { isNot: null } }] });
    } else if (testType === "ANTIBACTERIAL") {
      testRunAnd.push({ OR: [{ testType: "ANTIBACTERIAL" }, { abResult: { isNot: null } }] });
    } else if (testType === "ICP") {
      testRunAnd.push({ OR: [{ testType: "ICP" }, { icpResult: { isNot: null } }] });
    } else if (testType === "ODOR") {
      testRunAnd.push({ OR: [{ testType: "ODOR" }, { odorResult: { isNot: null } }] });
    }
    if (testMethod) {
      testRunAnd.push({ testMethodStd: { contains: testMethod, mode: "insensitive" } });
    }
    if (organism) {
      testRunAnd.push({
        abResult: {
          OR: [
            { organism: { contains: organism, mode: "insensitive" } },
            { organism1: { contains: organism, mode: "insensitive" } },
          ],
        },
      });
    }
    where.submissions = {
      some: { testRuns: { some: testRunAnd.length ? { AND: testRunAnd } : {} } },
    };

    // Get total count for pagination
    const totalCount = await prisma.fabric.count({ where });

    // Fetch fabrics with anonymized data + test summaries
    const fabrics = await prisma.fabric.findMany({
      where,
      select: {
        id: true,
        fuzeNumber: true,
        construction: true,
        weightGsm: true,
        widthInches: true,
        yarnType: true,
        fabricCategory: true,
        endUse: true,
        weavePattern: true,
        knitStitchType: true,
        color: true,
        // NO brandId, NO factoryId, NO customerCode, NO factoryCode
        submissions: {
          select: {
            testRuns: {
              select: {
                id: true,
                testType: true,
                testMethodStd: true,
                washCount: true,
                testDate: true,
                icpResult: {
                  select: {
                    agValue: true,
                    unit: true,
                  },
                },
                abResult: {
                  select: {
                    organism: true,
                    organism1: true,
                    percentReduction: true,
                    result1: true,
                    activityValue: true,
                    methodPass: true,
                    pass: true,
                  },
                },
                fungalResult: {
                  select: {
                    pass: true,
                    writtenResult: true,
                  },
                },
                odorResult: {
                  select: {
                    pass: true,
                    testedOdor: true,
                  },
                },
              },
              orderBy: { testDate: "desc" },
            },
          },
        },
      },
      orderBy: { fuzeNumber: "desc" },
      skip,
      take: limit,
    });

    // Flatten and anonymize: extract test runs from submissions
    const catalog = fabrics.map((fabric) => {
      const allTestRuns = fabric.submissions.flatMap((s) => s.testRuns);

      // Build test summary
      const tests = allTestRuns.map((tr) => {
        const result: any = {
          testType: tr.testType,
          testMethod: tr.testMethodStd,
          washCount: tr.washCount,
          testDate: tr.testDate,
        };

        if (tr.icpResult) {
          result.icpAgPpm = tr.icpResult.agValue;
        }
        if (tr.abResult) {
          result.organism = tr.abResult.organism || tr.abResult.organism1;
          result.percentReduction = tr.abResult.percentReduction ?? tr.abResult.result1;
          result.abPass = tr.abResult.methodPass ?? tr.abResult.pass;
        }
        if (tr.fungalResult) {
          result.fungalPass = tr.fungalResult.pass;
        }
        if (tr.odorResult) {
          result.odorPass = tr.odorResult.pass;
          result.odorType = tr.odorResult.testedOdor;
        }

        return result;
      });

      // Filter by test type if requested. Result-driven so legacy rows
      // whose `testType` label drifted from the actual result they
      // carry still match — e.g. a TestRun stored as ANTIBACTERIAL
      // with a fungalResult attached will surface under the FUNGAL
      // filter too. Brian's #cmo9jnuhp bug.
      const filteredTests = testType
        ? tests.filter((t) => {
            if (t.testType === testType) return true;
            if (testType === "FUNGAL" && t.fungalPass != null) return true;
            if (
              testType === "ANTIBACTERIAL" &&
              (t.abPass != null || t.percentReduction != null)
            )
              return true;
            if (testType === "ICP" && t.icpAgPpm != null) return true;
            if (testType === "ODOR" && t.odorPass != null) return true;
            return false;
          })
        : tests;

      // Filter by pass only if requested
      const finalTests = passOnly
        ? filteredTests.filter((t) => {
            if (t.testType === "ICP") return t.icpAgPpm && t.icpAgPpm > 0;
            if (t.testType === "ANTIBACTERIAL") return t.abPass === true;
            if (t.testType === "FUNGAL") return t.fungalPass === true;
            if (t.testType === "ODOR") return t.odorPass === true;
            return true;
          })
        : filteredTests;

      return {
        fuzeNumber: fabric.fuzeNumber,
        construction: fabric.construction,
        weightGsm: fabric.weightGsm,
        widthInches: fabric.widthInches,
        yarnType: fabric.yarnType,
        fabricCategory: fabric.fabricCategory,
        endUse: fabric.endUse,
        weavePattern: fabric.weavePattern,
        knitStitchType: fabric.knitStitchType,
        color: fabric.color,
        testCount: allTestRuns.length,
        tests: finalTests,
      };
    });

    // If filtering by test type or pass, remove fabrics with 0 matching tests
    const filteredCatalog =
      testType || passOnly
        ? catalog.filter((f) => f.tests.length > 0)
        : catalog;

    // Aggregate stats for the header
    const totalFabrics = await prisma.fabric.count({
      where: {
        submissions: { some: { testRuns: { some: {} } } },
      },
    });
    const totalTests = await prisma.testRun.count();
    const totalIcp = await prisma.icpResult.count();
    const totalAb = await prisma.antibacterialResult.count();

    return NextResponse.json({
      ok: true,
      catalog: filteredCatalog,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalFabrics,
        totalTests,
        totalIcp,
        totalAb,
      },
    });
  } catch (e: any) {
    console.error("Fabric library error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
