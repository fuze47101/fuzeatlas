// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── POST /api/factory-portal/sample-trial/[id]/icp-submit ──
 *  Submit ICP test results for a sample trial.
 *  Creates a FabricSubmission + TestRun + IcpResult,
 *  then links back to the SampleTrialRequest.
 * ─────────────────────────────────────────────────── */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const trial = await prisma.sampleTrialRequest.findUnique({
      where: { id },
      include: {
        fabric: { select: { id: true, fuzeNumber: true, customerCode: true, factoryCode: true } },
      },
    });

    if (!trial) return NextResponse.json({ ok: false, error: "Trial not found" }, { status: 404 });

    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    const isFactory = user.factoryId === trial.factoryId;
    if (!isAdmin && !isFactory) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { agValue, auValue, unit, testMethod, labReportRef, notes } = body;

    if (agValue == null || agValue < 0) {
      return NextResponse.json({ ok: false, error: "Ag (allotrope) value is required and must be >= 0" }, { status: 400 });
    }

    // Create FabricSubmission → TestRun → IcpResult
    const submission = await prisma.fabricSubmission.create({
      data: {
        fabricId: trial.fabricId,
        fuzeFabricNumber: trial.fabric.fuzeNumber ? String(trial.fabric.fuzeNumber) : null,
        customerFabricCode: trial.fabric.customerCode,
        factoryFabricCode: trial.fabric.factoryCode,
        status: "ICP_RECEIVED",
        testStatus: "COMPLETE",
        category: "SAMPLE_TRIAL_ICP",
        raw: {
          source: "FACTORY_PORTAL_ICP_SUBMIT",
          sampleTrialId: trial.id,
          submittedBy: user.id,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    const testRun = await prisma.testRun.create({
      data: {
        submissionId: submission.id,
        testType: "ICP",
        testMethodRaw: testMethod || "ICP-OES (Factory Submitted)",
        testMethodStd: "ICP-OES per AATCC TM100",
        testedMetal: "Ag",
        labId: trial.icpLabId || null,
        raw: {
          source: "FACTORY_PORTAL_ICP_SUBMIT",
          sampleTrialId: trial.id,
          labReportRef: labReportRef || null,
        },
        aiReviewNotes: `ICP results submitted via factory portal for Sample Trial Request. Ag: ${agValue} ${unit || "ppm"}${auValue ? `, Au: ${auValue} ${unit || "ppm"}` : ""}`,
        icpResult: {
          create: {
            agValue: parseFloat(agValue),
            auValue: auValue ? parseFloat(auValue) : null,
            agRaw: `${agValue} ${unit || "ppm"}`,
            auRaw: auValue ? `${auValue} ${unit || "ppm"}` : null,
            unit: unit || "ppm",
          },
        },
      },
    });

    // Update the trial request with ICP results
    const updated = await prisma.sampleTrialRequest.update({
      where: { id },
      data: {
        status: "ICP_SUBMITTED",
        icpTestRunId: testRun.id,
        icpSubmittedAt: new Date(),
        icpAgValue: parseFloat(agValue),
        icpAuValue: auValue ? parseFloat(auValue) : null,
        notes: notes ? `${trial.notes || ""}\n\nICP Notes: ${notes}`.trim() : trial.notes,
      },
    });

    return NextResponse.json({
      ok: true,
      trial: updated,
      testRunId: testRun.id,
      submissionId: submission.id,
    });
  } catch (e: any) {
    console.error("ICP submit error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
