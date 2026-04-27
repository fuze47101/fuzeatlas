// @ts-nocheck
/**
 * GET /api/admin/sample-requests
 *
 * Admin-side view of every factory FUZE sample request. Built to fix
 * Scott Pace's #cmo7jxpom — "I have no path to locate or fulfill
 * inbound sample requests."
 *
 * Filters: ?status=… ?factoryId=… ?stale=1
 * Sort: SUBMITTED first (action needed), then by createdAt desc.
 *
 * PATCH /api/admin/sample-requests
 *   Body: { id, action, ... }
 *   Actions:
 *     - approve              { adminNotes? }
 *     - reject               { rejectedReason }
 *     - mark-shipped         { sampleTrackingNumber, shippingCarrier? }
 *     - mark-received
 *     - mark-trial-in-progress
 *     - mark-icp-pending
 *     - mark-complete
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ACTION_NEEDED_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "ICP_PENDING"];

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "LAB_USER", "LAB_MANAGER"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");
    const factoryId = url.searchParams.get("factoryId");
    const stale = url.searchParams.get("stale") === "1";

    const where: any = {};
    if (statusFilter) where.status = statusFilter;
    if (factoryId) where.factoryId = factoryId;
    if (stale) {
      // Stale = SUBMITTED or UNDER_REVIEW for 3+ days.
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      where.status = { in: ["SUBMITTED", "UNDER_REVIEW"] };
      where.createdAt = { lte: cutoff };
    }

    const requests = await prisma.sampleTrialRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        factory: {
          select: { id: true, name: true, country: true, distributorId: true },
        },
        fabric: {
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            customerReference: true,
            fabricCategory: true,
            color: true,
            weightGsm: true,
          },
        },
        brand: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        icpLab: { select: { id: true, name: true } },
      },
    });

    const now = Date.now();
    const enriched = requests.map((r: any) => {
      const ageDays = Math.floor(
        (now - new Date(r.createdAt).getTime()) / (24 * 60 * 60 * 1000),
      );
      const actionNeeded = ACTION_NEEDED_STATUSES.includes(r.status);
      const isStale =
        ["SUBMITTED", "UNDER_REVIEW"].includes(r.status) && ageDays >= 3;
      return {
        ...r,
        ageDays,
        actionNeeded,
        isStale,
      };
    });

    enriched.sort((a: any, b: any) => {
      if (a.actionNeeded !== b.actionNeeded) return a.actionNeeded ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const summary = {
      total: enriched.length,
      submitted: enriched.filter((r: any) => r.status === "SUBMITTED").length,
      underReview: enriched.filter((r: any) => r.status === "UNDER_REVIEW").length,
      approved: enriched.filter((r: any) => r.status === "APPROVED").length,
      shipped: enriched.filter((r: any) => r.status === "SAMPLE_SHIPPED").length,
      stale: enriched.filter((r: any) => r.isStale).length,
      complete: enriched.filter((r: any) => r.status === "COMPLETE").length,
    };

    return NextResponse.json({ ok: true, requests: enriched, summary });
  } catch (e: any) {
    console.error("[sample-requests.GET] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER", "BD_REP"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, action } = body;
    if (!id || !action) {
      return NextResponse.json({ ok: false, error: "id and action required" }, { status: 400 });
    }

    const existing = await prisma.sampleTrialRequest.findUnique({
      where: { id },
      select: {
        id: true,
        factoryId: true,
        requestedById: true,
        status: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
    }

    const data: any = {};
    let notifyTitle = "";
    let notifyMessage = "";

    switch (action) {
      case "approve":
        data.status = "APPROVED";
        data.approvedById = user.id;
        data.approvedAt = new Date();
        if (body.adminNotes) data.adminNotes = body.adminNotes;
        notifyTitle = "Sample request approved";
        notifyMessage = "Your FUZE sample request has been approved. Shipping next.";
        break;
      case "reject":
        if (!body.rejectedReason) {
          return NextResponse.json(
            { ok: false, error: "rejectedReason required" },
            { status: 400 },
          );
        }
        data.status = "REJECTED";
        data.rejectedReason = body.rejectedReason;
        notifyTitle = "Sample request not approved";
        notifyMessage = `Reason: ${body.rejectedReason}`;
        break;
      case "mark-shipped":
        data.status = "SAMPLE_SHIPPED";
        data.sampleShippedDate = new Date();
        if (body.sampleTrackingNumber) data.sampleTrackingNumber = body.sampleTrackingNumber;
        if (body.shippingCarrier) data.shippingCarrier = body.shippingCarrier;
        notifyTitle = "FUZE sample shipped";
        notifyMessage = body.sampleTrackingNumber
          ? `Tracking ${body.sampleTrackingNumber}${body.shippingCarrier ? ` (${body.shippingCarrier})` : ""}`
          : "Tracking will follow.";
        break;
      case "mark-received":
        data.status = "SAMPLE_RECEIVED";
        data.sampleReceivedDate = new Date();
        notifyTitle = "Sample marked received";
        notifyMessage = "FUZE has confirmed delivery. Begin trial when ready.";
        break;
      case "mark-trial-in-progress":
        data.status = "TRIAL_IN_PROGRESS";
        notifyTitle = "Trial in progress";
        notifyMessage = "Status updated.";
        break;
      case "mark-icp-pending":
        data.status = "ICP_PENDING";
        notifyTitle = "Awaiting ICP submission";
        notifyMessage = "Reminder: please send your treated sample to the ICP lab.";
        break;
      case "mark-complete":
        data.status = "COMPLETE";
        notifyTitle = "Sample trial complete";
        notifyMessage = "Trial closed.";
        break;
      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }

    const updated = await prisma.sampleTrialRequest.update({
      where: { id },
      data,
    });

    // Notify the factory user who filed the request.
    try {
      if (existing.requestedById && notifyTitle) {
        await prisma.notification.create({
          data: {
            userId: existing.requestedById,
            type: "PO_STATUS",
            title: notifyTitle,
            message: notifyMessage,
            link: `/factory-portal/sample-requests/${id}`,
          },
        });
      }
    } catch (e) {
      console.error("[sample-requests] notify failed (non-blocking):", e);
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (e: any) {
    console.error("[sample-requests.PATCH] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
