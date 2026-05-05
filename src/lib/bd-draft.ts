// @ts-nocheck
/**
 * ═══════════════════════════════════════════════════════════════════════
 * BD WIZARD — Shared draft generator
 *
 * Extracted from /api/admin/bd/wizard/draft so the sequence cron can
 * call it directly without making an internal HTTP round-trip. Both
 * the wizard's "draft this email" endpoint and the cron's step-prep
 * pass use this function.
 *
 * Behavior:
 *   - Builds the same prompt the route used in Phase 1 (10 non-negotiable
 *     rules, brand intel, rep customization Q&A).
 *   - Calls Anthropic primary, OpenAI fallback.
 *   - Returns humanized subject + body + diagnostic flags.
 *   - If no AI keys are configured, falls back to a templated draft so
 *     the wizard / cron still produces something usable.
 * ═══════════════════════════════════════════════════════════════════════
 */
import { aiFetch } from "@/lib/ai-fetch";
import { humanize, diagnose } from "@/lib/humanize";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const OPENAI_MODEL = "gpt-4o";

export type DraftChannel = "email" | "linkedin";

export interface DraftArgs {
  brand: any; // Prisma Brand with researchData, textileCategory, name
  contact: any; // Prisma Contact with firstName, name, jobTitle
  channel: DraftChannel;
  /** 2-3 freeform Q&A pairs the rep filled in on the wizard. */
  answers?: Record<string, string>;
  tone?: "direct" | "warm" | "curious";
  repName: string;
  userId: string; // for ai-fetch cost logging
  /**
   * Optional — if this is a follow-up step in a sequence, we let the
   * prompt know so it doesn't greet them like a stranger and references
   * the first touch.
   */
  isFollowUp?: boolean;
  /** Optional — the subject of the first-touch email, for grounding the follow-up. */
  previousSubject?: string;
  /**
   * Phase 4 — reply mode. When the prospect actually replied and the rep
   * is drafting a response (not another cold follow-up). Completely
   * different prompt rules: even shorter, conversational, lead with what
   * they said.
   */
  isReply?: boolean;
  /**
   * Free-text summary of the prospect's reply, provided by the rep on
   * the reply wizard. Example: "Asked if it works on nylon. Mentioned
   * they source from Vietnam." Used to ground the draft in what was
   * actually said without having to parse the full inbound email.
   */
  replySummary?: string;
  /** Optional — the full text of our previous outbound, for grounding. */
  previousBody?: string;
}

export interface DraftResult {
  subject: string;
  body: string;
  diagnosed: string[];
  provider: "anthropic" | "openai" | "fallback";
  usage?: any;
}

function buildPrompt(a: DraftArgs): string {
  const {
    brand,
    contact,
    channel,
    answers,
    tone = "direct",
    repName,
    isFollowUp,
    previousSubject,
    isReply,
    replySummary,
    previousBody,
  } = a;
  const isEmail = channel === "email";
  const contactFirstName =
    contact.firstName || (contact.name ? contact.name.split(" ")[0] : "there");

  const intel = brand.researchData
    ? JSON.stringify(brand.researchData).slice(0, 6000)
    : "(no research data yet — keep the pitch generic but grounded in their category)";

  // Collect the rep's answers as { question, answer } pairs. These are the
  // Step-3 prompts the rep filled in ("What caught your attention about this
  // brand?", "What specific problem does FUZE solve for them?", etc.) and
  // were previously listed but not ENFORCED — the AI would often ignore them
  // and produce a generic pitch. We now elevate them to seed material and
  // add a hard rule that each non-empty answer must be referenced.
  const answerPairs = Object.entries(answers || {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => ({ q: k, a: String(v).trim() }));

  const qaLines = answerPairs.map(({ q, a }) => `- ${q}: ${a}`).join("\n");

  // Tickets cmom20xdz + cmon7n0me — Ryan and Scott reported the AI was
  // either ignoring their seed answers or shoehorning them in awkwardly,
  // leading to "incomplete sentences" and "confusing intros". The old
  // prompt listed this twice and demanded "verbatim phrases", which made
  // the model paste raw answer text mid-sentence. We now list ONCE and
  // ask for natural integration — facts, not quotes.
  const seedBlock = answerPairs.length
    ? `
WHAT THE REP TOLD ME (treat as facts to weave in, NOT quotes to paste):
${answerPairs.map(({ q, a: v }, i) => `${i + 1}. ${q}? — ${v}`).join("\n")}

Each of these ${answerPairs.length} note(s) must inform the draft naturally. If the rep flagged something specific (a brand move, a pain point, a personal angle), the FIRST sentence after the greeting must hook on that. Do not paste the rep's note verbatim — rephrase it as your own observation.
`
    : "";

  // Phase 4: reply mode takes over completely — we're responding to a real
  // human reply, so all the cold-opener rules flip. Still no em-dashes,
  // still no silver/nano, but the draft should be short, responsive, and
  // lead with what they said rather than with FUZE.
  if (isReply) {
    const prevSnippet = previousBody ? previousBody.slice(0, 600) : "";
    return `You are drafting ${repName}'s reply to a prospect who just responded to a cold ${isEmail ? "email" : "LinkedIn DM"}.
${seedBlock}
TARGET BRAND: ${brand.name}
TARGET CONTACT: ${contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ")} — ${contact.jobTitle || "decision-maker"}
CATEGORY: ${brand.textileCategory || "textile"}

WHAT THEY SAID (rep's summary of the reply):
${replySummary || "(no summary provided — keep the reply generic but responsive)"}

OUR PREVIOUS OUTBOUND${previousSubject ? ` (subject: "${previousSubject}")` : ""}:
${prevSnippet || "(not available)"}

FUZE CONTEXT (for fallback facts only — don't pitch):
${intel.slice(0, 1500)}

REP NOTES:
${qaLines || "(none)"}

RULES (non-negotiable):
1. This is a REPLY, not a pitch. Lead with their reply, not with FUZE.
2. 2-3 sentences. Hard max. If they asked a direct question, answer it in sentence one.
3. NO em-dashes. NO "I hope", NO "circle back / touch base / deep dive / unlock / synergy".
4. NO bullet lists. Plain prose.
5. NO "silver" / "nano" / "ion" — it's F1 meta-material.
6. End with ONE concrete next step: a 15-min call with two time suggestions, a specific tech question back to them, OR an offer to send a one-pager. Not "let me know".
7. Tone: ${tone}. Treat the prospect as an equal — no thanking them effusively, no "great to hear from you!".
8. ${isEmail ? 'Keep subject as "Re: <previous subject>" or a short 3-5 word variation.' : "Subject is always empty for LinkedIn."}

${isEmail ? 'Return JSON: {"subject": "Re: ...", "body": "..."} — plain text body, no HTML.' : 'Return JSON: {"subject": "", "body": "..."}'}

Start the body with "${contactFirstName}," — no "Hi" / "Hello" / "Thanks for the reply".

Respond with ONLY the JSON object, no preamble or postamble.`;
  }

  const followUpNote = isFollowUp
    ? `\nTHIS IS A FOLLOW-UP. The rep already sent a first-touch ${isEmail ? "email" : "LinkedIn DM"}${previousSubject ? ` (subject: "${previousSubject}")` : ""}. Do not re-introduce FUZE from scratch. Reference that they might not have seen the first message, bring one new angle (a different value prop, a recent industry data point, or a softer ask), and keep it even shorter than a cold open.\n`
    : "";

  return `You are writing a ${isEmail ? "cold email" : "LinkedIn DM"} on behalf of ${repName} at FUZE Technologies.

FUZE sells F1 meta-material antimicrobial textile treatment, applied at the mill level. Permanent through 50+ industrial washes. Not silver, not nano. It's a finishing technology that brands license into their supply chain.
${seedBlock}
TARGET BRAND: ${brand.name}
TARGET CONTACT: ${contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ")} — ${contact.jobTitle || "decision-maker"}
CATEGORY: ${brand.textileCategory || "textile"}
${followUpNote}
BRAND INTEL (background facts — only use what's directly relevant):
${intel}

TONE: ${tone}

RULES (non-negotiable — violating any of these fails the draft):
1. NO em-dashes. Use periods or commas.
2. NO "I hope this email finds you well" or any "I hope..." opener.
3. NO "circle back", "touch base", "leverage", "synergy", "unlock", "game-changer", "deep dive".
4. NO three-item parallel lists ("fast, reliable, and scalable").
5. NO generic hedging openers ("Essentially,", "Fundamentally,", "Moreover,", "Furthermore,").
6. NO bullet lists in the body. Write prose.
7. NO claim that FUZE is "silver" or "nano" — it's F1 meta-material.
${
  isEmail
    ? `8. Keep to ${isFollowUp ? "2-4" : "4-6"} short sentences. Plain text only (no HTML tags).
9. Include one specific reference to the target brand that proves you actually looked at them.
10. End with one concrete ask — ${isFollowUp ? "just a yes or no on a 15-min call, or ask who the right person is" : "a 15-min call or a reply to a specific question"}. Not "let me know your thoughts".`
    : `8. Keep under 600 characters total (LinkedIn cuts off).
9. One specific reference to the contact's role OR a recent post from their brand.
10. One concrete ask — 15-min call OR the right person to speak to. Not "would love to connect".`
}
11. ${
    answerPairs.length
      ? `INTEGRATE THE REP'S NOTES NATURALLY. Each note in WHAT THE REP TOLD ME must inform the draft as a fact you've observed — not as a pasted quote. If a note names a brand move, your opening sentence references that move in your own words. If a note names a problem, name that problem in plain language. If a note is personal context about the contact, weave it into the rationale, not as a callout. The draft fails if any note is silently dropped, AND it fails if any note is shoehorned awkwardly into a sentence that doesn't read like a human wrote it.`
      : `No rep notes were provided; work from the BRAND INTEL block alone.`
  }
12. NO FILLER INTRO LINE. The first sentence after "${contactFirstName}," must be substantive — a specific observation about the brand or contact, NOT a generic opener like "I came across your work", "I've been following [Brand]", "Hope you're well", or "I lead BD at FUZE". The greeting line is the only filler allowed.

${isEmail ? `Return JSON: {"subject": "...", "body": "..."} — subject must be under 8 words, no clickbait, no emojis, no "Re:" or "Fwd:". Subject must reference the specific angle from the rep's notes when provided, not a generic "FUZE F1 for [Brand]".` : `Return JSON: {"subject": "", "body": "..."} — subject is always empty for LinkedIn.`}

Start with "${contactFirstName}," as the opener. No "Dear" or "Hello".

Respond with ONLY the JSON object, no preamble or postamble.`;
}

async function callAnthropic(prompt: string, userId: string) {
  const { response } = await aiFetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    { provider: "anthropic", callerRoute: "bd/draft-helper", userId },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic ${response.status}: ${text}`);
  }
  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  return { text, usage: data.usage };
}

async function callOpenAI(prompt: string, userId: string) {
  const { response } = await aiFetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    },
    { provider: "openai", callerRoute: "bd/draft-helper", userId },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI ${response.status}: ${text}`);
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return { text, usage: data.usage };
}

function safeParseJson(text: string): { subject: string; body: string } {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];
  try {
    const parsed = JSON.parse(cleaned);
    return {
      subject: String(parsed.subject || "").trim(),
      body: String(parsed.body || "").trim(),
    };
  } catch {
    return { subject: "", body: cleaned };
  }
}

/**
 * Pull normalized text out of the rep's Q&A by best-guess question match.
 * Keys on the wizard come through either as the question verbatim or as a
 * short slug — we handle both by matching lowercase substrings.
 */
function pickAnswer(answers: Record<string, string> | undefined, needles: string[]): string | null {
  if (!answers) return null;
  for (const [k, v] of Object.entries(answers)) {
    if (!v || !String(v).trim()) continue;
    const key = k.toLowerCase();
    if (needles.some((n) => key.includes(n))) return String(v).trim();
  }
  return null;
}

/** Lowercase first letter so an interpolated answer flows mid-sentence. */
function lc1(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Fallback draft — used only when NO AI keys are configured (or every AI
 * call failed). Historically this was purely templated and ignored the
 * rep's Step-3 answers, which is exactly the bug we're fixing for #95. Now
 * it interpolates the rep's "what caught your attention" + "what problem
 * does FUZE solve" answers so even the offline path honors their input.
 */
function fallbackDraft(a: DraftArgs): { subject: string; body: string } {
  const first = a.contact.firstName || (a.contact.name ? a.contact.name.split(" ")[0] : "there");

  // Rep's Step-3 answers — try a couple of likely key shapes.
  const hookAnswer = pickAnswer(a.answers, ["caught", "attention", "why", "noticed", "eye"]);
  const problemAnswer = pickAnswer(a.answers, ["problem", "pain", "solve", "gap", "challenge"]);
  const angleAnswer = pickAnswer(a.answers, ["angle", "hook", "specific", "pitch"]);
  const extraAnswers = Object.values(a.answers || {})
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  const hookLine = hookAnswer ? `${hookAnswer.replace(/\.$/, "")}.` : "";
  const problemLine = problemAnswer
    ? `FUZE F1 speaks directly to ${lc1(problemAnswer.replace(/\.$/, ""))}. `
    : "";
  const angleTail = angleAnswer ? ` Specifically ${lc1(angleAnswer.replace(/\.$/, ""))}.` : "";
  // If none of the targeted slots matched but the rep DID write something,
  // fall back to just appending the first non-empty answer so their input
  // is never silently dropped.
  const rawTail =
    !hookLine && !problemLine && !angleTail && extraAnswers.length
      ? ` ${extraAnswers[0].replace(/\.$/, "")}.`
      : "";

  if (a.channel === "email") {
    if (a.isReply) {
      const subjectBase = a.previousSubject
        ? `Re: ${a.previousSubject}`
        : `Re: FUZE F1 for ${a.brand.name}`;
      const summaryLine = a.replySummary
        ? `Appreciate the reply. ${a.replySummary.trim().endsWith(".") ? a.replySummary.trim() : a.replySummary.trim() + "."}`
        : "Appreciate the reply.";
      return {
        subject: subjectBase,
        body: `${first},

${summaryLine}${rawTail} ${problemLine}Happy to send a one-pager or jump on a 15-min call Tuesday or Thursday to walk through how FUZE F1 maps to ${a.brand.textileCategory || "your"} line.${angleTail} Which works?

${a.repName}`,
      };
    }
    if (a.isFollowUp) {
      return {
        subject: `Re: FUZE F1 for ${a.brand.name}`,
        body: `${first},

Following up on my note last week.${hookLine ? ` ${hookLine}` : ""} ${problemLine}FUZE F1 is the antimicrobial finish that survives 50+ washes, and it maps cleanly to ${a.brand.textileCategory || "your product"} line.${angleTail} Do you have 15 minutes this week, or is there a better person on your team to speak to?${rawTail}

${a.repName}`,
      };
    }
    const opener = hookLine ? hookLine : `${a.brand.name} came across my desk this week.`;
    return {
      subject: `FUZE F1 for ${a.brand.name}`,
      body: `${first},

${opener} ${problemLine}We license a textile finish called FUZE F1 that stays antimicrobial through 50+ industrial washes. Not silver, not nano. It's applied at the mill.${angleTail}${rawTail}

Worth 15 minutes to see if it fits your ${a.brand.textileCategory || "product"} line?

${a.repName}`,
    };
  }
  const liHook =
    hookLine || `Curious about ${a.brand.name}'s ${a.brand.textileCategory || "textile"} line.`;
  return {
    subject: "",
    body: `${first}, ${liHook} ${problemLine}FUZE F1 is an antimicrobial finish applied at the mill that lasts 50+ washes.${angleTail} Worth a quick look?`,
  };
}

export async function generateDraft(a: DraftArgs): Promise<DraftResult> {
  const prompt = buildPrompt(a);

  try {
    if (ANTHROPIC_API_KEY) {
      const r = await callAnthropic(prompt, a.userId);
      const parsed = safeParseJson(r.text);
      return {
        subject: humanize(parsed.subject).replace(/\n/g, " ").trim(),
        body: humanize(parsed.body),
        diagnosed: diagnose(parsed.body),
        provider: "anthropic",
        usage: r.usage,
      };
    }
    if (OPENAI_API_KEY) {
      const r = await callOpenAI(prompt, a.userId);
      const parsed = safeParseJson(r.text);
      return {
        subject: humanize(parsed.subject).replace(/\n/g, " ").trim(),
        body: humanize(parsed.body),
        diagnosed: diagnose(parsed.body),
        provider: "openai",
        usage: r.usage,
      };
    }
  } catch (err) {
    console.error("[bd-draft] AI call failed, falling back to template:", err);
  }

  const fallback = fallbackDraft(a);
  return {
    subject: humanize(fallback.subject).replace(/\n/g, " ").trim(),
    body: humanize(fallback.body),
    diagnosed: diagnose(fallback.body),
    provider: "fallback",
  };
}
