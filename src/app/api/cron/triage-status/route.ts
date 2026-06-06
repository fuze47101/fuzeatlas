// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/triage-status
 *
 * Reports the state of the daily auto-triage GitHub Actions
 * workflow:
 *
 *  - lastSuccessfulRunAt: most recent run where errorMessage is null
 *  - lastRunAt: most recent run regardless of outcome
 *  - prsThisWeek: sum(prsCreated) where runAt >= now - 7d
 *  - ticketsAttemptedThisWeek + ticketsSkippedThisWeek
 *  - recent: last 5 runs in descending order
 *
 * Surfaced into diag-all-surfaces so a stale workflow gets caught
 * proactively rather than via "the digest still has 11 tickets next
 * week."
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [lastSuccessful, lastRun, weekAgg, recent] = await Promise.all([
    (prisma as any).triageRun.findFirst({
      where: { errorMessage: null },
      orderBy: { runAt: "desc" },
      select: { id: true, runAt: true, runUrl: true, prsCreated: true },
    }),
    (prisma as any).triageRun.findFirst({
      orderBy: { runAt: "desc" },
      select: { id: true, runAt: true, errorMessage: true, runUrl: true },
    }),
    (prisma as any).triageRun.aggregate({
      where: { runAt: { gte: sevenDaysAgo } },
      _sum: { prsCreated: true, ticketsAttempted: true, ticketsSkipped: true },
      _count: { id: true },
    }),
    (prisma as any).triageRun.findMany({
      orderBy: { runAt: "desc" },
      take: 5,
      select: {
        id: true, runAt: true, runUrl: true, newTicketCount: true,
        ticketsAttempted: true, ticketsSkipped: true, prsCreated: true,
        errorMessage: true, prUrls: true,
        rawFetchCount: true, sampleIds: true, fetchHttpCode: true,
      },
    }),
  ]);

  const daysSinceSuccess = lastSuccessful
    ? Math.floor((Date.now() - new Date(lastSuccessful.runAt).getTime()) / 86400000)
    : null;

  return NextResponse.json({
    ok: true,
    lastSuccessfulRunAt: lastSuccessful?.runAt || null,
    lastSuccessfulRunUrl: lastSuccessful?.runUrl || null,
    daysSinceLastSuccess: daysSinceSuccess,
    lastRunAt: lastRun?.runAt || null,
    lastRunUrl: lastRun?.runUrl || null,
    lastRunFailed: Boolean(lastRun?.errorMessage),
    lastRunError: lastRun?.errorMessage || null,
    prsCreatedThisWeek: weekAgg._sum?.prsCreated || 0,
    ticketsAttemptedThisWeek: weekAgg._sum?.ticketsAttempted || 0,
    ticketsSkippedThisWeek: weekAgg._sum?.ticketsSkipped || 0,
    runsThisWeek: weekAgg._count?.id || 0,
    healthy:
      lastSuccessful !== null &&
      daysSinceSuccess !== null &&
      daysSinceSuccess <= 2 &&
      !lastRun?.errorMessage,
    recent,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 30;
