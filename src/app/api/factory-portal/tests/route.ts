// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/factory-portal/tests
 *
 * Test runs for fabrics owned or submitted by the calling factory user.
 *
 * Tina ticket May 2026 — root cause:
 *   The previous query filtered ONLY by `fabric.factoryId == user.factoryId`.
 *   When a factory submits a fabric through Intake, the relationship lands
 *   on `FabricSubmission.factoryId`. `Fabric.factoryId` is sometimes left
 *   null (especially for fabrics that move between factories or are
 *   factory-agnostic catalog entries we treat for them under contract).
 *   Net effect: factories who submitted fabrics and had FUZE run the
 *   testing saw an empty Test Results page even though TestRuns existed
 *   in the database scoped to their submissions.
 *
 *   Fix: scope by EITHER fabric.factoryId OR submission.factoryId, and
 *   include a report-document download link so the factory can pull the
 *   PDF directly from this page instead of asking us to email it.
 *
 * Also drops the unauthenticated `x-user-id` header pattern in favour of
 * getCurrentUser() — the old route trusted a header any client could
 * spoof, which let any logged-in user read another factory's runs.
 */
export async function GET(req: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const isFactory =
      sessionUser.role === "FACTORY_USER" || sessionUser.role === "FACTORY_MANAGER";
    const isAdmin = ["ADMIN", "EMPLOYEE"].includes(sessionUser.role);

    if (!isFactory && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const factoryId = isFactory ? sessionUser.factoryId || null : null;
    if (isFactory && !factoryId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No factory assigned to your account. Ask your admin to link your user to a factory.",
        },
        { status: 400 },
      );
    }

    // Scope: any TestRun whose fabric.factoryId OR submission.factoryId
    // matches the caller's factory. Admins see everything.
    const where: any = isAdmin
      ? {}
      : {
          OR: [
            { fabric: { factoryId } },
            { submission: { factoryId } },
          ],
        };

    const testRuns = await prisma.testRun.findMany({
      where,
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
            factoryId: true,
            factory: { select: { id: true, name: true } },
            brand: { select: { id: true, name: true } },
            // Submission-level FUZE numbers + codes — fall back here
            // when Fabric is null, which happens for runs created
            // straight off the submission before fabric reconciliation.
            fuzeFabricNumber: true,
            customerFabricCode: true,
            factoryFabricCode: true,
          },
        },
        lab: { select: { id: true, name: true } },
        // Surface the report PDF so factories can download it without
        // having to email Tina. Take the most-recent REPORT document
        // attached to the run.
        documents: {
          where: { kind: "REPORT" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            filename: true,
            sizeBytes: true,
            contentType: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const runs = testRuns.map((run) => {
      const reportDoc = run.documents?.[0] || null;
      const fuzeNumber = run.fabric?.fuzeNumber ?? run.submission?.fuzeFabricNumber ?? null;
      const customerCode =
        run.fabric?.customerCode ?? run.submission?.customerFabricCode ?? null;
      const factoryCode =
        run.fabric?.factoryCode ?? run.submission?.factoryFabricCode ?? null;
      return {
        id: run.id,
        testType: run.testType,
        testReportNumber: run.testReportNumber,
        testMethodStd: run.testMethodStd,
        testDate: run.testDate ? new Date(run.testDate).toLocaleDateString() : null,
        washCount: run.washCount,
        lab: run.lab?.name,
        fuzeNumber,
        customerCode,
        factoryCode,
        fabricId: run.fabricId,
        hasIcp: run.hasIcp,
        hasAb: run.hasAb,
        hasFungal: run.hasFungal,
        hasOdor: run.hasOdor,
        result: run.result,
        submissionDate: run.submission?.submissionDate
          ? new Date(run.submission.submissionDate).toLocaleDateString()
          : null,
        // Brand attribution for context — visible to the factory only
        // when FUZE has linked a brand to the submission.
        brandName: run.submission?.brand?.name || null,
        // Report PDF download — the headline missing piece in Tina's
        // ticket. `null` when no report doc has landed yet.
        reportDocumentId: reportDoc?.id || null,
        reportDownloadUrl: reportDoc ? `/api/documents/${reportDoc.id}/download` : null,
        reportFilename: reportDoc?.filename || null,
      };
    });

    return NextResponse.json({
      ok: true,
      total: runs.length,
      runs,
      scope: isAdmin ? "ADMIN_ALL" : "FACTORY",
    });
  } catch (error: any) {
    console.error("Error fetching factory test runs:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error" },
      { status: 500 },
    );
  }
}
