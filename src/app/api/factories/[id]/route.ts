// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const factory = await prisma.factory.findUnique({
      where: { id: params.id },
      include: {
        salesRep: { select: { id: true, name: true } },
        contacts: true,
        brands: { include: { brand: { select: { id: true, name: true, pipelineStage: true } } } },
        fabrics: { select: { id: true, fuzeNumber: true, construction: true, color: true, weightGsm: true }, take: 20 },
        submissions: { select: { id: true, fuzeFabricNumber: true, status: true, testStatus: true, createdAt: true }, take: 20, orderBy: { createdAt: "desc" } },
        _count: { select: { brands: true, fabrics: true, submissions: true, contacts: true } },
      },
    });

    if (!factory) return NextResponse.json({ ok: false, error: "Factory not found" }, { status: 404 });
    return NextResponse.json({ ok: true, factory });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const data: any = {};
    const fields = ["name","chineseName","millType","specialty","purchasing","annualSales",
      "address","city","state","country","secondaryCountry","development","customerType","brandNominated","salesRepId"];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f] || null;
    }
    if (data.name) data.name = data.name.trim();

    const factory = await prisma.factory.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, factory });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    await prisma.factory.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
