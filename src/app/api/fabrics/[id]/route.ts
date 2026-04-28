// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const fabric = await prisma.fabric.findUnique({
      where: { id: params.id },
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true, country: true } },
        // Distributor-owned fabric portfolio support — added Apr 2026.
        // Safe to include even if the relation isn't on every existing
        // query path; Prisma returns null when the FK is empty.
        // @ts-ignore — new relation from distributor portfolio
        distributor: { select: { id: true, name: true } },
        contents: true,
        submissions: {
          include: {
            testRuns: { include: { icpResult: true, abResult: true, fungalResult: true, odorResult: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        // @ts-ignore — new relation from recipe bench tests
        recipeBenchTests: {
          orderBy: { testDate: "desc" },
          take: 20,
        },
        // Latest test request — used by the label printer (and any
        // other "what's the most recent ICP request for this fabric"
        // caller) so we can include PO# / tier / lab assignment on the
        // baggie sticker without a second round-trip.
        // @ts-ignore — new include
        testRequests: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            poNumber: true,
            poDate: true,
            pricingTier: true,
            status: true,
            requestedAt: true,
            fuzeFabricNumber: true,
            customerFabricCode: true,
            factoryFabricCode: true,
            lab: { select: { id: true, name: true, city: true, country: true } },
          },
        },
        // Latest sample application — tier + recipe stamp the lab needs
        // to know what was applied before they ICP-test it.
        // @ts-ignore — new relation from sample applications
        sampleApplications: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            appNumber: true,
            tier: true,
            bathConcentrationMgPerL: true,
            bathVolumeL: true,
            paddedAt: true,
            driedAt: true,
            operator: true,
          },
        },
      },
    });

    if (!fabric) return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
    return NextResponse.json({ ok: true, fabric });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const data: any = {};

    // String fields
    const strFields = [
      "customerCode","factoryCode","customerReference","construction","color","yarnType","finishNote","note",
      "endUse","targetFuzeTier","annualVolume","quantityType","quantityUnit","batchLotNumber",
      "fabricCategory","knitStitchType","weavePattern","gauge","dyeStage","dyeClass",
      "intakeFormId",
    ];
    for (const f of strFields) { if (body[f] !== undefined) data[f] = body[f] || null; }

    // Int fields
    if (body.fuzeNumber !== undefined) data.fuzeNumber = body.fuzeNumber ? parseInt(body.fuzeNumber) : null;
    if (body.threadCountWarp !== undefined) data.threadCountWarp = body.threadCountWarp ? parseInt(body.threadCountWarp) : null;
    if (body.threadCountWeft !== undefined) data.threadCountWeft = body.threadCountWeft ? parseInt(body.threadCountWeft) : null;

    // Float fields
    const floatFields = ["weightGsm","widthInches","thickness","shrinkageLength","shrinkageWidth","fabricPh"];
    for (const f of floatFields) { if (body[f] !== undefined) data[f] = body[f] ? parseFloat(body[f]) : null; }

    // Boolean fields
    if (body.dyeApplied !== undefined) data.dyeApplied = body.dyeApplied ?? null;

    // Reference fields
    if (body.brandId !== undefined) data.brandId = body.brandId || null;
    if (body.factoryId !== undefined) data.factoryId = body.factoryId || null;

    // JSON fields
    const jsonFields = ["pretreatment","dyeDetails","finishSoftener","finishRepellent","finishWicking","finishWrinkleFree","finishOther","raw"];
    for (const f of jsonFields) { if (body[f] !== undefined) data[f] = body[f] || null; }

    // DateTime
    if (body.intakeParsedAt !== undefined) data.intakeParsedAt = body.intakeParsedAt ? new Date(body.intakeParsedAt) : null;

    // Handle fiber contents update if provided
    const fabric = await prisma.fabric.update({ where: { id: params.id }, data });

    // If contents array is provided, replace existing FabricContent rows
    if (body.contents !== undefined && Array.isArray(body.contents)) {
      await prisma.fabricContent.deleteMany({ where: { fabricId: params.id } });
      const validContents = body.contents.filter((c: any) => c.material);
      if (validContents.length > 0) {
        await prisma.fabricContent.createMany({
          data: validContents.map((c: any) => ({
            fabricId: params.id,
            material: c.material,
            percent: c.percent ? parseFloat(c.percent) : null,
            rawText: c.rawText || null,
          })),
        });
      }
    }

    // Return updated fabric with relations
    const updated = await prisma.fabric.findUnique({
      where: { id: params.id },
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        contents: true,
      },
    });

    return NextResponse.json({ ok: true, fabric: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const id = params.id;

    // Delete related records first (no cascade in Prisma by default)
    await prisma.fabricContent.deleteMany({ where: { fabricId: id } });

    // Check for submissions — warn if any exist
    const subCount = await prisma.fabricSubmission.count({ where: { fabricId: id } });
    if (subCount > 0) {
      // Unlink submissions instead of deleting them (preserve test data)
      await prisma.fabricSubmission.updateMany({
        where: { fabricId: id },
        data: { fabricId: null },
      });
    }

    await prisma.fabric.delete({ where: { id } });
    return NextResponse.json({ ok: true, unlinkedSubmissions: subCount });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
