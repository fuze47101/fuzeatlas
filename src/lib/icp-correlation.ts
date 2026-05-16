/**
 * src/lib/icp-correlation.ts — MB-1 ICP correlation chart helpers.
 *
 * Pulls every brand-visible TestRun that has BOTH an IcpResult (with
 * agValue, the FUZE residual measurement in mg/kg fabric) AND an
 * AntibacterialResult (with percentReduction, the kill rate across
 * the test method). Returns a point cloud ready for the SVG scatter.
 *
 * Customer-facing copy NEVER says "silver" or "Ag" — per CLAUDE.md
 * brand voice rules, the residual measurement surfaces as "FUZE
 * residual (mg/kg)". The DB column stays `agValue` because that's
 * what the lab reports use.
 */
import { prisma } from "@/lib/prisma";

export interface CorrelationPoint {
  testRunId: string;
  fabricId: string | null;
  fuzeNumber: number | null;
  factoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  tier: string | null;
  testDate: string | null;
  /** FUZE residual on fabric (mg/kg), from IcpResult.agValue. */
  icpValue: number;
  /** AB efficacy percent reduction (0..100), from AntibacterialResult.percentReduction. */
  abPercentReduction: number;
  /** Optional method tag for the tooltip (AATCC 100, ASTM E2149, etc.). */
  testMethod: string | null;
}

export interface RegressionLine {
  slope: number;
  intercept: number;
  /** Pearson r-squared. */
  r2: number;
  /** Endpoints in data space — handy for SVG plotting. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Ordinary least-squares fit. Skips silently when fewer than 2 points.
 */
export function fitRegression(points: CorrelationPoint[]): RegressionLine | null {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (const p of points) {
    sumX += p.icpValue;
    sumY += p.abPercentReduction;
    sumXY += p.icpValue * p.abPercentReduction;
    sumX2 += p.icpValue * p.icpValue;
    sumY2 += p.abPercentReduction * p.abPercentReduction;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const numerator = n * sumXY - sumX * sumY;
  const ssTotXNum = Math.sqrt(n * sumX2 - sumX * sumX);
  const ssTotYNum = Math.sqrt(n * sumY2 - sumY * sumY);
  const denomR = ssTotXNum * ssTotYNum;
  const r = denomR === 0 ? 0 : numerator / denomR;
  const r2 = r * r;

  const xs = points.map((p) => p.icpValue);
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  return {
    slope,
    intercept,
    r2,
    x1,
    y1: intercept + slope * x1,
    x2,
    y2: intercept + slope * x2,
  };
}

/**
 * Load brand-visible TestRuns with both ICP + AB data. When
 * `brandId` is set, scopes to that brand (drives the brand-portal
 * view). Without it returns global (admin scope).
 *
 * Cap is 2000 points so the SVG stays performant — well above any
 * realistic dataset for the foreseeable future.
 */
export async function loadCorrelationPoints(
  brandId?: string | null,
): Promise<CorrelationPoint[]> {
  const where: any = {
    brandVisible: true,
    // Prisma relation-filter syntax: field constraints on the related
    // record go INSIDE an `is: {...}` block, not siblinged with
    // `isNot`. Previous shape `{ isNot: null, agValue: {...} }` threw
    // "Unknown argument is" — caught when Akina (Rhone) hit the page
    // May 16. Using `is: { ... }` implies the relation exists AND the
    // field constraint holds, which is exactly what we want here.
    icpResult: { is: { agValue: { not: null } } },
    abResult: { is: { percentReduction: { not: null } } },
  };
  if (brandId) {
    where.submission = { fabric: { brandId } };
  }

  const runs = await prisma.testRun.findMany({
    where,
    select: {
      id: true,
      testDate: true,
      icpResult: { select: { agValue: true } },
      abResult: {
        select: { percentReduction: true, testMethodStd: true },
      },
      lab: { select: { name: true } },
      submission: {
        select: {
          fabric: {
            select: {
              id: true,
              fuzeNumber: true,
              targetFuzeTier: true,
              brand: { select: { id: true, name: true, requiredFuzeTier: true } },
              factory: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { testDate: "desc" },
    take: 2000,
  });

  const points: CorrelationPoint[] = [];
  for (const r of runs) {
    const icpValue = r.icpResult?.agValue;
    const abPct = r.abResult?.percentReduction;
    if (icpValue == null || abPct == null) continue;
    if (!Number.isFinite(icpValue) || !Number.isFinite(abPct)) continue;
    points.push({
      testRunId: r.id,
      fabricId: r.submission?.fabric?.id || null,
      fuzeNumber: r.submission?.fabric?.fuzeNumber ?? null,
      factoryName: r.submission?.fabric?.factory?.name || null,
      brandId: r.submission?.fabric?.brand?.id || null,
      brandName: r.submission?.fabric?.brand?.name || null,
      tier:
        r.submission?.fabric?.targetFuzeTier ||
        r.submission?.fabric?.brand?.requiredFuzeTier ||
        null,
      testDate: r.testDate?.toISOString() || null,
      icpValue,
      abPercentReduction: abPct,
      testMethod: r.abResult?.testMethodStd || null,
    });
  }
  return points;
}
