// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    // Server-side filtering (?q=…) and paging (?pageSize=…). Both optional —
    // legacy callers that hit /api/fabrics with no params still get the full
    // library back (preserving the original contract).
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const pageSizeRaw = parseInt(searchParams.get("pageSize") || "0", 10);
    const take = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(pageSizeRaw, 1000) : undefined;

    // Build a broad OR filter. Ashlee types "2504" → we want that to match
    // fuzeNumber exactly AND customer/factory codes that contain "2504"
    // AND the same fields on the related FabricSubmission. Tickets
    // cmo4u8xjm + cmoam7lr4 — Ashlee was getting blank-state results for
    // some fabrics because the submission branch ONLY checked fuzeFabricNumber
    // for numeric queries (so "2504" missed any fabric whose number lived on
    // a customer/factory code instead).
    let where: any = undefined;
    if (q) {
      const asInt = /^\d+$/.test(q) ? parseInt(q, 10) : null;
      // Strip "FUZE-" / "FUZE " / "F-" prefixes the user might type.
      const stripped = q.replace(/^(?:FUZE[-\s]*|F[-\s]+)/i, "").trim();
      const strippedAsInt = stripped !== q && /^\d+$/.test(stripped)
        ? parseInt(stripped, 10)
        : null;
      const numericMatch = asInt ?? strippedAsInt;

      where = {
        OR: [
          ...(numericMatch !== null ? [{ fuzeNumber: numericMatch }] : []),
          { customerCode: { contains: q, mode: "insensitive" } },
          { factoryCode: { contains: q, mode: "insensitive" } },
          { customerReference: { contains: q, mode: "insensitive" } },
          { construction: { contains: q, mode: "insensitive" } },
          { color: { contains: q, mode: "insensitive" } },
          { yarnType: { contains: q, mode: "insensitive" } },
          { fabricCategory: { contains: q, mode: "insensitive" } },
          { note: { contains: q, mode: "insensitive" } },
          { brand: { is: { name: { contains: q, mode: "insensitive" } } } },
          { factory: { is: { name: { contains: q, mode: "insensitive" } } } },
          // FUZE number / customer code / factory code may also live on the
          // related FabricSubmission if the fabric was registered via intake
          // and not yet back-filled.
          {
            submissions: {
              some: {
                OR: [
                  ...(numericMatch !== null
                    ? [{ fuzeFabricNumber: numericMatch }]
                    : []),
                  { customerFabricCode: { contains: q, mode: "insensitive" } },
                  { factoryFabricCode: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      };
    }

    // When the caller provided a query string we want to return every match,
    // not just the top 200 by fuzeNumber desc. Otherwise a fabric outside the
    // top-200 window silently disappears from the picker. Same root cause as
    // ticket cmoam7lr4. Ignore the pageSize cap when q is set.
    const effectiveTake = q ? undefined : take;

    const fabrics = await prisma.fabric.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        contents: true,
        _count: { select: { submissions: true } },
        submissions: {
          select: {
            id: true,
            fuzeFabricNumber: true,
            customerFabricCode: true,
            factoryFabricCode: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        // Latest usable recipe bench test for this fabric — drives the
        // application-recipe step of the ICP Sample Prep wizard without a
        // second round-trip. We only include tests with a computed pickup;
        // anything pre-measurement is useless for building a bath.
        recipeBenchTests: {
          where: { pickupDryToWetPct: { not: null } },
          orderBy: { testDate: "desc" },
          take: 1,
          select: {
            id: true,
            testNumber: true,
            testDate: true,
            applicationMethod: true,
            squeezePressure: true,
            vfdFrequencyHz: true,
            lineSpeedMPerMin: true,
            stockMgPerL: true,
            pickupDryToWetPct: true,
            f1BathMgPerL: true,
            f2BathMgPerL: true,
            f3BathMgPerL: true,
            f4BathMgPerL: true,
            f1FuzeMlPerLBath: true,
            f2FuzeMlPerLBath: true,
            f3FuzeMlPerLBath: true,
            f4FuzeMlPerLBath: true,
          },
        },
      },
      orderBy: { fuzeNumber: "desc" },
      ...(effectiveTake ? { take: effectiveTake } : {}),
    });

    const list = fabrics.map((f: any) => {
      const sub = f.submissions?.[0] || null;
      const bench = f.recipeBenchTests?.[0] || null;
      return {
        id: f.id,
        fuzeNumber: f.fuzeNumber ?? sub?.fuzeFabricNumber ?? null,
        customerCode: f.customerCode || sub?.customerFabricCode || null,
        factoryCode: f.factoryCode || sub?.factoryFabricCode || null,
        customerReference: f.customerReference || null,
        construction: f.construction,
        color: f.color,
        weightGsm: f.weightGsm,
        widthInches: f.widthInches,
        yarnType: f.yarnType,
        brand: f.brand?.name || null,
        brandId: f.brandId,
        factory: f.factory?.name || null,
        factoryId: f.factoryId,
        contents: f.contents.map((c: any) => `${c.material} ${c.percent ? c.percent + "%" : ""}`).join(", "),
        submissionCount: f._count.submissions,
        // Kept for any caller that still reads the nested shape.
        submission: sub
          ? {
              id: sub.id,
              fuzeFabricNumber: sub.fuzeFabricNumber,
              customerFabricCode: sub.customerFabricCode,
              factoryFabricCode: sub.factoryFabricCode,
            }
          : null,
        // Recipe snapshot for the ICP Sample Prep wizard. Null if the fabric
        // has never been bench-tested — wizard renders a "Run Recipe Calculator
        // first" banner and blocks the step.
        latestBenchTest: bench,
      };
    });

    // Return BOTH keys so every existing caller keeps working: /fabrics and
    // test-requests read `fabrics`, ICP Sample Prep reads `items`.
    return NextResponse.json({
      ok: true,
      fabrics: list,
      items: list,
      total: list.length,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fuzeNumber, customerCode, factoryCode, customerReference, construction, color,
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
        customerReference: customerReference || null,
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
