// @ts-nocheck
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/tests/by-entity?brandId=xxx or ?factoryId=xxx
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const brandId = url.searchParams.get("brandId");
    const factoryId = url.searchParams.get("factoryId");

    if (!brandId && !factoryId) {
      return NextResponse.json({ ok: false, error: "brandId or factoryId required" }, { status: 400 });
    }

    // Build where clause through submissions
    const where: any = {};
    if (brandId) {
      where.submission = { brandId };
    }
    if (factoryId) {
      where.submission = { ...where.submission, factoryId };
    }

    const testRuns = await prisma.testRun.findMany({
      where,
      include: {
        submission: {
          select: {
            id: true,
            fuzeFabricNumber: true,
            customerFabricCode: true,
            status: true,
          },
        },
        lab: { select: { id: true, name: true } },
        icpResult: true,
        abResult: { select: { id: true, organism: true, organism1: true, percentReduction: true, activityValue: true, methodPass: true, pass: true } },
        fungalResult: { select: { id: true, pass: true, writtenResult: true } },
        odorResult: { select: { id: true, pass: true, result: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ ok: true, testRuns });
  } catch (e: any) {
    console.error("Tests by entity error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
