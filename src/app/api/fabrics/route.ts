import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function asInt(v: string | null, d: number) {
  const n = v ? Number(v) : d;
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : d;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = asInt(url.searchParams.get("page"), 1);
    const pageSize = asInt(url.searchParams.get("pageSize"), 25);
    const skip = (page - 1) * pageSize;

    const [total, fabrics] = await Promise.all([
      prisma.fabric.count(),
      prisma.fabric.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          contents: {
            select: { material: true, percent: true },
            orderBy: { material: "asc" },
          },
          submissions: {
            select: {
              fuzeFabricNumber: true,
              customerFabricCode: true,
              factoryFabricCode: true,
              applicationMethod: true,
              treatmentLocation: true,
              applicationDate: true,
            },
            orderBy: { applicationDate: "desc" },
            take: 1,
          },
        },
      }),
    ]);

    // Shape each row so page.tsx gets `submission` (singular) not `submissions`
    const items = fabrics.map((f) => {
      const { submissions, ...rest } = f;
      return { ...rest, submission: submissions[0] ?? null };
    });

    return NextResponse.json({ ok: true, page, pageSize, total, items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // schema-safe: only set fields that exist on your Fabric model
    const data: any = {};
    if (typeof body.construction === "string") data.construction = body.construction;
    if (typeof body.color === "string") data.color = body.color;
    if (typeof body.widthInches === "number") data.widthInches = body.widthInches;
    if (typeof body.weightGsm === "number") data.weightGsm = body.weightGsm;
    if (body.raw !== undefined) data.raw = body.raw;

    // minimal validation: require at least one meaningful field
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid Fabric fields provided." },
        { status: 400 }
      );
    }

    const fabric = await prisma.fabric.create({ data });
    return NextResponse.json({ ok: true, fabric }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unknown error" },
      { status: 500 }
    );
  }
}
