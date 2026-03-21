// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── POST /api/tests/confirm ───────────────────────────────────
   Accepts reviewed test data and creates TestRun + result records.
   Supports both legacy flat fields and rich ITS antibacterial fields.
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
      // Legacy Antibacterial
      organism1,
      organism2,
      result1,
      result2,
      abPass,
      // Rich Antibacterial (ITS parser)
      testNumberInReport,
      organism,
      strainNumber,
      brothMedia,
      surfactant,
      sterilization,
      contactTime,
      incubationTemp,
      agarMedium,
      inoculumCFU,
      controlCFU,
      treatedCFU,
      percentReduction,
      growthValue,
      activityValue,
      methodPass,
      methodPassReason,
      rawExtracted,
      // AI review
      aiReviewData,
      aiReviewNotes,
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

    // ── Duplicate Gate ────────────────────────────────────────
    // Block exact duplicates: same report number + same test type + same testNumberInReport
    const skipDuplicateCheck = body.forceDuplicate === true;
    if (!skipDuplicateCheck && testReportNumber) {
      const where: any = { testReportNumber };
      if (testNumberInReport) {
        where.testNumberInReport = parseInt(String(testNumberInReport), 10);
      }
      const existing = await prisma.testRun.findFirst({
        where,
        select: { id: true, testType: true, createdAt: true },
      });
      if (existing) {
        return NextResponse.json({
          ok: false,
          error: `Duplicate detected: a test with report number "${testReportNumber}"${testNumberInReport ? ` (test #${testNumberInReport})` : ""} already exists (ID: ${existing.id}, created ${new Date(existing.createdAt).toLocaleDateString()}). To override, check "Allow duplicate" and resubmit.`,
          duplicate: true,
          existingTestId: existing.id,
        }, { status: 409 });
      }
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
    const testRunData: any = {
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
      // Rich fields
      testNumberInReport: testNumberInReport ? parseInt(String(testNumberInReport), 10) : null,
      aiReviewData: aiReviewData || null,
      aiReviewDate: aiReviewData ? new Date() : null,
      aiReviewNotes: aiReviewNotes || null,
      // Link document
      documents: documentId
        ? { connect: { id: documentId } }
        : undefined,
    };

    const testRun = await prisma.testRun.create({ data: testRunData });

    // Create type-specific result
    if (testType === "ANTIBACTERIAL") {
      // Check if we have rich ITS data or legacy flat data
      const hasRichData = organism || strainNumber || brothMedia || inoculumCFU != null || activityValue != null;

      const abData: any = {
        testRunId: testRun.id,
        // Legacy fields (always populated for backward compat)
        organism1: organism || organism1 || null,
        organism2: organism2 || null,
        result1: percentReduction != null ? percentReduction : (result1 ? parseFloat(String(result1)) : null),
        result2: result2 ? parseFloat(String(result2)) : null,
        organism1Raw: organism || organism1 || null,
        organism2Raw: organism2 || null,
        result1Raw: percentReduction != null ? String(percentReduction) : (result1 ? String(result1) : null),
        result2Raw: result2 ? String(result2) : null,
        pass: methodPass != null ? Boolean(methodPass)
            : abPass != null ? Boolean(abPass)
            : overallPass != null ? Boolean(overallPass)
            : null,
      };

      // Rich fields (from ITS parser)
      if (hasRichData) {
        abData.organism = organism || null;
        abData.strainNumber = strainNumber || null;
        abData.testMethodStd = testMethodStd || null;
        abData.brothMedia = brothMedia || null;
        abData.surfactant = surfactant || null;
        abData.sterilization = sterilization || null;
        abData.contactTime = contactTime || null;
        abData.incubationTemp = incubationTemp || null;
        abData.agarMedium = agarMedium || null;
        abData.inoculumCFU = inoculumCFU != null ? parseFloat(String(inoculumCFU)) : null;
        abData.controlCFU = controlCFU != null ? parseFloat(String(controlCFU)) : null;
        abData.treatedCFU = treatedCFU != null ? parseFloat(String(treatedCFU)) : null;
        abData.percentReduction = percentReduction != null ? parseFloat(String(percentReduction)) : null;
        abData.growthValue = growthValue != null ? parseFloat(String(growthValue)) : null;
        abData.activityValue = activityValue != null ? parseFloat(String(activityValue)) : null;
        abData.methodPass = methodPass != null ? Boolean(methodPass) : null;
        abData.methodPassReason = methodPassReason || null;
        abData.rawExtracted = rawExtracted || null;
      }

      await prisma.antibacterialResult.create({ data: abData });
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
