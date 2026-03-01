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
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
