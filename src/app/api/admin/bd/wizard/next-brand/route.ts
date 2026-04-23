// @ts-nocheck
/**
 * GET /api/admin/bd/wizard/next-brand
 *
 * Returns the next highest-confidence unassigned LEAD the rep should work
 * on — the entry point to the BD Wizard's "next brand" auto-pick. Andrew's
 * requirement: "auto-assign next highest-confidence brand, don't make the
 * rep browse a list".
 *
 * Ordering (confidence proxy — we don't have a true confidence score, so
 * we stack-rank on the signals we do have):
 *   1. fuzeRelevance = high  > medium  > low  > null
 *   2. validationStatus = verified > pending > null (skip irrelevant/dead/duplicate)
 *   3. has contacts (at least one with email) > no contacts
 *   4. researchData populated (cached multi-AI enrichment) > empty
 *   5. most recently updated (newer = fresher signal)
 *
 * Concurrency (#101, 2026-04-23):
 *   Before this hardening, three reps hitting the wizard in the same
 *   30-second window would all receive the same top brand — then race on
 *   the Send step. The permanent claim (salesRepId) still flips on send,
 *   so whoever shipped the email last "won", but by then two other reps
 *   had already drafted and (potentially) sent their own emails to the
 *   same contact. Net effect: duplicate outreach, rep confusion, domain
 *   reputation risk.
 *
 *   Fix: the pick is now an *atomic reservation*. After ranking
 *   candidates in memory, we walk the sorted list and try to claim each
 *   one via `updateMany` with a WHERE clause that only matches brands
 *   that are still free (no salesRepId, no active reservation by someone
 *   else). First writer wins — their `updateMany.count` is 1 and we
 *   return that brand. Losers' count is 0 and we advance to the next
 *   candidate. The reservation has a 30-minute TTL so if a rep abandons
 *   the wizard mid-flow, the brand re-enters the queue for others.
 *
 * Optional query params:
 *   skip=<brandId>   — skip this brand (use when rep says "next")
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const RELEVANCE_ORDER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// How long a pick-time reservation holds a brand for the rep who picked
// it. Long enough that a rep can enrich + draft + read over a cup of
// coffee; short enough that an abandoned wizard tab re-releases the
// brand without a manual intervention.
const RESERVATION_TTL_MS = 30 * 60_000; // 30 minutes

function scoreBrand(b: any): number {
  let score = 0;
  const rel = (b.fuzeRelevance || "").toLowerCase();
  score += (RELEVANCE_ORDER[rel] || 0) * 1000;
  if (b.validationStatus === "verified") score += 500;
  else if (b.validationStatus === "pending" || !b.validationStatus) score += 100;
  if (b.contacts && b.contacts.length > 0) score += 300;
  const emailable = (b.contacts || []).filter((c: any) => c.email).length;
  score += Math.min(emailable, 5) * 20;
  if (b.researchData) score += 200;
  if (b.updatedAt)
    score +=
      Math.min(
        30,
        Math.floor((Date.now() - new Date(b.updatedAt).getTime()) / (1000 * 60 * 60 * 24)) * -1,
      ) + 30;
  return score;
}

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const skipId = url.searchParams.get("skip") || "";
    const now = new Date();

    // Pull a small candidate pool and rank in memory. We over-fetch
    // (up to 25) so the in-memory scoring has some variety to work with;
    // Prisma's ordering can't express our composite rank cleanly. We
    // *also* over-fetch because the top candidate may lose the
    // reservation race and we need fallbacks — 25 gives plenty of
    // headroom even if all three BD reps hit this simultaneously.
    const candidates = await prisma.brand.findMany({
      where: {
        pipelineStage: "LEAD",
        salesRepId: null,
        // Skip brands explicitly marked as not worth chasing OR bounced
        // by a rep who hit a dead domain.
        validationStatus: { notIn: ["irrelevant", "dead", "duplicate"] },
        // Skip brands with no contacts at all — the wizard has nothing to do
        contacts: { some: {} },
        // Exclude brands that ANOTHER rep currently has reserved. We
        // include brands where the reservation has expired, and brands
        // where this same rep holds the reservation (so refreshing the
        // wizard doesn't flip them off their own brand).
        OR: [{ reservedUntil: null }, { reservedUntil: { lt: now } }, { reservedBy: user.id }],
        ...(skipId ? { id: { not: skipId } } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 25,
      include: {
        contacts: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
            personalEmail: true,
            linkedinUrl: true,
            jobTitle: true,
            seniority: true,
            emailStatus: true,
            outreachStatus: true,
            lastContactedAt: true,
          },
        },
      },
    });

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        brand: null,
        reason:
          "No unassigned LEAD brands with contacts found. Add brands via /brands/discover or import a CSV.",
      });
    }

    // Rank in memory
    const ranked = candidates
      .map((b: any) => ({ b, score: scoreBrand(b) }))
      .sort((a, b) => b.score - a.score);

    // ─── Atomic reservation loop ────────────────────────────────
    // Try to claim the top-ranked brand first. If another rep beat
    // us to it in the microseconds between the findMany and this
    // updateMany, count will be 0 and we walk to the next candidate.
    // We cap iterations at the candidate list length — if all 25 are
    // contested, the queue is deeper than we're seeing and the caller
    // should just retry.
    const reservedUntil = new Date(Date.now() + RESERVATION_TTL_MS);
    let pick: any = null;
    let losses = 0;
    for (const cand of ranked) {
      const r = await prisma.brand.updateMany({
        where: {
          id: cand.b.id,
          salesRepId: null,
          OR: [
            { reservedUntil: null },
            { reservedUntil: { lt: new Date() } },
            { reservedBy: user.id },
          ],
        },
        data: { reservedBy: user.id, reservedUntil },
      });
      if (r.count === 1) {
        pick = cand.b;
        break;
      }
      losses++;
    }

    if (!pick) {
      // Every candidate we saw got snapped up by another rep between
      // findMany and updateMany. Shouldn't happen often; if it does,
      // telling the client to retry is the right move.
      return NextResponse.json({
        ok: true,
        brand: null,
        reason:
          "Another rep reserved every candidate in the queue just now. Click Next again to refresh.",
      });
    }

    return NextResponse.json({
      ok: true,
      brand: {
        id: pick.id,
        name: pick.name,
        website: pick.website,
        linkedInProfile: pick.linkedInProfile,
        backgroundInfo: pick.backgroundInfo,
        fuzeRelevance: pick.fuzeRelevance,
        validationStatus: pick.validationStatus,
        textileCategory: pick.textileCategory,
        researchData: pick.researchData || null,
        researchDate: pick.researchDate ? pick.researchDate.toISOString() : null,
        updatedAt: pick.updatedAt.toISOString(),
        contacts: (pick.contacts || []).map((c: any) => ({
          id: c.id,
          name: c.name || [c.firstName, c.lastName].filter(Boolean).join(" "),
          email: c.email,
          personalEmail: c.personalEmail,
          linkedinUrl: c.linkedinUrl,
          jobTitle: c.jobTitle,
          seniority: c.seniority,
          emailStatus: c.emailStatus,
          outreachStatus: c.outreachStatus,
          lastContactedAt: c.lastContactedAt ? c.lastContactedAt.toISOString() : null,
        })),
      },
      reservation: {
        reservedBy: user.id,
        reservedUntil: reservedUntil.toISOString(),
        ttlMinutes: Math.round(RESERVATION_TTL_MS / 60_000),
        contested: losses,
      },
      queueDepth: candidates.length,
    });
  } catch (err: any) {
    console.error("[bd/wizard/next-brand] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to pick next brand" },
      { status: 500 },
    );
  }
}
