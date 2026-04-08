// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/ongoing-tests
 * Returns all active test requests with timeline data.
 * Visible to AMs, admins, and employees — each AM sees their brands' tests.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    // AM/Sales reps see only their brands; Admin/Employee see all
    const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user.role);

    const where: any = {
      status: { in: ["SUBMITTED", "PENDING_APPROVAL", "APPROVED", "IN_PROGRESS", "RESULTS_RECEIVED"] },
    };

    // Filter to AM's brands if not admin
    if (!isAdmin) {
      const amBrands = await prisma.brand.findMany({
        where: { salesRepId: user.id },
        select: { id: true },
      });
      where.brandId = { in: amBrands.map((b) => b.id) };
    }

    const testRequests = await prisma.testRequest.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true, salesRepId: true, salesRep: { select: { name: true } } } },
        fabric: { select: { id: true, fuzeNumber: true, customerCode: true, construction: true } },
        lab: { select: { id: true, name: true } },
        lines: {
          select: { id: true, testType: true, testMethod: true, status: true, estimatedDays: true, testRunId: true },
        },
        submission: {
          select: { id: true, factoryId: true, factory: { select: { name: true, country: true } } },
        },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    const tests = testRequests.map((tr) => {
      const completedLines = tr.lines.filter((l) => l.status === "COMPLETE").length;
      const totalLines = tr.lines.length;
      const progress = totalLines > 0 ? Math.round((completedLines / totalLines) * 100) : 0;

      // Calculate days in current status
      const now = new Date();
      const startDate = tr.testingStartedAt || tr.createdAt;
      const daysActive = Math.round((now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

      // Days until ETA
      let daysUntilEta: number | null = null;
      if (tr.estimatedCompletionDate) {
        daysUntilEta = Math.round(
          (new Date(tr.estimatedCompletionDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      return {
        id: tr.id,
        poNumber: tr.poNumber,
        status: tr.status,
        priority: tr.priority,
        brandName: tr.brand?.name,
        brandId: tr.brand?.id,
        accountManager: tr.brand?.salesRep?.name || "Unassigned",
        factoryName: tr.submission?.factory?.name,
        factoryCountry: tr.submission?.factory?.country,
        labName: tr.lab?.name,
        fabricInfo: tr.fabric
          ? `${tr.fabric.fuzeNumber || ""} ${tr.fabric.customerCode || ""} ${tr.fabric.construction || ""}`.trim()
          : undefined,
        testTypes: [...new Set(tr.lines.map((l) => l.testType))],
        totalLines,
        completedLines,
        progress,
        daysActive,
        daysUntilEta,
        overdue: daysUntilEta !== null && daysUntilEta < 0,
        createdAt: tr.createdAt.toISOString(),
        testingStartedAt: tr.testingStartedAt?.toISOString() || null,
        requestedCompletionDate: tr.requestedCompletionDate?.toISOString() || null,
        estimatedCompletionDate: tr.estimatedCompletionDate?.toISOString() || null,
        specialInstructions: tr.specialInstructions,
        reportUploaded: tr.lines.some((l) => l.testRunId != null),
      };
    });

    // Summary
    const awaitingAccept = tests.filter((t) => ["SUBMITTED", "PENDING_APPROVAL", "APPROVED"].includes(t.status)).length;
    const inProgress = tests.filter((t) => t.status === "IN_PROGRESS").length;
    const resultsReady = tests.filter((t) => t.status === "RESULTS_RECEIVED").length;
    const overdue = tests.filter((t) => t.overdue).length;

    return NextResponse.json({
      ok: true,
      tests,
      summary: { total: tests.length, awaitingAccept, inProgress, resultsReady, overdue },
    });
  } catch (e: any) {
    console.error("Ongoing tests GET error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load ongoing tests" }, { status: 500 });
  }
}
