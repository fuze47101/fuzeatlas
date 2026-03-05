// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/labs/[id] ── single lab with services & documents ── */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lab = await prisma.lab.findUnique({
      where: { id },
      include: {
        services: { orderBy: { testType: "asc" } },
        documents: {
          where: { kind: "LAB_FORM" },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { testRuns: true } },
      },
    });
    if (!lab) {
      return NextResponse.json({ ok: false, error: "Lab not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, lab });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── PUT /api/labs/[id] ── update lab details, services, documents ── */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name, address, city, state, country, region,
      website, email, phone, accreditations,
      icpApproved, abApproved, fungalApproved, odorApproved, uvApproved,
      notes, customerNumber, services,
    } = body;

    // Update core lab info
    const lab = await prisma.lab.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address || null }),
        ...(city !== undefined && { city: city || null }),
        ...(state !== undefined && { state: state || null }),
        ...(country !== undefined && { country: country || null }),
        ...(region !== undefined && { region: region || null }),
        ...(website !== undefined && { website: website || null }),
        ...(email !== undefined && { email: email || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(accreditations !== undefined && { accreditations: accreditations || null }),
        ...(customerNumber !== undefined && { customerNumber: customerNumber || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(icpApproved !== undefined && { icpApproved: Boolean(icpApproved) }),
        ...(abApproved !== undefined && { abApproved: Boolean(abApproved) }),
        ...(fungalApproved !== undefined && { fungalApproved: Boolean(fungalApproved) }),
        ...(odorApproved !== undefined && { odorApproved: Boolean(odorApproved) }),
        ...(uvApproved !== undefined && { uvApproved: Boolean(uvApproved) }),
      },
    });

    // Upsert services if provided
    if (Array.isArray(services)) {
      // Delete removed services
      const existingIds = services.filter((s: any) => s.id).map((s: any) => s.id);
      await prisma.labService.deleteMany({
        where: { labId: id, id: { notIn: existingIds } },
      });

      for (const svc of services) {
        if (svc.id) {
          // Update existing
          await prisma.labService.update({
            where: { id: svc.id },
            data: {
              testType: svc.testType,
              testMethod: svc.testMethod || null,
              description: svc.description || null,
              priceUSD: svc.priceUSD != null ? Number(svc.priceUSD) : null,
              listPriceUSD: svc.listPriceUSD != null ? Number(svc.listPriceUSD) : null,
              turnaroundDays: svc.turnaroundDays != null ? Number(svc.turnaroundDays) : null,
              rushPriceUSD: svc.rushPriceUSD != null ? Number(svc.rushPriceUSD) : null,
              rushDays: svc.rushDays != null ? Number(svc.rushDays) : null,
              notes: svc.notes || null,
            },
          });
        } else {
          // Create new
          await prisma.labService.create({
            data: {
              labId: id,
              testType: svc.testType,
              testMethod: svc.testMethod || null,
              description: svc.description || null,
              priceUSD: svc.priceUSD != null ? Number(svc.priceUSD) : null,
              listPriceUSD: svc.listPriceUSD != null ? Number(svc.listPriceUSD) : null,
              turnaroundDays: svc.turnaroundDays != null ? Number(svc.turnaroundDays) : null,
              rushPriceUSD: svc.rushPriceUSD != null ? Number(svc.rushPriceUSD) : null,
              rushDays: svc.rushDays != null ? Number(svc.rushDays) : null,
              notes: svc.notes || null,
            },
          });
        }
      }
    }

    // Re-fetch with relations
    const updated = await prisma.lab.findUnique({
      where: { id },
      include: {
        services: { orderBy: { testType: "asc" } },
        documents: {
          where: { kind: "LAB_FORM" },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { testRuns: true } },
      },
    });

    return NextResponse.json({ ok: true, lab: updated });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "A lab with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── DELETE /api/labs/[id] ── soft delete (deactivate) ── */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.lab.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
