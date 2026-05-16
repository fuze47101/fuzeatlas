// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/top-pipeline-potential
 *
 * MB-4 widget data: top 10 brands ranked by predictedValueUSD desc.
 * Excludes ARCHIVE / CUSTOMER_WON so the BD reps' call-list focuses
 * on movable pipeline. Reads the cron-stamped column — no in-request
 * recomputation.
 */
const ALLOWED = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }
  const rows = await prisma.brand.findMany({
    where: {
      predictedValueUSD: { not: null },
      pipelineStage: { notIn: ["ARCHIVE", "CUSTOMER_WON"] },
    } as any,
    select: {
      id: true,
      name: true,
      pipelineStage: true,
      textileCategory: true,
      fuzeRelevance: true,
      predictedValueUSD: true,
      predictedValueComputedAt: true,
      predictedValueFactors: true,
      salesRep: { select: { id: true, name: true } },
    } as any,
    orderBy: { predictedValueUSD: "desc" } as any,
    take: 10,
  });

  // Total pipeline potential — gives a hero number for the widget header.
  const total = await prisma.brand.aggregate({
    where: {
      predictedValueUSD: { not: null },
      pipelineStage: { notIn: ["ARCHIVE", "CUSTOMER_WON"] },
    } as any,
    _sum: { predictedValueUSD: true } as any,
    _count: true,
  });

  return NextResponse.json({
    ok: true,
    rows,
    totalPredictedUSD: (total as any)._sum?.predictedValueUSD || 0,
    brandCount: total._count,
  });
}
