// @ts-nocheck
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { content, noteType, brandId, contactName } = body;

    if (!content?.trim()) {
      return NextResponse.json({ ok: false, error: "Note content is required" }, { status: 400 });
    }

    const note = await prisma.note.create({
      data: {
        content: content.trim(),
        noteType: noteType || "NOTE",
        brandId: brandId || null,
        contactName: contactName || null,
        date: new Date(),
      },
    });

    return NextResponse.json({ ok: true, note });
  } catch (e: any) {
    console.error("Note create error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
