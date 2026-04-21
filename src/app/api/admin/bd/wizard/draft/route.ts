// @ts-nocheck
/**
 * POST /api/admin/bd/wizard/draft
 *
 * Generate a personalized outbound draft for a specific contact at a brand.
 * The wizard calls this after the rep picks a contact, chooses LinkedIn vs
 * Email, and answers 2-3 customization questions.
 *
 *   body = {
 *     brandId: string,
 *     contactId: string,
 *     channel: "email" | "linkedin",
 *     answers?: Record<string, string>,   // customization Q&A
 *     tone?: "direct" | "warm" | "curious",
 *   }
 *
 * Response:
 *   { ok: true, subject, body, diagnosed: string[], tokensUsed }
 *
 * Implementation notes:
 *  - Uses the brand's cached researchData (from /api/brands/[id]/research)
 *    as the intel pack. If missing, returns a stubbed template so the rep
 *    isn't blocked — they'll see a banner suggesting they run research first.
 *  - Uses Anthropic (Claude) as the drafting model because we've had the
 *    best on-brand voice from it for outbound. GPT is available as a fallback
 *    if ANTHROPIC_API_KEY is unset.
 *  - Output goes through humanize() BEFORE returning so the rep sees the
 *    cleaned draft. They can still edit it, but the AI tells are already gone.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { aiFetch } from "@/lib/ai-fetch";
import { humanize, diagnose } from "@/lib/humanize";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const OPENAI_MODEL = "gpt-4o";

function buildPrompt(args: {
  brand: any;
  contact: any;
  channel: "email" | "linkedin";
  answers: Record<string, string>;
  tone: string;
  repName: string;
}) {
  const { brand, contact, channel, answers, tone, repName } = args;
  const isEmail = channel === "email";
  const contactFirstName =
    contact.firstName ||
    (contact.name ? contact.name.split(" ")[0] : "there");

  // Compact the research data so the prompt isn't gigantic
  const intel = brand.researchData
    ? JSON.stringify(brand.researchData).slice(0, 6000)
    : "(no research data yet — keep the pitch generic but grounded in their category)";

  const qaLines = Object.entries(answers || {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  return `You are writing a ${isEmail ? "cold email" : "LinkedIn DM"} on behalf of ${repName} at FUZE Technologies.

FUZE sells F1 meta-material antimicrobial textile treatment, applied at the mill level. Permanent through 50+ industrial washes. Not silver, not nano. It's a finishing technology that brands license into their supply chain.

TARGET BRAND: ${brand.name}
TARGET CONTACT: ${contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ")} — ${contact.jobTitle || "decision-maker"}
CATEGORY: ${brand.textileCategory || "textile"}

INTEL:
${intel}

REP'S CUSTOMIZATION NOTES:
${qaLines || "(none provided)"}

TONE: ${tone}

RULES (non-negotiable — violating any of these fails the draft):
1. NO em-dashes. Use periods or commas.
2. NO "I hope this email finds you well" or any "I hope..." opener.
3. NO "circle back", "touch base", "leverage", "synergy", "unlock", "game-changer", "deep dive".
4. NO three-item parallel lists ("fast, reliable, and scalable").
5. NO generic hedging openers ("Essentially,", "Fundamentally,", "Moreover,", "Furthermore,").
6. NO bullet lists in the body. Write prose.
7. NO claim that FUZE is "silver" or "nano" — it's F1 meta-material.
${isEmail ? `8. Keep to 4-6 short sentences. Plain text only (no HTML tags).
9. Include one specific reference to the target brand that proves you actually looked at them.
10. End with one concrete ask — a 15-min call or a reply to a specific question. Not "let me know your thoughts".` : `8. Keep under 600 characters total (LinkedIn cuts off).
9. One specific reference to the contact's role OR a recent post from their brand.
10. One concrete ask — 15-min call OR the right person to speak to. Not "would love to connect".`}

${isEmail ? `Return JSON: {"subject": "...", "body": "..."} — subject must be under 8 words, no clickbait, no emojis, no "Re:" or "Fwd:".` : `Return JSON: {"subject": "", "body": "..."} — subject is always empty for LinkedIn.`}

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
    { provider: "anthropic", callerRoute: "bd/wizard/draft", userId },
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
    { provider: "openai", callerRoute: "bd/wizard/draft", userId },
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
  // Anthropic sometimes wraps JSON in ```json fences. Strip them.
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  // If the model added any preamble, try to locate the first { ... } block.
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];
  try {
    const parsed = JSON.parse(cleaned);
    return {
      subject: String(parsed.subject || "").trim(),
      body: String(parsed.body || "").trim(),
    };
  } catch {
    // Fallback: treat the whole output as the body.
    return { subject: "", body: cleaned };
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const isBDEligible =
      user.role === "ADMIN" ||
      user.role === "EMPLOYEE" ||
      user.role === "SALES_MANAGER" ||
      user.role === "SALES_REP";
    if (!isBDEligible) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      brandId,
      contactId,
      channel = "email",
      answers = {},
      tone = "direct",
    } = body || {};

    if (!brandId || !contactId) {
      return NextResponse.json(
        { ok: false, error: "brandId and contactId are required" },
        { status: 400 },
      );
    }
    if (channel !== "email" && channel !== "linkedin") {
      return NextResponse.json(
        { ok: false, error: "channel must be 'email' or 'linkedin'" },
        { status: 400 },
      );
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.brandId !== brandId) {
      return NextResponse.json(
        { ok: false, error: "Contact not found on this brand" },
        { status: 404 },
      );
    }

    const repName = user.name || user.email.split("@")[0];
    const prompt = buildPrompt({ brand, contact, channel, answers, tone, repName });

    let raw = "";
    let provider = "";
    let usage: any = null;

    if (ANTHROPIC_API_KEY) {
      const r = await callAnthropic(prompt, user.id);
      raw = r.text;
      provider = "anthropic";
      usage = r.usage;
    } else if (OPENAI_API_KEY) {
      const r = await callOpenAI(prompt, user.id);
      raw = r.text;
      provider = "openai";
      usage = r.usage;
    } else {
      // No AI keys configured — return a templated fallback the rep can edit
      const first =
        contact.firstName ||
        (contact.name ? contact.name.split(" ")[0] : "there");
      const bodyFallback =
        channel === "email"
          ? `${first},

${brand.name} came across my desk this week. We license a textile finish called FUZE F1 that stays antimicrobial through 50+ industrial washes. Not silver, not nano. It's applied at the mill.

Worth 15 minutes to see if it fits your ${brand.textileCategory || "product"} line?

${repName}`
          : `${first}, FUZE F1 is an antimicrobial finish applied at the mill that lasts 50+ washes. Curious if it maps to ${brand.name}'s ${brand.textileCategory || "textile"} line. Worth a quick look?`;
      return NextResponse.json({
        ok: true,
        subject: channel === "email" ? `FUZE F1 for ${brand.name}` : "",
        body: humanize(bodyFallback),
        diagnosed: diagnose(bodyFallback),
        provider: "fallback",
        usage: null,
      });
    }

    const parsed = safeParseJson(raw);
    const humanizedBody = humanize(parsed.body);
    // Subjects pass through humanize too — em-dashes in subjects are a tell
    const humanizedSubject = humanize(parsed.subject).replace(/\n/g, " ").trim();

    return NextResponse.json({
      ok: true,
      subject: humanizedSubject,
      body: humanizedBody,
      diagnosed: diagnose(parsed.body),
      provider,
      usage,
    });
  } catch (err: any) {
    console.error("[bd/wizard/draft] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to draft" },
      { status: 500 },
    );
  }
}
