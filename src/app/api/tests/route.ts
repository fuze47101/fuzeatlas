// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const [
      testRuns,
      byType,
      recentRuns,
      icpCount,
      fungalCount,
      odorCount,
    ] = await Promise.all([
      prisma.testRun.count(),
      prisma.testRun.groupBy({ by: ["testType"], _count: { id: true } }),
      prisma.testRun.findMany({
        take: 30,
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
      dateSent: r.dateSent,
      dateReceived: r.dateReceived,
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
      typeBreakdown,
      runs,
      resultCounts: {
        icp: icpCount,
        fungal: fungalCount,
        odor: odorCount,
      },
    });
  } catch (e: any) {
    console.error("Tests API error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
