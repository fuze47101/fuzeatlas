// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendTrialStatusEmail, sendTrialAdminNotification } from "@/lib/email";

/* ── GET /api/factory-portal/sample-trial/[id] ── trial detail ── */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const trial = await prisma.sampleTrialRequest.findUnique({
      where: { id },
      include: {
        fabric: {
          select: {
            id: true, fuzeNumber: true, customerCode: true, factoryCode: true,
            construction: true, weightGsm: true, widthInches: true, fabricCategory: true,
            contents: { select: { material: true, percent: true }, orderBy: { percent: "desc" } },
          },
        },
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true, country: true, city: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        icpLab: { select: { id: true, name: true, city: true, country: true, email: true } },
      },
    });

    if (!trial) return NextResponse.json({ ok: false, error: "Trial not found" }, { status: 404 });

    // Auth check: factory users can only see their own trials
    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    if (!isAdmin && trial.factoryId !== user.factoryId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, trial });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── PUT /api/factory-portal/sample-trial/[id] ── update status/tracking ── */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const trial = await prisma.sampleTrialRequest.findUnique({ where: { id } });
    if (!trial) return NextResponse.json({ ok: false, error: "Trial not found" }, { status: 404 });

    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    const isFactory = user.factoryId === trial.factoryId;

    if (!isAdmin && !isFactory) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Status transitions
    const VALID_STATUSES = [
      "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED",
      "SAMPLE_SHIPPED", "SAMPLE_RECEIVED", "TRIAL_IN_PROGRESS",
      "ICP_PENDING", "ICP_SUBMITTED", "COMPLETE",
    ];

    const updateData: any = {};

    // Admin-only fields
    if (isAdmin) {
      if (body.status && VALID_STATUSES.includes(body.status)) {
        updateData.status = body.status;

        if (body.status === "APPROVED") {
          updateData.approvedById = user.id;
          updateData.approvedAt = new Date();
        }
        if (body.status === "REJECTED") {
          updateData.rejectedReason = body.rejectedReason || null;
        }
        if (body.status === "SAMPLE_SHIPPED") {
          updateData.sampleShippedDate = new Date();
          if (body.sampleTrackingNumber) updateData.sampleTrackingNumber = body.sampleTrackingNumber;
        }
      }
      if (body.sampleTrackingNumber !== undefined) updateData.sampleTrackingNumber = body.sampleTrackingNumber;
      if (body.adminNotes !== undefined) updateData.adminNotes = body.adminNotes;
    }

    // Factory users can update certain fields
    if (isFactory || isAdmin) {
      if (body.status === "SAMPLE_RECEIVED" && (trial.status === "SAMPLE_SHIPPED" || isAdmin)) {
        updateData.status = "SAMPLE_RECEIVED";
        updateData.sampleReceivedDate = new Date();
      }
      if (body.status === "TRIAL_IN_PROGRESS" && (trial.status === "SAMPLE_RECEIVED" || isAdmin)) {
        updateData.status = "TRIAL_IN_PROGRESS";
      }
      if (body.status === "ICP_PENDING" && (trial.status === "TRIAL_IN_PROGRESS" || isAdmin)) {
        updateData.status = "ICP_PENDING";
      }
      if (body.notes !== undefined) updateData.notes = body.notes;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid updates provided" }, { status: 400 });
    }

    const updated = await prisma.sampleTrialRequest.update({
      where: { id },
      data: updateData,
      include: {
        fabric: {
          select: {
            id: true, fuzeNumber: true, customerCode: true, factoryCode: true,
            construction: true, weightGsm: true, widthInches: true, fabricCategory: true,
            contents: { select: { material: true, percent: true }, orderBy: { percent: "desc" } },
          },
        },
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true, country: true, city: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        icpLab: { select: { id: true, name: true, city: true, country: true } },
      },
    });

    // ── Send email notifications on status changes (non-blocking) ──
    if (updateData.status && updateData.status !== trial.status) {
      const newStatus = updateData.status;
      const fabricInfo = updated.fabric
        ? `${updated.fabric.fuzeNumber ? `FUZE-${updated.fabric.fuzeNumber}` : ""} ${updated.fabric.customerCode || updated.fabric.factoryCode || ""}`.trim()
        : "N/A";
      const factoryName = updated.factory?.name || "Unknown Factory";

      // Notify the factory user who requested the trial
      if (updated.requestedBy?.email) {
        sendTrialStatusEmail({
          email: updated.requestedBy.email,
          name: updated.requestedBy.name || "Factory User",
          trialId: id,
          factoryName,
          fabricInfo,
          newStatus,
          trackingNumber: updated.sampleTrackingNumber || undefined,
          rejectedReason: body.rejectedReason || undefined,
          adminNotes: body.adminNotes || undefined,
          icpLabName: updated.icpLab?.name || undefined,
        }).catch((err: any) => console.error("Trial email failed:", err));
      }

      // Notify admins when ICP results are submitted
      if (newStatus === "ICP_SUBMITTED") {
        prisma.user.findMany({
          where: { role: { in: ["ADMIN", "EMPLOYEE"] }, email: { not: null } },
          select: { email: true },
        }).then((admins: any[]) => {
          const emails = admins.map((a: any) => a.email).filter(Boolean);
          if (emails.length > 0) {
            sendTrialAdminNotification({
              adminEmails: emails,
              trialId: id,
              factoryName,
              fabricInfo,
              requestedByName: updated.requestedBy?.name || "Factory User",
              event: "ICP_SUBMITTED",
            }).catch((err: any) => console.error("Admin trial email failed:", err));
          }
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, trial: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
