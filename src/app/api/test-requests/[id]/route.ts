// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── GET: Single test request with full details ─────────────────────────
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tr = await prisma.testRequest.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, pipelineStage: true } },
        fabric: {
          select: {
            id: true, fuzeNumber: true, customerCode: true, factoryCode: true,
            construction: true, color: true, weightGsm: true, widthInches: true,
            yarnType: true, finishNote: true,
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
          },
        },
        submission: {
          select: {
            id: true, fuzeFabricNumber: true, customerFabricCode: true,
            applicationMethod: true, washTarget: true, status: true,
          },
        },
        project: { select: { id: true, name: true, stage: true } },
        sow: { select: { id: true, title: true, status: true } },
        lab: {
          select: {
            id: true, name: true, customerNumber: true, email: true, phone: true,
            address: true, city: true, state: true, country: true,
            services: true,
          },
        },
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        lines: {
          include: {
            testRun: {
              select: {
                id: true, testReportNumber: true, testDate: true, testType: true,
                icpResult: true, abResult: true, fungalResult: true, odorResult: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!tr) {
      return NextResponse.json({ ok: false, error: "Test request not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, testRequest: tr });
  } catch (e: any) {
    console.error("Test request GET error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ─── PUT: Update test request (edit, submit, approve, reject, cancel) ─────────────────────────
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;
    const userId = request.headers.get("x-user-id") || null;
    const userRole = request.headers.get("x-user-role") || "";

    const existing = await prisma.testRequest.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Test request not found" }, { status: 404 });
    }

    // ─── Action: Submit for Approval ─────────────────────────
    if (action === "submit") {
      if (existing.status !== "DRAFT") {
        return NextResponse.json({ ok: false, error: "Only draft requests can be submitted" }, { status: 400 });
      }
      const updated = await prisma.testRequest.update({
        where: { id },
        data: {
          status: "PENDING_APPROVAL",
          requestedById: userId,
          requestedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, testRequest: updated, message: "Submitted for approval" });
    }

    // ─── Action: Approve ─────────────────────────
    if (action === "approve") {
      // Only ADMIN or EMPLOYEE can approve
      if (!["ADMIN", "EMPLOYEE"].includes(userRole)) {
        return NextResponse.json({ ok: false, error: "Only administrators can approve test requests" }, { status: 403 });
      }
      if (existing.status !== "PENDING_APPROVAL") {
        return NextResponse.json({ ok: false, error: "Only pending requests can be approved" }, { status: 400 });
      }
      const updated = await prisma.testRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: userId,
          approvedAt: new Date(),
          rejectedAt: null,
          rejectedReason: null,
        },
      });
      return NextResponse.json({ ok: true, testRequest: updated, message: "Test request approved" });
    }

    // ─── Action: Reject ─────────────────────────
    if (action === "reject") {
      if (!["ADMIN", "EMPLOYEE"].includes(userRole)) {
        return NextResponse.json({ ok: false, error: "Only administrators can reject test requests" }, { status: 403 });
      }
      if (existing.status !== "PENDING_APPROVAL") {
        return NextResponse.json({ ok: false, error: "Only pending requests can be rejected" }, { status: 400 });
      }
      const updated = await prisma.testRequest.update({
        where: { id },
        data: {
          status: "DRAFT",  // Send back to draft for revision
          rejectedAt: new Date(),
          rejectedReason: body.rejectedReason || null,
        },
      });
      return NextResponse.json({ ok: true, testRequest: updated, message: "Test request rejected — returned to draft" });
    }

    // ─── Action: Mark as Submitted to Lab ─────────────────────────
    if (action === "submit_to_lab") {
      if (existing.status !== "APPROVED") {
        return NextResponse.json({ ok: false, error: "Only approved requests can be submitted to lab" }, { status: 400 });
      }
      const updated = await prisma.testRequest.update({
        where: { id },
        data: { status: "SUBMITTED" },
      });
      return NextResponse.json({ ok: true, testRequest: updated, message: "Marked as submitted to lab" });
    }

    // ─── Action: Mark In Progress ─────────────────────────
    if (action === "in_progress") {
      if (!["SUBMITTED", "APPROVED"].includes(existing.status)) {
        return NextResponse.json({ ok: false, error: "Cannot mark as in progress from current status" }, { status: 400 });
      }
      const updated = await prisma.testRequest.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });
      return NextResponse.json({ ok: true, testRequest: updated, message: "Marked as in progress" });
    }

    // ─── Action: Results Received ─────────────────────────
    if (action === "results_received") {
      const updated = await prisma.testRequest.update({
        where: { id },
        data: { status: "RESULTS_RECEIVED" },
      });
      return NextResponse.json({ ok: true, testRequest: updated, message: "Results received" });
    }

    // ─── Action: Complete ─────────────────────────
    if (action === "complete") {
      const updated = await prisma.testRequest.update({
        where: { id },
        data: {
          status: "COMPLETE",
          actualCompletionDate: new Date(),
          actualCost: body.actualCost ?? existing.actualCost,
        },
      });
      return NextResponse.json({ ok: true, testRequest: updated, message: "Test request completed" });
    }

    // ─── Action: Cancel ─────────────────────────
    if (action === "cancel") {
      if (["COMPLETE", "CANCELLED"].includes(existing.status)) {
        return NextResponse.json({ ok: false, error: "Cannot cancel a completed or already cancelled request" }, { status: 400 });
      }
      const updated = await prisma.testRequest.update({
        where: { id },
        data: {
          status: "CANCELLED",
          internalNotes: existing.internalNotes
            ? `${existing.internalNotes}\n\nCancelled: ${body.reason || "No reason given"}`
            : `Cancelled: ${body.reason || "No reason given"}`,
        },
      });
      return NextResponse.json({ ok: true, testRequest: updated, message: "Test request cancelled" });
    }

    // ─── Default: Update fields (edit mode) ─────────────────────────
    if (existing.status !== "DRAFT" && existing.status !== "PENDING_APPROVAL") {
      // Allow field edits only on draft/pending
      // But allow internalNotes and actualCost updates at any time
    }

    const updateData: any = {};
    if (body.brandId !== undefined) updateData.brandId = body.brandId || null;
    if (body.fabricId !== undefined) updateData.fabricId = body.fabricId || null;
    if (body.submissionId !== undefined) updateData.submissionId = body.submissionId || null;
    if (body.projectId !== undefined) updateData.projectId = body.projectId || null;
    if (body.sowId !== undefined) updateData.sowId = body.sowId || null;
    if (body.labId !== undefined) {
      updateData.labId = body.labId;
      // Update customer number from new lab
      const newLab = await prisma.lab.findUnique({ where: { id: body.labId }, select: { customerNumber: true } });
      updateData.labCustomerNumber = newLab?.customerNumber || null;
    }
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.specialInstructions !== undefined) updateData.specialInstructions = body.specialInstructions;
    if (body.internalNotes !== undefined) updateData.internalNotes = body.internalNotes;
    if (body.requestedCompletionDate !== undefined) {
      updateData.requestedCompletionDate = body.requestedCompletionDate ? new Date(body.requestedCompletionDate) : null;
    }
    if (body.actualCost !== undefined) updateData.actualCost = body.actualCost;

    // Update lines if provided
    if (body.lines && Array.isArray(body.lines)) {
      // Delete existing lines and recreate
      await prisma.testRequestLine.deleteMany({ where: { testRequestId: id } });

      // Fetch lab services for pricing
      const currentLabId = body.labId || existing.labId;
      const labServices = await prisma.labService.findMany({ where: { labId: currentLabId } });

      const lineData = body.lines.map((line: any) => {
        const service = labServices.find(
          (s) => s.testType === line.testType && (!line.testMethod || s.testMethod === line.testMethod)
        );
        const qty = line.quantity || 1;
        const isRush = line.rush === true;
        const unitPrice = line.unitPrice ?? service?.priceUSD ?? null;
        const rushPrice = isRush ? (line.rushPrice ?? service?.rushPriceUSD ?? null) : null;
        const totalPrice = unitPrice != null ? unitPrice * qty + (rushPrice || 0) : null;

        return {
          testRequestId: id,
          testType: line.testType,
          testMethod: line.testMethod || service?.testMethod || null,
          description: line.description || service?.description || null,
          quantity: qty,
          unitPrice,
          totalPrice,
          rush: isRush,
          rushPrice,
          estimatedDays: isRush ? (service?.rushDays ?? null) : (service?.turnaroundDays ?? null),
          notes: line.notes || null,
          testRunId: line.testRunId || null,
          status: line.status || "PENDING",
        };
      });

      await prisma.testRequestLine.createMany({ data: lineData });

      // Recalculate estimated cost
      updateData.estimatedCost = lineData.reduce((sum: number, l: any) => sum + (l.totalPrice || 0), 0);
    }

    const updated = await prisma.testRequest.update({
      where: { id },
      data: updateData,
      include: {
        brand: { select: { id: true, name: true } },
        lab: { select: { id: true, name: true } },
        fabric: { select: { id: true, fuzeNumber: true } },
        lines: true,
      },
    });

    return NextResponse.json({ ok: true, testRequest: updated });
  } catch (e: any) {
    console.error("Test request PUT error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ─── DELETE: Remove test request (draft only) ─────────────────────────
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await prisma.testRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Test request not found" }, { status: 404 });
    }
    if (existing.status !== "DRAFT") {
      return NextResponse.json({ ok: false, error: "Only draft requests can be deleted" }, { status: 400 });
    }

    await prisma.testRequestLine.deleteMany({ where: { testRequestId: id } });
    await prisma.testRequest.delete({ where: { id } });

    return NextResponse.json({ ok: true, message: "Test request deleted" });
  } catch (e: any) {
    console.error("Test request DELETE error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
