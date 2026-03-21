// @ts-nocheck
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const { content, noteType, contactName } = body;

    const note = await prisma.note.update({
      where: { id: params.id },
      data: {
        ...(content !== undefined && { content: content.trim() }),
        ...(noteType !== undefined && { noteType }),
        ...(contactName !== undefined && { contactName: contactName || null }),
      },
    });

    return NextResponse.json({ ok: true, note });
  } catch (e: any) {
    console.error("Note update error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    await prisma.note.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Note delete error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
