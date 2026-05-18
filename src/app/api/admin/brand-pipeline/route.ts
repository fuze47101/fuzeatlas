// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/brand-pipeline
 * Consolidated brand pipeline — brands + contacts + last activity + health score
 *
 * Views:
 *   actionable (default) — verified brands with contacts OR any brand past LEAD stage
 *   enriched — brands that have at least 1 contact with email/linkedin
 *   verified — all AI-verified brands (regardless of contacts)
 *   all — everything except archived/dead/irrelevant
 *   everything — truly all brands, no filter
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const stage = url.searchParams.get("stage");
    const relevance = url.searchParams.get("relevance");
    const search = url.searchParams.get("search");
    const view = url.searchParams.get("view") || "actionable";
    // mode: "pipeline" (LEAD only) | "accounts" (post-LEAD) | undefined (both)
    const mode = url.searchParams.get("mode");

    // Build where clause
    const conditions: any[] = [];

    // Pipeline vs Accounts split:
    // "pipeline" shows only LEAD brands (prospects being worked)
    // "accounts" shows brands that have received a presentation or more
    // (PRESENTATION, BRAND_TESTING, FACTORY_ONBOARDING, FACTORY_TESTING,
    // PRODUCTION, BRAND_EXPANSION, CUSTOMER_WON)
    if (mode === "pipeline") {
      conditions.push({ pipelineStage: "LEAD" });
    } else if (mode === "accounts") {
      conditions.push({
        pipelineStage: {
          in: [
            "PRESENTATION",
            "BRAND_TESTING",
            "FACTORY_ONBOARDING",
            "FACTORY_TESTING",
            "PRODUCTION",
            "BRAND_EXPANSION",
            "CUSTOMER_WON",
          ],
        },
      });
    }

    if (view === "actionable") {
      // Brands you can actually work with: have contacts, or past LEAD, or verified with high relevance
      conditions.push({ pipelineStage: { not: "ARCHIVE" } });
      conditions.push({
        validationStatus: { notIn: ["irrelevant", "dead"] },
      });
      conditions.push({
        OR: [
          { contacts: { some: {} } },                                    // has any contacts
          { pipelineStage: { notIn: ["LEAD"] } },                        // past lead stage
          { fuzeRelevance: { in: ["high", "medium"] } },                 // high/medium fit
        ],
      });
    } else if (view === "enriched") {
      // Only brands with enriched contacts (email or linkedin)
      conditions.push({ pipelineStage: { not: "ARCHIVE" } });
      conditions.push({
        contacts: {
          some: {
            OR: [
              { email: { not: null } },
              { linkedinUrl: { not: null } },
            ],
          },
        },
      });
    } else if (view === "verified") {
      conditions.push({ validationStatus: "verified" });
      conditions.push({ pipelineStage: { not: "ARCHIVE" } });
    } else if (view === "all") {
      // Everything except dead/irrelevant/archived
      conditions.push({ pipelineStage: { not: "ARCHIVE" } });
      conditions.push({
        OR: [
          { validationStatus: { notIn: ["irrelevant", "dead"] } },
          { validationStatus: null },
        ],
      });
    }
    // view === "everything" has no conditions

    if (stage && stage !== "all") {
      conditions.push({ pipelineStage: stage });
    }

    if (relevance && relevance !== "all") {
      conditions.push({ fuzeRelevance: relevance });
    }

    if (search) {
      conditions.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { contacts: { some: { name: { contains: search, mode: "insensitive" } } } },
          { contacts: { some: { email: { contains: search, mode: "insensitive" } } } },
        ],
      });
    }

    const where: any = conditions.length > 0 ? { AND: conditions } : {};

    // Fetch brands — no arbitrary limit
    const brands = await prisma.brand.findMany({
      where,
      select: {
        id: true,
        name: true,
        pipelineStage: true,
        customerType: true,
        website: true,
        linkedInProfile: true,
        validationStatus: true,
        fuzeRelevance: true,
        textileCategory: true,
        companyStatus: true,
        salesRep: { select: { id: true, name: true } },
        contacts: {
          select: {
            id: true,
            name: true,
            jobTitle: true,
            email: true,
            phone: true,
            linkedinUrl: true,
            outreachStatus: true,
            lastContactedAt: true,
            outreachCount: true,
            decisionMaker: true,
            emailStatus: true,
            outreachChecks: {
              select: {
                type: true,
                userId: true,
                sentAt: true,
                user: { select: { name: true } },
              },
            },
          },
          orderBy: { decisionMaker: "desc" },
          take: 5,
        },
        notes: {
          select: { id: true, content: true, noteType: true, date: true, contactName: true },
          orderBy: { date: "desc" },
          take: 1,
        },
        _count: {
          select: {
            contacts: true,
            notes: true,
            submissions: true,
            fabrics: true,
            factories: true,
            sows: true,
            fuzeOrders: true,
          },
        },
        engagement: {
          select: { overallScore: true, engagementTrend: true },
        },
        // MB-4 — predicted pipeline value (recompute cron stamps these
        // nightly). Surfaced as a column + sort option on the page.
        predictedValueUSD: true,
        predictedValueComputedAt: true,
        predictedValueFactors: true,
        createdAt: true,
        dateOfInitialContact: true,
      },
      orderBy: [
        { name: "asc" },
      ],
    });

    // Build per-stage summary (across ALL returned results)
    // BRAND_EXPANSION (Re-Connect) now sits right after PRESENTATION in
    // the workflow — stalled brands needing re-engagement before
    // re-entering BRAND_TESTING.
    const stageSummary: Record<string, number> = {};
    const STAGES = ["LEAD", "PRESENTATION", "BRAND_EXPANSION", "BRAND_TESTING", "FACTORY_ONBOARDING", "FACTORY_TESTING", "PRODUCTION", "CUSTOMER_WON", "ARCHIVE"];
    for (const s of STAGES) stageSummary[s] = 0;

    // Build enriched brand list and sort: brands with contacts first, then by stage priority.
    // Re-Connect dropped from priority 1 (was second-highest under the
    // old "Expansion" meaning) to priority 6 — re-connect brands are
    // stalled relationships needing reach-out, less actionable than
    // active customers but more actionable than fresh leads.
    const STAGE_ORDER: Record<string, number> = {
      PRODUCTION: 0, CUSTOMER_WON: 1,
      FACTORY_TESTING: 2, FACTORY_ONBOARDING: 3, BRAND_TESTING: 4,
      PRESENTATION: 5, BRAND_EXPANSION: 6, LEAD: 7, ARCHIVE: 8,
    };

    const pipeline = brands.map((b) => {
      const primaryContact = b.contacts[0] || null;
      const lastNote = b.notes[0] || null;
      const daysSinceActivity = lastNote?.date
        ? Math.floor((Date.now() - new Date(lastNote.date).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const hasEnrichedContacts = b.contacts.some((c: any) => c.email || c.linkedinUrl);

      stageSummary[b.pipelineStage] = (stageSummary[b.pipelineStage] || 0) + 1;

      return {
        id: b.id,
        name: b.name,
        stage: b.pipelineStage,
        stageOrder: STAGE_ORDER[b.pipelineStage] ?? 9,
        customerType: b.customerType,
        website: b.website,
        linkedIn: b.linkedInProfile,
        validationStatus: b.validationStatus,
        fuzeRelevance: b.fuzeRelevance,
        textileCategory: b.textileCategory,
        salesRep: b.salesRep?.name || null,
        salesRepId: b.salesRep?.id || null,
        engagementScore: b.engagement?.overallScore || null,
        engagementTrend: b.engagement?.engagementTrend || null,
        primaryContact,
        contacts: b.contacts,
        contactCount: b._count.contacts,
        hasEnrichedContacts,
        lastNote,
        daysSinceActivity,
        counts: b._count,
        createdAt: b.createdAt,
        dateOfInitialContact: b.dateOfInitialContact,
        predictedValueUSD: b.predictedValueUSD ?? null,
        predictedValueComputedAt: b.predictedValueComputedAt ?? null,
        predictedValueFactors: b.predictedValueFactors ?? null,
      };
    });

    // Sort: relevance first (high→medium→low→none), then enriched, then stage, then A-Z
    const RELEVANCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
    pipeline.sort((a, b) => {
      // Relevance rating first — the brands you rated highest show up top
      const relA = RELEVANCE_ORDER[a.fuzeRelevance || "none"] ?? 3;
      const relB = RELEVANCE_ORDER[b.fuzeRelevance || "none"] ?? 3;
      if (relA !== relB) return relA - relB;
      // Then enriched contacts (has email/linkedin)
      if (a.hasEnrichedContacts && !b.hasEnrichedContacts) return -1;
      if (!a.hasEnrichedContacts && b.hasEnrichedContacts) return 1;
      // Then by stage priority (production > testing > lead)
      if (a.stageOrder !== b.stageOrder) return a.stageOrder - b.stageOrder;
      // Then alphabetical
      return a.name.localeCompare(b.name);
    });

    // Overall stats
    const totalBrands = pipeline.length;
    const enriched = pipeline.filter((b) => b.hasEnrichedContacts).length;
    const withContacts = pipeline.filter((b) => b.contactCount > 0).length;
    const contacted = pipeline.filter((b) => b.contacts.some((c: any) => c.outreachStatus && c.outreachStatus !== "not_contacted")).length;
    const verified = pipeline.filter((b) => b.validationStatus === "verified").length;
    const stale = pipeline.filter((b) => b.daysSinceActivity !== null && b.daysSinceActivity > 30).length;
    const noActivity = pipeline.filter((b) => b.daysSinceActivity === null).length;

    return NextResponse.json({
      ok: true,
      pipeline,
      stageSummary,
      currentUserId: user.id,
      stats: {
        totalBrands,
        enriched,
        withContacts,
        contacted,
        verified,
        stale,
        noActivity,
      },
    });
  } catch (e: any) {
    console.error("Brand pipeline error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
