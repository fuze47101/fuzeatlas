// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { interpretTestRun } from "@/lib/test-interpreter";

/**
 * GET /api/tests/[id]/interpret
 *
 * Returns the AI interpretation for a test run, including:
 * - Compliance assessment against AATCC/ASTM/JIS standards
 * - FUZE tier classification
 * - Anomaly detection
 * - Wash durability analysis
 * - Recommendations
 * - Detailed interpretation
 *
 * Caches the interpretation in aiReviewData if not already present.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the test run with all related results
    const testRun = await prisma.testRun.findUnique({
      where: { id },
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

    if (!testRun) {
      return NextResponse.json(
        { ok: false, error: "Test run not found" },
        { status: 404 }
      );
    }

    // Check if interpretation is already cached in aiReviewData
    if (testRun.aiReviewData && typeof testRun.aiReviewData === 'object' && 'summary' in testRun.aiReviewData) {
      return NextResponse.json({ ok: true, interpretation: testRun.aiReviewData });
    }

    // Build test data for interpreter
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

    // Run interpretation
    const interpretation = interpretTestRun(testData);

    // Cache the interpretation
    try {
      await prisma.testRun.update({
        where: { id },
        data: {
          aiReviewData: interpretation,
          aiReviewDate: new Date(),
        },
      });
    } catch (cacheError) {
      // Log but don't fail if caching fails
      console.error("Failed to cache interpretation:", cacheError);
    }

    return NextResponse.json({ ok: true, interpretation });
  } catch (err: any) {
    console.error("Test interpretation error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tests/[id]/interpret
 *
 * Force regeneration of interpretation even if cached.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch fresh test run
    const testRun = await prisma.testRun.findUnique({
      where: { id },
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

    if (!testRun) {
      return NextResponse.json(
        { ok: false, error: "Test run not found" },
        { status: 404 }
      );
    }

    // Build test data for interpreter
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

    // Run interpretation
    const interpretation = interpretTestRun(testData);

    // Update cache
    try {
      await prisma.testRun.update({
        where: { id },
        data: {
          aiReviewData: interpretation,
          aiReviewDate: new Date(),
        },
      });
    } catch (cacheError) {
      console.error("Failed to update interpretation cache:", cacheError);
    }

    return NextResponse.json({ ok: true, interpretation });
  } catch (err: any) {
    console.error("Test interpretation error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
