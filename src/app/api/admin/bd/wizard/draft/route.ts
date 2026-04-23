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
 *     isFollowUp?: boolean,               // Phase 3 — sequence follow-up
 *     previousSubject?: string,
 *   }
 *
 * Response:
 *   { ok: true, subject, body, diagnosed: string[], provider, usage }
 *
 * Implementation note: the heavy lifting (prompt build + Anthropic/OpenAI
 * dispatch + humanize/diagnose) lives in lib/bd-draft.ts so the cron
 * (bd-sequence-tick) can call it without HTTP roundtrips. This route is
 * now a thin shim over generateDraft().
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateDraft } from "@/lib/bd-draft";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROK_API_KEY = process.env.GROK_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// Function words we skip when checking whether the draft picked up on the
// distinctive parts of the rep's seed answer.
const STOPWORDS = new Set([
  "that",
  "this",
  "with",
  "from",
  "they",
  "them",
  "their",
  "have",
  "will",
  "would",
  "could",
  "should",
  "about",
  "also",
  "been",
  "being",
  "into",
  "than",
  "then",
  "just",
  "only",
  "very",
  "some",
  "like",
  "what",
  "when",
  "where",
  "which",
  "while",
  "your",
  "yours",
  "them",
  "there",
  "these",
  "those",
  "such",
  "want",
  "need",
  "look",
  "make",
  "made",
  "fuze",
  "brand",
  "company",
  "product",
  "products",
  "team",
  "line",
  "line",
]);

/**
 * Auto-trigger brand research when the brand has no `researchData` yet.
 * Originally the wizard drafted "blind" if the brand had never been
 * researched — Active Line Corp regression (#95). We fire the research
 * endpoint server-to-server, await it, and return the fresh researchData
 * so the draft prompt gets real intel instead of "(no research data yet)".
 *
 * Best-effort: if research fails (all AI keys missing, network, etc.) we
 * return whatever the brand already had and let the draft proceed.
 */
async function ensureResearch(
  req: Request,
  brand: { id: string; researchData: any },
): Promise<any> {
  if (brand.researchData) return brand.researchData;

  const hasAnyKey = !!(ANTHROPIC_API_KEY || OPENAI_API_KEY || GROK_API_KEY || PERPLEXITY_API_KEY);
  if (!hasAnyKey) return null;

  try {
    // Call the research endpoint on the same origin. We forward cookies +
    // x-user-* headers so getUserIdFromHeaders() inside /research works.
    const origin = new URL(req.url).origin;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const cookie = req.headers.get("cookie");
    if (cookie) headers["cookie"] = cookie;
    for (const h of ["x-user-id", "x-user-email", "x-user-role"]) {
      const v = req.headers.get(h);
      if (v) headers[h] = v;
    }

    const r = await fetch(`${origin}/api/brands/${brand.id}/research`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      // We intentionally DON'T pass autoSaveContacts — the wizard should not
      // mass-ingest AI-guessed contacts just because someone hit "draft".
      cache: "no-store",
    });
    if (!r.ok) {
      console.warn("[bd/wizard/draft] auto-research failed:", r.status);
      return null;
    }
    const payload = await r.json();
    if (!payload?.research) return null;

    // Persist so subsequent drafts hit the fast path.
    try {
      await prisma.brand.update({
        where: { id: brand.id },
        data: { researchData: payload.research, researchDate: new Date() },
      });
    } catch (e) {
      console.warn("[bd/wizard/draft] could not persist research:", e);
    }

    return payload.research;
  } catch (e) {
    console.warn("[bd/wizard/draft] auto-research threw:", e);
    return null;
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
      user.role === "SALES_REP" ||
      user.role === "BD_REP";
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
      isFollowUp = false,
      previousSubject = null,
      // Phase 4 — reply mode. The rep received a reply and wants to draft
      // a short response. replySummary is a free-text blurb from the rep
      // summarizing what the prospect said.
      isReply = false,
      replySummary = null,
      previousBody = null,
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

    // ── Auto-research if the brand has no intel yet. ──
    // #95 regression: the wizard used to draft blind for any brand that
    // hadn't been hand-researched. We now enrich on-the-fly so the AI has
    // real facts to work with instead of "(no research data yet)".
    const hadPriorResearch = Boolean(brand.researchData);
    const research = await ensureResearch(req, brand);
    const brandWithIntel = research ? { ...brand, researchData: research } : brand;

    const result = await generateDraft({
      brand: brandWithIntel,
      contact,
      channel,
      answers,
      tone,
      repName,
      userId: user.id,
      isFollowUp: Boolean(isFollowUp),
      previousSubject,
      isReply: Boolean(isReply),
      replySummary,
      previousBody,
    });

    // ── Soft validation: did the AI actually reference the rep's answers? ──
    // We already tell the AI to in rule 11, but some models still ignore
    // the seed block. We compute a coverage ratio of answers-referenced-in-
    // body and surface it to the UI so the rep can regenerate if the AI
    // flat-out ignored their input.
    const answerStrings = Object.values(answers || {})
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    const bodyLc = (result.body || "").toLowerCase();
    const referencedCount = answerStrings.filter((ans) => {
      // Extract the most distinctive 3+ letter words from the answer and
      // consider it "referenced" if any of those appear in the body.
      const tokens = ans
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
      if (!tokens.length) return true; // nothing distinctive to check
      return tokens.some((t) => bodyLc.includes(t));
    }).length;
    const answerCoverage = answerStrings.length ? referencedCount / answerStrings.length : 1;

    return NextResponse.json({
      ok: true,
      subject: result.subject,
      body: result.body,
      diagnosed: result.diagnosed,
      provider: result.provider,
      usage: result.usage || null,
      research: {
        hadPriorResearch,
        autoResearched: !hadPriorResearch && !!research,
        hasIntel: !!research,
      },
      answerCoverage: {
        total: answerStrings.length,
        referenced: referencedCount,
        ratio: answerCoverage,
        /** True if at least one answer appears unreferenced — UI can warn. */
        underused: answerStrings.length > 0 && answerCoverage < 1,
      },
    });
  } catch (err: any) {
    console.error("[bd/wizard/draft] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to draft" },
      { status: 500 },
    );
  }
}
