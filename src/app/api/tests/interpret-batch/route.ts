// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { interpretTestRun } from "@/lib/test-interpreter";

/**
 * POST /api/tests/interpret-batch
 *
 * Interprets multiple tests at once.
 *
 * Request body:
 * {
 *   testRunIds: string[]
 * }
 *
 * Returns:
 * {
 *   ok: boolean,
 *   interpretations: Array<{
 *     testRunId: string,
 *     interpretation: TestInterpretation
 *   }>
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { testRunIds } = body;

    if (!Array.isArray(testRunIds) || testRunIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "testRunIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Limit batch size
    if (testRunIds.length > 100) {
      return NextResponse.json(
        { ok: false, error: "Maximum 100 test runs per batch" },
        { status: 400 }
      );
    }

    // Fetch all test runs
    const testRuns = await prisma.testRun.findMany({
      where: {
        id: { in: testRunIds },
      },
      include: {
        submission: {
          select: {
            id: true,
            washTarget: true,
          },
        },
        icpResult: true,
        abResult: true,
        fungalResult: true,
        odorResult: true,
      },
    });

    // Build interpretations
    const interpretations = testRuns.map((testRun) => {
      const testData = {
        id: testRun.id,
        testType: testRun.testType,
        testMethodStd: testRun.testMethodStd,
        washCount: testRun.washCount,
        icpResult: testRun.icpResult ? {
          agValue: testRun.icpResult.agValue,
          auValue: testRun.icpResult.auValue,
          unit: testRun.icpResult.unit,
        } : undefined,
        abResult: testRun.abResult ? {
          organism: testRun.abResult.organism,
          strainNumber: testRun.abResult.strainNumber,
          testMethodStd: testRun.abResult.testMethodStd,
          percentReduction: testRun.abResult.percentReduction,
          growthValue: testRun.abResult.growthValue,
          activityValue: testRun.abResult.activityValue,
          methodPass: testRun.abResult.methodPass,
          methodPassReason: testRun.abResult.methodPassReason,
          inoculumCFU: testRun.abResult.inoculumCFU,
          controlCFU: testRun.abResult.controlCFU,
          treatedCFU: testRun.abResult.treatedCFU,
          contactTime: testRun.abResult.contactTime,
          incubationTemp: testRun.abResult.incubationTemp,
        } : undefined,
        fungalResult: testRun.fungalResult ? {
          organism: testRun.fungalResult.organism,
          strainNumber: testRun.fungalResult.strainNumber,
          percentReduction: testRun.fungalResult.percentReduction,
          growthValue: testRun.fungalResult.growthValue,
          methodPass: testRun.fungalResult.methodPass,
        } : undefined,
        odorResult: testRun.odorResult ? {
          odorReduction: testRun.odorResult.testedOdor,
          methodPass: testRun.odorResult.pass,
        } : undefined,
        submission: testRun.submission ? {
          id: testRun.submission.id,
          washTarget: testRun.submission.washTarget,
        } : undefined,
      };

      const interpretation = interpretTestRun(testData);

      return {
        testRunId: testRun.id,
        interpretation,
      };
    });

    // Cache interpretations (non-blocking)
    Promise.all(
      interpretations.map((item) =>
        prisma.testRun
          .update({
            where: { id: item.testRunId },
            data: {
              aiReviewData: item.interpretation,
              aiReviewDate: new Date(),
            },
          })
          .catch((err) => {
            console.error(`Failed to cache interpretation for ${item.testRunId}:`, err);
          })
      )
    ).catch((err) => {
      console.error("Batch caching error:", err);
    });

    return NextResponse.json({ ok: true, interpretations });
  } catch (err: any) {
    console.error("Batch interpretation error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
