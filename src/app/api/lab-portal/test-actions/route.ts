// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/lab-portal/test-actions
 *
 * Lab workflow actions:
 * - accept: Lab accepts a test request (PENDING_APPROVAL/APPROVED → IN_PROGRESS)
 * - update_status: Update test request status
 * - set_ready_date: Set expected ready date
 * - link_report: Link an uploaded report (Document/TestRun) to a test request line
 * - complete_line: Mark a test line as complete with results
 * - add_note: Add lab notes to a test request
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isLab = user.role === "LAB_USER" && user.labId;
    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isLab && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { action, testRequestId, lineId, testRunId, expectedReadyDate, notes, status } = body;

    if (!testRequestId) {
      return NextResponse.json({ ok: false, error: "testRequestId required" }, { status: 400 });
    }

    // Verify lab owns this request (unless internal)
    const testRequest = await prisma.testRequest.findUnique({
      where: { id: testRequestId },
      include: {
        lines: true,
        lab: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true, salesRepId: true } },
        fabric: { select: { fuzeNumber: true } },
      },
    });

    if (!testRequest) {
      return NextResponse.json({ ok: false, error: "Test request not found" }, { status: 404 });
    }

    if (isLab && testRequest.labId !== user.labId) {
      return NextResponse.json({ ok: false, error: "This test request belongs to another lab" }, { status: 403 });
    }

    switch (action) {
      // ─── Accept test request ───
      case "accept": {
        const updated = await prisma.testRequest.update({
          where: { id: testRequestId },
          data: {
            status: "IN_PROGRESS",
            testingStartedAt: new Date(),
            testingStartedById: user.id,
            estimatedCompletionDate: expectedReadyDate ? new Date(expectedReadyDate) : null,
          },
        });

        // Update all pending lines to IN_PROGRESS
        await prisma.testRequestLine.updateMany({
          where: { testRequestId, status: "PENDING" },
          data: { status: "IN_PROGRESS" },
        });

        // Notify account manager
        try {
          const amId = testRequest.brand?.salesRepId;
          if (amId) {
            await prisma.notification.create({
              data: {
                userId: amId,
                type: "TEST_RESULTS",
                title: `Lab Started Testing: ${testRequest.poNumber}`,
                message: `${testRequest.lab?.name} has accepted test request ${testRequest.poNumber} for ${testRequest.brand?.name || "—"} (${testRequest.fabric?.fuzeNumber || "—"}).${expectedReadyDate ? ` Expected ready: ${new Date(expectedReadyDate).toLocaleDateString()}.` : ""}`,
                link: `/admin/sample-trials`,
              },
            });
          }

          // Notify all admins
          const admins = await prisma.user.findMany({
            where: { role: "ADMIN", active: true },
            select: { id: true },
          });
          for (const admin of admins) {
            if (admin.id !== amId) {
              await prisma.notification.create({
                data: {
                  userId: admin.id,
                  type: "TEST_RESULTS",
                  title: `Lab Started Testing: ${testRequest.poNumber}`,
                  message: `${testRequest.lab?.name} accepted ${testRequest.poNumber}. ${expectedReadyDate ? `ETA: ${new Date(expectedReadyDate).toLocaleDateString()}` : ""}`,
                  link: `/admin/sample-trials`,
                },
              });
            }
          }
        } catch {}

        return NextResponse.json({ ok: true, testRequest: updated });
      }

      // ─── Set expected ready date ───
      case "set_ready_date": {
        if (!expectedReadyDate) {
          return NextResponse.json({ ok: false, error: "expectedReadyDate required" }, { status: 400 });
        }
        const updated = await prisma.testRequest.update({
          where: { id: testRequestId },
          data: { estimatedCompletionDate: new Date(expectedReadyDate) },
        });
        return NextResponse.json({ ok: true, testRequest: updated });
      }

      // ─── Link uploaded report to test line ───
      case "link_report": {
        if (!lineId || !testRunId) {
          return NextResponse.json({ ok: false, error: "lineId and testRunId required" }, { status: 400 });
        }

        // Update the test request line with the test run
        const updatedLine = await prisma.testRequestLine.update({
          where: { id: lineId },
          data: {
            testRunId,
            status: "COMPLETE",
          },
        });

        // Check if all lines are complete → mark test request as RESULTS_RECEIVED
        const allLines = await prisma.testRequestLine.findMany({
          where: { testRequestId },
        });
        const allComplete = allLines.every((l) => l.status === "COMPLETE");

        if (allComplete) {
          await prisma.testRequest.update({
            where: { id: testRequestId },
            data: {
              status: "RESULTS_RECEIVED",
              actualCompletionDate: new Date(),
            },
          });

          // Notify AM that results are ready
          try {
            const amId = testRequest.brand?.salesRepId;
            if (amId) {
              await prisma.notification.create({
                data: {
                  userId: amId,
                  type: "TEST_RESULTS",
                  title: `Results Ready: ${testRequest.poNumber}`,
                  message: `All test results received for ${testRequest.poNumber} (${testRequest.brand?.name || "—"}, ${testRequest.fabric?.fuzeNumber || "—"}).`,
                  link: `/admin/sample-trials`,
                },
              });
            }
          } catch {}
        }

        return NextResponse.json({ ok: true, line: updatedLine, allComplete });
      }

      // ─── Update status ───
      case "update_status": {
        if (!status) {
          return NextResponse.json({ ok: false, error: "status required" }, { status: 400 });
        }
        const valid = ["PENDING_APPROVAL", "APPROVED", "SUBMITTED", "IN_PROGRESS", "RESULTS_RECEIVED", "COMPLETE", "CANCELLED"];
        if (!valid.includes(status)) {
          return NextResponse.json({ ok: false, error: `Invalid status. Valid: ${valid.join(", ")}` }, { status: 400 });
        }
        const updated = await prisma.testRequest.update({
          where: { id: testRequestId },
          data: {
            status,
            ...(status === "COMPLETE" ? { actualCompletionDate: new Date() } : {}),
          },
        });
        return NextResponse.json({ ok: true, testRequest: updated });
      }

      // ─── Add note ───
      case "add_note": {
        if (!notes) {
          return NextResponse.json({ ok: false, error: "notes required" }, { status: 400 });
        }
        const existing = testRequest.specialInstructions || "";
        const timestamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const attribution = isLab ? testRequest.lab?.name : user.name;
        const updated = await prisma.testRequest.update({
          where: { id: testRequestId },
          data: {
            specialInstructions: `${existing}\n[${timestamp} — ${attribution}] ${notes}`.trim(),
          },
        });
        return NextResponse.json({ ok: true, testRequest: updated });
      }

      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    console.error("Lab test action error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to process action" }, { status: 500 });
  }
}
