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
 * Load correlation points pairing ICP residual (mg/kg) to AB
 * percentReduction (%). When `brandId` is set, scopes to that brand
 * (drives the brand-portal view); otherwise returns global (admin scope).
 *
 * Architecture: TestRun.testType is single-valued — no single row holds
 * both an icpResult AND an abResult. Correlation points are produced
 * by joining ICP and AB TestRuns through their shared FabricSubmission.
 *
 * Pairing rule per submission:
 *   1. If any (ICP, AB) pair shares a washCount, emit one point per
 *      shared washCount — same wash cycle, apples-to-apples.
 *   2. Otherwise emit one point pairing the most-recent ICP value to
 *      the most-recent AB value on that submission (by testDate desc).
 *
 * Both runs must be brandVisible. Submission cap is 2000 — well above
 * any realistic dataset.
 */
export async function loadCorrelationPoints(
  brandId?: string | null,
): Promise<CorrelationPoint[]> {
  const submissionWhere: any = {
    // Submission must have BOTH an ICP run with agValue AND an AB run
    // with percentReduction, both brand-visible. Prisma `some:` filter
    // returns submissions where at least one related row matches.
    testRuns: {
      some: {
        testType: "ICP",
        brandVisible: true,
        icpResult: { is: { agValue: { not: null } } },
      },
    },
    AND: [
      {
        testRuns: {
          some: {
            testType: "ANTIBACTERIAL",
            brandVisible: true,
            abResult: { is: { percentReduction: { not: null } } },
          },
        },
      },
    ],
  };
  if (brandId) {
    submissionWhere.fabric = { brandId };
  }

  const submissions = await prisma.fabricSubmission.findMany({
    where: submissionWhere,
    select: {
      id: true,
      fabric: {
        select: {
          id: true,
          fuzeNumber: true,
          targetFuzeTier: true,
          brand: { select: { id: true, name: true, requiredFuzeTier: true } },
          factory: { select: { name: true } },
        },
      },
      testRuns: {
        where: {
          brandVisible: true,
          OR: [
            { testType: "ICP", icpResult: { is: { agValue: { not: null } } } },
            {
              testType: "ANTIBACTERIAL",
              abResult: { is: { percentReduction: { not: null } } },
            },
          ],
        },
        select: {
          id: true,
          testType: true,
          testDate: true,
          washCount: true,
          icpResult: { select: { agValue: true } },
          abResult: { select: { percentReduction: true, testMethodStd: true } },
        },
        orderBy: { testDate: "desc" },
      },
    },
    take: 2000,
  });

  const points: CorrelationPoint[] = [];

  for (const sub of submissions) {
    const fab = sub.fabric;

    const icpRuns = sub.testRuns
      .filter(
        (r) =>
          r.testType === "ICP" &&
          r.icpResult?.agValue != null &&
          Number.isFinite(r.icpResult.agValue as number),
      )
      .sort((a, b) => (b.testDate?.getTime() || 0) - (a.testDate?.getTime() || 0));

    const abRuns = sub.testRuns
      .filter(
        (r) =>
          r.testType === "ANTIBACTERIAL" &&
          r.abResult?.percentReduction != null &&
          Number.isFinite(r.abResult.percentReduction as number),
      )
      .sort((a, b) => (b.testDate?.getTime() || 0) - (a.testDate?.getTime() || 0));

    if (icpRuns.length === 0 || abRuns.length === 0) continue;

    const tier =
      fab?.targetFuzeTier || fab?.brand?.requiredFuzeTier || null;
    const fabContext = {
      fabricId: fab?.id || null,
      fuzeNumber: fab?.fuzeNumber ?? null,
      factoryName: fab?.factory?.name || null,
      brandId: fab?.brand?.id || null,
      brandName: fab?.brand?.name || null,
      tier,
    };

    // Pairing rule 1: matched washCount → one point per shared cycle.
    const icpByWash = new Map<number, (typeof icpRuns)[number]>();
    for (const r of icpRuns) {
      if (r.washCount != null && !icpByWash.has(r.washCount)) {
        icpByWash.set(r.washCount, r);
      }
    }
    const matchedWashCounts = new Set<number>();
    for (const ab of abRuns) {
      if (ab.washCount == null) continue;
      const icp = icpByWash.get(ab.washCount);
      if (!icp) continue;
      matchedWashCounts.add(ab.washCount);
      points.push({
        testRunId: `${icp.id}+${ab.id}`,
        ...fabContext,
        testDate: ab.testDate?.toISOString() || icp.testDate?.toISOString() || null,
        icpValue: icp.icpResult!.agValue as number,
        abPercentReduction: ab.abResult!.percentReduction as number,
        testMethod: ab.abResult?.testMethodStd || null,
      });
    }

    // Pairing rule 2 (fallback): if no wash-count match landed, pair the
    // most-recent ICP with the most-recent AB on the submission.
    if (matchedWashCounts.size === 0) {
      const icp = icpRuns[0];
      const ab = abRuns[0];
      points.push({
        testRunId: `${icp.id}+${ab.id}`,
        ...fabContext,
        testDate: ab.testDate?.toISOString() || icp.testDate?.toISOString() || null,
        icpValue: icp.icpResult!.agValue as number,
        abPercentReduction: ab.abResult!.percentReduction as number,
        testMethod: ab.abResult?.testMethodStd || null,
      });
    }
  }

  // Sort newest-first for stable rendering — caller may re-sort.
  points.sort((a, b) => (b.testDate || "").localeCompare(a.testDate || ""));
  console.log(
    "[icp-correlation] brand=%s, submissions=%d, points=%d",
    brandId || "(all)",
    submissions.length,
    points.length,
  );
  return points;
}
