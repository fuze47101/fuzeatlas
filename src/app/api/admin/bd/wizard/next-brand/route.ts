// @ts-nocheck
/**
 * GET /api/admin/bd/wizard/next-brand
 *
 * Returns the next highest-confidence unassigned LEAD the rep should work on
 * — the entry point to the BD Wizard's "next brand" auto-pick. Andrew's
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
 * Optional query params:
 *   skip=<brandId>   — skip this brand (use when rep says "next")
 *   preview=1        — don't reserve/claim the brand, just return it
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const RELEVANCE_ORDER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

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
  if (b.updatedAt) score += Math.min(30, Math.floor((Date.now() - new Date(b.updatedAt).getTime()) / (1000 * 60 * 60 * 24) * -1) + 30);
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

    // Pull a small candidate pool and rank in memory. We over-fetch
    // (up to 25) so the in-memory scoring has some variety to work with;
    // Prisma's ordering can't express our composite rank cleanly.
    const candidates = await prisma.brand.findMany({
      where: {
        pipelineStage: "LEAD",
        salesRepId: null,
        // Skip brands we've explicitly marked as not worth chasing
        validationStatus: { notIn: ["irrelevant", "dead", "duplicate"] },
        // Skip brands with no contacts at all — the wizard has nothing to do
        contacts: { some: {} },
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

    // Rank and pick the top one
    const ranked = candidates
      .map((b: any) => ({ b, score: scoreBrand(b) }))
      .sort((a, b) => b.score - a.score);

    const pick = ranked[0].b;

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
      rankScore: ranked[0].score,
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
