// @ts-nocheck
/**
 * Phase 10G — AI anomaly review.
 *
 * Runs deterministic protocol checks first (cheap, fast, always
 * fire), then optionally augments with Claude analysis when the
 * data has free-text fields worth interpreting. Persists the
 * combined result as a single AiTestReview row keyed on testRunId.
 */
import { prisma } from "@/lib/prisma";
import { aiFetch } from "@/lib/ai-fetch";

export type FlagSeverity = "info" | "warn" | "error";
export interface ReviewFlag {
  severity: FlagSeverity;
  code: string;
  message: string;
  evidence?: any;
}
export type RecommendedAction = "APPROVE" | "REVIEW" | "RETEST" | "REJECT";

interface ReviewInput {
  id: string;
  testType: string | null;
  testMethodStd: string | null;
  testDate: Date | null;
  washCount: number | null;
  testReportNumber: string | null;
  raw?: any;
  icpResult?: { agValue: number | null; auValue: number | null; unit: string | null } | null;
  abResult?: {
    organism1: string | null;
    organism2: string | null;
    result1: number | null;
    result2: number | null;
    pass: boolean | null;
    initialCount?: number | null;
    // Schema column is contactTime (string like "24 Hours"). The
    // earlier numeric contactHours was always undefined so the
    // 24h-incubation protocol check below never fired.
    contactTime?: string | null;
    broth?: string | null;
    sterilization?: string | null;
    notes?: string | null;
  } | null;
  fungalResult?: { writtenResult: string | null; pass: boolean | null } | null;
  odorResult?: { testedOdor: string | null; result: string | null; pass: boolean | null } | null;
  submission?: {
    fuzeFabricNumber: number | null;
    fuzeTier: string | null;
    fabric: { fuzeNumber: number | null; fabricCategory: string | null } | null;
  } | null;
  lab?: { name: string | null } | null;
}

/**
 * Run deterministic protocol checks. Returns flags ordered by
 * severity (error → warn → info).
 */
export function runProtocolChecks(t: ReviewInput): ReviewFlag[] {
  const flags: ReviewFlag[] = [];

  // ─── ICP-MS only (Phase 10I) ────────────────────────────────
  if (t.testType === "ICP" && t.testMethodStd && /icp[\s-]?oes/i.test(t.testMethodStd)) {
    flags.push({
      severity: "error",
      code: "icp_oes_used",
      message: "FUZE policy is ICP-MS only. ICP-OES result detected — RETEST required.",
      evidence: { testMethodStd: t.testMethodStd },
    });
  }

  // ─── ASTM E2149 protocol checklist ──────────────────────────
  if (t.testType === "ANTIBACTERIAL" && t.testMethodStd && /e[\s-]?2149/i.test(t.testMethodStd)) {
    const ab = t.abResult || ({} as any);
    // contactTime is a free-text string like "24 Hours" / "48 hr" /
    // "1 hour". Parse a leading number; flag when it's recorded and
    // not 24 (ASTM E2149's spec'd window).
    if (ab.contactTime) {
      const m = String(ab.contactTime).match(/(\d+(?:\.\d+)?)/);
      const hrs = m ? Number(m[1]) : null;
      if (hrs != null && hrs !== 24) {
        flags.push({
          severity: "warn",
          code: "astm_e2149_incubation_off",
          message: `ASTM E2149 protocol expects 24h incubation; this run logged ${ab.contactTime}.`,
          evidence: { contactTime: ab.contactTime, parsedHours: hrs },
        });
      }
    }
    if (ab.broth && !/mueller[\s-]?hinton.*low.*sulfur|mh.*low.*sulfur/i.test(ab.broth)) {
      flags.push({
        severity: "warn",
        code: "astm_e2149_broth_off",
        message: `ASTM E2149 expects Mueller Hinton low-sulfur broth; this run used ${ab.broth}.`,
        evidence: { broth: ab.broth },
      });
    }
    if (
      ab.sterilization &&
      !/^uv$|uv[\s-]?only|ultraviolet/i.test(ab.sterilization)
    ) {
      flags.push({
        severity: "error",
        code: "astm_e2149_sterilization_wrong",
        message: `ASTM E2149 must use UV-only sterilization — autoclave or chemical sterilization buries metamaterial in synthetic fibers and invalidates the result. This run used ${ab.sterilization}.`,
        evidence: { sterilization: ab.sterilization },
      });
    }
  }

  // ─── AATCC 100 initial-count check ──────────────────────────
  if (t.testType === "ANTIBACTERIAL" && t.testMethodStd && /aatcc[\s-]?100/i.test(t.testMethodStd)) {
    const ab = t.abResult || ({} as any);
    if (ab.initialCount != null) {
      const inRange = ab.initialCount >= 1e5 && ab.initialCount <= 5e5;
      if (!inRange) {
        flags.push({
          severity: "warn",
          code: "aatcc100_initial_count_off",
          message: `AATCC 100 expects initial inoculum in 1-5×10^5 CFU/mL; this run logged ${ab.initialCount.toExponential(2)}.`,
          evidence: { initialCount: ab.initialCount },
        });
      }
    } else {
      flags.push({
        severity: "info",
        code: "aatcc100_initial_count_missing",
        message: "AATCC 100 initial inoculum count not recorded — can't verify it was in the 1-5×10^5 CFU/mL range.",
      });
    }
  }

  return flags.sort((a, b) => {
    const order: Record<FlagSeverity, number> = { error: 0, warn: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

export function deriveRecommendedAction(flags: ReviewFlag[]): RecommendedAction {
  if (flags.some((f) => f.severity === "error")) return "RETEST";
  if (flags.some((f) => f.severity === "warn")) return "REVIEW";
  return "APPROVE";
}

/**
 * Check inter-day inconsistency: were multiple TestRuns on the same
 * fabric submitted on different dates?
 */
export async function detectMultiDayRuns(testRunId: string): Promise<ReviewFlag[]> {
  const tr = await prisma.testRun.findUnique({
    where: { id: testRunId },
    select: { submission: { select: { id: true } } },
  });
  if (!tr?.submission?.id) return [];
  const sibling = await prisma.testRun.findMany({
    where: { submissionId: tr.submission.id, id: { not: testRunId } },
    select: { id: true, testDate: true },
  });
  const dates = new Set(
    sibling.map((s) => s.testDate?.toISOString().slice(0, 10) || "?"),
  );
  if (dates.size >= 2) {
    return [
      {
        severity: "info",
        code: "multi_day_runs",
        message: `Sibling tests on this fabric span ${dates.size} different days — comparability caveat.`,
        evidence: { sibling: Array.from(dates) },
      },
    ];
  }
  return [];
}

export async function performAiTestReview(testRunId: string): Promise<{
  flags: ReviewFlag[];
  recommendedAction: RecommendedAction;
  modelUsed: string;
  notes: string;
}> {
  const tr = (await prisma.testRun.findUnique({
    where: { id: testRunId },
    include: {
      icpResult: true,
      abResult: true,
      fungalResult: true,
      odorResult: true,
      submission: {
        include: {
          fabric: {
            select: { fuzeNumber: true, fabricCategory: true },
          },
        },
      },
      lab: { select: { name: true } },
    },
  })) as any;
  if (!tr) {
    return {
      flags: [],
      recommendedAction: "REVIEW",
      modelUsed: "rule-based",
      notes: "TestRun not found",
    };
  }

  const flags = runProtocolChecks(tr);
  const multiDay = await detectMultiDayRuns(testRunId);
  flags.push(...multiDay);

  // Optional Claude augmentation. Skip if no API key — rule-based
  // checks are still authoritative.
  let modelUsed: string = "rule-based";
  let notes = "";
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const systemPrompt = `You are reviewing a textile antimicrobial test result for FUZE Biotech. Look for protocol deviations, inconsistencies, and results that may need brand approval. Use FUZE / metamaterial vocabulary — never "silver" or "nano".

Focus on:
- Did the result match expected pattern for FUZE F1/F2/F3/F4 tier?
- Are there free-text fields suggesting the lab deviated from protocol?
- Compared to typical FUZE test results, is anything anomalous?

Return JSON only:
{
  "additionalFlags": [{ "severity": "info"|"warn"|"error", "code": "...", "message": "..." }],
  "summary": "<one paragraph plain-English summary>"
}`;
      const { response } = await aiFetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1500,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: JSON.stringify(
                  {
                    testRun: {
                      type: tr.testType,
                      method: tr.testMethodStd,
                      date: tr.testDate,
                      washCount: tr.washCount,
                      icp: tr.icpResult,
                      ab: tr.abResult,
                      fungal: tr.fungalResult,
                      odor: tr.odorResult,
                      submission: tr.submission,
                      lab: tr.lab,
                    },
                    deterministicFlags: flags,
                  },
                  null,
                  2,
                ),
              },
            ],
          }),
        },
        { provider: "anthropic", callerRoute: "ai-test-review", userId: "system" },
      );
      if (response.ok) {
        const data = await response.json();
        const text = data.content?.[0]?.text || "";
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (Array.isArray(parsed.additionalFlags)) {
            flags.push(...parsed.additionalFlags);
          }
          notes = parsed.summary || "";
          modelUsed = "claude-haiku-4-5-20251001";
        }
      }
    } catch (err: any) {
      notes = `AI augmentation failed: ${err?.message || String(err)}`;
    }
  }

  const recommendedAction = deriveRecommendedAction(flags);
  return { flags, recommendedAction, modelUsed, notes };
}

export async function persistAiTestReview(testRunId: string) {
  const review = await performAiTestReview(testRunId);
  await prisma.aiTestReview.upsert({
    where: { testRunId },
    create: {
      testRunId,
      reviewedAt: new Date(),
      modelUsed: review.modelUsed,
      flags: review.flags,
      recommendedAction: review.recommendedAction,
      reviewedNotes: review.notes,
    },
    update: {
      reviewedAt: new Date(),
      modelUsed: review.modelUsed,
      flags: review.flags,
      recommendedAction: review.recommendedAction,
      reviewedNotes: review.notes,
    },
  });
  return review;
}
