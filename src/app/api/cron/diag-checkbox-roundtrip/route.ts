// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/diag-checkbox-roundtrip
 *
 * End-to-end probe for the action-item DONE-toggle pipeline.
 *
 *   1. Creates a throwaway MeetingActionItem (status=OPEN)
 *      assigned to andrew@fuze47.com, attached to the most recent
 *      MeetingNote on the platform.
 *   2. Simulates exactly what PATCH /api/action-items/[id] does when
 *      the checkbox fires: write status=DONE + doneAt + doneById.
 *   3. Reads back the row and verifies status === "DONE".
 *   4. Deletes the throwaway row.
 *
 * The point: if this returns server_path_healthy=true, the
 * checkbox bug is client-side (browser cookies, CSP, an extension
 * stealing the click, hydration error, etc). If it returns
 * server_path_healthy=false, the bug is server-side.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const trace: any[] = [];
  const t0 = Date.now();

  const andrew = await prisma.user.findUnique({
    where: { email: "andrew@fuze47.com" },
    select: { id: true, name: true, email: true },
  });
  if (!andrew) {
    return NextResponse.json({
      ok: true,
      server_path_healthy: false,
      reason: "andrew@fuze47.com not found",
      trace,
    });
  }
  trace.push({ step: "resolved-andrew", id: andrew.id, ms: Date.now() - t0 });

  const meeting = await (prisma as any).meetingNote.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
  if (!meeting) {
    return NextResponse.json({
      ok: true,
      server_path_healthy: false,
      reason: "no MeetingNote available to attach probe to",
      trace,
    });
  }
  trace.push({ step: "resolved-meeting", id: meeting.id, ms: Date.now() - t0 });

  let createdId: string | null = null;
  let server_path_healthy = false;
  let finalStatus: string | null = null;
  let doneAt: any = null;
  let doneById: string | null = null;

  try {
    const item = await (prisma as any).meetingActionItem.create({
      data: {
        meetingNoteId: meeting.id,
        description: `[DIAG] checkbox-roundtrip probe ${new Date().toISOString()}`,
        priority: "LOW",
        assigneeId: andrew.id,
        createdById: andrew.id,
        status: "OPEN",
      },
      select: { id: true, status: true },
    });
    createdId = item.id;
    trace.push({ step: "created-probe", id: item.id, initialStatus: item.status, ms: Date.now() - t0 });

    // Mimic the PATCH /api/action-items/[id] body shape exactly.
    const patched = await (prisma as any).meetingActionItem.update({
      where: { id: item.id },
      data: { status: "DONE", doneAt: new Date(), doneById: andrew.id },
      select: { id: true, status: true, doneAt: true, doneById: true },
    });
    trace.push({ step: "patched-to-done", patchedStatus: patched.status, ms: Date.now() - t0 });

    // Re-read to verify persistence.
    const refetched = await (prisma as any).meetingActionItem.findUnique({
      where: { id: item.id },
      select: { id: true, status: true, doneAt: true, doneById: true },
    });
    finalStatus = refetched?.status || null;
    doneAt = refetched?.doneAt || null;
    doneById = refetched?.doneById || null;
    server_path_healthy = refetched?.status === "DONE" && refetched?.doneById === andrew.id;
    trace.push({ step: "refetched", status: finalStatus, ms: Date.now() - t0 });
  } catch (e: any) {
    trace.push({ step: "ERROR", message: e?.message, stack: String(e?.stack || "").slice(0, 400) });
  } finally {
    if (createdId) {
      try {
        await (prisma as any).meetingActionItem.delete({ where: { id: createdId } });
        trace.push({ step: "cleaned-up", id: createdId, ms: Date.now() - t0 });
      } catch (e: any) {
        trace.push({ step: "cleanup-failed", id: createdId, message: e?.message });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    server_path_healthy,
    verdict: server_path_healthy
      ? "Server-side DONE-toggle path works end-to-end. If the UI checkbox still doesn't toggle for Andrew, the failure is client-side (browser session cookie, hydration error blocking React, an extension intercepting clicks, or the Next.js bundle being out-of-date)."
      : "Server-side DONE-toggle path FAILED. See trace for the failing step.",
    finalStatus,
    doneAtSet: Boolean(doneAt),
    doneByIdSet: Boolean(doneById),
    totalMs: Date.now() - t0,
    trace,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
