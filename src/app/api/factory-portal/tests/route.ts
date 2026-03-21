// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ── GET /api/factory-portal/tests ── fetch test results for factory's fabrics ── */
export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's factory
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { factory: true },
    });

    if (!user?.factoryId) {
      return NextResponse.json(
        { ok: false, error: "Not a factory user" },
        { status: 403 }
      );
    }

    // Fetch test runs for fabrics belonging to this factory
    const testRuns = await prisma.testRun.findMany({
      where: {
        fabric: {
          factoryId: user.factoryId,
        },
      },
      include: {
        fabric: {
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            factoryCode: true,
          },
        },
        submission: {
          select: {
            id: true,
            submissionDate: true,
          },
        },
        lab: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format response
    const runs = testRuns.map((run) => ({
      id: run.id,
      testType: run.testType,
      testReportNumber: run.testReportNumber,
      testMethodStd: run.testMethodStd,
      testDate: run.testDate ? new Date(run.testDate).toLocaleDateString() : null,
      washCount: run.washCount,
      lab: run.lab?.name,
      fuzeNumber: run.fabric?.fuzeNumber,
      customerCode: run.fabric?.customerCode,
      factoryCode: run.fabric?.factoryCode,
      fabricId: run.fabricId,
      hasIcp: run.hasIcp,
      hasAb: run.hasAb,
      hasFungal: run.hasFungal,
      hasOdor: run.hasOdor,
      result: run.result, // PASS, FAIL, etc.
      submissionDate: run.submission?.submissionDate
        ? new Date(run.submission.submissionDate).toLocaleDateString()
        : null,
    }));

    return NextResponse.json({
      ok: true,
      total: runs.length,
      runs,
    });
  } catch (error) {
    console.error("Error fetching factory test runs:", error);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
