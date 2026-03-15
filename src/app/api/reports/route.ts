// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateTestResultsReport,
  generateBrandScorecard,
  generateComplianceReport,
  generateWeeklyDigest,
} from "@/lib/pdf-reports";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * GET /api/reports
 * Generate and return various report types
 *
 * Query params:
 * - type: test-results | brand-scorecard | compliance | weekly-digest
 * - format: html (default) | email
 * - to: email address (required if format=email)
 * - brandId: brand ID (for test-results, brand-scorecard, compliance)
 * - weekOf: ISO date for weekly digest (e.g., 2026-03-09)
 */
export async function GET(req: Request) {
  try {
    // Check auth
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: x-user-id header required" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "test-results";
    const format = url.searchParams.get("format") || "html";
    const to = url.searchParams.get("to");
    const brandId = url.searchParams.get("brandId");
    const weekOf = url.searchParams.get("weekOf");

    let html = "";

    // ──────────────────────────────────────────────────
    // TEST RESULTS REPORT
    // ──────────────────────────────────────────────────
    if (type === "test-results" && brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
      });

      if (!brand) {
        return NextResponse.json(
          { error: "Brand not found" },
          { status: 404 }
        );
      }

      // Get all test runs for this brand (via submissions)
      const submissions = await prisma.fabricSubmission.findMany({
        where: { brandId },
        include: {
          testRuns: {
            include: {
              lab: true,
              icpResult: true,
              abResult: true,
              fungalResult: true,
              odorResult: true,
            },
            orderBy: { testDate: "desc" },
          },
        },
      });

      const testRuns = submissions
        .flatMap((s) =>
          s.testRuns.map((tr) => ({
            testType: tr.testType,
            testMethod: tr.testMethodStd || tr.testMethodRaw,
            testDate: tr.testDate?.toISOString(),
            labName: tr.lab?.name,
            passed:
              tr.icpResult ||
              (tr.abResult?.methodPass !== false) ||
              tr.fungalResult?.pass ||
              tr.odorResult?.pass ||
              false,
            passFailReason: tr.aiReviewNotes || undefined,
            icpAg: tr.icpResult?.agValue || undefined,
            icpAu: tr.icpResult?.auValue || undefined,
            abReduction: tr.abResult?.percentReduction || undefined,
            fungalResult: tr.fungalResult?.writtenResult,
            odorResult: tr.odorResult?.result,
            washCount: tr.washCount || undefined,
          }))
        )
        .slice(0, 20); // Limit to recent tests

      html = generateTestResultsReport({
        brandName: brand.name,
        fabricCode: submissions[0]?.customerFabricCode,
        submissionId: submissions[0]?.id,
        testRuns,
      });
    }

    // ──────────────────────────────────────────────────
    // BRAND SCORECARD
    // ──────────────────────────────────────────────────
    else if (type === "brand-scorecard" && brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        include: {
          fabrics: true,
          sows: true,
        },
      });

      if (!brand) {
        return NextResponse.json(
          { error: "Brand not found" },
          { status: 404 }
        );
      }

      // Get test runs for this brand
      const submissions = await prisma.fabricSubmission.findMany({
        where: { brandId },
        include: {
          testRuns: {
            include: {
              lab: true,
              icpResult: true,
              abResult: true,
              fungalResult: true,
              odorResult: true,
            },
          },
        },
      });

      const allTestRuns = submissions.flatMap((s) => s.testRuns);
      const passedTests = allTestRuns.filter(
        (tr) =>
          tr.icpResult ||
          (tr.abResult?.methodPass !== false) ||
          tr.fungalResult?.pass ||
          tr.odorResult?.pass
      ).length;
      const passRate =
        allTestRuns.length > 0
          ? (passedTests / allTestRuns.length) * 100
          : 0;

      // Get recent tests
      const recentTests = allTestRuns
        .sort(
          (a, b) =>
            new Date(b.testDate || 0).getTime() -
            new Date(a.testDate || 0).getTime()
        )
        .slice(0, 5)
        .map((tr) => ({
          fabricCode:
            submissions.find((s) =>
              s.testRuns.some((t) => t.id === tr.id)
            )?.customerFabricCode || "N/A",
          testType: tr.testType,
          passed:
            tr.icpResult ||
            (tr.abResult?.methodPass !== false) ||
            tr.fungalResult?.pass ||
            tr.odorResult?.pass ||
            false,
          date: tr.testDate?.toISOString() || new Date().toISOString(),
        }));

      // Get upcoming milestones from SOWs
      const upcomingMilestones = await prisma.sOWMilestone.findMany({
        where: {
          sow: { brandId },
          dueDate: { gte: new Date() },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
      });

      html = generateBrandScorecard({
        brandName: brand.name,
        pipelineStage: brand.pipelineStage,
        totalFabrics: brand.fabrics.length,
        totalTests: allTestRuns.length,
        passRate,
        activeSows: brand.sows.filter((s) => s.status === "ACTIVE").length,
        complianceStatus: "Green", // Could be enhanced with actual compliance checks
        recentTests,
        upcomingMilestones: upcomingMilestones.map((m) => ({
          title: m.title,
          dueDate: m.dueDate?.toISOString() || "",
          status: m.completedAt ? "Completed" : "Pending",
        })),
      });
    }

    // ──────────────────────────────────────────────────
    // COMPLIANCE REPORT
    // ──────────────────────────────────────────────────
    else if (type === "compliance" && brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
      });

      if (!brand) {
        return NextResponse.json(
          { error: "Brand not found" },
          { status: 404 }
        );
      }

      // Get test data for compliance metrics
      const submissions = await prisma.fabricSubmission.findMany({
        where: { brandId },
        include: {
          testRuns: {
            include: {
              abResult: true,
              fungalResult: true,
              icpResult: true,
            },
          },
        },
      });

      const allTestRuns = submissions.flatMap((s) => s.testRuns);

      // Calculate pass rates by test type
      const testPassRatesByType: Record<string, number> = {};
      const testsByType = allTestRuns.reduce(
        (acc, tr) => {
          if (!acc[tr.testType]) acc[tr.testType] = [];
          acc[tr.testType].push(tr);
          return acc;
        },
        {} as Record<string, any[]>
      );

      for (const [testType, tests] of Object.entries(testsByType)) {
        const passed = (tests as any[]).filter(
          (tr) =>
            tr.icpResult ||
            (tr.abResult?.methodPass !== false) ||
            tr.fungalResult?.pass
        ).length;
        testPassRatesByType[testType] = (passed / tests.length) * 100;
      }

      // Find flagged tests (those with AI review notes)
      const flaggedTests = allTestRuns
        .filter((tr) => tr.aiReviewNotes)
        .slice(0, 10)
        .map((tr) => ({
          testType: tr.testType,
          reason: tr.aiReviewNotes || "Review flagged",
          date: tr.testDate?.toISOString() || new Date().toISOString(),
          resolution: tr.brandApprovedAt ? "Approved" : "Pending",
        }));

      html = generateComplianceReport({
        brandName: brand.name,
        certifications: [
          { name: "OEKO-TEX", status: "Active" },
          { name: "bluesign", status: "Active" },
          { name: "ZDHC Level 3", status: "Pending" },
        ],
        testPassRatesByType,
        flaggedTests,
        recommendations: [
          "Continue regular testing schedule to maintain certifications",
          "Address any flagged tests before renewal applications",
          "Update compliance documentation quarterly",
        ],
      });
    }

    // ──────────────────────────────────────────────────
    // WEEKLY DIGEST
    // ──────────────────────────────────────────────────
    else if (type === "weekly-digest") {
      // Parse week dates
      let weekStart = new Date();
      if (weekOf) {
        weekStart = new Date(weekOf);
      }
      // Find the Monday of this week
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
      weekStart = new Date(weekStart.setDate(diff));

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Get test results from this week
      const testRuns = await prisma.testRun.findMany({
        where: {
          testDate: {
            gte: weekStart,
            lte: weekEnd,
          },
          brandVisible: true,
        },
        include: {
          submission: {
            include: { brand: true },
          },
          lab: true,
          icpResult: true,
          abResult: true,
          fungalResult: true,
          odorResult: true,
        },
        orderBy: { testDate: "desc" },
        take: 50,
      });

      const testResults = testRuns.map((tr) => ({
        brandName: tr.submission?.brand?.name || "Unknown",
        fabricCode: tr.submission?.customerFabricCode || "N/A",
        testType: tr.testType,
        passed:
          tr.icpResult ||
          (tr.abResult?.methodPass !== false) ||
          tr.fungalResult?.pass ||
          tr.odorResult?.pass ||
          false,
        labName: tr.lab?.name,
      }));

      // Get new brands this week
      const newBrands = await prisma.brand.findMany({
        where: {
          createdAt: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        take: 20,
      });

      // Get new factories this week (via access requests approval)
      const newFactories = await prisma.factory.findMany({
        where: {
          createdAt: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        take: 20,
      });

      // Get pipeline movements (brands with updated pipelineStage)
      const pipelineMovements = await prisma.brand.findMany({
        where: {
          updatedAt: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        take: 20,
      });

      // Get SOW status changes
      const sowUpdates = await prisma.sOW.findMany({
        where: {
          updatedAt: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        include: { brand: true },
        take: 20,
      });

      const complianceUpdates = sowUpdates.map((sow) => ({
        brandName: sow.brand.name,
        update: `SOW "${sow.title}" status: ${sow.status}`,
      }));

      // Get upcoming milestones
      const upcomingMilestones = await prisma.sOWMilestone.findMany({
        where: {
          dueDate: {
            gte: weekEnd,
            lte: new Date(weekEnd.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { dueDate: "asc" },
        take: 15,
      });

      html = generateWeeklyDigest({
        weekStartDate: weekStart.toISOString(),
        weekEndDate: weekEnd.toISOString(),
        testResults: testResults.slice(0, 20),
        newBrands: newBrands.map((b) => ({
          name: b.name,
          pipelineStage: b.pipelineStage,
        })),
        newFactories: newFactories.map((f) => ({
          name: f.name,
          country: f.country || undefined,
        })),
        pipelineMovements: pipelineMovements.map((b) => ({
          brandName: b.name,
          fromStage: "Unknown",
          toStage: b.pipelineStage,
        })),
        complianceUpdates,
        upcomingWeek: upcomingMilestones.map((m) => ({
          activity: m.title,
          dueDate: m.dueDate?.toISOString() || new Date().toISOString(),
        })),
      });
    }

    // ──────────────────────────────────────────────────
    // Return or send
    // ──────────────────────────────────────────────────

    if (!html) {
      return NextResponse.json(
        { error: "Invalid report type or missing required parameters" },
        { status: 400 }
      );
    }

    // Return HTML
    if (format === "html") {
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Send via email
    if (format === "email" && to) {
      const emailSubject = `FUZE Atlas Report: ${type}`;

      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "noreply@fuzeatlas.com",
        to,
        subject: emailSubject,
        html,
      });

      if (result.error) {
        return NextResponse.json(
          { error: "Failed to send email", details: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Report sent to ${to}`,
        id: result.data?.id,
      });
    }

    // Default: return HTML
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
