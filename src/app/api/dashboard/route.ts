// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const [
      fabrics, brands, factories, distributors, labs,
      testRuns, icpResults, antibacterialResults, fungalResults, odorResults,
      submissions, contacts, users, notes,
    ] = await Promise.all([
      prisma.fabric.count(),
      prisma.brand.count(),
      prisma.factory.count(),
      prisma.distributor.count(),
      prisma.lab.count(),
      prisma.testRun.count(),
      prisma.icpResult.count(),
      prisma.antibacterialResult.count(),
      prisma.fungalResult.count(),
      prisma.odorResult.count(),
      prisma.fabricSubmission.count(),
      prisma.contact.count(),
      prisma.user.count(),
      prisma.note.count(),
    ]);

    // Pipeline breakdown
    const stages = [
      "LEAD","PRESENTATION","BRAND_TESTING","FACTORY_ONBOARDING",
      "FACTORY_TESTING","PRODUCTION","BRAND_EXPANSION","ARCHIVE","CUSTOMER_WON",
    ];
    const pipeline = await Promise.all(
      stages.map(async (stage) => ({
        stage,
        count: await prisma.brand.count({ where: { pipelineStage: stage } }),
      }))
    );

    // Recent fabrics
    const recentFabrics = await prisma.fabric.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, fuzeNumber: true, construction: true, color: true,
        createdAt: true,
        brand: { select: { name: true } },
        factory: { select: { name: true } },
      },
    });

    // Recent test runs
    const recentTests = await prisma.testRun.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, testType: true, testDate: true, createdAt: true,
        testReportNumber: true,
        lab: { select: { name: true } },
        submission: {
          select: {
            fuzeFabricNumber: true,
            brand: { select: { name: true } },
          },
        },
        icpResult: true,
        abResult: true,
      },
    });

    // Test type breakdown
    const testTypes = await prisma.testRun.groupBy({
      by: ["testType"],
      _count: true,
    });

    // ─── Revenue Pipeline KPIs ─────────────
    const allProjects = await prisma.project.findMany({
      where: { projectedValue: { not: null } },
      select: { projectedValue: true, actualValue: true, probability: true, stage: true },
    });

    const totalPipeline = allProjects.reduce((s, p) => s + (p.projectedValue || 0), 0);
    const weightedForecast = allProjects.reduce(
      (s, p) => s + (p.projectedValue || 0) * ((p.probability || 0) / 100), 0
    );
    const actualRevenue = allProjects.reduce((s, p) => s + (p.actualValue || 0), 0);

    // Invoice metrics
    const invoiceMetrics = await prisma.invoice.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: { id: true },
    });
    const invoicePaid = invoiceMetrics.find((m) => m.status === "PAID")?._sum?.amount || 0;
    const invoiceOutstanding =
      (invoiceMetrics.find((m) => m.status === "SENT")?._sum?.amount || 0) +
      (invoiceMetrics.find((m) => m.status === "DRAFT")?._sum?.amount || 0) +
      (invoiceMetrics.find((m) => m.status === "OVERDUE")?._sum?.amount || 0);

    // Project stage breakdown
    const projectPipeline = await prisma.project.groupBy({
      by: ["stage"],
      _count: { id: true },
      _sum: { projectedValue: true },
    });

    // ─── Test Request metrics ─────────────
    let testRequestStats = { pending: 0, approved: 0, inTesting: 0, total: 0, estimatedCost: 0 };
    try {
      const trStats = await prisma.testRequest.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { estimatedCost: true },
      });
      testRequestStats.total = trStats.reduce((s, r) => s + r._count.id, 0);
      testRequestStats.pending = trStats.find((r) => r.status === "PENDING_APPROVAL")?._count?.id || 0;
      testRequestStats.approved = trStats.find((r) => r.status === "APPROVED")?._count?.id || 0;
      testRequestStats.inTesting = (trStats.find((r) => r.status === "SUBMITTED")?._count?.id || 0) +
        (trStats.find((r) => r.status === "IN_PROGRESS")?._count?.id || 0);
      testRequestStats.estimatedCost = trStats.reduce((s, r) => s + (r._sum.estimatedCost || 0), 0);
    } catch {
      // TestRequest table may not exist yet
    }

    return NextResponse.json({
      ok: true,
      counts: {
        fabrics, brands, factories, distributors, labs,
        testRuns, icpResults, antibacterialResults, fungalResults, odorResults,
        submissions, contacts, users, notes,
      },
      pipeline,
      testTypes: testTypes.map((t) => ({ type: t.testType, count: t._count })),
      recentFabrics,
      recentTests,
      testRequests: testRequestStats,
      revenue: {
        totalPipeline: Math.round(totalPipeline * 100) / 100,
        weightedForecast: Math.round(weightedForecast * 100) / 100,
        actualRevenue: Math.round(actualRevenue * 100) / 100,
        invoicePaid: Math.round(invoicePaid * 100) / 100,
        invoiceOutstanding: Math.round(invoiceOutstanding * 100) / 100,
        dealCount: allProjects.length,
        projectPipeline: projectPipeline.map((p) => ({
          stage: p.stage,
          count: p._count.id,
          value: p._sum.projectedValue || 0,
        })),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
