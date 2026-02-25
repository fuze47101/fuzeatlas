import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    const item = await prisma.fabric.findUnique({
      where: { id },
      select: {
        id: true,
        construction: true,
        color: true,
        widthInches: true,
        weightGsm: true,
        raw: true,
        createdAt: true,
        updatedAt: true,
        contents: {
          select: { id: true, material: true, percent: true, rawText: true },
          orderBy: { material: "asc" },
        },
        submissions: {
          select: {
            id: true,
            fuzeFabricNumber: true,
            customerFabricCode: true,
            factoryFabricCode: true,
            applicationMethod: true,
            applicationRecipeRaw: true,
            padRecipeRaw: true,
            treatmentLocation: true,
            applicationDate: true,
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
          },
          orderBy: { applicationDate: "desc" },
          take: 50,
        },
      },
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
