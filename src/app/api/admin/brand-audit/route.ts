import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 min — scanning 1600+ brands

/**
 * GET  /api/admin/brand-audit
 *   → Full data quality audit of all brands
 *   → Returns scored + categorized brands ready for cleanup
 *
 * POST /api/admin/brand-audit
 *   → Execute cleanup actions (archive/delete flagged brands)
 *   body: { action: "archive" | "delete", brandIds: string[] }
 */

// ──────────────────────────────────────────────
// SCORING WEIGHTS
// ──────────────────────────────────────────────
const WEIGHTS = {
  // Data completeness (max 30 pts)
  hasWebsite: 6,
  hasLinkedIn: 4,
  hasBackgroundInfo: 3,
  hasCustomerType: 2,
  hasResearchData: 5,
  multiAiValidated: 5, // researchData.validationCount >= 2
  hasSalesRep: 3,
  hasDateOfContact: 2,

  // Contacts (max 20 pts)
  hasAnyContact: 8,
  hasEnrichedContact: 6, // contact with linkedinUrl or jobTitle
  hasVerifiedEmail: 6, // contact with emailStatus = "verified"

  // Activity signals (max 50 pts) — these prove the brand is REAL
  hasSubmissions: 10,
  hasFabrics: 8,
  hasTestRequests: 10,
  hasProjects: 5,
  hasSOWs: 8,
  hasInvoices: 10, // money changed hands = definitely real
  hasOrders: 10,
  hasMeetings: 5,
  hasNotes: 4,
  hasSampleTrials: 5,

  // Pipeline progression (max 15 pts)
  beyondLead: 10, // moved past LEAD stage
  hasEngagement: 5,

  // Penalties
  noNameOrGeneric: -20,
  duplicateSuspect: -10,
};

// Pipeline stages that indicate real progression
const ACTIVE_STAGES = [
  "PRESENTATION",
  "BRAND_TESTING",
  "FACTORY_ONBOARDING",
  "FACTORY_TESTING",
  "PRODUCTION",
  "BRAND_EXPANSION",
  "CUSTOMER_WON",
];

// ──────────────────────────────────────────────
// GET — Run the audit
// ──────────────────────────────────────────────
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const includeDetails = url.searchParams.get("details") === "true";

  // Pull ALL brands with count-based activity signals
  const brands = await prisma.brand.findMany({
    select: {
      id: true,
      name: true,
      knackId: true,
      pipelineStage: true,
      customerType: true,
      leadReferralSource: true,
      dateOfInitialContact: true,
      website: true,
      linkedInProfile: true,
      backgroundInfo: true,
      researchData: true,
      researchDate: true,
      salesRepId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          contacts: true,
          factories: true,
          submissions: true,
          fabrics: true,
          projects: true,
          products: true,
          sows: true,
          invoices: true,
          notes: true,
          testRequests: true,
          sampleTrials: true,
          fuzeConsumptions: true,
          fuzeOrders: true,
          meetings: true,
          sourceRecords: true,
          orderAllocations: true,
        },
      },
      // Pull contacts to check enrichment quality
      contacts: {
        select: {
          id: true,
          email: true,
          linkedinUrl: true,
          jobTitle: true,
          emailStatus: true,
          enrichmentSource: true,
          apolloId: true,
        },
      },
      engagement: {
        select: {
          overallScore: true,
          engagementTrend: true,
          daysSinceLastContact: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // ── Score each brand ──
  const scored = brands.map((b) => {
    let score = 0;
    const flags: string[] = [];
    const positives: string[] = [];

    // --- Data Completeness ---
    if (b.website) { score += WEIGHTS.hasWebsite; positives.push("has_website"); }
    if (b.linkedInProfile) { score += WEIGHTS.hasLinkedIn; positives.push("has_linkedin"); }
    if (b.backgroundInfo && b.backgroundInfo.length > 20) { score += WEIGHTS.hasBackgroundInfo; positives.push("has_background"); }
    if (b.customerType) { score += WEIGHTS.hasCustomerType; positives.push("has_type"); }
    if (b.salesRepId) { score += WEIGHTS.hasSalesRep; positives.push("has_sales_rep"); }
    if (b.dateOfInitialContact) { score += WEIGHTS.hasDateOfContact; positives.push("has_contact_date"); }

    // Research data quality
    const rd = b.researchData as Record<string, any> | null;
    if (rd && Object.keys(rd).length > 0) {
      score += WEIGHTS.hasResearchData;
      positives.push("has_research");
      if (rd.validationCount && rd.validationCount >= 2) {
        score += WEIGHTS.multiAiValidated;
        positives.push(`multi_ai_validated(${rd.validationCount})`);
      }
    }

    // --- Contacts ---
    if (b._count.contacts > 0) {
      score += WEIGHTS.hasAnyContact;
      positives.push(`contacts(${b._count.contacts})`);
    }
    const hasEnriched = b.contacts.some((c) => c.linkedinUrl || c.jobTitle);
    if (hasEnriched) { score += WEIGHTS.hasEnrichedContact; positives.push("enriched_contact"); }
    const hasVerified = b.contacts.some((c) => c.emailStatus === "verified");
    if (hasVerified) { score += WEIGHTS.hasVerifiedEmail; positives.push("verified_email"); }

    // --- Activity Signals ---
    if (b._count.submissions > 0) { score += WEIGHTS.hasSubmissions; positives.push(`submissions(${b._count.submissions})`); }
    if (b._count.fabrics > 0) { score += WEIGHTS.hasFabrics; positives.push(`fabrics(${b._count.fabrics})`); }
    if (b._count.testRequests > 0) { score += WEIGHTS.hasTestRequests; positives.push(`tests(${b._count.testRequests})`); }
    if (b._count.projects > 0) { score += WEIGHTS.hasProjects; positives.push(`projects(${b._count.projects})`); }
    if (b._count.sows > 0) { score += WEIGHTS.hasSOWs; positives.push(`sows(${b._count.sows})`); }
    if (b._count.invoices > 0) { score += WEIGHTS.hasInvoices; positives.push(`invoices(${b._count.invoices})`); }
    if (b._count.fuzeOrders > 0) { score += WEIGHTS.hasOrders; positives.push(`orders(${b._count.fuzeOrders})`); }
    if (b._count.meetings > 0) { score += WEIGHTS.hasMeetings; positives.push(`meetings(${b._count.meetings})`); }
    if (b._count.notes > 0) { score += WEIGHTS.hasNotes; positives.push(`notes(${b._count.notes})`); }
    if (b._count.sampleTrials > 0) { score += WEIGHTS.hasSampleTrials; positives.push(`trials(${b._count.sampleTrials})`); }

    // --- Pipeline Progression ---
    if (ACTIVE_STAGES.includes(b.pipelineStage)) {
      score += WEIGHTS.beyondLead;
      positives.push(`stage(${b.pipelineStage})`);
    }
    if (b.engagement) {
      score += WEIGHTS.hasEngagement;
      positives.push(`engagement(${b.engagement.overallScore})`);
    }

    // --- Penalties ---
    const nameLower = b.name.toLowerCase().trim();
    const genericNames = ["test", "unknown", "sample", "demo", "example", "temp", "n/a", "none", "tbd", "placeholder"];
    if (genericNames.some((g) => nameLower === g || nameLower.startsWith(g + " "))) {
      score += WEIGHTS.noNameOrGeneric;
      flags.push("generic_name");
    }
    if (b.name.length < 2) {
      score += WEIGHTS.noNameOrGeneric;
      flags.push("name_too_short");
    }

    // --- Determine source ---
    let source: "legacy_knack" | "ai_discovery" | "manual" | "unknown" = "unknown";
    if (b.knackId) source = "legacy_knack";
    else if (rd?.discoveredBy || rd?.category) source = "ai_discovery";
    else if (b._count.sourceRecords > 0) source = "legacy_knack";
    else source = "manual";

    // --- Classification ---
    const totalActivity =
      b._count.submissions +
      b._count.fabrics +
      b._count.testRequests +
      b._count.sows +
      b._count.invoices +
      b._count.fuzeOrders +
      b._count.sampleTrials +
      b._count.meetings;

    let tier: "A_active_customer" | "B_qualified_lead" | "C_needs_validation" | "D_low_quality" | "F_delete_candidate";
    let recommendation: "keep" | "validate" | "archive" | "delete";

    if (totalActivity > 0 || b.pipelineStage === "CUSTOMER_WON" || b.pipelineStage === "PRODUCTION") {
      tier = "A_active_customer";
      recommendation = "keep";
    } else if (score >= 35) {
      tier = "B_qualified_lead";
      recommendation = "keep";
    } else if (score >= 15) {
      tier = "C_needs_validation";
      recommendation = "validate";
    } else if (score >= 5) {
      tier = "D_low_quality";
      recommendation = "archive";
    } else {
      tier = "F_delete_candidate";
      recommendation = "delete";
    }

    const result: Record<string, any> = {
      id: b.id,
      name: b.name,
      score,
      tier,
      recommendation,
      source,
      pipelineStage: b.pipelineStage,
      totalActivity,
      contactCount: b._count.contacts,
      flags,
      createdAt: b.createdAt,
    };

    if (includeDetails) {
      result.positives = positives;
      result.website = b.website;
      result.linkedInProfile = b.linkedInProfile;
      result.customerType = b.customerType;
      result.researchDate = b.researchDate;
      result.activityBreakdown = {
        submissions: b._count.submissions,
        fabrics: b._count.fabrics,
        testRequests: b._count.testRequests,
        projects: b._count.projects,
        sows: b._count.sows,
        invoices: b._count.invoices,
        orders: b._count.fuzeOrders,
        meetings: b._count.meetings,
        notes: b._count.notes,
        trials: b._count.sampleTrials,
      };
      result.contacts = b.contacts.map((c) => ({
        email: c.email,
        linkedinUrl: c.linkedinUrl,
        jobTitle: c.jobTitle,
        emailStatus: c.emailStatus,
        source: c.enrichmentSource,
      }));
      result.engagement = b.engagement;
    }

    return result;
  });

  // ── Sort by score descending ──
  scored.sort((a, b) => b.score - a.score);

  // ── Summary stats ──
  const summary = {
    total: scored.length,
    byTier: {
      A_active_customer: scored.filter((s) => s.tier === "A_active_customer").length,
      B_qualified_lead: scored.filter((s) => s.tier === "B_qualified_lead").length,
      C_needs_validation: scored.filter((s) => s.tier === "C_needs_validation").length,
      D_low_quality: scored.filter((s) => s.tier === "D_low_quality").length,
      F_delete_candidate: scored.filter((s) => s.tier === "F_delete_candidate").length,
    },
    bySource: {
      legacy_knack: scored.filter((s) => s.source === "legacy_knack").length,
      ai_discovery: scored.filter((s) => s.source === "ai_discovery").length,
      manual: scored.filter((s) => s.source === "manual").length,
      unknown: scored.filter((s) => s.source === "unknown").length,
    },
    byRecommendation: {
      keep: scored.filter((s) => s.recommendation === "keep").length,
      validate: scored.filter((s) => s.recommendation === "validate").length,
      archive: scored.filter((s) => s.recommendation === "archive").length,
      delete: scored.filter((s) => s.recommendation === "delete").length,
    },
    byPipelineStage: {} as Record<string, number>,
    scoreDistribution: {
      "80+": scored.filter((s) => s.score >= 80).length,
      "60-79": scored.filter((s) => s.score >= 60 && s.score < 80).length,
      "40-59": scored.filter((s) => s.score >= 40 && s.score < 60).length,
      "20-39": scored.filter((s) => s.score >= 20 && s.score < 40).length,
      "1-19": scored.filter((s) => s.score >= 1 && s.score < 20).length,
      "0_or_below": scored.filter((s) => s.score <= 0).length,
    },
    avgScore: Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length),
  };

  // Pipeline stage breakdown
  for (const b of scored) {
    const stage = b.pipelineStage;
    summary.byPipelineStage[stage] = (summary.byPipelineStage[stage] || 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    summary,
    brands: scored,
    scoringWeights: WEIGHTS,
    tierDefinitions: {
      A_active_customer: "Has real activity (submissions, tests, orders, invoices) or is in Production/Customer Won",
      B_qualified_lead: "Score >= 35 — good data, enriched contacts, research data, but no activity yet",
      C_needs_validation: "Score 15-34 — some data but unverified. Needs Phase 2 web validation",
      D_low_quality: "Score 5-14 — minimal data, likely just a name. Archive candidate",
      F_delete_candidate: "Score <= 4 — no useful data at all. Safe to delete",
    },
  });
}

// ──────────────────────────────────────────────
// POST — Execute cleanup actions
// ──────────────────────────────────────────────
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { action, brandIds } = body as {
    action: "archive" | "delete";
    brandIds: string[];
  };

  if (!action || !brandIds?.length) {
    return NextResponse.json(
      { ok: false, error: "Required: action (archive|delete), brandIds[]" },
      { status: 400 }
    );
  }

  if (action === "archive") {
    const result = await prisma.brand.updateMany({
      where: { id: { in: brandIds } },
      data: { pipelineStage: "ARCHIVE" },
    });
    return NextResponse.json({
      ok: true,
      action: "archive",
      count: result.count,
      message: `Archived ${result.count} brands`,
    });
  }

  if (action === "delete") {
    // Safety: only delete brands with ZERO activity
    const safeBrands = await prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            submissions: true,
            fabrics: true,
            testRequests: true,
            sows: true,
            invoices: true,
            fuzeOrders: true,
            fuzeConsumptions: true,
          },
        },
      },
    });

    const safeToDelete: string[] = [];
    const blocked: { id: string; name: string; reason: string }[] = [];

    for (const b of safeBrands) {
      const activity =
        b._count.submissions +
        b._count.fabrics +
        b._count.testRequests +
        b._count.sows +
        b._count.invoices +
        b._count.fuzeOrders +
        b._count.fuzeConsumptions;

      if (activity > 0) {
        blocked.push({ id: b.id, name: b.name, reason: `Has ${activity} activity records — archive instead` });
      } else {
        safeToDelete.push(b.id);
      }
    }

    // Delete contacts first (FK constraint), then brands
    if (safeToDelete.length > 0) {
      await prisma.contact.deleteMany({
        where: { brandId: { in: safeToDelete } },
      });
      await prisma.note.deleteMany({
        where: { brandId: { in: safeToDelete } },
      });
      await prisma.brandEngagement.deleteMany({
        where: { brandId: { in: safeToDelete } },
      });
      await prisma.sourceRecord.deleteMany({
        where: { brandId: { in: safeToDelete } },
      });
      // Delete the brands
      const result = await prisma.brand.deleteMany({
        where: { id: { in: safeToDelete } },
      });

      return NextResponse.json({
        ok: true,
        action: "delete",
        deleted: result.count,
        blocked,
        message: `Deleted ${result.count} brands. ${blocked.length} blocked (have activity).`,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "delete",
      deleted: 0,
      blocked,
      message: `All ${blocked.length} brands have activity — cannot delete. Use archive instead.`,
    });
  }

  return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
}
