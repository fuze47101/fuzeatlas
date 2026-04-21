// @ts-nocheck
/**
 * GET /api/admin/bd/sequences
 *
 * List BD sequences for the dashboard. Scoped to the current rep's own
 * sequences by default; admins can see everyone's by passing ?all=1.
 *
 * Query params:
 *   - status?  active | paused | completed | exited — default: active
 *   - all?     "1" to see sequences across all reps (admin only)
 *
 * Response shape is optimized for the list view: one row per sequence
 * with brand + contact name, step counts, and the next step's channel
 * + scheduledFor so the UI can render "Next: Email in 2 days" chips.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const isBDEligible =
    user.role === "ADMIN" ||
    user.role === "EMPLOYEE" ||
    user.role === "SALES_MANAGER" ||
    user.role === "SALES_REP";
  if (!isBDEligible) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "active";
  const allReps = url.searchParams.get("all") === "1";
  const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";

  const where: any = { status };
  if (!(allReps && isAdmin)) {
    where.repId = user.id;
  }

  const sequences = await prisma.bDSequence.findMany({
    where,
    orderBy: { startedAt: "desc" },
    include: {
      brand: { select: { id: true, name: true, textileCategory: true, pipelineStage: true } },
      contact: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
        },
      },
      rep: { select: { id: true, name: true, email: true } },
      steps: {
        orderBy: { stepIndex: "asc" },
        select: {
          id: true,
          stepIndex: true,
          channel: true,
          status: true,
          scheduledFor: true,
          readyAt: true,
          sentAt: true,
          skippedAt: true,
        },
      },
    },
  });

  // Compute the "next step" for each — first non-terminal step by stepIndex
  const payload = sequences.map((s) => {
    const next = s.steps.find(
      (st) => st.status === "pending" || st.status === "ready" || st.status === "failed",
    );
    const readyCount = s.steps.filter((st) => st.status === "ready").length;
    return {
      id: s.id,
      status: s.status,
      cadenceKey: s.cadenceKey,
      exitReason: s.exitReason,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      totalSteps: s.totalSteps,
      sentSteps: s.sentSteps,
      skippedSteps: s.skippedSteps,
      readyCount,
      brand: s.brand,
      contact: s.contact,
      rep: s.rep,
      steps: s.steps,
      nextStep: next
        ? {
            id: next.id,
            channel: next.channel,
            status: next.status,
            scheduledFor: next.scheduledFor,
          }
        : null,
    };
  });

  return NextResponse.json({ ok: true, sequences: payload });
}
