// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendResultsReadyEmail } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth";
import { notifyTestResult } from "@/lib/notify";

/* ── GET /api/tests/[id] ── fetch single test run with all details */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const testRun = await prisma.testRun.findUnique({
      where: { id },
      include: {
        lab: { select: { id: true, name: true } },
        // Project is editable from the test detail page (Tina ticket Apr 2026 —
        // admin needs to retag tests to a project after upload).
        project: { select: { id: true, name: true } },
        submission: {
          select: {
            id: true,
            fuzeFabricNumber: true,
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
            fabric: { select: { id: true, fuzeNumber: true, customerCode: true } },
          },
        },
        icpResult: true,
        abResult: true,
        fungalResult: true,
        odorResult: true,
        documents: { select: { id: true, filename: true, kind: true } },
      },
    });

    if (!testRun) {
      return NextResponse.json({ ok: false, error: "Test run not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, testRun });
  } catch (err: any) {
    console.error("Test detail error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── PATCH /api/tests/[id] ── edit test run core fields ────────── */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      testType,
      testReportNumber,
      labName,
      testDate,
      testMethodStd,
      washCount,
      // ICP fields
      agValue,
      auValue,
      agUnit,
      // AB fields
      organism1,
      organism2,
      result1,
      result2,
      abPass,
      // Fungal fields
      fungalWrittenResult,
      fungalPass,
      // Odor fields
      testedOdor,
      odorResult,
      odorPass,
      // Brand visibility
      brandVisible,
      // Linked-entity edits (Tina ticket Apr 2026):
      //   • projectId — direct on TestRun
      //   • factoryId — proxied onto the linked submission (factory lives there)
      projectId,
      factoryId,
    } = body;

    // Verify test exists
    const existing = await prisma.testRun.findUnique({
      where: { id },
      include: { icpResult: true, abResult: true, fungalResult: true, odorResult: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Test run not found" }, { status: 404 });
    }

    // Resolve lab if changed
    let labId = existing.labId;
    if (labName !== undefined) {
      if (labName) {
        let lab = await prisma.lab.findFirst({ where: { name: labName } });
        if (!lab) {
          lab = await prisma.lab.create({ data: { name: labName } });
        }
        labId = lab.id;
      } else {
        labId = null;
      }
    }

    // Parse date
    let parsedDate = existing.testDate;
    if (testDate !== undefined) {
      if (testDate) {
        const d = new Date(testDate);
        parsedDate = !isNaN(d.getTime()) ? d : null;
      } else {
        parsedDate = null;
      }
    }

    // Brand visibility stamp — derive userId from the session, not a spoof-able header.
    const sessionUser = await getCurrentUser();
    const userId = sessionUser?.id || null;
    const brandVisData: any = {};
    if (brandVisible !== undefined) {
      brandVisData.brandVisible = Boolean(brandVisible);
      if (brandVisible) {
        brandVisData.brandApprovedById = userId;
        brandVisData.brandApprovedAt = new Date();
      } else {
        brandVisData.brandApprovedById = null;
        brandVisData.brandApprovedAt = null;
      }
    }

    // Update core TestRun fields
    const updated = await prisma.testRun.update({
      where: { id },
      data: {
        ...(testType !== undefined && { testType }),
        ...(testReportNumber !== undefined && { testReportNumber: testReportNumber || null }),
        ...(testMethodStd !== undefined && { testMethodStd: testMethodStd || null }),
        ...(washCount !== undefined && {
          washCount: washCount ? parseInt(String(washCount), 10) : null,
        }),
        ...(projectId !== undefined && { projectId: projectId || null }),
        labId,
        testDate: parsedDate,
        ...brandVisData,
      },
    });

    // Factory lives on the linked FabricSubmission, not on TestRun. If the
    // caller passed factoryId, proxy it onto the submission. If there's no
    // submission yet (standalone upload), create one on the fly so Tina can
    // attach a factory to a freshly uploaded report. Ticket cmo8d1yuy.
    if (factoryId !== undefined) {
      if (existing.submissionId) {
        await prisma.fabricSubmission.update({
          where: { id: existing.submissionId },
          data: { factoryId: factoryId || null },
        });
      } else if (factoryId) {
        // No submission yet — create a minimal one and link it to the test.
        const newSub = await prisma.fabricSubmission.create({
          data: {
            factoryId,
            status: "Submitted",
            testStatus: "PENDING",
            progressPercent: 0,
          },
        });
        await prisma.testRun.update({
          where: { id },
          data: { submissionId: newSub.id },
        });
      }
    }

    // Update ICP result if fields provided
    if (updated.testType === "ICP" && (agValue !== undefined || auValue !== undefined)) {
      if (existing.icpResult) {
        await prisma.icpResult.update({
          where: { id: existing.icpResult.id },
          data: {
            ...(agValue !== undefined && {
              agValue: agValue ? parseFloat(String(agValue)) : null,
              agRaw: agValue ? String(agValue) : null,
            }),
            ...(auValue !== undefined && {
              auValue: auValue ? parseFloat(String(auValue)) : null,
              auRaw: auValue ? String(auValue) : null,
            }),
            ...(agUnit !== undefined && { unit: agUnit || "ppm" }),
          },
        });
      } else {
        await prisma.icpResult.create({
          data: {
            testRunId: id,
            agValue: agValue ? parseFloat(String(agValue)) : null,
            auValue: auValue ? parseFloat(String(auValue)) : null,
            agRaw: agValue ? String(agValue) : null,
            auRaw: auValue ? String(auValue) : null,
            unit: agUnit || "ppm",
          },
        });
      }
    }

    // Update AB result
    if (
      updated.testType === "ANTIBACTERIAL" &&
      (organism1 !== undefined || result1 !== undefined)
    ) {
      if (existing.abResult) {
        await prisma.antibacterialResult.update({
          where: { id: existing.abResult.id },
          data: {
            ...(organism1 !== undefined && { organism1: organism1 || null }),
            ...(organism2 !== undefined && { organism2: organism2 || null }),
            ...(result1 !== undefined && { result1: result1 ? parseFloat(String(result1)) : null }),
            ...(result2 !== undefined && { result2: result2 ? parseFloat(String(result2)) : null }),
            ...(abPass !== undefined && { pass: Boolean(abPass) }),
          },
        });
      }
    }

    // Update fungal result
    if (updated.testType === "FUNGAL" && fungalWrittenResult !== undefined) {
      if (existing.fungalResult) {
        await prisma.fungalResult.update({
          where: { id: existing.fungalResult.id },
          data: {
            writtenResult: fungalWrittenResult || null,
            ...(fungalPass !== undefined && { pass: Boolean(fungalPass) }),
          },
        });
      }
    }

    // Update odor result
    if (updated.testType === "ODOR" && (testedOdor !== undefined || odorResult !== undefined)) {
      if (existing.odorResult) {
        await prisma.odorResult.update({
          where: { id: existing.odorResult.id },
          data: {
            ...(testedOdor !== undefined && { testedOdor: testedOdor || null }),
            ...(odorResult !== undefined && { result: odorResult || null }),
            ...(odorPass !== undefined && { pass: Boolean(odorPass) }),
          },
        });
      }
    }

    // ── Send enhanced results email when stamping for brand visibility ──
    if (brandVisible === true) {
      (async () => {
        try {
          // Get the full test run with related data
          const fullTest = await prisma.testRun.findUnique({
            where: { id },
            include: {
              submission: {
                select: {
                  fuzeFabricNumber: true,
                  fabric: { select: { fuzeNumber: true, customerCode: true } },
                  factory: { select: { id: true, name: true } },
                  brand: { select: { id: true, name: true } },
                },
              },
              icpResult: true,
              abResult: true,
              fungalResult: true,
              odorResult: true,
              // Check if this test is linked to a TestRequestLine
              testRequestLines: {
                select: {
                  testRequest: {
                    select: {
                      id: true,
                      poNumber: true,
                      requestedBy: { select: { email: true, name: true } },
                    },
                  },
                },
              },
            },
          });
          if (!fullTest) return;

          // Find the customer to email (from test request or submission)
          let customerEmail: string | null = null;
          let customerName = "Team";
          let poNumber = "";

          if (fullTest.testRequestLines?.length > 0) {
            const trLine = fullTest.testRequestLines[0];
            customerEmail = trLine.testRequest?.requestedBy?.email || null;
            customerName = trLine.testRequest?.requestedBy?.name || "Team";
            poNumber = trLine.testRequest?.poNumber || "";
          }

          if (!customerEmail) return; // No customer to notify

          const fabricInfo =
            [
              fullTest.submission?.fuzeFabricNumber
                ? `FUZE-${fullTest.submission.fuzeFabricNumber}`
                : null,
              fullTest.submission?.fabric?.customerCode,
            ]
              .filter(Boolean)
              .join(" | ") || "See test report";

          // Build result entry
          const results: any[] = [];
          let passed = false;

          if (fullTest.testType === "ICP" && fullTest.icpResult) {
            const val = fullTest.icpResult.agValue;
            passed = val != null && val >= 0.25;
            results.push({
              testType: "ICP Analysis",
              testMethod: "ICP-OES",
              result: val != null ? `${val} mg/kg` : "See report",
              passed,
              detail: val != null ? `Ag content: ${val} mg/kg` : undefined,
            });
          } else if (fullTest.testType === "ANTIBACTERIAL" && fullTest.abResult) {
            passed = fullTest.abResult.pass === true;
            const r1 = fullTest.abResult.result1;
            results.push({
              testType: "Antibacterial",
              testMethod: fullTest.testMethodStd || "AATCC 100",
              result: r1 != null ? `${r1}% reduction` : "See report",
              passed,
              detail: r1 != null ? `Bacterial reduction: ${r1}%` : undefined,
            });
          } else if (fullTest.testType === "FUNGAL" && fullTest.fungalResult) {
            passed = fullTest.fungalResult.pass === true;
            results.push({
              testType: "Antifungal",
              testMethod: fullTest.testMethodStd || "AATCC 30",
              result: fullTest.fungalResult.writtenResult || "See report",
              passed,
            });
          } else if (fullTest.testType === "ODOR" && fullTest.odorResult) {
            passed = fullTest.odorResult.pass === true;
            results.push({
              testType: "Odor Reduction",
              testMethod: fullTest.testMethodStd || "",
              result: fullTest.odorResult.result || "See report",
              passed,
            });
          } else {
            results.push({
              testType: fullTest.testType || "Test",
              testMethod: fullTest.testMethodStd || "",
              result: "See full report",
              passed: true,
            });
          }

          await sendResultsReadyEmail({
            email: customerEmail,
            name: customerName,
            poNumber: poNumber || `Test ${fullTest.testReportNumber || id}`,
            fabricInfo,
            overallResult: passed ? "PASSED" : "FAILED",
            results,
          });
        } catch (emailErr) {
          console.error("[EMAIL] Results ready email failed:", emailErr);
        }

        // Penfabric/Raihana follow-on May 2026 — single email to the test
        // requestor is not enough. The brand and the factory should both
        // see this in their in-app notification feed the moment a test is
        // stamped brand-visible. Fan out via notifyTestResult; failure is
        // non-fatal so the stamp action never rolls back.
        try {
          const testName =
            fullTest.testType === "ICP"
              ? `ICP Analysis${fabricInfo ? ` · ${fabricInfo}` : ""}`
              : fullTest.testType === "ANTIBACTERIAL"
              ? `Antibacterial${fabricInfo ? ` · ${fabricInfo}` : ""}`
              : fullTest.testType === "FUNGAL"
              ? `Antifungal${fabricInfo ? ` · ${fabricInfo}` : ""}`
              : fullTest.testType === "ODOR"
              ? `Odor${fabricInfo ? ` · ${fabricInfo}` : ""}`
              : `${fullTest.testType || "Test"}${fabricInfo ? ` · ${fabricInfo}` : ""}`;
          await notifyTestResult({
            testId: id,
            testName,
            result: passed ? "PASSED" : "FAILED",
            brandId: fullTest.submission?.brand?.id,
            factoryId: fullTest.submission?.factory?.id,
          });
        } catch (notifyErr) {
          console.error("[NOTIFY] notifyTestResult failed:", notifyErr);
        }
      })();
    }

    return NextResponse.json({ ok: true, testRunId: id, message: "Test run updated" });
  } catch (err: any) {
    console.error("Test edit error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
