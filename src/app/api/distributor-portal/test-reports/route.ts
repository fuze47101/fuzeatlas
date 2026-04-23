// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/distributor-portal/test-reports
 *
 * Returns test reports relevant to the calling distributor user.
 *
 * "Relevant" means a TestRun whose either:
 *   (a) submission belongs to one of the distributor's factories, OR
 *   (b) project is assigned to this distributor (Project.distributorId).
 *
 * The earlier version of this route filtered Documents by
 * `uploadedById = user.id`, but Document has no `uploadedById`
 * column — `// @ts-nocheck` was hiding the runtime Prisma validation
 * error. Distributors should see reports for the brands and factories
 * they SERVE, not just files they personally uploaded — that was
 * Andrew's complaint in ticket #12.
 *
 * Query params:
 *   ?search=...        Free-text search across brand name, factory name, FUZE#, customer/factory code
 *   ?testType=...      Filter by TestType enum value (ICP_AG, AB, etc.)
 *   ?limit=50          Default 50, max 200
 *
 * Admins (ADMIN / EMPLOYEE) get all reports — useful for support.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user.role);
    if (!isDistributor && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const testTypeFilter = url.searchParams.get("testType")?.trim() || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50") || 50, 200);

    // Resolve the distributor scope for non-admins
    let factoryIds: string[] = [];
    let distributorId: string | null = null;

    if (isDistributor) {
      distributorId = user.distributorId || null;
      if (!distributorId) {
        return NextResponse.json(
          { ok: false, error: "No distributor assigned to your account" },
          { status: 400 },
        );
      }
      const factories = await prisma.factory.findMany({
        where: { distributorId },
        select: { id: true },
      });
      factoryIds = factories.map((f) => f.id);
    }

    // Build the TestRun where clause
    const where: any = {};
    const ands: any[] = [];

    if (!isAdmin) {
      // Either the submission's factory is in distributor's factory list,
      // OR the test run's project is assigned to this distributor.
      const scopeOr: any[] = [];
      if (factoryIds.length > 0) {
        scopeOr.push({ submission: { factoryId: { in: factoryIds } } });
      }
      if (distributorId) {
        scopeOr.push({ project: { distributorId } });
      }
      if (scopeOr.length === 0) {
        // Distributor with no factories AND no projects → nothing to show
        return NextResponse.json({ ok: true, reports: [] });
      }
      ands.push({ OR: scopeOr });
    }

    // Only test runs that actually have at least one REPORT document
    ands.push({ documents: { some: { kind: "REPORT" } } });

    if (testTypeFilter) {
      ands.push({ testType: testTypeFilter });
    }

    if (search) {
      ands.push({
        OR: [
          { submission: { brand: { name: { contains: search, mode: "insensitive" } } } },
          { submission: { factory: { name: { contains: search, mode: "insensitive" } } } },
          { submission: { customerFabricCode: { contains: search, mode: "insensitive" } } },
          { submission: { factoryFabricCode: { contains: search, mode: "insensitive" } } },
          { testReportNumber: { contains: search, mode: "insensitive" } },
          { fuzeInternalReportNumber: { contains: search, mode: "insensitive" } },
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
            factory: { select: { id: true, name: true, country: true } },
            fabric: { select: { id: true, fuzeNumber: true, fabricCategory: true, color: true } },
          },
        },
        project: {
          select: { id: true, name: true, brand: { select: { id: true, name: true } } },
        },
        documents: {
          where: { kind: "REPORT" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, filename: true, contentType: true, sizeBytes: true, createdAt: true },
        },
      },
      orderBy: [{ testDate: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    const reports = testRuns.map((t) => {
      const doc = t.documents[0];
      const sub = t.submission;
      const brand = sub?.brand || t.project?.brand || null;
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
        factory: factory ? { id: factory.id, name: factory.name, country: factory.country } : null,
        fuzeNumber,
        customerFabricCode: sub?.customerFabricCode || null,
        factoryFabricCode: sub?.factoryFabricCode || null,
        fabricCategory: sub?.fabric?.fabricCategory || null,
        color: sub?.fabric?.color || null,
        projectName: t.project?.name || null,
        createdAt: t.createdAt,
      };
    });

    return NextResponse.json({ ok: true, reports, scope: isAdmin ? "ADMIN_ALL" : "DISTRIBUTOR" });
  } catch (e: any) {
    console.error("Distributor test-reports error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
