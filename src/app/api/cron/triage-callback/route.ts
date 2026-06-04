// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/triage-callback
 *
 * Called by .github/workflows/auto-triage.yml at the end of every
 * run. Records the outcome into TriageRun so a human (or the
 * diag-all-surfaces probe) can confirm the workflow actually ran +
 * what it did without leaving the Atlas admin tabs.
 *
 *   Body: {
 *     runUrl?: string,
 *     newTicketCount?: number,
 *     ticketsAttempted?: number,
 *     ticketsSkipped?: number,
 *     prsCreated?: number,
 *     errorMessage?: string,
 *     attemptedIds?: string[],
 *     skippedReasons?: Array<{id, reason}>,
 *     prUrls?: string[],
 *   }
 *
 * Bearer-authed via CRON_SECRET.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const row = await (prisma as any).triageRun.create({
      data: {
        runUrl: body?.runUrl || null,
        newTicketCount: Number(body?.newTicketCount || 0) | 0,
        ticketsAttempted: Number(body?.ticketsAttempted || 0) | 0,
        ticketsSkipped: Number(body?.ticketsSkipped || 0) | 0,
        prsCreated: Number(body?.prsCreated || 0) | 0,
        errorMessage: body?.errorMessage ? String(body.errorMessage).slice(0, 2000) : null,
        attemptedIds: Array.isArray(body?.attemptedIds) ? body.attemptedIds.join(",") : null,
        skippedReasons: body?.skippedReasons ? JSON.stringify(body.skippedReasons).slice(0, 4000) : null,
        prUrls: Array.isArray(body?.prUrls) ? body.prUrls.join(",") : null,
      },
      select: { id: true, runAt: true },
    });
    return NextResponse.json({ ok: true, runId: row.id, runAt: row.runAt });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "callback failed" }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 30;
