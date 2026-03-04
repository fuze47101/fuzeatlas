// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/pipeline ── Pipeline aggregation by project stage ──── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId") || "";
    const factoryId = searchParams.get("factoryId") || "";
    const distributorId = searchParams.get("distributorId") || "";

    const where: any = {};
    if (brandId) where.brandId = brandId;
    if (factoryId) where.factoryId = factoryId;
    if (distributorId) where.distributorId = distributorId;

    const projects = await prisma.project.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true, country: true } },
        distributor: { select: { id: true, name: true, country: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Group by stage
    const stages = [
      "DEVELOPMENT", "SAMPLING", "TESTING", "APPROVED",
      "COMMERCIALIZATION", "PRODUCTION", "COMPLETE",
    ];

    const pipeline = stages.map((stage) => {
      const inStage = projects.filter((p) => p.stage === stage);
      const totalValue = inStage.reduce((s, p) => s + (p.projectedValue || 0), 0);
      const weightedForecast = inStage.reduce(
        (s, p) => s + (p.projectedValue || 0) * ((p.probability || 0) / 100), 0
      );
      const probSum = inStage.reduce((s, p) => s + (p.probability || 0), 0);

      return {
        stage,
        count: inStage.length,
        totalValue: Math.round(totalValue * 100) / 100,
        weightedForecast: Math.round(weightedForecast * 100) / 100,
        avgProbability: inStage.length > 0 ? Math.round(probSum / inStage.length) : 0,
        projects: inStage.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand?.name || null,
          brandId: p.brandId,
          factory: p.factory?.name || null,
          factoryCountry: p.factory?.country || null,
          distributor: p.distributor?.name || null,
          projectedValue: p.projectedValue,
          actualValue: p.actualValue,
          probability: p.probability,
          fuzeTier: p.fuzeTier,
          annualVolumeMeters: p.annualVolumeMeters,
          annualFuzeLiters: p.annualFuzeLiters,
          expectedProductionDate: p.expectedProductionDate,
          actualProductionDate: p.actualProductionDate,
          currency: p.currency,
        })),
      };
    });

    // Summary
    const totalPipeline = projects.reduce((s, p) => s + (p.projectedValue || 0), 0);
    const weightedTotal = projects.reduce(
      (s, p) => s + (p.projectedValue || 0) * ((p.probability || 0) / 100), 0
    );
    const actualTotal = projects.reduce((s, p) => s + (p.actualValue || 0), 0);

    return NextResponse.json({
      ok: true,
      pipeline,
      summary: {
        totalProjects: projects.length,
        totalPipeline: Math.round(totalPipeline * 100) / 100,
        weightedForecast: Math.round(weightedTotal * 100) / 100,
        actualRevenue: Math.round(actualTotal * 100) / 100,
      },
    });
  } catch (e: any) {
    console.error("Pipeline API error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
