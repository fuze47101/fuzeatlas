import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/fabrics?q=&construction=&color=&material=&minPct=&maxPct=&page=&pageSize=
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const construction = (searchParams.get("construction") || "").trim();
    const color = (searchParams.get("color") || "").trim();
    const material = (searchParams.get("material") || "").trim();

    const minPctRaw = (searchParams.get("minPct") || "").trim();
    const maxPctRaw = (searchParams.get("maxPct") || "").trim();
    const minPct = minPctRaw ? Number(minPctRaw) : null;
    const maxPct = maxPctRaw ? Number(maxPctRaw) : null;

    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || "25")));
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};

    // "q" searches Fabric.construction/color plus content material/rawText plus submission codes
    if (q) {
      where.OR = [
        { construction: { contains: q, mode: "insensitive" } },
        { color: { contains: q, mode: "insensitive" } },
        {
          contents: {
            some: {
              OR: [
                { material: { contains: q, mode: "insensitive" } },
                { rawText: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          submissions: {
            some: {
              OR: [
                { customerFabricCode: { contains: q, mode: "insensitive" } },
                { factoryFabricCode: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    if (construction) where.construction = { contains: construction, mode: "insensitive" };
    if (color) where.color = { contains: color, mode: "insensitive" };

    if (material || minPct !== null || maxPct !== null) {
      const contentWhere: any = {};
      if (material) contentWhere.material = { contains: material, mode: "insensitive" };
      if (minPct !== null) contentWhere.percent = { ...(contentWhere.percent || {}), gte: minPct };
      if (maxPct !== null) contentWhere.percent = { ...(contentWhere.percent || {}), lte: maxPct };

      where.contents = { some: contentWhere };
    }

    const [total, rows] = await Promise.all([
      prisma.fabric.count({ where }),
      prisma.fabric.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
        include: {
          contents: { orderBy: { percent: "desc" } },
          submissions: {
            orderBy: { createdAt: "desc" },
            take: 1, // latest submission only (fast + clean)
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
      rows: rows.map((f) => ({
        id: f.id,
        construction: f.construction,
        color: f.color,
        widthInches: f.widthInches,
        weightGsm: f.weightGsm,
        updatedAt: f.updatedAt,
        contents: f.contents.map((c) => ({
          material: c.material,
          percent: c.percent,
          rawText: c.rawText,
        })),
        submission: f.submissions[0]
          ? {
              fuzeFabricNumber: f.submissions[0].fuzeFabricNumber,
              customerFabricCode: f.submissions[0].customerFabricCode,
              factoryFabricCode: f.submissions[0].factoryFabricCode,
              applicationMethod: f.submissions[0].applicationMethod,
              treatmentLocation: f.submissions[0].treatmentLocation,
              applicationDate: f.submissions[0].applicationDate,
            }
          : null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}