// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── PATCH /api/tests/[id]/assign ──────────────────────────────
   Assigns a test run to a project and/or brand/factory/fabric
   by creating or finding a FabricSubmission bridge record.      */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { brandId, factoryId, fabricId, projectId } = body;

    if (!brandId && !factoryId && !fabricId && !projectId) {
      return NextResponse.json(
        { ok: false, error: "At least one of projectId, brandId, factoryId, or fabricId is required" },
        { status: 400 }
      );
    }

    // Verify test run exists
    const testRun = await prisma.testRun.findUnique({ where: { id } });
    if (!testRun) {
      return NextResponse.json(
        { ok: false, error: "Test run not found" },
        { status: 404 }
      );
    }

    const updateData: any = {};

    // Handle project assignment
    if (projectId !== undefined) {
      updateData.projectId = projectId || null;
    }

    // Handle brand/factory/fabric via FabricSubmission
    if (brandId || factoryId || fabricId) {
      const where: any = {};
      if (brandId) where.brandId = brandId;
      else where.brandId = null;
      if (factoryId) where.factoryId = factoryId;
      else where.factoryId = null;
      if (fabricId) where.fabricId = fabricId;
      else where.fabricId = null;

      let submission = await prisma.fabricSubmission.findFirst({ where });
      if (!submission) {
        const data: any = {};
        if (brandId) data.brandId = brandId;
        if (factoryId) data.factoryId = factoryId;
        if (fabricId) data.fabricId = fabricId;
        submission = await prisma.fabricSubmission.create({ data });
      }
      updateData.submissionId = submission.id;
    }

    // Update TestRun
    const updated = await prisma.testRun.update({
      where: { id },
      data: updateData,
      include: {
        submission: {
          include: {
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
            fabric: { select: { id: true, fuzeNumber: true, customerCode: true } },
          },
        },
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      testRunId: updated.id,
      submissionId: updated.submissionId,
      brand: updated.submission?.brand || null,
      factory: updated.submission?.factory || null,
      fabric: updated.submission?.fabric || null,
      project: updated.project || null,
    });
  } catch (err: any) {
    console.error("Assign error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
