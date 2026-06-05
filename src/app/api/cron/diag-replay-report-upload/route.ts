// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/diag-replay-report-upload
 *
 * Verifies the BUG 1 (Kaylee Pace cmpyq564c0001l404naf8m4hj) fix —
 * confirms that, given an existing TestRequest + an existing TestRun,
 * the same code path the /api/tests/confirm route now runs:
 *
 *   1. creates a TestRequestLine pivot row
 *   2. flips TestRequest.status to COMPLETE
 *   3. stamps TestRequest.actualCompletionDate
 *
 * All inside a $transaction that ALWAYS rolls back so prod data is
 * untouched. If the schema or status transition drifts, this probe
 * surfaces the error instead of the next live upload.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Pick a pre-results TestRequest + any TestRun to use as fixtures.
  const target = await prisma.testRequest.findFirst({
    where: {
      status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ASSIGNED_TO_LAB", "SUBMITTED", "IN_PROGRESS", "RESULTS_RECEIVED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, actualCompletionDate: true },
  });
  const probeRun = await prisma.testRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, testType: true },
  });

  if (!target || !probeRun) {
    return NextResponse.json({
      ok: true,
      replayed: false,
      reason: "no pre-results TestRequest + TestRun pair available to replay against",
      target,
      probeRun,
    });
  }

  let flipOk = false;
  let pivotOk = false;
  let replayError: any = null;

  try {
    await prisma.$transaction(async (tx) => {
      try {
        const pivot = await (tx as any).testRequestLine.create({
          data: {
            testRequestId: target.id,
            testRunId: probeRun.id,
            testType: probeRun.testType || "ICP",
            status: "COMPLETE",
          },
          select: { id: true },
        });
        pivotOk = Boolean(pivot?.id);

        const flipped = await tx.testRequest.update({
          where: { id: target.id },
          data: { status: "COMPLETE", actualCompletionDate: new Date() },
          select: { id: true, status: true, actualCompletionDate: true },
        });
        flipOk = flipped.status === "COMPLETE" && Boolean(flipped.actualCompletionDate);
      } catch (e: any) {
        replayError = {
          message: e?.message || String(e),
          code: e?.code || null,
          meta: e?.meta || null,
        };
      }
      throw new Error("__diag_rollback__");
    });
  } catch (e: any) {
    if (e?.message !== "__diag_rollback__") {
      replayError = replayError || {
        message: e?.message,
        code: e?.code || null,
        meta: e?.meta || null,
      };
    }
  }

  return NextResponse.json({
    ok: true,
    replayed: true,
    server_path_healthy: pivotOk && flipOk && !replayError,
    pivotOk,
    flipOk,
    target: { id: target.id, prevStatus: target.status },
    probeRun: { id: probeRun.id, testType: probeRun.testType },
    replayError,
    verdict: replayError
      ? "Replay surfaced a prisma error — see replayError."
      : "Replay succeeded inside a rolled-back transaction; the TestRequest flip works against current schema.",
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
