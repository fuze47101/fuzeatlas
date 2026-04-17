// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const distributors = await prisma.distributor.findMany({
      select: { id: true, name: true, country: true, specialty: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ ok: true, distributors });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      chineseName,
      specialty,
      agentForFuze,
      annualSales,
      country,
      region,
      city,
      address,
      email,
      phone,
      website,
      coverageCountries,
      localCurrency,
      notes,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Distributor name is required" },
        { status: 400 },
      );
    }

    const distributor = await prisma.distributor.create({
      data: {
        name: name.trim(),
        chineseName: chineseName || null,
        specialty: specialty || null,
        agentForFuze: agentForFuze || null,
        annualSales: annualSales || null,
        country: country || null,
        region: region || null,
        city: city || null,
        address: address || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        coverageCountries: coverageCountries || null,
        localCurrency: localCurrency || null,
        notes: notes || null,
        status: "ACTIVE",
        active: true,
      },
    });

    return NextResponse.json({ ok: true, distributor });
  } catch (e: any) {
    console.error("Distributor create error:", e);
    if (e.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "A distributor with this name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
