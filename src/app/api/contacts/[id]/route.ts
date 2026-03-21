// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── PATCH /api/contacts/[id] ── update a contact ────────── */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { firstName, lastName, title, email, phone, address } = body;

    const data: any = {};
    if (firstName !== undefined) data.firstName = firstName?.trim() || null;
    if (lastName !== undefined) data.lastName = lastName?.trim() || null;
    if (firstName !== undefined || lastName !== undefined) {
      data.name = [firstName ?? "", lastName ?? ""].filter(Boolean).join(" ") || null;
    }
    if (title !== undefined) data.title = title?.trim() || null;
    if (email !== undefined) data.email = email?.trim() || null;
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;

    const contact = await prisma.contact.update({ where: { id }, data });
    return NextResponse.json({ ok: true, contact });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── DELETE /api/contacts/[id] ── delete a contact ────────── */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
