// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/contacts?brandId=xxx ── list contacts ────────── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId");
    const factoryId = searchParams.get("factoryId");

    const where: any = {};
    if (brandId) where.brandId = brandId;
    if (factoryId) where.factoryId = factoryId;

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, contacts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── POST /api/contacts ── create a new contact ────────── */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { firstName, lastName, title, email, phone, address, brandId, factoryId, distributorId } = body;

    if (!firstName?.trim() && !lastName?.trim() && !email?.trim()) {
      return NextResponse.json({ ok: false, error: "At least a name or email is required" }, { status: 400 });
    }

    const contact = await prisma.contact.create({
      data: {
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        name: [firstName, lastName].filter(Boolean).join(" ") || null,
        title: title?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        brandId: brandId || null,
        factoryId: factoryId || null,
        distributorId: distributorId || null,
      },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
