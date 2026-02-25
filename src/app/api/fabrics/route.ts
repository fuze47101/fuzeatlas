import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function escLike(s: string) {
  // escape % and _ for SQL LIKE
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const q = (url.searchParams.get("q") || "").trim();
    const construction = (url.searchParams.get("construction") || "").trim();
    const color = (url.searchParams.get("color") || "").trim();
    const contains = (url.searchParams.get("contains") || "").trim();

    const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
    const pageSize = Math.min(100, Math.max(1, toInt(url.searchParams.get("pageSize"), 25)));

    // Base where (Fabric)
    const where: any = {};

    // Specific field filters
    if (construction) where.construction = { contains: construction, mode: "insensitive" as const };
    if (color) where.color = { contains: color, mode: "insensitive" as const };

    // "Contains" filter -> Fabric.contents.material
    if (contains) {
      where.contents = {
        some: {
          material: { contains: contains, mode: "insensitive" as const },
        },
      };
    }

    // General search q across Fabric + Submission codes (via relation)
    if (q) {
      const qLike = escLike(q);
      where.OR = [
        { construction: { contains: q, mode: "insensitive" as const } },
        { color: { contains: q, mode: "insensitive" as const } },
        // search contents material
        { contents: { some: { material: { contains: q, mode: "insensitive" as const } } } },
        // search related submissions codes / FUZE #
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
        // FUZE fabric number (Int) exact match if q is numeric
        ...(Number.isFinite(parseInt(q, 10))
          ? [
              {
                submissions: {
                  some: {
                    fuzeFabricNumber: parseInt(q, 10),
                  },
                },
              },
            ]
          : []),
        // fallback: raw JSON string contains (optional, expensive) — off by default
      ];
    }

    const [total, items] = await Promise.all([
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
          contents: {
            select: {
              material: true,
              percent: true,
            },
          },
          // pick ONE submission to display in the list UI (latest created)
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

    // Shape to match your existing UI: row.submission + row.contents
    const rows = items.map((f) => ({
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
      pages: Math.max(1, Math.ceil(total / pageSize)),
      rows,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
