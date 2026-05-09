// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

const prisma = new PrismaClient();

// BD-eligible roles that should auto-claim a brand on manual creation.
// Mirrors the role gate in /api/admin/bd/wizard/send (#101).
// Discovery / bulk-import paths (e.g. /api/brands/discover) intentionally
// create unclaimed leads and don't go through this filter.
const AUTO_CLAIM_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
]);

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      include: {
        salesRep: { select: { id: true, name: true } },
        _count: {
          select: { fabrics: true, submissions: true, factories: true, contacts: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const stages = [
      "LEAD","PRESENTATION","BRAND_TESTING","FACTORY_ONBOARDING",
      "FACTORY_TESTING","PRODUCTION","BRAND_EXPANSION","ARCHIVE","CUSTOMER_WON",
    ];

    const grouped: Record<string, any[]> = {};
    for (const s of stages) grouped[s] = [];

    for (const b of brands) {
      const stage = b.pipelineStage || "LEAD";
      if (!grouped[stage]) grouped[stage] = [];
      grouped[stage].push({
        id: b.id,
        name: b.name,
        pipelineStage: stage,
        salesRep: b.salesRep?.name || b.salesRepId,
        customerType: b.customerType,
        fabricCount: b._count.fabrics,
        submissionCount: b._count.submissions,
        factoryCount: b._count.factories,
        contactCount: b._count.contacts,
        createdAt: b.createdAt,
      });
    }

    // Return both grouped (for pipeline view) and flat brands array (for dropdowns)
    const brandsFlat = brands.map((b) => ({
      id: b.id,
      name: b.name,
      pipelineStage: b.pipelineStage || "LEAD",
      customerType: b.customerType,
      website: b.website,
      backgroundInfo: b.backgroundInfo,
      validationStatus: (b as any).validationStatus || null,
      validationReason: (b as any).validationReason || null,
      validationDate: (b as any).validationDate || null,
      fuzeRelevance: (b as any).fuzeRelevance || null,
      textileCategory: (b as any).textileCategory || null,
      companyStatus: (b as any).companyStatus || null,
      createdAt: b.createdAt,
    }));

    return NextResponse.json({ ok: true, grouped, brands: brandsFlat, total: brands.length });
  } catch (e: any) {
    console.error("Brands API error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getCurrentUser().catch(() => null);

    const body = await req.json();
    const {
      name, pipelineStage, customerType, leadReferralSource,
      website, linkedInProfile, backgroundInfo, projectType,
      projectDescription, forecast, deliverables, salesRepId,
      dateOfInitialContact, presentationDate,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: "Brand name is required" }, { status: 400 });
    }

    // Bug A fix (Scott ticket cmot3i3pk, May 2026): when a BD-eligible
    // user manually adds a brand, default salesRepId to that user so
    // they own it from the moment of creation. The wizard's send step
    // already auto-claims (see #101), but until they hit Send the brand
    // sat unclaimed and other reps could grab it. Caller can still pass
    // an explicit salesRepId (e.g. an admin assigning a rep) — that
    // wins. Bulk-import / discovery flows skip this path entirely.
    let resolvedSalesRepId: string | null = salesRepId || null;
    if (!resolvedSalesRepId && sessionUser && AUTO_CLAIM_ROLES.has(sessionUser.role)) {
      resolvedSalesRepId = sessionUser.id;
    }

    const now = new Date();
    const brand = await prisma.brand.create({
      data: {
        name: name.trim(),
        pipelineStage: pipelineStage || "LEAD",
        customerType: customerType || null,
        leadReferralSource: leadReferralSource || null,
        website: website || null,
        linkedInProfile: linkedInProfile || null,
        backgroundInfo: backgroundInfo || null,
        projectType: projectType || null,
        projectDescription: projectDescription || null,
        forecast: forecast || null,
        deliverables: deliverables || null,
        salesRepId: resolvedSalesRepId,
        // Stamp lastActivityAt so the 90-day inactivity cron doesn't
        // immediately bounce a freshly-claimed brand. Aligns with the
        // wizard's send step which sets this on first outbound.
        lastActivityAt: resolvedSalesRepId ? now : null,
        dateOfInitialContact: dateOfInitialContact ? new Date(dateOfInitialContact) : null,
        presentationDate: presentationDate ? new Date(presentationDate) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      brand,
      autoClaimed: !!(resolvedSalesRepId && resolvedSalesRepId !== salesRepId),
    });
  } catch (e: any) {
    console.error("Brand create error:", e);
    if (e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "A brand with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
