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

    const result = await prisma.testRun.updateMany({
      where: { id: { in: testRunIds } },
      data: {
        brandVisible: stamp,
        brandApprovedById: stamp ? user.id : null,
        brandApprovedAt: stamp ? new Date() : null,
      },
    });

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

    return NextResponse.json({
      ok: true,
      updated: result.count,
      notified: notifiedCount,
      action: stamp ? "stamped" : "unstamped",
    });
  } catch (err: any) {
    console.error("Batch stamp error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
