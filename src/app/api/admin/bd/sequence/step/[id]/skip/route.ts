// @ts-nocheck
/**
 * POST /api/admin/bd/sequence/step/[id]/skip
 *
 * Rep declines to send a step. Works for any non-terminal state (pending,
 * ready). Bumps skippedSteps and may roll the sequence to "completed" if
 * this was the last non-terminal step.
 *
 * Body: { reason?: string }
 *
 * Also usable as /mark-sent for manual channels (linkedin_connect,
 * linkedin_dm, tradeshow) where the rep physically did the work outside
 * Atlas and just wants to tick the box. Pass `{ action: "mark_sent" }` and
 * we'll flip the step to "sent" instead of "skipped".
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { markStepSent, markStepSkipped } from "@/lib/bd-sequence";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const isBDEligible =
    user.role === "ADMIN" ||
    user.role === "EMPLOYEE" ||
    user.role === "SALES_MANAGER" ||
    user.role === "SALES_REP" ||
    user.role === "BD_REP";
  if (!isBDEligible) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";

  const { id } = await params;

  const step = await prisma.bDSequenceStep.findUnique({
    where: { id },
    include: { sequence: true },
  });
  if (!step) return NextResponse.json({ ok: false, error: "Step not found" }, { status: 404 });
  if (!isAdmin && step.sequence.repId !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (step.status === "sent" || step.status === "skipped") {
    return NextResponse.json(
      { ok: false, error: `Step is already ${step.status}` },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "skip").toLowerCase();
  const reason = body?.reason ? String(body.reason) : null;

  const result = await prisma.$transaction(async (tx) => {
    let updated;
    if (action === "mark_sent") {
      updated = await markStepSent({
        tx,
        stepId: step.id,
        outreachMessageId: null,
        draftSubject: step.draftSubject,
        draftBody: step.draftBody,
      });
    } else {
      updated = await markStepSkipped({ tx, stepId: step.id, reason });
    }
    // Close the linked task if any
    if (step.crmTaskId) {
      try {
        await tx.crmTask.update({
          where: { id: step.crmTaskId },
          data: { status: "DONE", completedAt: new Date() },
        });
      } catch {
        /* task may have been deleted */
      }
    }
    return updated;
  });

  return NextResponse.json({ ok: true, step: result });
}
