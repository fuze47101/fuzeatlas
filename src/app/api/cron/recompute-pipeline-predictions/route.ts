// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { predictBrandValue } from "@/lib/pipeline-prediction";

/**
 * /api/cron/recompute-pipeline-predictions
 *
 * MB-4. Daily 04:00 UTC. For every Brand whose pipelineStage isn't
 * ARCHIVE, compute the predicted 12-month $ value and stamp
 * predictedValueUSD + predictedValueComputedAt + predictedValueFactors.
 *
 * For brands with at least one FuzeOrder we feed lifetime booked
 * volume + years-since-first-order into the predictor so the actuals
 * anchor kicks in instead of the vertical default.
 *
 * Bearer-authed via `Authorization: Bearer $CRON_SECRET`.
 */

const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();

  const brands = await prisma.brand.findMany({
    where: { pipelineStage: { not: "ARCHIVE" } },
    select: {
      id: true,
      name: true,
      pipelineStage: true,
      textileCategory: true,
      fuzeRelevance: true,
      engagement: { select: { overallScore: true } },
    },
  });

  // Pull lifetime FuzeOrder volume + earliest createdAt per brand in
  // one shot. groupBy is cheap; we then index into a map below.
  const ordersAgg = await prisma.fuzeOrder.groupBy({
    by: ["brandId"],
    where: {
      brandId: { not: null },
      status: { notIn: ["CANCELLED"] },
    },
    _sum: { volumeLiters: true },
    _min: { createdAt: true },
  });
  const aggByBrand = new Map<string, { liters: number; firstAt: Date }>();
  for (const row of ordersAgg) {
    if (!row.brandId) continue;
    aggByBrand.set(row.brandId, {
      liters: row._sum.volumeLiters || 0,
      firstAt: row._min.createdAt || new Date(),
    });
  }

  const now = new Date();
  const results: Array<{
    brandId: string;
    name: string;
    predictedValueUSD: number;
    stage: string;
  }> = [];
  let errorCount = 0;

  for (const b of brands) {
    try {
      const agg = aggByBrand.get(b.id);
      const yearsBookingFuze = agg
        ? Math.max(0.5, (now.getTime() - agg.firstAt.getTime()) / (365 * 24 * 60 * 60 * 1000))
        : null;

      const prediction = predictBrandValue({
        pipelineStage: b.pipelineStage,
        textileCategory: b.textileCategory,
        fuzeRelevance: b.fuzeRelevance,
        engagementScore: b.engagement?.overallScore ?? null,
        lifetimeFuzeLitersBooked: agg?.liters ?? null,
        yearsBookingFuze,
      });

      await prisma.brand.update({
        where: { id: b.id },
        data: {
          predictedValueUSD: prediction.predictedValueUSD,
          predictedValueComputedAt: now,
          predictedValueFactors: prediction.factors as any,
        } as any,
      });

      results.push({
        brandId: b.id,
        name: b.name,
        predictedValueUSD: prediction.predictedValueUSD,
        stage: b.pipelineStage,
      });
    } catch (e) {
      console.error(`[recompute-pipeline-predictions] ${b.id} (${b.name}) failed:`, e);
      errorCount++;
    }
  }

  results.sort((a, b) => b.predictedValueUSD - a.predictedValueUSD);
  const top5 = results.slice(0, 5);

  return NextResponse.json({
    ok: errorCount === 0,
    verdict: `Stamped ${results.length} brands · ${errorCount} errors · ${
      Date.now() - startedAt
    }ms total.`,
    summary: {
      total: brands.length,
      stamped: results.length,
      errors: errorCount,
      top5,
    },
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
