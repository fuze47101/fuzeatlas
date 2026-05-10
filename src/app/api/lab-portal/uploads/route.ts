// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/lab-portal/uploads
 * Returns all documents uploaded by the current lab user's lab.
 * Shows report history so labs can verify uploads and see business volume.
 *
 * Bug history (Apr 2026, Tina ticket): the original version selected
 * brand / factory / fabric / result / status / reportNumber DIRECTLY
 * on TestRun. None of those exist as columns on TestRun:
 *   - brand/factory/fabric are reachable only via submission
 *   - reportNumber is actually testReportNumber
 *   - result is on the per-method tables (icpResult, abResult, etc.)
 *   - status doesn't exist on TestRun at all
 * Prisma was throwing "Unknown field" on every call, so the endpoint
 * 500'd and Tina saw zero uploads in the lab portal. Fix walks
 * through submission for the entity references and surfaces the
 * pending (no testRunId) uploads so the lab can confirm a file
 * landed even before admin review confirms it.
 */
export async function GET(req: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const labId = sessionUser.labId;
    const isAdmin = sessionUser.role === "ADMIN" || sessionUser.role === "EMPLOYEE";

    if (!labId && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Not a lab user" }, { status: 403 });
    }

    // Build query — labs see their own, admins see all (including unlinked)
    const where: any = { kind: "REPORT" };
    if (labId && !isAdmin) {
      where.labId = labId;
    }
    // Admins see everything (no labId filter)

    // Parse query params for filtering
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : 100;

    const documents = await prisma.document.findMany({
      where,
      include: {
        testRun: {
          select: {
            id: true,
            testType: true,
            testReportNumber: true,
            fuzeInternalReportNumber: true,
            testDate: true,
            washCount: true,
            // Phase 7F — surface brand approval status to the lab.
            brandVisible: true,
            brandApprovalStatus: true,
            brandRejectionReason: true,
            // Per-method result tables (one is non-null depending on
            // testType). Selecting the id is enough to know "yes,
            // a result row exists" — full result data is a heavier
            // query the upload-history view doesn't need.
            icpResult: { select: { id: true } },
            abResult: { select: { id: true } },
            fungalResult: { select: { id: true } },
            odorResult: { select: { id: true } },
            lab: { select: { id: true, name: true } },
            // Brand / factory / fabric live on the submission, not
            // directly on TestRun. Walk through the relation.
            submission: {
              select: {
                id: true,
                fuzeFabricNumber: true,
                customerFabricCode: true,
                factoryFabricCode: true,
                brand: { select: { id: true, name: true } },
                factory: { select: { id: true, name: true, country: true } },
                fabric: {
                  select: {
                    id: true,
                    fuzeNumber: true,
                    customerCode: true,
                    fabricCategory: true,
                    color: true,
                  },
                },
              },
            },
          },
        },
        lab: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Flatten + tag pending vs confirmed for the UI. A document
    // with testRunId set is "confirmed" (admin reviewed + linked
    // to a TestRun); without testRunId it's "pending review" (the
    // upload landed but the parser couldn't auto-extract enough,
    // or the admin hasn't confirmed yet).
    const enriched = documents.map((d: any) => {
      const tr = d.testRun || null;
      const sub = tr?.submission || null;
      const brand = sub?.brand || null;
      const factory = sub?.factory || null;
      const fabric = sub?.fabric || null;
      const fuzeNumber =
        sub?.fuzeFabricNumber ?? fabric?.fuzeNumber ?? null;
      const hasResult = !!(
        tr?.icpResult ||
        tr?.abResult ||
        tr?.fungalResult ||
        tr?.odorResult
      );

      // Build a testRun shape that matches what the existing
      // /lab-portal/uploads page expects (which queries
      // doc.testRun.brand / .factory / .fabric / .reportNumber /
      // .status). Original Prisma shape didn't have any of those —
      // they all live on submission, not TestRun. So we synthesise
      // the nested shape here from the underlying sub. If there's
      // no testRun yet (pending review), the field is null and the
      // page renders "—" / "Awaiting admin review".
      const testRunOut = tr
        ? {
            id: tr.id,
            testType: tr.testType,
            reportNumber:
              tr.testReportNumber || tr.fuzeInternalReportNumber || "—",
            testDate: tr.testDate,
            washCount: tr.washCount,
            status: hasResult ? "complete" : "in_progress",
            lab: tr.lab,
            brand: brand ? { name: brand.name, id: brand.id } : null,
            factory: factory
              ? { name: factory.name, id: factory.id, country: factory.country }
              : null,
            fabric: fabric
              ? {
                  fuzeNumber,
                  customerCode: fabric.customerCode,
                  id: fabric.id,
                }
              : fuzeNumber
                ? { fuzeNumber, customerCode: null }
                : undefined,
          }
        : null;

      return {
        id: d.id,
        filename: d.filename,
        sizeBytes: d.sizeBytes,
        contentType: d.contentType,
        createdAt: d.createdAt,
        labName: d.lab?.name || null,
        testRun: testRunOut,
        // Flat aliases — easier for any future consumer that doesn't
        // want to crawl through testRun.
        testRunId: tr?.id || null,
        testType: tr?.testType || null,
        testReportNumber:
          tr?.testReportNumber || tr?.fuzeInternalReportNumber || null,
        testDate: tr?.testDate || null,
        washCount: tr?.washCount ?? null,
        hasResult,
        brand: brand ? { id: brand.id, name: brand.name } : null,
        factory: factory
          ? { id: factory.id, name: factory.name, country: factory.country }
          : null,
        fabric: fabric
          ? {
              id: fabric.id,
              fuzeNumber,
              customerCode: fabric.customerCode,
              category: fabric.fabricCategory,
              color: fabric.color,
            }
          : { fuzeNumber, customerCode: null, category: null, color: null },
        downloadUrl: `/api/documents/${d.id}/download`,
        status: tr?.id ? "confirmed" : "pending_review",
      };
    });

    // Compute summary stats
    const totalUploads = enriched.length;
    const linkedToTests = enriched.filter((d) => d.testRunId).length;
    const pendingReview = enriched.filter((d) => !d.testRunId).length;
    const testTypes: Record<string, number> = {};
    const brands: Record<string, number> = {};
    for (const d of enriched) {
      if (d.testType) testTypes[d.testType] = (testTypes[d.testType] || 0) + 1;
      if (d.brand?.name) brands[d.brand.name] = (brands[d.brand.name] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      documents: enriched,
      stats: {
        totalUploads,
        linkedToTests,
        pendingReview,
        testTypes,
        brands,
      },
    });
  } catch (error: any) {
    console.error("Error fetching lab uploads:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to fetch upload history",
      },
      { status: 500 }
    );
  }
}
