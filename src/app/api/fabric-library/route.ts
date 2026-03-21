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
    const passOnly = url.searchParams.get("passOnly") === "true";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = 50;
    const skip = (page - 1) * limit;

    // Build fabric where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { construction: { contains: search, mode: "insensitive" } },
        { yarnType: { contains: search, mode: "insensitive" } },
        { fabricCategory: { contains: search, mode: "insensitive" } },
        { endUse: { contains: search, mode: "insensitive" } },
        { weavePattern: { contains: search, mode: "insensitive" } },
      ];
      const numSearch = parseInt(search);
      if (!isNaN(numSearch)) {
        where.OR.push({ fuzeNumber: numSearch });
      }
    }

    if (construction) {
      where.construction = { contains: construction, mode: "insensitive" };
    }

    // Only fabrics that have at least one test run with results
    where.submissions = {
      some: {
        testRuns: {
          some: {},
        },
      },
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

      // Filter by test type if requested
      const filteredTests = testType
        ? tests.filter((t) => t.testType === testType)
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
