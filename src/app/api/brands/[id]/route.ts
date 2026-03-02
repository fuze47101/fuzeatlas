// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
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

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
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

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const id = params.id;

    // Admin code check
    const url = new URL(req.url);
    const adminCode = url.searchParams.get("code");
    if (adminCode !== "FUZE2026") {
      return NextResponse.json(
        { ok: false, error: "Invalid admin code" },
        { status: 403 }
      );
    }

    // Check for linked records — block delete if brand is in active use
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { fabrics: true, submissions: true, factories: true, sows: true },
        },
      },
    });

    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    const c = brand._count;
    if (c.fabrics > 0 || c.submissions > 0 || c.factories > 0 || c.sows > 0) {
      const linked = [
        c.fabrics > 0 && `${c.fabrics} fabric(s)`,
        c.submissions > 0 && `${c.submissions} submission(s)`,
        c.factories > 0 && `${c.factories} factory link(s)`,
        c.sows > 0 && `${c.sows} SOW(s)`,
      ].filter(Boolean).join(", ");
      return NextResponse.json(
        { ok: false, error: `Cannot delete — brand has ${linked}. Remove linked records first.` },
        { status: 409 }
      );
    }

    // Safe to delete — clean up lightweight records first
    await prisma.contact.deleteMany({ where: { brandId: id } });
    await prisma.note.deleteMany({ where: { brandId: id } });
    await prisma.project.deleteMany({ where: { brandId: id } });
    await prisma.brandFactory.deleteMany({ where: { brandId: id } });
    await prisma.sourceRecord.updateMany({ where: { brandId: id }, data: { brandId: null } });

    // Delete the brand
    await prisma.brand.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Brand delete error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
