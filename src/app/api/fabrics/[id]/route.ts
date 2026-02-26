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
            washTarget: true,
            icpSent: true,
            icpReceived: true,
            icpPassed: true,
            abSent: true,
            abReceived: true,
            abPassed: true,
            programName: true,
            category: true,
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
            testRuns: {
              select: {
                id: true,
                testType: true,
                testDate: true,
                washCount: true,
                testReportNumber: true,
                testMethodStd: true,
                lab: { select: { id: true, name: true } },
                icpResult: {
                  select: { agValue: true, auValue: true, unit: true },
                },
                abResult: {
                  select: {
                    organism1: true,
                    organism2: true,
                    result1: true,
                    result2: true,
                    pass: true,
                  },
                },
              },
              orderBy: { testDate: "desc" },
            },
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
