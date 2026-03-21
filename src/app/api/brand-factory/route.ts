// @ts-nocheck
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Link a brand to a factory
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { brandId, factoryId, isPrimary, note } = body;

    if (!brandId || !factoryId) {
      return NextResponse.json({ ok: false, error: "brandId and factoryId are required" }, { status: 400 });
    }

    const link = await prisma.brandFactory.create({
      data: {
        brandId,
        factoryId,
        isPrimary: isPrimary || false,
        note: note || null,
      },
      include: {
        factory: { select: { id: true, name: true, country: true } },
        brand: { select: { id: true, name: true, pipelineStage: true } },
      },
    });

    return NextResponse.json({ ok: true, link });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "This brand-factory link already exists" }, { status: 409 });
    }
    console.error("Brand-factory link error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// Unlink a brand from a factory
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Link id is required" }, { status: 400 });
    }

    await prisma.brandFactory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Brand-factory unlink error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
