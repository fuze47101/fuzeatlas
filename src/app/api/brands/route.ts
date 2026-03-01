// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

    return NextResponse.json({ ok: true, grouped, total: brands.length });
  } catch (e: any) {
    console.error("Brands API error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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
        salesRepId: salesRepId || null,
        dateOfInitialContact: dateOfInitialContact ? new Date(dateOfInitialContact) : null,
        presentationDate: presentationDate ? new Date(presentationDate) : null,
      },
    });

    return NextResponse.json({ ok: true, brand });
  } catch (e: any) {
    console.error("Brand create error:", e);
    if (e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "A brand with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
