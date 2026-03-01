// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get("type") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = 50;

    // Build where clause for type filter
    const where = filterType ? { testType: filterType } : {};

    const [
      testRuns,
      byType,
      filteredCount,
      recentRuns,
      icpCount,
      abCount,
      fungalCount,
      odorCount,
    ] = await Promise.all([
      prisma.testRun.count(),
      prisma.testRun.groupBy({ by: ["testType"], _count: { id: true } }),
      prisma.testRun.count({ where }),
      prisma.testRun.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          lab: { select: { name: true } },
          submission: {
            select: {
              fuzeFabricNumber: true,
              brand: { select: { name: true } },
              factory: { select: { name: true } },
            },
          },
          icpResult: true,
          abResult: true,
          fungalResult: true,
          odorResult: true,
        },
      }),
      prisma.icpResult.count(),
      prisma.abResult.count(),
      prisma.fungalResult.count(),
      prisma.odorResult.count(),
    ]);

    const typeBreakdown = byType.map((t) => ({
      type: t.testType || "UNKNOWN",
      count: t._count.id,
    }));

    const runs = recentRuns.map((r) => ({
      id: r.id,
      testType: r.testType,
      testReportNumber: r.testReportNumber || null,
      testDate: r.dateSent || r.dateReceived || null,
      testMethodStd: r.testMethodStd || null,
      washCount: r.washCount || null,
      lab: r.lab?.name || null,
      brand: r.submission?.brand?.name || null,
      factory: r.submission?.factory?.name || null,
      fuzeNumber: r.submission?.fuzeFabricNumber || null,
      hasIcp: r.icpResult != null,
      hasAb: r.abResult != null,
      hasFungal: r.fungalResult != null,
      hasOdor: r.odorResult != null,
    }));

    return NextResponse.json({
      ok: true,
      total: testRuns,
      filteredCount,
      page,
      pageSize,
      totalPages: Math.ceil(filteredCount / pageSize),
      typeBreakdown,
      runs,
      resultCounts: {
        icp: icpCount,
        antibacterial: abCount,
        fungal: fungalCount,
        odor: odorCount,
      },
    });
  } catch (e: any) {
    console.error("Tests API error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
