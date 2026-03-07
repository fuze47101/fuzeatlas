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
      weightGsm, widthInches, yarnType, finishNote, note, brandId, factoryId, contents,
      // v2 intake fields
      fabricName, endUse, targetFuzeTier, annualVolume, quantityType, quantityUnit,
      batchLotNumber, thickness, shrinkageLength, shrinkageWidth,
      fabricCategory, knitStitchType, weavePattern, gauge, threadCountWarp, threadCountWeft,
      pretreatment, fabricPh, dyeApplied, dyeStage, dyeClass, dyeDetails,
      finishSoftener, finishRepellent, finishWicking, finishWrinkleFree, finishOther,
      intakeFormId, intakeParsedAt, raw } = body;

    // Auto-assign FUZE number: find max and increment
    let assignedFuzeNumber = fuzeNumber ? parseInt(fuzeNumber) : null;
    if (!assignedFuzeNumber) {
      const maxFabric = await prisma.fabric.findFirst({
        where: { fuzeNumber: { not: null } },
        orderBy: { fuzeNumber: "desc" },
        select: { fuzeNumber: true },
      });
      assignedFuzeNumber = (maxFabric?.fuzeNumber || 1000) + 1;
    }

    const fabric = await prisma.fabric.create({
      data: {
        fuzeNumber: assignedFuzeNumber,
        customerCode: customerCode || null,
        factoryCode: factoryCode || null,
        construction: construction || fabricCategory || null,
        color: color || null,
        weightGsm: weightGsm ? parseFloat(weightGsm) : null,
        widthInches: widthInches ? parseFloat(widthInches) : null,
        yarnType: yarnType || null,
        finishNote: finishNote || null,
        note: note || (fabricName ? `Intake: ${fabricName}` : null),
        brandId: brandId || null,
        factoryId: factoryId || null,
        // v2 intake fields
        endUse: endUse || null,
        targetFuzeTier: targetFuzeTier || null,
        annualVolume: annualVolume || null,
        quantityType: quantityType || null,
        quantityUnit: quantityUnit || null,
        batchLotNumber: batchLotNumber || null,
        thickness: thickness ? parseFloat(thickness) : null,
        shrinkageLength: shrinkageLength ? parseFloat(shrinkageLength) : null,
        shrinkageWidth: shrinkageWidth ? parseFloat(shrinkageWidth) : null,
        fabricCategory: fabricCategory || null,
        knitStitchType: knitStitchType || null,
        weavePattern: weavePattern || null,
        gauge: gauge || null,
        threadCountWarp: threadCountWarp ? parseInt(threadCountWarp) : null,
        threadCountWeft: threadCountWeft ? parseInt(threadCountWeft) : null,
        pretreatment: pretreatment || null,
        fabricPh: fabricPh ? parseFloat(fabricPh) : null,
        dyeApplied: dyeApplied ?? null,
        dyeStage: dyeStage || null,
        dyeClass: dyeClass || null,
        dyeDetails: dyeDetails || null,
        finishSoftener: finishSoftener || null,
        finishRepellent: finishRepellent || null,
        finishWicking: finishWicking || null,
        finishWrinkleFree: finishWrinkleFree || null,
        finishOther: finishOther || null,
        intakeFormId: intakeFormId || null,
        intakeParsedAt: intakeParsedAt ? new Date(intakeParsedAt) : null,
        raw: raw || null,
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

    return NextResponse.json({ ok: true, fabric, fuzeNumber: assignedFuzeNumber });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ ok: false, error: "A fabric with this FUZE number already exists" }, { status: 409 });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
