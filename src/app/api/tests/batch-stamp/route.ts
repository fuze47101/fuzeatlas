// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyTestResult } from "@/lib/notify";

/* ── POST /api/tests/batch-stamp ── stamp/unstamp multiple tests for brand visibility */
export async function POST(req: Request) {
  try {
    // Tina-style fix May 2026 — drop the spoof-able x-user-id / x-user-role
    // headers in favour of the real session. Anyone with a valid Atlas
    // cookie used to be able to forge any role by setting headers.
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EMPLOYEE", "TESTING_MANAGER"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Only admins and testing managers can batch stamp tests" },
        { status: 403 },
      );
    }

    const { testRunIds, visible } = await req.json();

    if (!Array.isArray(testRunIds) || testRunIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "testRunIds array is required" },
        { status: 400 },
      );
    }

    const stamp = visible !== false; // default to stamping (true)

    // Phase 8G — mirror /api/tests/[id] PATCH approval-pending hook on
    // the batch path. When stamping, split the input into two cohorts:
    // tests whose brand has requiresApproval=true (→ PENDING) and the
    // rest (→ visible only). When unstamping, also clear
    // brandApprovalStatus to keep state consistent with the PATCH.
    let pendingIds: string[] = [];
    let pendingCtx: any[] = [];
    if (stamp) {
      pendingCtx = await prisma.testRun.findMany({
        where: {
          id: { in: testRunIds },
          submission: { brand: { requiresApproval: true } },
        },
        select: {
          id: true,
          testType: true,
          testReportNumber: true,
          submission: {
            select: { brandId: true, brand: { select: { name: true } } },
          },
        },
      });
      pendingIds = pendingCtx.map((r: any) => r.id);
    }

    const result = await prisma.testRun.updateMany({
      where: { id: { in: testRunIds } },
      data: {
        brandVisible: stamp,
        brandApprovedById: stamp ? user.id : null,
        brandApprovedAt: stamp ? new Date() : null,
        ...(stamp ? {} : { brandApprovalStatus: null }),
      },
    });

    if (stamp && pendingIds.length > 0) {
      await prisma.testRun.updateMany({
        where: { id: { in: pendingIds } },
        data: { brandApprovalStatus: "PENDING" },
      });
    }

    // Penfabric/Raihana follow-on May 2026 — when stamping a batch, fan out
    // an in-app notification per test to brand + factory + admins via the
    // notifyTestResult helper. Lookup once, fire in parallel. Failure is
    // non-fatal so the batch stamp count is always correct.
    let notifiedCount = 0;
    if (stamp) {
      try {
        const stamped = await prisma.testRun.findMany({
          where: { id: { in: testRunIds } },
          select: {
            id: true,
            testType: true,
            testReportNumber: true,
            icpResult: { select: { agValue: true } },
            abResult: { select: { pass: true } },
            fungalResult: { select: { pass: true } },
            odorResult: { select: { pass: true } },
            submission: {
              select: {
                fuzeFabricNumber: true,
                brand: { select: { id: true } },
                factory: { select: { id: true } },
                fabric: { select: { fuzeNumber: true, customerCode: true } },
              },
            },
          },
        });

        await Promise.all(
          stamped.map(async (t: any) => {
            const fabricLabel =
              [
                t.submission?.fuzeFabricNumber
                  ? `FUZE-${t.submission.fuzeFabricNumber}`
                  : t.submission?.fabric?.fuzeNumber
                  ? `FUZE-${t.submission.fabric.fuzeNumber}`
                  : null,
                t.submission?.fabric?.customerCode,
              ]
                .filter(Boolean)
                .join(" · ") || t.testReportNumber || "";
            const passed =
              t.testType === "ICP"
                ? typeof t.icpResult?.agValue === "number" && t.icpResult.agValue >= 0.25
                : t.testType === "ANTIBACTERIAL"
                ? t.abResult?.pass === true
                : t.testType === "FUNGAL"
                ? t.fungalResult?.pass === true
                : t.testType === "ODOR"
                ? t.odorResult?.pass === true
                : true;
            const labelByType: Record<string, string> = {
              ICP: "ICP Analysis",
              ANTIBACTERIAL: "Antibacterial",
              FUNGAL: "Antifungal",
              ODOR: "Odor",
            };
            const testName = `${labelByType[t.testType] || t.testType || "Test"}${
              fabricLabel ? ` · ${fabricLabel}` : ""
            }`;
            try {
              await notifyTestResult({
                testId: t.id,
                testName,
                result: passed ? "PASSED" : "FAILED",
                brandId: t.submission?.brand?.id,
                factoryId: t.submission?.factory?.id,
              });
              notifiedCount++;
            } catch (e) {
              console.error(`[batch-stamp] notifyTestResult ${t.id} failed:`, e);
            }
          }),
        );
      } catch (notifyErr) {
        console.error("[batch-stamp] notification fan-out failed:", notifyErr);
      }
    }

    // Phase 8G — approval-pending fan-out (mirrors PATCH /api/tests/[id])
    let approvalNotified = 0;
    if (stamp && pendingCtx.length > 0) {
      try {
        const { notifyApprovalPending } = await import("@/lib/notify");
        await Promise.all(
          pendingCtx.map(async (r: any) => {
            const brandId = r.submission?.brandId;
            const brandName = r.submission?.brand?.name;
            if (!brandId || !brandName) return;
            try {
              await notifyApprovalPending({
                brandId,
                brandName,
                kind: "test",
                ref: `${r.testType}${r.testReportNumber ? ` #${r.testReportNumber}` : ""}`,
              });
              approvalNotified++;
            } catch (err) {
              console.error(
                `[batch-stamp] notifyApprovalPending ${r.id} failed:`,
                err,
              );
            }
          }),
        );
      } catch (err) {
        console.error("[batch-stamp] approval-pending fan-out failed:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      updated: result.count,
      notified: notifiedCount,
      pending: pendingIds.length,
      approvalNotified,
      action: stamp ? "stamped" : "unstamped",
    });
  } catch (err: any) {
    console.error("Batch stamp error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
