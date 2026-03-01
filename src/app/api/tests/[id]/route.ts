// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/tests/[id] ── fetch single test run with all details */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const testRun = await prisma.testRun.findUnique({
      where: { id },
      include: {
        lab: { select: { id: true, name: true } },
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
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      agValue, auValue, agUnit,
      // AB fields
      organism1, organism2, result1, result2, abPass,
      // Fungal fields
      fungalWrittenResult, fungalPass,
      // Odor fields
      testedOdor, odorResult, odorPass,
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

    // Update core TestRun fields
    const updated = await prisma.testRun.update({
      where: { id },
      data: {
        ...(testType !== undefined && { testType }),
        ...(testReportNumber !== undefined && { testReportNumber: testReportNumber || null }),
        ...(testMethodStd !== undefined && { testMethodStd: testMethodStd || null }),
        ...(washCount !== undefined && { washCount: washCount ? parseInt(String(washCount), 10) : null }),
        labId,
        testDate: parsedDate,
      },
    });

    // Update ICP result if fields provided
    if (updated.testType === "ICP" && (agValue !== undefined || auValue !== undefined)) {
      if (existing.icpResult) {
        await prisma.icpResult.update({
          where: { id: existing.icpResult.id },
          data: {
            ...(agValue !== undefined && { agValue: agValue ? parseFloat(String(agValue)) : null, agRaw: agValue ? String(agValue) : null }),
            ...(auValue !== undefined && { auValue: auValue ? parseFloat(String(auValue)) : null, auRaw: auValue ? String(auValue) : null }),
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
    if (updated.testType === "ANTIBACTERIAL" && (organism1 !== undefined || result1 !== undefined)) {
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

    return NextResponse.json({ ok: true, testRunId: id, message: "Test run updated" });
  } catch (err: any) {
    console.error("Test edit error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
