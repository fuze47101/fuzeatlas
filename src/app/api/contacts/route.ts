// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
