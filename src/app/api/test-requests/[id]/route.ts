// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pushTestRequestStatus } from "@/lib/notify-realtime";
import {
  sendTestRequestStatusEmail,
  sendShippingInstructionsEmail,
  sendSampleShippedNotification,
  sendShipmentConfirmedEmail,
  sendSampleReceivedEmail,
  sendSampleIssueEmail,
  sendTestingStartedEmail,
  sendResultsReadyEmail,
} from "@/lib/email";
import { getNotifyEmails } from "@/lib/notify-workflow";

const prisma = new PrismaClient();

/** Fire notification + email for test request status changes (non-blocking) */
async function notifyTestRequestChange(testRequestId: string, newStatus: string, existing: any) {
  try {
    // Resolve brand + factory IDs so we can fan out to their whole user
    // base, not just the requester. Penfabric phase 1 May 2026 — factory
    // PO moved states but only the submitter heard about it.
    let brandId: string | null = existing.brandId || null;
    let factoryId: string | null = null;
    try {
      if (existing.submissionId || existing.fabricId) {
        const meta = await prisma.testRequest.findUnique({
          where: { id: testRequestId },
          select: {
            brandId: true,
            submission: { select: { factoryId: true, brandId: true } },
            fabric: { select: { factoryId: true, brandId: true } },
          },
        });
        brandId =
          brandId || meta?.submission?.brandId || meta?.fabric?.brandId || null;
        factoryId =
          meta?.submission?.factoryId || meta?.fabric?.factoryId || null;
      }
    } catch (lookupErr) {
      console.error("[NOTIFY] Test request brand/factory lookup failed:", lookupErr);
    }

    // Push real-time notification (DB row + SSE)
    await pushTestRequestStatus({
      testRequestId,
      status: newStatus,
      createdByUserId: existing.requestedById || undefined,
      poNumber: existing.poNumber,
      brandId,
      factoryId,
    });

    // Send email to the requester
    if (existing.requestedById) {
      const requester = await prisma.user.findUnique({
        where: { id: existing.requestedById },
        select: { email: true, name: true },
      });
      if (requester?.email) {
        await sendTestRequestStatusEmail({
          email: requester.email,
          name: requester.name || "Team",
          poNumber: existing.poNumber || testRequestId,
          newStatus,
          testRequestId,
        });
      }
    }
  } catch (err) {
    console.error("[NOTIFY] Test request notification failed:", err);
  }
}

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
        distributor: { select: { id: true, name: true, region: true, country: true, coverageCountries: true } },
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
      notifyTestRequestChange(id, "PENDING_APPROVAL", existing).catch(() => {});
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
      notifyTestRequestChange(id, "APPROVED", existing).catch(() => {});

      // ── Send shipping instructions to requester on approval ──
      (async () => {
        try {
          // Fetch full test request with lab + fabric + requester + lines
          const fullTR = await prisma.testRequest.findUnique({
            where: { id },
            include: {
              lab: { select: { name: true, address: true, city: true, state: true, country: true, email: true, phone: true } },
              fabric: { select: { fuzeNumber: true, customerCode: true, factoryCode: true, construction: true, weightGsm: true } },
              requestedBy: { select: { email: true, name: true } },
              lines: { select: { testType: true, testMethod: true } },
            },
          });
          if (!fullTR?.lab || !fullTR.requestedBy?.email) return;

          // Build sample prep instructions based on test types
          const testTypes = fullTR.lines.map((l: any) => l.testType);
          const prepParts: string[] = [];
          if (testTypes.includes("ICP")) {
            prepParts.push("<strong>ICP-OES:</strong> Provide 2 swatches, each minimum 10cm x 10cm. Unwashed. Do not contaminate with metals.");
          }
          if (testTypes.includes("ANTIBACTERIAL")) {
            prepParts.push("<strong>Antibacterial (AATCC 100 / JIS L 1902):</strong> Provide 6 swatches, 4.8cm diameter (±0.5cm). Include untreated control swatches of the same fabric.");
          }
          if (testTypes.includes("FUNGAL")) {
            prepParts.push("<strong>Antifungal (AATCC 30):</strong> Provide 3 swatches, minimum 5cm x 5cm each.");
          }
          if (testTypes.includes("ODOR")) {
            prepParts.push("<strong>Odor Reduction:</strong> Provide 3 swatches, minimum 10cm x 10cm. Seal in individual zip-lock bags.");
          }
          if (testTypes.includes("UV")) {
            prepParts.push("<strong>UV Protection:</strong> Provide 2 swatches, minimum 15cm x 15cm.");
          }
          if (prepParts.length === 0) {
            prepParts.push("Provide test swatches per the lab's standard requirements. Contact your FUZE representative if unsure.");
          }

          const fabricInfo = [
            fullTR.fabric?.fuzeNumber ? `FUZE-${fullTR.fabric.fuzeNumber}` : null,
            fullTR.fabric?.customerCode,
            fullTR.fabric?.construction,
            fullTR.fabric?.weightGsm ? `${fullTR.fabric.weightGsm} GSM` : null,
          ].filter(Boolean).join(" | ") || "See PO for details";

          await sendShippingInstructionsEmail({
            email: fullTR.requestedBy.email,
            name: fullTR.requestedBy.name || "Team",
            testRequestId: id,
            poNumber: fullTR.poNumber || id,
            labName: fullTR.lab.name,
            labAddress: fullTR.lab.address || "",
            labCity: fullTR.lab.city || "",
            labState: fullTR.lab.state || undefined,
            labCountry: fullTR.lab.country || "",
            labEmail: fullTR.lab.email || undefined,
            labPhone: fullTR.lab.phone || undefined,
            testTypes: testTypes,
            fabricInfo,
            samplePrepInstructions: prepParts.join("<br><br>"),
          });
        } catch (shipErr) {
          console.error("[SHIPPING] Shipping instructions email failed:", shipErr);
        }
      })();

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
      notifyTestRequestChange(id, "REJECTED", existing).catch(() => {});
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
      notifyTestRequestChange(id, "SUBMITTED", existing).catch(() => {});
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
      notifyTestRequestChange(id, "IN_PROGRESS", existing).catch(() => {});
      return NextResponse.json({ ok: true, testRequest: updated, message: "Marked as in progress" });
    }

    // ─── Action: Results Received ─────────────────────────
    if (action === "results_received") {
      const updated = await prisma.testRequest.update({
        where: { id },
        data: { status: "RESULTS_RECEIVED" },
      });
      notifyTestRequestChange(id, "RESULTS_RECEIVED", existing).catch(() => {});
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
      notifyTestRequestChange(id, "COMPLETE", existing).catch(() => {});
      return NextResponse.json({ ok: true, testRequest: updated, message: "Test request completed" });
    }

    // ─── Action: Mark Shipped (customer enters tracking) ─────────────────────────
    if (action === "mark_shipped") {
      if (!["APPROVED", "SUBMITTED"].includes(existing.status)) {
        return NextResponse.json({ ok: false, error: "Cannot mark as shipped from current status" }, { status: 400 });
      }
      const { carrier, trackingNumber, shipDate, sampleCount } = body;
      if (!carrier || !trackingNumber) {
        return NextResponse.json({ ok: false, error: "Carrier and tracking number are required" }, { status: 400 });
      }

      // Find or create the shipment for this test request
      let shipment = await prisma.sampleShipment.findFirst({
        where: { testRequestId: id },
      });
      if (shipment) {
        shipment = await prisma.sampleShipment.update({
          where: { id: shipment.id },
          data: {
            carrier,
            trackingNumber,
            shipDate: shipDate ? new Date(shipDate) : new Date(),
            sampleCount: sampleCount || 1,
            status: "SHIPPED",
          },
        });
      } else {
        shipment = await prisma.sampleShipment.create({
          data: {
            testRequestId: id,
            fabricId: existing.fabricId,
            labId: existing.labId,
            destinationName: existing.lab?.name || "FUZE Lab",
            carrier,
            trackingNumber,
            shipDate: shipDate ? new Date(shipDate) : new Date(),
            sampleCount: sampleCount || 1,
            status: "SHIPPED",
            createdBy: userId,
          },
        });
      }

      // Add shipment event
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: "SHIPPED",
          notes: `Shipped via ${carrier} — ${trackingNumber}`,
          handler: userId,
        },
      });

      // Update TestRequest status
      const updated = await prisma.testRequest.update({
        where: { id },
        data: { status: "SUBMITTED" },
      });

      // Send emails (non-blocking)
      (async () => {
        try {
          const fullTR = await prisma.testRequest.findUnique({
            where: { id },
            include: {
              fabric: { select: { fuzeNumber: true, customerCode: true } },
              requestedBy: { select: { email: true, name: true } },
            },
          });
          const fabricInfo = [
            fullTR?.fabric?.fuzeNumber ? `FUZE-${fullTR.fabric.fuzeNumber}` : null,
            fullTR?.fabric?.customerCode,
          ].filter(Boolean).join(" | ") || "See PO";

          // Route notifications: lab team + admins + AM get shipped notice, customer gets confirmation
          const notify = await getNotifyEmails(id, "SAMPLE_SHIPPED");

          if (notify.toInternal.length > 0) {
            await sendSampleShippedNotification({
              adminEmails: notify.toInternal,
              poNumber: existing.poNumber || id,
              fabricInfo,
              carrier,
              trackingNumber,
              customerName: fullTR?.requestedBy?.name || "Customer",
              shipDate: shipDate || new Date().toISOString().split("T")[0],
            });
          }

          if (notify.toCustomer.length > 0) {
            await sendShipmentConfirmedEmail({
              email: notify.toCustomer[0],
              name: notify.targets.customer?.name || "Team",
              poNumber: existing.poNumber || id,
              carrier,
              trackingNumber,
            });
          }
        } catch (emailErr) {
          console.error("[EMAIL] mark_shipped emails failed:", emailErr);
        }
      })();

      return NextResponse.json({ ok: true, testRequest: updated, shipment, message: "Sample marked as shipped" });
    }

    // ─── Action: Receive Sample (lab/admin marks received) ─────────────────────────
    if (action === "receive_sample") {
      const { condition, pieces, controlIncluded, receivedNotes } = body;

      // Find the shipment
      const shipment = await prisma.sampleShipment.findFirst({
        where: { testRequestId: id },
      });

      if (shipment) {
        await prisma.sampleShipment.update({
          where: { id: shipment.id },
          data: {
            status: condition === "GOOD" ? "AT_LAB" : "AT_LAB",
            actualArrival: new Date(),
            receivedCondition: condition || "GOOD",
            receivedPieces: pieces || null,
            controlIncluded: controlIncluded ?? null,
            receivedNotes: receivedNotes || null,
            receivedById: userId,
          },
        });

        await prisma.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            eventType: "RECEIVED",
            notes: `Received — Condition: ${condition || "GOOD"}${receivedNotes ? ` — ${receivedNotes}` : ""}`,
            handler: userId,
          },
        });
      }

      // Update TestRequest status
      const newStatus = (condition === "DAMAGED" || condition === "INSUFFICIENT") ? existing.status : "SUBMITTED";
      const updated = await prisma.testRequest.update({
        where: { id },
        data: { status: newStatus },
      });

      // Send email to customer + AM
      (async () => {
        try {
          const notify = await getNotifyEmails(id, "SAMPLE_RECEIVED");
          const fullTR = await prisma.testRequest.findUnique({
            where: { id },
            include: {
              fabric: { select: { fuzeNumber: true, customerCode: true } },
              lines: { select: { testType: true } },
            },
          });

          const fabricInfo = [
            fullTR?.fabric?.fuzeNumber ? `FUZE-${fullTR.fabric.fuzeNumber}` : null,
            fullTR?.fabric?.customerCode,
          ].filter(Boolean).join(" | ") || "See PO";

          const customerEmail = notify.toCustomer[0];
          const customerName = notify.targets.customer?.name || "Team";
          if (!customerEmail) return;

          if (condition === "DAMAGED" || condition === "INSUFFICIENT") {
            // Notify customer of issue
            await sendSampleIssueEmail({
              email: customerEmail,
              name: customerName,
              poNumber: existing.poNumber || id,
              fabricInfo,
              issueDescription: receivedNotes || `Sample condition: ${condition}. Please contact the lab for next steps.`,
            });
            // Also notify AM of the issue
            if (notify.targets.accountManager?.email) {
              await sendSampleIssueEmail({
                email: notify.targets.accountManager.email,
                name: notify.targets.accountManager.name,
                poNumber: existing.poNumber || id,
                fabricInfo,
                issueDescription: `Customer sample issue — ${condition}: ${receivedNotes || "No details provided."}`,
              });
            }
          } else {
            await sendSampleReceivedEmail({
              email: customerEmail,
              name: customerName,
              poNumber: existing.poNumber || id,
              fabricInfo,
              receivedDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
              condition: condition || "Good",
              testTypes: fullTR?.lines.map((l: any) => l.testType) || [],
            });
          }
        } catch (emailErr) {
          console.error("[EMAIL] receive_sample emails failed:", emailErr);
        }
      })();

      return NextResponse.json({ ok: true, testRequest: updated, message: condition === "DAMAGED" || condition === "INSUFFICIENT" ? "Sample received with issue — customer notified" : "Sample received — customer notified" });
    }

    // ─── Action: Start Testing (admin/lab starts testing) ─────────────────────────
    if (action === "start_testing") {
      if (!["SUBMITTED", "APPROVED"].includes(existing.status)) {
        return NextResponse.json({ ok: false, error: "Cannot start testing from current status" }, { status: 400 });
      }

      // Calculate estimated completion from max turnaround days
      const lines = await prisma.testRequestLine.findMany({
        where: { testRequestId: id },
        select: { testType: true, testMethod: true, estimatedDays: true },
      });
      const maxDays = Math.max(...lines.map((l: any) => l.estimatedDays || 10), 10);
      const estCompletion = new Date();
      estCompletion.setDate(estCompletion.getDate() + maxDays);

      // Update TestRequest
      const updated = await prisma.testRequest.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          testingStartedAt: new Date(),
          testingStartedById: userId,
          estimatedCompletionDate: estCompletion,
        },
      });

      // Update all lines to IN_PROGRESS
      await prisma.testRequestLine.updateMany({
        where: { testRequestId: id, status: "PENDING" },
        data: { status: "IN_PROGRESS" },
      });

      notifyTestRequestChange(id, "IN_PROGRESS", existing).catch(() => {});

      // Send testing started email to customer + AM
      (async () => {
        try {
          const notify = await getNotifyEmails(id, "TESTING_STARTED");
          const fullTR = await prisma.testRequest.findUnique({
            where: { id },
            include: {
              fabric: { select: { fuzeNumber: true, customerCode: true } },
              lines: { select: { testType: true, testMethod: true, estimatedDays: true } },
            },
          });

          const fabricInfo = [
            fullTR?.fabric?.fuzeNumber ? `FUZE-${fullTR.fabric.fuzeNumber}` : null,
            fullTR?.fabric?.customerCode,
          ].filter(Boolean).join(" | ") || "See PO";

          const testLineData = fullTR?.lines.map((l: any) => ({
            testType: l.testType,
            testMethod: l.testMethod || undefined,
            estimatedDays: l.estimatedDays || undefined,
          })) || [];

          const estDateStr = estCompletion.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

          // Email customer
          if (notify.toCustomer[0]) {
            await sendTestingStartedEmail({
              email: notify.toCustomer[0],
              name: notify.targets.customer?.name || "Team",
              poNumber: existing.poNumber || id,
              fabricInfo,
              testLines: testLineData,
              estimatedCompletionDate: estDateStr,
            });
          }

          // Email AM
          if (notify.targets.accountManager?.email) {
            await sendTestingStartedEmail({
              email: notify.targets.accountManager.email,
              name: notify.targets.accountManager.name,
              poNumber: existing.poNumber || id,
              fabricInfo,
              testLines: testLineData,
              estimatedCompletionDate: estDateStr,
            });
          }
        } catch (emailErr) {
          console.error("[EMAIL] start_testing email failed:", emailErr);
        }
      })();

      return NextResponse.json({ ok: true, testRequest: updated, message: `Testing started — est. completion ${estCompletion.toLocaleDateString()}` });
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
      notifyTestRequestChange(id, "CANCELLED", existing).catch(() => {});
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
    if (body.distributorId !== undefined) updateData.distributorId = body.distributorId || null;
    if (body.pricingTier !== undefined) updateData.pricingTier = body.pricingTier || null;
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
