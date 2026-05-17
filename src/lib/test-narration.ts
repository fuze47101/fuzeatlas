// @ts-nocheck
/**
 * MB-3 — Plain-English narration of FUZE test results.
 *
 * When a TestRun is stamped brand-visible we generate a 2–4 sentence
 * paragraph that contextualizes the result for a non-technical brand
 * reader. Voice locked to FUZE / metamaterial vocabulary; the
 * brand-voice gate rejects + retries up to 2 times before stamping
 * `aiNarrationGenerationFailedAt`.
 *
 * Method-aware framing pulled from CLAUDE.md's
 * "AATCC 100 vs ASTM E2149" section:
 *   - ASTM E2149 is the right test for non-leaching contact-kill
 *     chemistry. Call out that mechanism match.
 *   - AATCC 100 is the historical layered test designed for leaching
 *     chemistries. FUZE still passes at higher tiers. Don't trash it.
 */

import { prisma } from "@/lib/prisma";
import { aiFetch } from "@/lib/ai-fetch";

const NARRATION_MODEL = "claude-haiku-4-5-20251001";

// Mirrors scripts/check-brand-voice.ts FORBIDDEN regex set — keep in
// sync. Anything matching gets a regenerate retry before persisting.
// Each pattern below is something we NEVER allow in customer-facing
// narration; the inline `// NEVER` keeps the brand-voice scanner
// from flagging this file (it's a rule definition, not customer copy).
const FORBIDDEN_RX: RegExp[] = [
  /\bsilver[-\s]?ion(s)?\b/i, // NEVER in narration
  /\bnano[-\s]?silver\b/i, // NEVER in narration
  /\bsilver[-\s]?nanoparticle(s)?\b/i, // NEVER in narration
  /\bnanoparticle(s)?\b/i, // NEVER in narration
  /\bnanosilver\b/i, // NEVER in narration
  /\bwater[-\s]?based silver\b/i, // NEVER in narration
  // The bare words are forbidden in customer copy too (narration is
  // always customer-facing); chemical/compliance docs handle these
  // through the negation lookaheads below.
  /\bsilver\b(?!\s*(chloride|nitrate|sulfate))/i, // NEVER in narration
  /\bnano(?!metric|second|gram|meter|technology of fuze)/i, // NEVER in narration
];

function brandVoicePasses(text: string): { ok: true } | { ok: false; hit: string } {
  for (const rx of FORBIDDEN_RX) {
    const m = text.match(rx);
    if (m) return { ok: false, hit: m[0] };
  }
  return { ok: true };
}

const SYSTEM_PROMPT = `You write a 2–4 sentence plain-English summary of a FUZE textile antimicrobial test result for a non-technical brand reader (apparel, hospitality, healthcare buyers).

═══════════════════════════════════════════════════════════════
BANNED WORDS — NEVER use ANY of these in output. Response is invalid and will be thrown away if any appear:
silver, silver-ion, silver ion, nano, nanoparticle, nanoparticles, nano-silver, nanosilver, silver nanoparticle, silver nanoparticles, water-based silver, ionic silver, colloidal silver, Ag, Ag+, Ag nanoparticles
═══════════════════════════════════════════════════════════════

The active ingredient is ALWAYS referred to as "FUZE" or "metamaterial" or "FUZE metamaterial" — never by any chemical name, ion form, or particle descriptor. This is non-negotiable. FUZE is a proprietary antimicrobial treatment; the brand reader does not need to know the underlying chemistry to understand the test result.

═══════════════════════════════════════════════════════════════
BAD EXAMPLE (NEVER write like this — would be rejected):
"This fabric showed a 4.2-log reduction against E. coli per ASTM E2149, demonstrating that the silver ions in the FUZE treatment are effectively killing bacteria on contact."
WHY BAD: uses "silver ions". Forbidden.

BAD EXAMPLE (NEVER write like this — would be rejected):
"The FUZE nanoparticle layer remained intact through 50 washes, sustaining a 4.5-log reduction."
WHY BAD: uses "nanoparticle". Forbidden.

GOOD EXAMPLE (would be accepted):
"This fabric achieved a 4.2-log bacterial reduction against E. coli per ASTM E2149 — strong contact-kill performance consistent with F2 Advanced Performance tier. ASTM E2149 is the dynamic-contact test designed for non-leaching antimicrobial chemistry like FUZE; results above 4-log indicate the metamaterial bond is intact and bacterial cells are being dismantled on contact at the fiber surface."

GOOD EXAMPLE (would be accepted):
"This sample passed AATCC 100 at the F1 Full Spectrum tier with a 99.9 percent reduction against Staphylococcus aureus after 100 industrial wash cycles. AATCC 100 is the historical layered antibacterial test for textiles; FUZE F1 passes it because the metamaterial density at this tier is sufficient to overcome the test geometry that was originally designed around leaching chemistries."

GOOD EXAMPLE (would be accepted):
"Wash 50 results show the FUZE F3 Core tier maintaining 3.8-log reduction against E. coli per ASTM E2149 — confirming durability of the metamaterial bond through standard industrial laundering. ASTM E2149 is the right test for non-leaching contact-kill chemistry; a result this strong after 50 washes is durability evidence the brand can defend to retail buyers."
═══════════════════════════════════════════════════════════════

OTHER VOICE RULES:
- Tiers are F1 / F2 / F3 / F4 (Full Spectrum / Advanced / Core / Foundation).
- Mention the test standard used (ASTM E2149, AATCC 100, ISO 20743, AATCC 30, ISO 18184) by name.
- If wash count > 0: mention it and call it durability evidence.
- Confident, neutral lab-summary tone. NOT marketing copy. No exclamation marks. No bullet points. No markdown. Plain text only.
- Exactly one paragraph, 2–4 sentences. No leading label like "Summary:".

BEFORE YOU RETURN YOUR RESPONSE, scan it for any banned word above. If you find one, rewrite using "FUZE" or "metamaterial" instead. Do not return text containing any banned word — it will be discarded and you will have wasted the call.

You will receive a JSON test result. Return only the paragraph as plain text, nothing else.`;

interface NarrationInput {
  id: string;
  testType: string | null;
  testMethodStd: string | null;
  testDate: Date | null;
  washCount: number | null;
  icpResult?: { agValue: number | null; auValue: number | null; unit: string | null } | null;
  abResult?: {
    organism1: string | null;
    organism2: string | null;
    result1: number | null;
    result2: number | null;
    pass: boolean | null;
    // Schema column is `contactTime` (string like "24 Hours"), not a
    // numeric contactHours field. Earlier narrations silently lost
    // this signal because the field was always undefined.
    contactTime?: string | null;
  } | null;
  fungalResult?: { writtenResult: string | null; pass: boolean | null } | null;
  odorResult?: { testedOdor: string | null; result: string | null; pass: boolean | null } | null;
  // Submission carries no fuzeTier column — tier lives on the linked
  // fabric (Fabric.targetFuzeTier). Pulling from the nested fabric
  // select instead.
  submission?: {
    fabric: {
      fuzeNumber: number | null;
      fabricCategory: string | null;
      targetFuzeTier: string | null;
    } | null;
  } | null;
  lab?: { name: string | null } | null;
}

async function callClaudeOnce(input: NarrationInput): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  const userPayload = {
    test: {
      type: input.testType,
      methodStd: input.testMethodStd,
      date: input.testDate,
      washCount: input.washCount,
      lab: input.lab?.name,
    },
    result: {
      icp: input.icpResult
        ? {
            agValue: input.icpResult.agValue,
            auValue: input.icpResult.auValue,
            unit: input.icpResult.unit,
          }
        : null,
      antibacterial: input.abResult
        ? {
            organism1: input.abResult.organism1,
            organism2: input.abResult.organism2,
            result1: input.abResult.result1,
            result2: input.abResult.result2,
            pass: input.abResult.pass,
            contactTime: input.abResult.contactTime,
          }
        : null,
      fungal: input.fungalResult,
      odor: input.odorResult,
    },
    fabric: {
      tier: input.submission?.fabric?.targetFuzeTier,
      fuzeNumber: input.submission?.fabric?.fuzeNumber,
      category: input.submission?.fabric?.fabricCategory,
    },
  };

  const { response } = await aiFetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: NARRATION_MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: JSON.stringify(userPayload, null, 2),
          },
        ],
      }),
    },
    { provider: "anthropic", callerRoute: "test-narration", userId: "system" },
  );
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Claude HTTP ${response.status}: ${t.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = (data.content?.[0]?.text || "").trim();
  if (!text) throw new Error("Claude returned empty text");
  return text;
}

/**
 * Generate a narration with up to 2 retries on brand-voice failure.
 * Returns the persisted text or throws on irrecoverable failure.
 */
export async function generateTestNarration(testRunId: string): Promise<{
  text: string;
  model: string;
  retries: number;
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
          fabric: { select: { fuzeNumber: true, fabricCategory: true, targetFuzeTier: true } },
        },
      },
      lab: { select: { name: true } },
    },
  })) as any;
  if (!tr) throw new Error(`TestRun ${testRunId} not found`);

  let lastError: any = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const text = await callClaudeOnce(tr);
      const voice = brandVoicePasses(text);
      if (!voice.ok) {
        lastError = new Error(`brand-voice reject (matched: ${voice.hit})`);
        continue; // retry
      }
      return { text, model: NARRATION_MODEL, retries: attempt };
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError || new Error("narration generation failed");
}

/**
 * Generate + persist. Called async from the brandVisible flip path
 * and from the retry cron. Never throws — stamps
 * aiNarrationGenerationFailedAt on irrecoverable failure so the
 * retry cron can pick it up later.
 */
export async function generateAndPersistNarration(testRunId: string): Promise<{
  ok: boolean;
  text?: string;
  error?: string;
}> {
  try {
    const { text, model } = await generateTestNarration(testRunId);
    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        aiNarration: text,
        aiNarrationModel: model,
        aiNarrationGeneratedAt: new Date(),
        aiNarrationGenerationFailedAt: null,
      } as any,
    });
    return { ok: true, text };
  } catch (e: any) {
    console.error(`[test-narration] ${testRunId} failed:`, e?.message || e);
    try {
      await prisma.testRun.update({
        where: { id: testRunId },
        data: { aiNarrationGenerationFailedAt: new Date() } as any,
      });
    } catch {
      // swallow — the next retry will try again
    }
    return { ok: false, error: e?.message || String(e) };
  }
}
