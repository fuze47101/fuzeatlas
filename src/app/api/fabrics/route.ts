import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const q = (url.searchParams.get("q") || "").trim();
    const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
    const pageSize = Math.min(100, Math.max(1, toInt(url.searchParams.get("pageSize"), 25)));

    const where: any = {};

    if (q) {
      const qNum = parseInt(q, 10);
      where.OR = [
        { construction: { contains: q, mode: "insensitive" as const } },
        { color: { contains: q, mode: "insensitive" as const } },
        { contents: { some: { material: { contains: q, mode: "insensitive" as const } } } },
        {
          submissions: {
            some: {
              OR: [
                { customerFabricCode: { contains: q, mode: "insensitive" as const } },
                { factoryFabricCode: { contains: q, mode: "insensitive" as const } },
              ],
            },
          },
        },
        ...(Number.isFinite(qNum) ? [{ submissions: { some: { fuzeFabricNumber: qNum } } }] : []),
      ];
    }

    const [total, fabrics] = await Promise.all([
      prisma.fabric.count({ where }),
      prisma.fabric.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          construction: true,
          color: true,
          widthInches: true,
          weightGsm: true,
          createdAt: true,
          updatedAt: true,
          contents: { select: { material: true, percent: true } },
          submissions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              fuzeFabricNumber: true,
              customerFabricCode: true,
              factoryFabricCode: true,
              applicationMethod: true,
              treatmentLocation: true,
              applicationDate: true,
            },
          },
        },
      }),
    ]);

    const items = fabrics.map((f) => ({
      id: f.id,
      construction: f.construction,
      color: f.color,
      widthInches: f.widthInches,
      weightGsm: f.weightGsm,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      contents: f.contents ?? [],
      submission: f.submissions?.[0] ?? null,
    }));

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total,
      items,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
