/**
 * Phase 9F — pure engagement-scoring helpers.
 *
 * `BrandEngagement.overallScore` is the sum of four weighted sub-
 * scores (communication / testingVelocity / pipelineVelocity /
 * paymentScore). The math used to live inline in
 * /api/brand-engagement/route.ts — moving it here lets the
 * /admin/brands/[id]/engagement-debug page show exactly which input
 * drove the score and what would change if a specific factor moved.
 *
 * The recalculation endpoint should import `computeEngagement` and
 * upsert the row; the debug page imports `explainEngagement` and
 * displays the breakdown.
 */

import { prisma } from "@/lib/prisma";

export interface EngagementFactor {
  name: string;
  weight: number;
  score: number; // 0..100
  contribution: number; // weight × score
  rationale: string;
  if: string; // "If X happened, score would change by Y"
}

export interface EngagementExplanation {
  brandId: string;
  brandName: string;
  overallScore: number;
  trend: "RISING" | "STABLE" | "DECLINING" | "AT_RISK";
  factors: EngagementFactor[];
  inputs: {
    daysSinceLastContact: number | null;
    testsLast30Days: number;
    testsLast90Days: number;
    avgInvoicePayDays: number | null;
    overdueInvoices: number;
  };
  calculatedAt: string;
}

const WEIGHTS = {
  communication: 0.3,
  testingVelocity: 0.25,
  pipelineVelocity: 0.25,
  paymentScore: 0.2,
} as const;

export async function explainEngagement(
  brandId: string,
): Promise<EngagementExplanation | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000);

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      notes: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      testRequests: {
        where: { poDate: { gte: ninetyDaysAgo } },
        select: { poDate: true },
      },
      invoices: { select: { paidDate: true, dueDate: true } },
    },
  });
  if (!brand) return null;

  const lastNote = brand.notes[0];
  const daysSinceLastContact = lastNote?.date
    ? Math.floor((Date.now() - lastNote.date.getTime()) / 86400_000)
    : null;
  const testsLast30Days = brand.testRequests.filter(
    (tr: any) => tr.poDate >= thirtyDaysAgo,
  ).length;
  const testsLast90Days = brand.testRequests.length;

  const invoiceData = brand.invoices.map((inv: any) => {
    const paidDate = inv.paidDate || new Date();
    const dueDate = inv.dueDate || new Date();
    return Math.floor((paidDate.getTime() - dueDate.getTime()) / 86400_000);
  });
  const avgInvoicePayDays =
    invoiceData.length > 0
      ? invoiceData.reduce((a: number, b: number) => a + b, 0) / invoiceData.length
      : null;
  const overdueInvoices = brand.invoices.filter(
    (inv: any) => inv.dueDate && inv.dueDate < new Date() && !inv.paidDate,
  ).length;

  // ─── Sub-scores ───────────────────────────────────────────
  let communicationScore = 50;
  let communicationRationale = "No recent notes — defaulting to 50";
  if (daysSinceLastContact !== null) {
    if (daysSinceLastContact <= 7) {
      communicationScore = 100;
      communicationRationale = `Last contact ${daysSinceLastContact}d ago — within the weekly cadence band`;
    } else {
      communicationScore = Math.max(0, 100 - (daysSinceLastContact - 7) * 10);
      communicationRationale = `Last contact ${daysSinceLastContact}d ago — loses 10 points per day past day 7`;
    }
  }

  const testingVelocity = Math.min(100, testsLast30Days * 10);
  const testingRationale = `${testsLast30Days} test requests in the last 30 days × 10 pts each, capped at 100`;

  const pipelineVelocity = Math.min(100, testsLast90Days * 5);
  const pipelineRationale = `${testsLast90Days} test requests in the last 90 days × 5 pts each, capped at 100`;

  let paymentScore = 100;
  let paymentRationale = "All invoices paid by due date";
  if (avgInvoicePayDays != null && avgInvoicePayDays > 30) {
    paymentScore = Math.max(0, 100 - (avgInvoicePayDays - 30) * 2);
    paymentRationale = `Avg pay ${avgInvoicePayDays.toFixed(1)}d past due × 2 pts each past day 30`;
  }
  if (overdueInvoices > 0) {
    paymentScore = Math.max(0, paymentScore - overdueInvoices * 15);
    paymentRationale += ` · ${overdueInvoices} currently overdue × 15 pts each`;
  }

  const factors: EngagementFactor[] = [
    {
      name: "Communication",
      weight: WEIGHTS.communication,
      score: communicationScore,
      contribution: communicationScore * WEIGHTS.communication,
      rationale: communicationRationale,
      if: "If a note is logged today, communication jumps to 100 (+15 to overall).",
    },
    {
      name: "Testing velocity (30d)",
      weight: WEIGHTS.testingVelocity,
      score: testingVelocity,
      contribution: testingVelocity * WEIGHTS.testingVelocity,
      rationale: testingRationale,
      if: "Each new test request adds 10 to this sub-score (+2.5 to overall) up to the 100 cap.",
    },
    {
      name: "Pipeline velocity (90d)",
      weight: WEIGHTS.pipelineVelocity,
      score: pipelineVelocity,
      contribution: pipelineVelocity * WEIGHTS.pipelineVelocity,
      rationale: pipelineRationale,
      if: "Each new test request in the 90d window adds 5 (+1.25 to overall).",
    },
    {
      name: "Payment timeliness",
      weight: WEIGHTS.paymentScore,
      score: paymentScore,
      contribution: paymentScore * WEIGHTS.paymentScore,
      rationale: paymentRationale,
      if: "Resolving one overdue invoice adds 15 to this sub-score (+3 to overall).",
    },
  ];

  const overallScore = Math.round(
    factors.reduce((s, f) => s + f.contribution, 0),
  );

  let trend: EngagementExplanation["trend"] = "STABLE";
  if (overallScore >= 75) trend = "RISING";
  else if (overallScore < 40) trend = "DECLINING";
  else if (overdueInvoices > 0 || (daysSinceLastContact != null && daysSinceLastContact > 60))
    trend = "AT_RISK";

  return {
    brandId: brand.id,
    brandName: brand.name,
    overallScore,
    trend,
    factors,
    inputs: {
      daysSinceLastContact,
      testsLast30Days,
      testsLast90Days,
      avgInvoicePayDays,
      overdueInvoices,
    },
    calculatedAt: new Date().toISOString(),
  };
}
