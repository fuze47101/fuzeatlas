// @ts-nocheck
/**
 * POST /api/admin/bd/wizard/auto-draft — Phase 11E.
 *
 * Generates a full first-draft outbound email tailored to:
 *   - The brand's textileCategory (regulatory triggers per vertical)
 *   - Brand.researchData (anything we've enriched)
 *   - Brand.requiredFuzeTier if set
 *   - Recent FUZE wins in the same category
 *   - Canonical FUZE voice from src/lib/fuze-knowledge.ts
 *
 * Brand-voice enforcement: system prompt explicitly constrains
 * vocabulary. The returned draft is scanned for the same denylist
 * patterns the check-brand-voice scanner uses; if a forbidden term
 * leaks through, we re-prompt with a stricter constraint once. On
 * second failure we return ok:false with a code so the rep falls
 * back to manual draft.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { aiFetch } from "@/lib/ai-fetch";
import { FUZE_KNOWLEDGE } from "@/lib/fuze-knowledge";

const BD_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "DISTRIBUTOR_USER"];

// Regulatory / news triggers per textileCategory. Keep this short and
// load-bearing — Claude picks one to weave in based on relevance.
const REG_TRIGGERS: Record<string, string[]> = {
  activewear: [
    "Texas AG investigation of Lululemon (April 2026) — PFAS in activewear",
    "California SB 707 — PFAS restrictions in textiles",
  ],
  hospitality: [
    "NY Hospitality Market — guest-complaint reduction angle",
    "Hotel laundry chemistry under regulator scrutiny",
  ],
  intimates: [
    "PFAS-free positioning for skin-contact apparel",
    "OEKO-TEX Standard 100 Class I — required for intimate apparel",
  ],
  kids: [
    "Child-safety regulatory pressure on antimicrobial chemistry",
    "California EPA approval (Q1 2026) for kid/baby textiles",
  ],
  workwear: [
    "Healthcare workwear infection-control claims",
    "Industrial workwear durability (F1 100 washes)",
  ],
  medical: [
    "ISO 18184 antiviral standard for medical textiles",
    "FDA-adjacent positioning for healthcare fabrics",
  ],
  industrial: [
    "OEM antimicrobial spec compliance",
    "PFAS-free industrial textile chemistry",
  ],
};

const VOICE_DENYLIST = [
  /\bsilver(?!\s*(?:laser|ablation|metamaterial))\b/i,
  /\bsilver[\s-]?ion\b/i,
  /\bnano(?:particle|particles)?\b/i,
  /\bnanosilver\b/i,
  /\bsilver[\s-]?based\b/i,
];

function violatesBrandVoice(text: string): boolean {
  return VOICE_DENYLIST.some((rx) => rx.test(text));
}

async function generate(prompt: string, system: string, userId: string) {
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
        max_tokens: 1800,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    { provider: "anthropic", callerRoute: "bd-auto-draft", userId },
  );
  if (!response.ok) return null;
  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BD_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, code: "no_ai_key", error: "ANTHROPIC_API_KEY not set on server" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.brandId) {
    return NextResponse.json({ ok: false, error: "brandId required" }, { status: 400 });
  }

  const [brand, contact] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: body.brandId },
      select: {
        id: true,
        name: true,
        textileCategory: true,
        country: true,
        requiredFuzeTier: true,
        researchData: true,
        backgroundInfo: true,
      },
    }),
    body.contactId
      ? prisma.contact.findUnique({
          where: { id: body.contactId },
          select: { name: true, firstName: true, title: true, email: true },
        })
      : null,
  ]);
  if (!brand) return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });

  const triggers = REG_TRIGGERS[brand.textileCategory || ""] || [];

  const baseSystem = `You write a single outbound BD email for FUZE Biotech, an antimicrobial textile treatment company.

ABSOLUTE BRAND-VOICE RULES (any violation = caller will reject and regenerate):
- ALWAYS use "FUZE" and "metamaterial" (one word, no hyphen)
- NEVER write "silver", "silver-ion", "nano", "nanoparticle", "nanosilver", or "silver-based" anywhere in the email
- If you'd be tempted to describe the active ingredient, say "FUZE metamaterial" or "proprietary metamaterial antimicrobial treatment"
- Standards we cite: AATCC 100, ASTM E2149, AATCC 30, ISO 18184, ISO 20743
- Certifications we cite: OEKO-TEX Standard 100 Class I, bluesign® approved, EPA registered (federal), California EPA approved Q1 2026, PFAS-free
- Tiers: F1 (100 washes), F2 (75), F3 (50), F4 (25)

Background knowledge:
${FUZE_KNOWLEDGE.slice(0, 4000)}

Return JSON only, exactly this shape:
{
  "subject": "<under 60 chars>",
  "body": "<plain-text email body, 4-8 short paragraphs, ends with one clear CTA>",
  "reasoning": "<one sentence explaining the angle picked>",
  "sources": ["<bullet 1>", "<bullet 2>", "..."]
}`;

  const userPayload = JSON.stringify(
    {
      brand: {
        name: brand.name,
        textileCategory: brand.textileCategory,
        country: brand.country,
        requiredFuzeTier: brand.requiredFuzeTier,
        backgroundInfo: brand.backgroundInfo,
        researchData: brand.researchData,
      },
      contact: contact
        ? {
            firstName: contact.firstName || (contact.name || "").split(" ")[0],
            title: contact.title,
          }
        : null,
      regulatoryTriggers: triggers,
      channel: body.channel || "email",
    },
    null,
    2,
  );

  // First attempt.
  let result = await generate(userPayload, baseSystem, user.id);
  if (!result || typeof result.body !== "string") {
    return NextResponse.json(
      { ok: false, code: "ai_no_output", error: "Claude returned no draft" },
      { status: 502 },
    );
  }

  let combined = `${result.subject || ""}\n\n${result.body}`;
  if (violatesBrandVoice(combined)) {
    // One stricter retry.
    const stricter =
      baseSystem +
      `\n\nPREVIOUS DRAFT VIOLATED BRAND VOICE. Specifically, do not use the words "silver", "silver-ion", "nano", "nanoparticle", "nanosilver", or any variant. Use ONLY "FUZE" and "metamaterial" to refer to the chemistry.`;
    result = await generate(userPayload, stricter, user.id);
    combined = result ? `${result.subject || ""}\n\n${result.body || ""}` : "";
    if (!result || violatesBrandVoice(combined)) {
      return NextResponse.json(
        {
          ok: false,
          code: "brand_voice_violation",
          error:
            "Generated draft used forbidden vocabulary (silver / nano) twice in a row. Fall back to manual draft.",
        },
        { status: 422 },
      );
    }
  }

  return NextResponse.json({ ok: true, ...result, triggersUsed: triggers });
}
