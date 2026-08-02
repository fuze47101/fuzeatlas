// @ts-nocheck
/**
 * Red Rover — AI Next-Best-Action + draft outreach (Phase 3, Track 1).
 *
 * One Claude (Haiku-tier) call per click. Loads the target + contacts +
 * recent activities, arms the model with FUZE positioning (fuze-knowledge)
 * and the matching competitor's chemistry (competitors.ts), and returns:
 *   { nextActions: string[≤3], draftEmail: { to, subject, bodyHtml } }.
 *
 * Reuses the aiFetch client + the test-narration brand-voice guard pattern.
 * HARD GUARD: never silver/nano/Ag/nanoparticle — FUZE / metamaterial only;
 * claims stay inside EPA treated-article scope (odor/mildew/freshness/
 * durability), no kill-rate/named-organism claims. Retries ≤3x on a banned
 * term; drops the draft and flags if it can't comply.
 */
import { aiFetch } from "@/lib/ai-fetch";
import { FUZE_KNOWLEDGE } from "@/lib/fuze-knowledge";
import { COMPETITORS } from "@/lib/competitors";

const MODEL = "claude-haiku-4-5-20251001"; // Haiku-tier, cost guard

// Same brand-voice scanner as test-narration.ts. Inline `// NEVER` keeps the
// repo brand-voice grep from flagging these rule definitions.
const FORBIDDEN_RX: RegExp[] = [
  /\bsilver[-\s]?ion(s)?\b/i, // NEVER
  /\bnano[-\s]?silver\b/i, // NEVER
  /\bsilver[-\s]?nanoparticle(s)?\b/i, // NEVER
  /\bnanoparticle(s)?\b/i, // NEVER
  /\bnanosilver\b/i, // NEVER
  /\bwater[-\s]?based silver\b/i, // NEVER
  /\bsilver\b(?!\s*(chloride|nitrate|sulfate))/i, // NEVER (bare silver in customer copy)
  /\bnano(?!metric|second|gram|meter)/i, // NEVER
  /\bAg\+?\b/, // NEVER (elemental/ionic silver shorthand)
];

function brandVoicePasses(text: string): { ok: true } | { ok: false; hit: string } {
  for (const rx of FORBIDDEN_RX) {
    const m = text.match(rx);
    if (m) return { ok: false, hit: m[0] };
  }
  return { ok: true };
}

// target name → competitor company keyword(s) so the model can arm the
// argument against the incumbent chemistry it's displacing.
const COMPETITOR_HINTS: Record<string, string[]> = {
  Archroma: ["HeiQ"], // Archroma's new HeiQ deal
  Sanitized: ["Sanitized"],
  Polygiene: ["Polygiene"],
  "Concept III": ["Polygiene"], // historically Polygiene-exclusive
  Microban: ["Microban"],
  "Rudolf (Duraner/Turkey)": ["Rudolf"],
  Sciessent: ["Sciessent"],
};

function matchCompetitors(targetName: string) {
  const keys = COMPETITOR_HINTS[targetName] || [];
  if (!keys.length) return [];
  const out: any[] = [];
  for (const c of COMPETITORS) {
    if (keys.some((k) => c.company.toLowerCase().includes(k.toLowerCase()))) {
      out.push({
        company: c.company,
        product: c.product,
        chemistry: c.chemistryLabel,
        activeAgent: c.activeAgent,
        epaNote: c.epaRegNote,
      });
      if (out.length >= 3) break;
    }
  }
  return out;
}

const SYSTEM_PROMPT = `You are a senior B2B business-development strategist for FUZE, a proprietary antimicrobial textile treatment. You advise the FUZE team on how to advance a specific industry-negotiation target (a textile-chemical company, brand-owner, or distributor) toward a partnership / distribution / white-label / offtake agreement.

You will receive JSON describing ONE target: its stage, current status, negotiation history, agreements, next step, intel, its contacts (with roles), and — where relevant — the incumbent competitor chemistry it would displace.

Return ONLY valid JSON, no prose, no markdown fences, in exactly this shape:
{
  "nextActions": ["action 1", "action 2", "action 3"],
  "draftEmail": { "to": "email or empty string", "subject": "...", "bodyHtml": "<p>...</p>" }
}

nextActions: EXACTLY 3 concrete, specific, sequenced next steps to move THIS target forward given its stage and history. Reference the actual people, the actual blocker, and the actual lever. No generic filler.

draftEmail: a short, warm, credible outreach email (3–5 short paragraphs, simple HTML in bodyHtml using <p> tags) addressed to the primary negotiation contact, written to advance the deal from its current stage. Use the competitor/regulatory lever where it helps. Professional, specific, no hype.

═══════════════════════════════════════════════════════════════
BANNED WORDS — NEVER use ANY of these anywhere in your output (actions OR email). The entire response is discarded if any appear:
silver, silver-ion, silver ion, nano, nanoparticle, nanoparticles, nano-silver, nanosilver, silver nanoparticle, ionic silver, colloidal silver, Ag, Ag+
The FUZE active is ALWAYS "FUZE" or "metamaterial" or "FUZE metamaterial" — never a chemical/ion/particle name. (You MAY name a COMPETITOR's chemistry when arguing against it, e.g. "their silver-chloride finish" — but never describe FUZE that way.)
═══════════════════════════════════════════════════════════════
EPA TREATED-ARTICLE SCOPE — customer-facing claims about FUZE are limited to: odor control, freshness/lasting, mildew that causes product deterioration, durability/wash performance, and factual certifications (EPA registered, OEKO-TEX, bluesign, PFAS-free, non-leaching). DO NOT make kill-rate claims, named-organism claims (MRSA, Staph, E. coli), or "antibacterial / kills 99.9% / protects the wearer" claims — those require a separate public-health registration FUZE does not assert in outreach.
═══════════════════════════════════════════════════════════════

FUZE POSITIONING / VOICE (source of truth — pull language from here):
${FUZE_KNOWLEDGE}

BEFORE RETURNING: scan your entire JSON output for any banned word. If found, rewrite with FUZE / metamaterial. Return ONLY the JSON object.`;

function buildUserPayload(target: any, contacts: any[], activities: any[]) {
  const negotiation = contacts.filter((c) => c.role === "NEGOTIATION");
  const primary =
    negotiation.find((c) => c.side === "TARGET" && c.email) ||
    negotiation.find((c) => c.email) ||
    contacts.find((c) => c.email) ||
    null;
  return {
    suggestedRecipientEmail: primary?.email || "",
    target: {
      name: target.name,
      companyClass: target.companyClass,
      geo: target.geo,
      tier: target.tier,
      stage: target.stage,
      currentStatus: target.currentStatus,
      currentAgreements: target.currentAgreements,
      keyMeetings: target.keyMeetings,
      initialContact: target.initialContact,
      nextStep: target.nextStep,
      whoDroveIt: target.whoDroveIt,
      intel: target.intel,
    },
    contacts: contacts.map((c) => ({
      name: c.name,
      title: c.title,
      email: c.email,
      side: c.side,
      role: c.role,
    })),
    recentActivity: activities.map((a) => ({
      type: a.type,
      when: a.occurredAt,
      body: a.body,
    })),
    incumbentCompetitors: matchCompetitors(target.name),
  };
}

async function callOnce(payload: any): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
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
        model: MODEL,
        max_tokens: 1400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(payload, null, 2) }],
      }),
    },
    { provider: "anthropic", callerRoute: "red-rover-next-action", userId: "system" },
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

function extractJson(text: string): any {
  // strip ```json fences if present, then grab the outermost object.
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON object in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Generate the next-best-action + draft. Never throws for the caller's
 * benefit is NOT guaranteed — the route wraps it; but brand-voice failures
 * resolve to a flagged result rather than an exception.
 */
export async function generateNextAction(
  prisma: any,
  targetId: string,
): Promise<{
  ok: boolean;
  flagged: boolean;
  flagReason?: string;
  nextActions: string[];
  draftEmail: { to: string; subject: string; bodyHtml: string } | null;
  model: string;
  retries: number;
}> {
  const target = await prisma.redRoverTarget.findUnique({
    where: { id: targetId },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      activities: { orderBy: { occurredAt: "desc" }, take: 15 },
    },
  });
  if (!target) throw new Error("Target not found");

  const payload = buildUserPayload(target, target.contacts, target.activities);
  const negotiation = target.contacts.filter((c: any) => c.role === "NEGOTIATION");
  const defaultTo =
    (negotiation.find((c: any) => c.side === "TARGET" && c.email) ||
      negotiation.find((c: any) => c.email) ||
      target.contacts.find((c: any) => c.email))?.email || "";

  let lastReason = "";
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const raw = await callOnce(payload);
      let parsed: any;
      try {
        parsed = extractJson(raw);
      } catch (e: any) {
        lastReason = `unparseable JSON: ${e?.message || e}`;
        continue;
      }
      const nextActions = Array.isArray(parsed.nextActions)
        ? parsed.nextActions.filter((s: any) => typeof s === "string" && s.trim()).slice(0, 3)
        : [];
      const de = parsed.draftEmail || {};
      const subject = typeof de.subject === "string" ? de.subject : "";
      const bodyHtml = typeof de.bodyHtml === "string" ? de.bodyHtml : "";
      if (nextActions.length === 0 || !subject || !bodyHtml) {
        lastReason = "incomplete response (missing actions or draft)";
        continue;
      }

      const combined = [...nextActions, subject, bodyHtml].join("\n");
      const voice = brandVoicePasses(combined);
      if (!voice.ok) {
        lastReason = `brand-voice reject (matched: "${voice.hit}")`;
        continue; // retry
      }

      return {
        ok: true,
        flagged: false,
        nextActions,
        draftEmail: {
          to: (typeof de.to === "string" && de.to.trim()) || defaultTo,
          subject,
          bodyHtml,
        },
        model: MODEL,
        retries: attempt,
      };
    } catch (e: any) {
      lastReason = e?.message || String(e);
    }
  }

  // Could not produce compliant output after 3 attempts — drop the draft, flag.
  return {
    ok: false,
    flagged: true,
    flagReason: lastReason || "failed to generate compliant output",
    nextActions: [],
    draftEmail: null,
    model: MODEL,
    retries: 3,
  };
}
