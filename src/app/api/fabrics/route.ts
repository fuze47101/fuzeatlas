// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const fabrics = await prisma.fabric.findMany({
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        contents: true,
        _count: { select: { submissions: true } },
      },
      orderBy: { fuzeNumber: "desc" },
    });

    const list = fabrics.map(f => ({
      id: f.id,
      fuzeNumber: f.fuzeNumber,
      customerCode: f.customerCode || null,
      factoryCode: f.factoryCode || null,
      construction: f.construction,
      color: f.color,
      weightGsm: f.weightGsm,
      yarnType: f.yarnType,
      brand: f.brand?.name || null,
      brandId: f.brandId,
      factory: f.factory?.name || null,
      factoryId: f.factoryId,
      contents: f.contents.map(c => `${c.material} ${c.percent ? c.percent + "%" : ""}`).join(", "),
      submissionCount: f._count.submissions,
    }));

    return NextResponse.json({ ok: true, fabrics: list, total: fabrics.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fuzeNumber, customerCode, factoryCode, construction, color,
      weightGsm, widthInches, yarnType, finishNote, note, brandId, factoryId, contents } = body;

    const fabric = await prisma.fabric.create({
      data: {
        fuzeNumber: fuzeNumber ? parseInt(fuzeNumber) : null,
        customerCode: customerCode || null,
        factoryCode: factoryCode || null,
        construction: construction || null,
        color: color || null,
        weightGsm: weightGsm ? parseFloat(weightGsm) : null,
        widthInches: widthInches ? parseFloat(widthInches) : null,
        yarnType: yarnType || null,
        finishNote: finishNote || null,
        note: note || null,
        brandId: brandId || null,
        factoryId: factoryId || null,
        ...(contents && contents.length > 0 && {
          contents: {
            create: contents.filter((c: any) => c.material).map((c: any) => ({
              material: c.material,
              percent: c.percent ? parseFloat(c.percent) : null,
              rawText: c.rawText || null,
            })),
          },
        }),
      },
    });

    return NextResponse.json({ ok: true, fabric });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ ok: false, error: "A fabric with this FUZE number already exists" }, { status: 409 });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
