// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/brand-pipeline
 * Consolidated brand pipeline — brands + contacts + last activity + health score
 * Replaces separate Brands, Lead Management, and Brand Health queries
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
    const view = url.searchParams.get("view") || "pipeline"; // pipeline | validated | all

    // Build where clause
    const where: any = {};
    const conditions: any[] = [];

    // View filter — pipeline excludes junk; validated = verified only
    if (view === "pipeline") {
      conditions.push({ pipelineStage: { not: "ARCHIVE" } });
      conditions.push({
        OR: [
          { validationStatus: "verified" },
          { validationStatus: null },        // unvalidated = show
          { validationStatus: "pending" },    // in-progress = show
        ],
      });
    } else if (view === "validated") {
      conditions.push({ validationStatus: "verified" });
      conditions.push({ pipelineStage: { not: "ARCHIVE" } });
    }
    // view === "all" has no conditions

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
        ],
      });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    // Fetch brands with contacts, last note, and counts
    const brands = await prisma.brand.findMany({
      where,
      select: {
        id: true,
        name: true,
        pipelineStage: true,
        customerType: true,
        website: true,
        linkedInProfile: true,
        backgroundInfo: true,
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
        // Health/engagement data
        engagement: {
          select: { overallScore: true, engagementTrend: true },
        },
        createdAt: true,
        dateOfInitialContact: true,
      },
      orderBy: [
        { pipelineStage: "asc" },
        { name: "asc" },
      ],
      take: 500,
    });

    // Build per-stage summary
    const stageSummary: Record<string, number> = {};
    const STAGES = ["LEAD", "PRESENTATION", "BRAND_TESTING", "FACTORY_ONBOARDING", "FACTORY_TESTING", "PRODUCTION", "BRAND_EXPANSION", "CUSTOMER_WON", "ARCHIVE"];
    for (const s of STAGES) stageSummary[s] = 0;

    for (const b of brands) {
      stageSummary[b.pipelineStage] = (stageSummary[b.pipelineStage] || 0) + 1;
    }

    // Build enriched brand list
    const pipeline = brands.map((b) => {
      const primaryContact = b.contacts[0] || null;
      const lastNote = b.notes[0] || null;
      const daysSinceActivity = lastNote?.date
        ? Math.floor((Date.now() - new Date(lastNote.date).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: b.id,
        name: b.name,
        stage: b.pipelineStage,
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
        lastNote,
        daysSinceActivity,
        counts: b._count,
        createdAt: b.createdAt,
        dateOfInitialContact: b.dateOfInitialContact,
      };
    });

    // Overall stats
    const totalBrands = pipeline.length;
    const withContacts = pipeline.filter((b) => b.contactCount > 0).length;
    const contacted = pipeline.filter((b) => b.contacts.some((c: any) => c.outreachStatus && c.outreachStatus !== "not_contacted")).length;
    const stale = pipeline.filter((b) => b.daysSinceActivity !== null && b.daysSinceActivity > 30).length;
    const noActivity = pipeline.filter((b) => b.daysSinceActivity === null).length;

    return NextResponse.json({
      ok: true,
      pipeline,
      stageSummary,
      stats: {
        totalBrands,
        withContacts,
        contacted,
        stale,
        noActivity,
      },
    });
  } catch (e: any) {
    console.error("Brand pipeline error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
