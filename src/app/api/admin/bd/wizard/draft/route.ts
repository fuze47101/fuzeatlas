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

    const result = await generateDraft({
      brand,
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

    return NextResponse.json({
      ok: true,
      subject: result.subject,
      body: result.body,
      diagnosed: result.diagnosed,
      provider: result.provider,
      usage: result.usage || null,
    });
  } catch (err: any) {
    console.error("[bd/wizard/draft] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to draft" },
      { status: 500 },
    );
  }
}
