// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── POST /api/tests/confirm ───────────────────────────────────
   Accepts reviewed test data and creates TestRun + result records.
   Optionally links to Brand/Factory/Fabric via FabricSubmission.  */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      documentId,
      testType,
      testReportNumber,
      labName,
      testDate,
      testMethodStd,
      testMethodRaw,
      washCount,
      fabricInfo,
      submissionId,
      // Assignment fields
      brandId,
      factoryId,
      fabricId,
      projectId,
      // Antibacterial
      organism1,
      organism2,
      result1,
      result2,
      abPass,
      // ICP
      agValue,
      auValue,
      agUnit,
      // Fungal
      fungalWrittenResult,
      fungalPass,
      // Odor
      testedOdor,
      odorResult,
      odorPass,
      // General
      overallPass,
      machineType,
      testedMetal,
    } = body;

    if (!testType) {
      return NextResponse.json(
        { ok: false, error: "Test type is required" },
        { status: 400 }
      );
    }

    // Resolve lab
    let labId: string | null = null;
    if (labName) {
      let lab = await prisma.lab.findFirst({ where: { name: labName } });
      if (!lab) {
        lab = await prisma.lab.create({ data: { name: labName } });
      }
      labId = lab.id;
    }

    // Parse test date
    let parsedDate: Date | null = null;
    if (testDate) {
      const d = new Date(testDate);
      if (!isNaN(d.getTime())) parsedDate = d;
    }

    // Resolve FabricSubmission if brand/factory/fabric provided
    let resolvedSubmissionId = submissionId || null;
    if (!resolvedSubmissionId && (brandId || factoryId || fabricId)) {
      // Try to find existing submission with same combo
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
      resolvedSubmissionId = submission.id;
    }

    // Create TestRun
    const testRun = await prisma.testRun.create({
      data: {
        testType,
        testReportNumber: testReportNumber || null,
        testMethodStd: testMethodStd || null,
        testMethodRaw: testMethodRaw || testMethodStd || null,
        testDate: parsedDate,
        washCount: washCount ? parseInt(String(washCount), 10) : null,
        machineType: machineType || null,
        testedMetal: testedMetal || null,
        labId,
        submissionId: resolvedSubmissionId,
        projectId: projectId || null,
        // Link document
        documents: documentId
          ? { connect: { id: documentId } }
          : undefined,
      },
    });

    // Create type-specific result
    if (testType === "ANTIBACTERIAL" && (organism1 || organism2 || result1 || result2)) {
      await prisma.antibacterialResult.create({
        data: {
          testRunId: testRun.id,
          organism1: organism1 || null,
          organism2: organism2 || null,
          result1: result1 ? parseFloat(String(result1)) : null,
          result2: result2 ? parseFloat(String(result2)) : null,
          organism1Raw: organism1 || null,
          organism2Raw: organism2 || null,
          result1Raw: result1 ? String(result1) : null,
          result2Raw: result2 ? String(result2) : null,
          pass: abPass != null ? Boolean(abPass) : overallPass != null ? Boolean(overallPass) : null,
        },
      });
    }

    if (testType === "ICP" && (agValue || auValue)) {
      await prisma.icpResult.create({
        data: {
          testRunId: testRun.id,
          agValue: agValue ? parseFloat(String(agValue)) : null,
          auValue: auValue ? parseFloat(String(auValue)) : null,
          agRaw: agValue ? String(agValue) : null,
          auRaw: auValue ? String(auValue) : null,
          unit: agUnit || "ppm",
        },
      });
    }

    if (testType === "FUNGAL") {
      await prisma.fungalResult.create({
        data: {
          testRunId: testRun.id,
          writtenResult: fungalWrittenResult || null,
          pass: fungalPass != null ? Boolean(fungalPass) : overallPass != null ? Boolean(overallPass) : null,
          raw: fungalWrittenResult || null,
        },
      });
    }

    if (testType === "ODOR") {
      await prisma.odorResult.create({
        data: {
          testRunId: testRun.id,
          testedOdor: testedOdor || null,
          result: odorResult || null,
          pass: odorPass != null ? Boolean(odorPass) : overallPass != null ? Boolean(overallPass) : null,
        },
      });
    }

    // Update document to link to testRun
    if (documentId) {
      await prisma.document.update({
        where: { id: documentId },
        data: { testRunId: testRun.id },
      });
    }

    return NextResponse.json({
      ok: true,
      testRunId: testRun.id,
      submissionId: resolvedSubmissionId,
      testType,
      message: `Test run created successfully (${testType})`,
    });
  } catch (err: any) {
    console.error("Confirm error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
