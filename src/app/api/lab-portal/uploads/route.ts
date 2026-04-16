// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/lab-portal/uploads
 * Returns all documents uploaded by the current lab user's lab.
 * Shows report history so labs can verify uploads and see business volume.
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
            reportNumber: true,
            testDate: true,
            washCount: true,
            result: true,
            status: true,
            lab: { select: { id: true, name: true } },
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
            fabric: { select: { id: true, fuzeNumber: true, customerCode: true } },
          },
        },
        lab: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Compute summary stats
    const totalUploads = documents.length;
    const linkedToTests = documents.filter((d: any) => d.testRunId).length;
    const testTypes: Record<string, number> = {};
    const brands: Record<string, number> = {};

    documents.forEach((d: any) => {
      if (d.testRun?.testType) {
        testTypes[d.testRun.testType] = (testTypes[d.testRun.testType] || 0) + 1;
      }
      if (d.testRun?.brand?.name) {
        brands[d.testRun.brand.name] = (brands[d.testRun.brand.name] || 0) + 1;
      }
    });

    return NextResponse.json({
      ok: true,
      documents,
      stats: {
        totalUploads,
        linkedToTests,
        testTypes,
        brands,
      },
    });
  } catch (error: any) {
    console.error("Error fetching lab uploads:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch upload history" },
      { status: 500 }
    );
  }
}
