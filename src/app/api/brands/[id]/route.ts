// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const brand = await prisma.brand.findUnique({
      where: { id: params.id },
      include: {
        salesRep: { select: { id: true, name: true, email: true } },
        contacts: true,
        factories: { include: { factory: { select: { id: true, name: true, country: true } } } },
        fabrics: { select: { id: true, fuzeNumber: true, construction: true, color: true, weightGsm: true }, take: 20 },
        submissions: { select: { id: true, fuzeFabricNumber: true, status: true, testStatus: true, createdAt: true }, take: 20, orderBy: { createdAt: "desc" } },
        sows: { select: { id: true, title: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        notes: { select: { id: true, content: true, noteType: true, date: true, contactName: true }, orderBy: { date: "desc" }, take: 20 },
        _count: { select: { fabrics: true, submissions: true, factories: true, contacts: true, sows: true, notes: true } },
      },
    });

    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, brand });
  } catch (e: any) {
    console.error("Brand detail error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const {
      name, pipelineStage, customerType, leadReferralSource,
      website, linkedInProfile, backgroundInfo, projectType,
      projectDescription, forecast, deliverables, salesRepId,
      dateOfInitialContact, presentationDate,
    } = body;

    const brand = await prisma.brand.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(pipelineStage !== undefined && { pipelineStage }),
        ...(customerType !== undefined && { customerType: customerType || null }),
        ...(leadReferralSource !== undefined && { leadReferralSource: leadReferralSource || null }),
        ...(website !== undefined && { website: website || null }),
        ...(linkedInProfile !== undefined && { linkedInProfile: linkedInProfile || null }),
        ...(backgroundInfo !== undefined && { backgroundInfo: backgroundInfo || null }),
        ...(projectType !== undefined && { projectType: projectType || null }),
        ...(projectDescription !== undefined && { projectDescription: projectDescription || null }),
        ...(forecast !== undefined && { forecast: forecast || null }),
        ...(deliverables !== undefined && { deliverables: deliverables || null }),
        ...(salesRepId !== undefined && { salesRepId: salesRepId || null }),
        ...(dateOfInitialContact !== undefined && { dateOfInitialContact: dateOfInitialContact ? new Date(dateOfInitialContact) : null }),
        ...(presentationDate !== undefined && { presentationDate: presentationDate ? new Date(presentationDate) : null }),
      },
    });

    return NextResponse.json({ ok: true, brand });
  } catch (e: any) {
    console.error("Brand update error:", e);
    if (e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "A brand with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.brand.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Brand delete error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
