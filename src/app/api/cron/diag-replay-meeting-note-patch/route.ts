// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/diag-replay-meeting-note-patch
 *
 * Replays the kind of PATCH that's been 500-ing in Vercel runtime
 * logs:
 *
 *   PATCH /api/meeting-notes/[id]/project-blocks/[blockId]/tasks/[taskId]
 *     body: { status: "DONE" }
 *
 * In a $transaction that ALWAYS rolls back, so prod data is
 * untouched. Returns the full prisma error (message + code + meta)
 * if the update fails so the schema drift is visible without
 * grepping Vercel logs.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Find the most recent open MeetingActionItem to replay against.
  const target = await (prisma as any).meetingActionItem.findFirst({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { id: true, meetingNoteId: true, description: true, status: true, doneAt: true },
  });
  if (!target) {
    return NextResponse.json({
      ok: true,
      replayed: false,
      reason: "no OPEN MeetingActionItem available to replay against",
    });
  }

  let replayedOk = false;
  let replayError: any = null;

  try {
    await prisma.$transaction(async (tx) => {
      const data: any = { status: "DONE" };
      // Match the fix in the live route — write doneAt, not
      // completedAt.
      if (!target.doneAt) data.doneAt = new Date();

      try {
        const updated = await (tx as any).meetingActionItem.update({
          where: { id: target.id },
          data,
          select: { id: true, status: true, doneAt: true },
        });
        replayedOk = updated.status === "DONE";
      } catch (e: any) {
        replayError = {
          message: e?.message || String(e),
          code: e?.code || null,
          meta: e?.meta || null,
        };
      }

      // Force rollback so prod data stays untouched.
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
    target: {
      id: target.id,
      meetingNoteId: target.meetingNoteId,
      description: String(target.description || "").slice(0, 80),
    },
    server_path_healthy: replayedOk && !replayError,
    replayError,
    verdict: replayError
      ? "Replay surfaced a prisma error — see replayError. Likely schema drift."
      : "Replay succeeded inside a rolled-back transaction; the PATCH path works against current schema.",
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
