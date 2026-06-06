// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyTestRequestStatus } from "@/lib/notify";

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
      // Phase 58 — when the upload originated from a TestRequest detail
      // page, the client passes testRequestId so we can flip the
      // request's status to RESULTS_RECEIVED + COMPLETE + create the
      // pivot row (Kaylee Pace ticket cmpyq564c0001l404naf8m4hj).
      testRequestId,
      // Phase 60 — per-submission tracking (Kaylee tickets cmpoerqbi/
      // cmpoevbni/cmprcqqy3). Stamp lot number, wash status, and
      // storage location onto the FabricSubmission row.
      submissionLotNumber,
      submissionWashStatus,
      submissionStorage,
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
        // Phase 60 — stamp lot/wash/storage on first create.
        if (submissionLotNumber) data.lotNumber = String(submissionLotNumber);
        if (submissionWashStatus) data.washStatus = String(submissionWashStatus);
        if (submissionStorage) data.storageLocation = String(submissionStorage);
        submission = await prisma.fabricSubmission.create({ data });
      } else if (submissionLotNumber || submissionWashStatus || submissionStorage) {
        // Existing submission — backfill any provided fields that
        // aren't already set so re-uploads don't overwrite curated data.
        const patch: any = {};
        if (submissionLotNumber && !(submission as any).lotNumber) patch.lotNumber = String(submissionLotNumber);
        if (submissionWashStatus && !(submission as any).washStatus) patch.washStatus = String(submissionWashStatus);
        if (submissionStorage && !(submission as any).storageLocation) patch.storageLocation = String(submissionStorage);
        if (Object.keys(patch).length > 0) {
          await prisma.fabricSubmission.update({ where: { id: submission.id }, data: patch });
        }
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

    // Phase 58 — close the originating TestRequest when one was named.
    // Creates the pivot row, flips status RESULTS_RECEIVED → COMPLETE,
    // stamps actualCompletionDate, and fans out the notify. Idempotent
    // on re-upload: only flips when the request is in a pre-results
    // state.
    let testRequestFlipped: any = null;
    if (testRequestId) {
      try {
        const tr = await prisma.testRequest.findUnique({
          where: { id: String(testRequestId) },
          select: {
            id: true, poNumber: true, status: true, brandId: true,
            requestedById: true, factoryId: true,
            submission: { select: { factoryId: true, brandId: true } },
          },
        });
        if (tr) {
          // Create the pivot row if it doesn't already exist for
          // this testRun.
          const existingLine = await prisma.testRequestLine.findFirst({
            where: { testRequestId: tr.id, testRunId: testRun.id },
            select: { id: true },
          });
          if (!existingLine) {
            await prisma.testRequestLine.create({
              data: {
                testRequestId: tr.id,
                testRunId: testRun.id,
                testType,
                testMethod: testMethodStd || null,
                status: "COMPLETE",
              },
            });
          }
          // Status transition. Pre-results states flip to COMPLETE in
          // a single step (we have the result on hand). Already-COMPLETE
          // or CANCELLED requests stay where they are.
          const preResults = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ASSIGNED_TO_LAB", "SUBMITTED", "IN_PROGRESS", "RESULTS_RECEIVED"];
          if (preResults.includes(tr.status)) {
            await prisma.testRequest.update({
              where: { id: tr.id },
              data: { status: "COMPLETE", actualCompletionDate: new Date() },
            });
            const brandIdForNotify = tr.brandId || tr.submission?.brandId || null;
            const factoryIdForNotify = tr.factoryId || tr.submission?.factoryId || null;
            void notifyTestRequestStatus({
              testRequestId: tr.id,
              status: "COMPLETE",
              poNumber: tr.poNumber,
              createdByUserId: tr.requestedById || undefined,
              brandId: brandIdForNotify,
              factoryId: factoryIdForNotify,
            }).catch((e) => console.error("[confirm] notifyTestRequestStatus failed:", e));
            testRequestFlipped = { id: tr.id, from: tr.status, to: "COMPLETE" };
          } else {
            testRequestFlipped = { id: tr.id, from: tr.status, to: tr.status, skipped: true };
          }
        }
      } catch (e: any) {
        console.error("[confirm] TestRequest flip failed:", e?.message, e?.code, e?.meta);
      }
    }

    return NextResponse.json({
      ok: true,
      testRunId: testRun.id,
      submissionId: resolvedSubmissionId,
      testType,
      testRequestFlipped,
      message: `Test run created successfully (${testType})`,
    });
  } catch (err: any) {
    console.error("Confirm error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
