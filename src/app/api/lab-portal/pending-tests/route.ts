// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/lab-portal/pending-tests
 *
 * Returns all active/pending test requests visible to labs and FUZE employees.
 * Lab users see only their lab's requests; admins/employees see all.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const isLabUser = user.role === "LAB_USER" && user.labId;
    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);

    if (!isLabUser && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    // Build filter — lab users see their lab's requests, internal sees all
    const where: any = {
      status: {
        in: ["SUBMITTED", "IN_PROGRESS", "RESULTS_RECEIVED", "APPROVED", "PENDING_APPROVAL"],
      },
    };
    if (isLabUser) {
      where.labId = user.labId;
    }

    const testRequests = await prisma.testRequest.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true } },
        fabric: {
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            construction: true,
          },
        },
        lab: { select: { id: true, name: true } },
        lines: {
          select: {
            id: true,
            testType: true,
            testMethod: true,
            status: true,
            estimatedDays: true,
            testRunId: true,
          },
        },
        submission: {
          select: { id: true, factoryId: true, factory: { select: { name: true } } },
        },
      },
      orderBy: [
        { priority: "asc" },
        { createdAt: "desc" },
      ],
      take: 100,
    });

    // Map to the shape the upload page expects
    const tests = testRequests.map((tr) => {
      const hasReport = tr.lines.some((l) => l.testRunId != null);
      return {
        id: tr.id,
        poNumber: tr.poNumber,
        status: tr.status,
        expectedReadyDate: tr.estimatedCompletionDate || tr.requestedCompletionDate,
        requestedCompletionDate: tr.requestedCompletionDate,
        estimatedCompletionDate: tr.estimatedCompletionDate,
        testingStartedAt: tr.testingStartedAt,
        actualCompletionDate: tr.actualCompletionDate,
        testTypes: [...new Set(tr.lines.map((l) => l.testType))],
        fabricInfo: tr.fabric
          ? `${tr.fabric.fuzeNumber || ""} ${tr.fabric.customerCode || ""} ${tr.fabric.construction || ""}`.trim()
          : undefined,
        brandName: tr.brand?.name,
        factoryName: tr.submission?.factory?.name,
        labName: tr.lab?.name,
        priority: tr.priority,
        specialInstructions: tr.specialInstructions,
        lineCount: tr.lines.length,
        completedLines: tr.lines.filter((l) => l.status === "COMPLETE").length,
        createdAt: tr.createdAt.toISOString(),
        reportUploaded: hasReport,
      };
    });

    return NextResponse.json({ ok: true, tests });
  } catch (e: any) {
    console.error("Pending tests GET error:", e);
    return NextResponse.json(
      { ok: false, error: "Failed to load pending tests" },
      { status: 500 }
    );
  }
}
