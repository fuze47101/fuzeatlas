// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/factory-portal/test-reports
 *
 * Returns test reports relevant to the calling factory user.
 *
 * "Relevant" means a TestRun whose submission.factoryId matches the
 * caller's factoryId. Plus Document rows of kind=REPORT that aren't
 * linked to a TestRun yet but were uploaded by this factory (via
 * raw.uploaderFactoryId on the Document) — so the user gets
 * immediate "yes, your upload saved" feedback even when the parser
 * couldn't auto-confirm.
 *
 * Mirrors /api/distributor-portal/test-reports.
 *
 * Filed against Tina's complaint (May 2026) that factories couldn't
 * upload test reports at all — factories had no upload page and no
 * portal listing, even though the underlying /api/tests/upload
 * endpoint did accept their POSTs.
 *
 * Query params:
 *   ?search=...        Free-text search across brand name, factory name, FUZE#, customer/factory code, report number
 *   ?testType=...      Filter by TestType enum value (ICP_AG, AB, etc.)
 *   ?limit=50          Default 50, max 200
 *
 * Admins (ADMIN / EMPLOYEE) get all reports — useful for support.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const isFactory = user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER";
    const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user.role);
    if (!isFactory && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const testTypeFilter = url.searchParams.get("testType")?.trim() || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50") || 50, 200);

    let factoryId: string | null = null;
    if (isFactory) {
      factoryId = user.factoryId || null;
      if (!factoryId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "No factory assigned to your account. Ask your admin to link your user to a factory.",
          },
          { status: 400 },
        );
      }
    }

    // ─── Confirmed reports (TestRuns w/ a REPORT document) ─────────
    const where: any = {};
    const ands: any[] = [];

    if (!isAdmin && factoryId) {
      ands.push({ submission: { factoryId } });
    }

    ands.push({ documents: { some: { kind: "REPORT" } } });

    if (testTypeFilter) {
      ands.push({ testType: testTypeFilter });
    }

    if (search) {
      ands.push({
        OR: [
          {
            submission: {
              brand: { name: { contains: search, mode: "insensitive" } },
            },
          },
          {
            submission: {
              factory: { name: { contains: search, mode: "insensitive" } },
            },
          },
          {
            submission: {
              customerFabricCode: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
          {
            submission: {
              factoryFabricCode: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
          {
            testReportNumber: { contains: search, mode: "insensitive" },
          },
          {
            fuzeInternalReportNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      });
    }

    if (ands.length > 0) where.AND = ands;

    const testRuns = await prisma.testRun.findMany({
      where,
      select: {
        id: true,
        testType: true,
        testMethodStd: true,
        testReportNumber: true,
        fuzeInternalReportNumber: true,
        testDate: true,
        washCount: true,
        createdAt: true,
        lab: { select: { id: true, name: true } },
        submission: {
          select: {
            id: true,
            fuzeFabricNumber: true,
            customerFabricCode: true,
            factoryFabricCode: true,
            brand: { select: { id: true, name: true } },
            factory: {
              select: { id: true, name: true, country: true },
            },
            fabric: {
              select: {
                id: true,
                fuzeNumber: true,
                fabricCategory: true,
                color: true,
              },
            },
          },
        },
        documents: {
          where: { kind: "REPORT" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            filename: true,
            contentType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ testDate: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    const reports = testRuns.map((t) => {
      const doc = t.documents[0];
      const sub = t.submission;
      const brand = sub?.brand || null;
      const factory = sub?.factory || null;
      const fuzeNumber = sub?.fuzeFabricNumber ?? sub?.fabric?.fuzeNumber ?? null;
      return {
        testRunId: t.id,
        documentId: doc?.id || null,
        filename: doc?.filename || null,
        sizeBytes: doc?.sizeBytes || null,
        downloadUrl: doc ? `/api/documents/${doc.id}/download` : null,
        testType: t.testType,
        testMethodStd: t.testMethodStd,
        reportNumber: t.testReportNumber || t.fuzeInternalReportNumber || null,
        washCount: t.washCount,
        testDate: t.testDate,
        labName: t.lab?.name || null,
        brand: brand ? { id: brand.id, name: brand.name } : null,
        factory: factory
          ? {
              id: factory.id,
              name: factory.name,
              country: factory.country,
            }
          : null,
        fuzeNumber,
        customerFabricCode: sub?.customerFabricCode || null,
        factoryFabricCode: sub?.factoryFabricCode || null,
        fabricCategory: sub?.fabric?.fabricCategory || null,
        color: sub?.fabric?.color || null,
        createdAt: t.createdAt,
      };
    });

    // ─── Pending uploads (Document rows with no TestRun yet) ──────
    // We surface uploads scoped two ways:
    //   1. submission.factoryId matches caller's factory (parser
    //      auto-linked the file but couldn't auto-confirm it as a
    //      TestRun).
    //   2. Document.raw->>'uploaderFactoryId' equals caller's
    //      factoryId — covers the brand-new "factory drops a PDF
    //      with no submission attached yet" path.
    const pendingScopeOr: any[] = [];
    if (factoryId) {
      pendingScopeOr.push({ submission: { factoryId } });
      pendingScopeOr.push({
        raw: { path: ["uploaderFactoryId"], equals: factoryId },
        submission: null,
      });
    }

    const pendingDocs = await prisma.document.findMany({
      where: {
        kind: "REPORT",
        testRunId: null,
        ...(isAdmin
          ? {}
          : pendingScopeOr.length > 0
            ? { OR: pendingScopeOr }
            : { id: "_no_match_" }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        filename: true,
        sizeBytes: true,
        contentType: true,
        createdAt: true,
        labId: true,
        lab: { select: { id: true, name: true } },
        submission: {
          select: {
            id: true,
            fuzeFabricNumber: true,
            customerFabricCode: true,
            factoryFabricCode: true,
            brand: { select: { id: true, name: true } },
            factory: {
              select: { id: true, name: true, country: true },
            },
            fabric: {
              select: {
                id: true,
                fuzeNumber: true,
                fabricCategory: true,
                color: true,
              },
            },
          },
        },
      },
    });

    const pending = pendingDocs.map((d) => ({
      testRunId: null,
      documentId: d.id,
      filename: d.filename,
      sizeBytes: d.sizeBytes,
      downloadUrl: `/api/documents/${d.id}/download`,
      testType: null,
      testMethodStd: null,
      reportNumber: null,
      washCount: null,
      testDate: null,
      labName: d.lab?.name || null,
      brand: d.submission?.brand
        ? { id: d.submission.brand.id, name: d.submission.brand.name }
        : null,
      factory: d.submission?.factory
        ? {
            id: d.submission.factory.id,
            name: d.submission.factory.name,
            country: d.submission.factory.country,
          }
        : null,
      fuzeNumber: d.submission?.fuzeFabricNumber ?? d.submission?.fabric?.fuzeNumber ?? null,
      customerFabricCode: d.submission?.customerFabricCode || null,
      factoryFabricCode: d.submission?.factoryFabricCode || null,
      fabricCategory: d.submission?.fabric?.fabricCategory || null,
      color: d.submission?.fabric?.color || null,
      createdAt: d.createdAt,
      status: "pending_review" as const,
    }));

    const confirmedReports = reports.map((r) => ({
      ...r,
      status: "confirmed" as const,
    }));

    return NextResponse.json({
      ok: true,
      reports: [...pending, ...confirmedReports],
      scope: isAdmin ? "ADMIN_ALL" : "FACTORY",
      pendingCount: pending.length,
      confirmedCount: confirmedReports.length,
    });
  } catch (e: any) {
    console.error("Factory test-reports error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
