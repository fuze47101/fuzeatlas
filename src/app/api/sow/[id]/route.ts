// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sow = await prisma.sOW.findUnique({
      where: { id: params.id },
      include: {
        brand: { select: { id: true, name: true, pipelineStage: true, salesRepId: true } },
        milestones: { orderBy: { sortOrder: "asc" } },
        documents: true,
      },
    });

    if (!sow) return NextResponse.json({ ok: false, error: "SOW not found" }, { status: 404 });
    return NextResponse.json({ ok: true, sow });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data: any = {};

    // Simple fields
    const strFields = ["title","expectations","performanceCriteria","pricingTerms","costControls","signatory","signatoryTitle","signatoryEmail"];
    for (const f of strFields) { if (body[f] !== undefined) data[f] = body[f] || null; }
    if (body.status !== undefined) data.status = body.status;

    const sow = await prisma.sOW.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, sow });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    // Delete milestones first, then SOW
    await prisma.sOWMilestone.deleteMany({ where: { sowId: params.id } });
    await prisma.sOW.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
