// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyRecipeMilestone } from "@/lib/notify-recipe";

/**
 * ICP validation for a bench test.
 *
 * POST /api/admin/recipe-bench-tests/[id]/icp
 *   body: { action, ... }
 *     "submit"      → { icpLab, icpSampleId, testedAtTier, testBathVolumeL, testBathFuzeMl, testBathWaterMl, icpExpectedPpm, notes? }
 *     "enter-result"→ { icpMeasuredPpm, icpReportUrl?, notes? }
 *     "reset"       → clears ICP fields
 *
 * Affinity = measured / expected × 100.  100% means the recipe nailed the target.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "LAB_USER", "LAB_MANAGER"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: `Role ${user.role} not permitted` }, { status: 403 });
    }
    const body = await req.json();
    const { action } = body;
    const data: any = {};

    if (action === "submit") {
      data.icpLab = body.icpLab || null;
      data.icpSampleId = body.icpSampleId || null;
      data.icpSubmittedAt = new Date();
      data.icpSubmittedById = user.id;
      if (body.testedAtTier) data.testedAtTier = body.testedAtTier;
      if (body.testBathVolumeL !== undefined) data.testBathVolumeL = Number(body.testBathVolumeL);
      if (body.testBathFuzeMl !== undefined) data.testBathFuzeMl = Number(body.testBathFuzeMl);
      if (body.testBathWaterMl !== undefined) data.testBathWaterMl = Number(body.testBathWaterMl);
      if (body.icpExpectedPpm !== undefined) data.icpExpectedPpm = Number(body.icpExpectedPpm);
      if (body.notes) data.icpNotes = body.notes;
    } else if (action === "enter-result") {
      data.icpMeasuredPpm = Number(body.icpMeasuredPpm);
      data.icpResultReceivedAt = new Date();
      if (body.icpReportUrl) data.icpReportUrl = body.icpReportUrl;
      if (body.notes) data.icpNotes = body.notes;

      // Compute affinity if we have expected
      const existing = await prisma.recipeBenchTest.findUnique({
        where: { id },
        select: { icpExpectedPpm: true },
      });
      const expected = existing?.icpExpectedPpm;
      if (expected && expected > 0) {
        data.affinityPct = (Number(body.icpMeasuredPpm) / expected) * 100;
      }
    } else if (action === "reset") {
      data.icpLab = null;
      data.icpSampleId = null;
      data.icpSubmittedAt = null;
      data.icpSubmittedById = null;
      data.icpExpectedPpm = null;
      data.icpMeasuredPpm = null;
      data.icpResultReceivedAt = null;
      data.icpReportUrl = null;
      data.icpNotes = null;
      data.affinityPct = null;
    } else {
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }

    const test = await prisma.recipeBenchTest.update({ where: { id }, data });

    // Penfabric/Raihana fix May 2026 — auto-notify the factory when
    // ICP comes back with affinity in the validated band (90–110%).
    // Other actions (submit, reset) don't fan out. Failure is
    // non-fatal: ICP entry must succeed even if email/notify errors.
    let notify = null;
    if (
      action === "enter-result" &&
      typeof test.affinityPct === "number" &&
      test.affinityPct >= 90 &&
      test.affinityPct <= 110
    ) {
      try {
        notify = await notifyRecipeMilestone(id, "ICP_VALIDATED", user.id || null);
      } catch (notifyErr) {
        console.error("[icp] notifyRecipeMilestone threw:", notifyErr);
      }
    }

    return NextResponse.json({ ok: true, test, notify });
  } catch (e: any) {
    console.error("ICP error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
