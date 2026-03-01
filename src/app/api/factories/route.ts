// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const factories = await prisma.factory.findMany({
      include: {
        _count: { select: { brands: true, submissions: true, fabrics: true, contacts: true } },
      },
      orderBy: { name: "asc" },
    });

    const list = factories.map(f => ({
      id: f.id,
      name: f.name,
      chineseName: f.chineseName,
      millType: f.millType,
      specialty: f.specialty,
      country: f.country,
      city: f.city,
      brandCount: f._count.brands,
      submissionCount: f._count.submissions,
      fabricCount: f._count.fabrics,
      contactCount: f._count.contacts,
    }));

    const byCountry: Record<string, number> = {};
    for (const f of factories) {
      const c = f.country || "Unknown";
      byCountry[c] = (byCountry[c] || 0) + 1;
    }

    return NextResponse.json({ ok: true, factories: list, total: factories.length, byCountry });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, chineseName, millType, specialty, purchasing, annualSales,
      address, city, state, country, secondaryCountry, development,
      customerType, brandNominated, salesRepId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: "Factory name is required" }, { status: 400 });
    }

    const factory = await prisma.factory.create({
      data: {
        name: name.trim(),
        chineseName: chineseName || null,
        millType: millType || null,
        specialty: specialty || null,
        purchasing: purchasing || null,
        annualSales: annualSales || null,
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || null,
        secondaryCountry: secondaryCountry || null,
        development: development || null,
        customerType: customerType || null,
        brandNominated: brandNominated || null,
        salesRepId: salesRepId || null,
      },
    });

    return NextResponse.json({ ok: true, factory });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
