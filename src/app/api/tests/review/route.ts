// @ts-nocheck
import { NextResponse } from "next/server";
import { aiFetch, getUserIdFromHeaders } from "@/lib/ai-fetch";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ─── AI REVIEW PROMPT ─────────────────────────────────────
// Specialized for antibacterial test report anomaly detection

const REVIEW_PROMPT = `You are FUZE Atlas Lab Intelligence — an expert QA reviewer for antimicrobial textile test reports. You review parsed test data from ITS Taiwan (Intertek) and other accredited labs for FUZE Technologies, which manufactures high density allotrope antimicrobial textile treatments.

Your job: Analyze the parsed test results and raw PDF text to detect anomalies, validate data integrity, and assess pass/fail per standard thresholds. You are looking for things a human QA reviewer or lab scientist would catch.

## WHAT TO CHECK

### 1. INOCULUM RANGE
- Standard starting inoculum for most methods: 1×10⁴ to 3×10⁵ CFU/mL
- Flag if significantly outside this range (HIGH severity if >10⁶ or <10³)
- Note: higher inoculum makes it harder to achieve high reduction — this is important context

### 2. CONTROL GROWTH VALIDATION
- The untreated control must show adequate bacterial growth
- AATCC TM100: B should be significantly higher than D (control grew during incubation)
- JIS L 1902: Ct should be ≥ C0 (standard cloth bacteria should grow, not die)
- ASTM E2149: control flask (b) should be near initial count or higher
- Flag if control shows unexpected die-off (suggests test conditions issue)

### 3. MATH VERIFICATION
- AATCC: R% = (B - A) / B × 100 — verify this matches reported percent reduction
- ASTM: R% = (b - a) / b × 100 — verify
- JIS: F = log(Ct) - log(C0), A = F - (log(Tt) - log(T0)) — verify growth value and activity value
- Flag any discrepancy > 2% as medium severity, > 5% as high severity

### 4. METHOD-SPECIFIC PASS/FAIL
- JIS L 1902: A ≥ 2.0 = "Effect", A ≥ 3.0 = "Full Effect", A < 2.0 = FAIL
- AATCC TM100: No universal threshold — typically 90%+ reduction expected for FUZE-treated antimicrobials, but varies by client spec
- ASTM E2149: Typically 80-90%+ reduction expected
- State clearly whether the result passes or fails and by what margin

### 5. TREATED > CONTROL WARNING
- If treated sample CFU exceeds control CFU, the treatment may have PROMOTED growth
- This is a HIGH severity flag — very unusual for antimicrobial fabrics

### 6. BROTH/MEDIA CONCERNS
- Note if non-standard media is used (could affect results)
- Flag if different tests in same report use different media (unusual)
- Common standard: "1/20 Nutrient Broth" for AATCC, varies for JIS

### 7. SHARED CONTROL DATA
- If multiple tests from same report share identical control data, note this
- Not necessarily wrong (batch testing) but worth documenting

### 8. SAMPLE/MATERIAL NOTES
- Note if sample is unusual (turf, padding, non-woven) vs standard woven/knit fabric
- Flag if sterilization method could affect results (UV vs autoclave vs none)

## OUTPUT FORMAT

Return valid JSON with this EXACT structure:

{
  "anomalies": [
    {
      "type": "inoculum_range" | "control_growth" | "math_error" | "treated_exceeds_control" | "media_concern" | "shared_control" | "sterilization" | "sample_type" | "other",
      "severity": "high" | "medium" | "low",
      "description": "Clear explanation of the issue",
      "field": "name of the relevant data field",
      "testIndex": 1
    }
  ],
  "passAssessment": {
    "standard": "JIS L 1902:2015",
    "threshold": "A >= 2.0",
    "actual": "-0.2",
    "passes": false,
    "rating": "No Effect" | "Effect" | "Full Effect" | "Pass" | "Fail",
    "note": "Brief context about what this means"
  },
  "mathChecks": [
    {
      "formula": "R% = (B - A) / B × 100",
      "calculated": 99.5,
      "reported": 99.5,
      "matches": true,
      "testIndex": 1
    }
  ],
  "confidence": "high" | "medium" | "low",
  "notes": "Overall assessment — brief, actionable summary for the FUZE team. Mention if results are expected/typical for FUZE antimicrobial treatment or if something looks off."
}

## CRITICAL RULES
1. Be precise with numbers — this is QA, not sales
2. Always verify math when CFU values are available
3. JIS fails are EXPECTED for some organisms — don't panic, just report accurately
4. Multiple tests per report with different organisms is normal for ITS Taiwan
5. Return ONLY the JSON object — no markdown fences, no explanation
6. If data is missing for a check, skip it (don't flag missing data as anomaly unless it's critical)`;

// ─── AI CALLER FUNCTIONS ────────────────────────────────

async function callAnthropicReview(userMessage: string, userId?: string): Promise<any> {
  const { response } = await aiFetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: REVIEW_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    },
    { provider: "anthropic", callerRoute: "test-review", userId }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic review API error:", errText);
    return null;
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || "";
  return parseAIJson(text, "Anthropic");
}

async function callOpenAIReview(userMessage: string, userId?: string): Promise<any> {
  const { response } = await aiFetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        messages: [
          { role: "system", content: REVIEW_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1, // Low temp for QA precision
      }),
    },
    { provider: "openai", callerRoute: "test-review", userId }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI review API error:", errText);
    return null;
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return parseAIJson(text, "OpenAI");
}

function parseAIJson(text: string, source: string): any {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON found in ${source} response`);
    const parsed = JSON.parse(jsonMatch[0]);
    parsed._source = source;
    return parsed;
  } catch (e) {
    console.error(`Failed to parse ${source} review response:`, text.substring(0, 500));
    return null;
  }
}

// ─── MERGE REVIEW RESULTS ───────────────────────────────

function mergeReviews(anthropic: any, openai: any): any {
  if (!anthropic && !openai) return null;
  if (!anthropic) return { ...openai, _sources: ["OpenAI"] };
  if (!openai) return { ...anthropic, _sources: ["Anthropic"] };

  const merged: any = { _sources: ["Anthropic", "OpenAI"] };

  // Anomalies: combine from both, deduplicate by type+testIndex
  const anomalyMap = new Map<string, any>();
  for (const a of [...(anthropic.anomalies || []), ...(openai.anomalies || [])]) {
    const key = `${a.type}-${a.testIndex || 0}-${a.field || ""}`;
    if (!anomalyMap.has(key)) {
      anomalyMap.set(key, a);
    } else {
      // Keep higher severity
      const existing = anomalyMap.get(key);
      const sevRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
      if ((sevRank[a.severity] || 0) > (sevRank[existing.severity] || 0)) {
        anomalyMap.set(key, a);
      }
    }
  }
  merged.anomalies = Array.from(anomalyMap.values());

  // Pass assessment: prefer Anthropic's (tends to be more precise)
  merged.passAssessment = anthropic.passAssessment || openai.passAssessment;

  // Math checks: combine, prefer where "matches" differs (flag both)
  const mathMap = new Map<string, any>();
  for (const mc of [...(anthropic.mathChecks || []), ...(openai.mathChecks || [])]) {
    const key = `${mc.testIndex || 0}-${mc.formula || ""}`;
    if (!mathMap.has(key)) {
      mathMap.set(key, mc);
    } else if (!mc.matches) {
      // Prefer the one that found a mismatch
      mathMap.set(key, mc);
    }
  }
  merged.mathChecks = Array.from(mathMap.values());

  // Confidence: take higher
  const confRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const ac = confRank[anthropic.confidence] || 1;
  const oc = confRank[openai.confidence] || 1;
  merged.confidence = ac >= oc ? anthropic.confidence : openai.confidence;

  // Notes: combine
  const notes = [
    anthropic.notes && `[Anthropic] ${anthropic.notes}`,
    openai.notes && `[OpenAI] ${openai.notes}`,
  ].filter(Boolean).join(" | ");
  merged.notes = notes;

  return merged;
}

// ─── BUILD USER MESSAGE FOR AI ──────────────────────────

function buildReviewMessage(tests: any[], rawText: string): string {
  let msg = `Review the following parsed antibacterial test results from an ITS Taiwan (Intertek) report.\n\n`;

  for (const test of tests) {
    msg += `--- TEST ${test.testIndex} ---\n`;
    msg += `Method: ${test.testMethod || "Unknown"}\n`;
    msg += `Organism: ${test.organism || "Unknown"} (${test.strainNumber || "no strain"})\n`;
    msg += `Sterilization: ${test.sterilization || "Not specified"}\n`;
    msg += `Broth Media: ${test.brothMedia || "Not specified"}\n`;
    msg += `Surfactant: ${test.surfactant || "Not specified"}\n`;

    if (test.testMethod?.includes("AATCC")) {
      msg += `\nAATCC TM100 Values:\n`;
      msg += `  D (viability control 0hr): ${test.inoculumRaw || test.inoculumCFU || "N/A"}\n`;
      msg += `  B' (viability control 24hr): ${test.aatccBprime || "N/A"}\n`;
      msg += `  B (untreated control 24hr): ${test.controlRaw || test.controlCFU || "N/A"}\n`;
      msg += `  C (treated 0hr): ${test.aatccC || "N/A"}\n`;
      msg += `  A (treated 24hr): ${test.treatedRaw || test.treatedCFU || "N/A"}\n`;
      msg += `  Growth Value (F): ${test.growthValue ?? "N/A"}\n`;
      msg += `  Percent Reduction (R): ${test.percentReduction ?? "N/A"}%\n`;
    } else if (test.testMethod?.includes("ASTM")) {
      msg += `\nASTM E2149 Values:\n`;
      msg += `  Initial Count: ${test.inoculumRaw || test.astmInitialCount || "N/A"}\n`;
      msg += `  Control Flask (b): ${test.controlRaw || test.astmControlFlask || "N/A"}\n`;
      msg += `  Treated Flask (a): ${test.treatedRaw || test.astmTreatedFlask || "N/A"}\n`;
      msg += `  Percent Reduction: ${test.percentReduction ?? "N/A"}%\n`;
    } else if (test.testMethod?.includes("JIS")) {
      msg += `\nJIS L 1902 Values:\n`;
      msg += `  Inoculum: ${test.inoculumRaw || test.inoculumCFU || "N/A"}\n`;
      msg += `  C0 (standard 0hr): ${test.jisC0 || "N/A"} (Log: ${test.jisC0Log ?? "N/A"})\n`;
      msg += `  Ct (standard 18-24hr): ${test.jisCt || "N/A"} (Log: ${test.jisCtLog ?? "N/A"})\n`;
      msg += `  T0 (treated 0hr): ${test.jisT0 || "N/A"} (Log: ${test.jisT0Log ?? "N/A"})\n`;
      msg += `  Tt (treated 18-24hr): ${test.jisTt || "N/A"} (Log: ${test.jisTtLog ?? "N/A"})\n`;
      msg += `  Growth Value (F): ${test.growthValue ?? "N/A"}\n`;
      msg += `  Activity Value (A): ${test.activityValue ?? "N/A"}\n`;
      msg += `  Reduction Rate: ${test.percentReduction ?? "N/A"}%\n`;
    }

    msg += `  Method Pass: ${test.methodPass !== null ? (test.methodPass ? "PASS" : "FAIL") : "N/A"}\n`;
    msg += `  Pass Reason: ${test.methodPassReason || "N/A"}\n`;
    msg += `  Parser Confidence: ${test.confidence}/100\n`;
    if (test.warnings?.length > 0) {
      msg += `  Parser Warnings: ${test.warnings.join("; ")}\n`;
    }
    msg += `\n`;
  }

  // Include raw text excerpt for context (first 3000 chars)
  msg += `\n--- RAW PDF TEXT (first 3000 chars) ---\n${rawText.substring(0, 3000)}\n`;
  msg += `\nAnalyze all tests above. Return the JSON review with anomalies, pass assessment, math checks, and notes.`;

  return msg;
}

// ─── POST /api/tests/review ─────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tests, rawText } = body;

    if (!tests || !Array.isArray(tests) || tests.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No parsed test data provided" },
        { status: 400 }
      );
    }

    const hasAnthropic = !!ANTHROPIC_API_KEY;
    const hasOpenAI = !!OPENAI_API_KEY;

    if (!hasAnthropic && !hasOpenAI) {
      return NextResponse.json(
        { ok: false, error: "No AI API keys configured. Add ANTHROPIC_API_KEY and/or OPENAI_API_KEY to .env" },
        { status: 500 }
      );
    }

    const userMessage = buildReviewMessage(tests, rawText || "");
    const userId = getUserIdFromHeaders(req.headers);

    // Fire both AIs in parallel
    const promises: Promise<any>[] = [];
    promises.push(hasAnthropic ? callAnthropicReview(userMessage, userId) : Promise.resolve(null));
    promises.push(hasOpenAI ? callOpenAIReview(userMessage, userId) : Promise.resolve(null));

    const [anthropicResult, openaiResult] = await Promise.all(promises);

    const review = mergeReviews(anthropicResult, openaiResult);

    if (!review) {
      return NextResponse.json({
        ok: false,
        error: "Both AI models failed to return valid review results.",
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      review,
      sources: review._sources || [],
    });
  } catch (e: any) {
    console.error("Test review error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
