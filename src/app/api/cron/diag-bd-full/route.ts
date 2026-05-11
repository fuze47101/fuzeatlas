// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/diag-bd-full
 *
 * Runs every individual query the real /api/admin/bd/scoreboard route
 * runs, in isolation, with its own try/catch. Reports which one fails.
 *
 * The basic mirror (diag-bd-mirror) returned healthy data — meaning the
 * first Promise.all works. This endpoint adds the Phase 9D + 9I queries
 * that come AFTER the mirror's coverage. One of those is suspected of
 * throwing because of a Phase 9 schema column that may not actually be
 * live in prod (referredByBrandId, referredByContactId, forecast, etc.)
 */

const CRON_SECRET = process.env.CRON_SECRET;
const ADVANCED_STAGES = [
  "BRAND_TESTING",
  "FACTORY_ONBOARDING",
  "FACTORY_TESTING",
  "PRODUCTION",
  "BRAND_EXPANSION",
  "CUSTOMER_WON",
];

async function run<T>(label: string, fn: () => Promise<T>) {
  try {
    const result = await fn();
    const count = Array.isArray(result)
      ? result.length
      : typeof result === "number"
        ? result
        : 1;
    return { label, ok: true, count };
  } catch (e: any) {
    return {
      label,
      ok: false,
      error: e?.message || String(e),
      code: e?.code || null,
      meta: e?.meta || null,
    };
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 30 * 86400_000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000);

  // Resolve repIds the same way the real route does
  const activeAuthors = await prisma.outreachMessage.findMany({
    where: { sentAt: { gte: since }, sentBy: { not: null } },
    select: { sentBy: true },
    distinct: ["sentBy"],
  });
  const repIds = activeAuthors.map((a) => a.sentBy).filter(Boolean) as string[];

  if (repIds.length === 0) {
    return NextResponse.json({
      ok: true,
      note: "No active reps in window — cannot test downstream queries",
    });
  }

  // Phase 5 / 9D / 9I queries — each isolated
  const results = await Promise.all([
    run("seqStartedAgg (BDSequence groupBy startedAt)", () =>
      prisma.bDSequence.groupBy({
        by: ["repId"],
        where: { repId: { in: repIds }, startedAt: { gte: since } },
        _count: { _all: true },
      }),
    ),
    run("seqRepliedAgg (BDSequence exitReason=replied)", () =>
      prisma.bDSequence.groupBy({
        by: ["repId"],
        where: {
          repId: { in: repIds },
          exitReason: "replied",
          completedAt: { gte: since },
        },
        _count: { _all: true },
      }),
    ),
    run("stepsSent (BDSequenceStep status=sent)", () =>
      prisma.bDSequenceStep.findMany({
        where: {
          status: "sent",
          sentAt: { gte: since },
          sequence: { repId: { in: repIds } },
        },
        select: { sequence: { select: { repId: true } } },
      }),
    ),
    run("stepsReady (BDSequenceStep status=ready)", () =>
      prisma.bDSequenceStep.findMany({
        where: {
          status: "ready",
          sequence: { repId: { in: repIds }, status: "active" },
        },
        select: { sequence: { select: { repId: true } } },
      }),
    ),
    run("meetingsAgg (Meeting groupBy organizerId+brandId+startTime)", () =>
      prisma.meeting.groupBy({
        by: ["organizerId"],
        where: {
          organizerId: { in: repIds },
          brandId: { not: null },
          startTime: { gte: since },
        },
        _count: { _all: true },
      }),
    ),
    run("brandsConvertedAgg (Brand groupBy salesRepId+stage+updatedAt)", () =>
      prisma.brand.groupBy({
        by: ["salesRepId"],
        where: {
          salesRepId: { in: repIds },
          pipelineStage: { in: ADVANCED_STAGES },
          updatedAt: { gte: since },
        },
        _count: { _all: true },
      }),
    ),
    run("outreachMessagesAgg (OutreachMessage with openedAt/clickedAt/repliedAt)", () =>
      prisma.outreachMessage.findMany({
        where: {
          sentBy: { in: repIds },
          sentAt: { gte: since },
        },
        select: {
          sentBy: true,
          contactId: true,
          channel: true,
          sentAt: true,
          openedAt: true,
          clickedAt: true,
          repliedAt: true,
        },
        take: 5,
      }),
    ),
    // ── Phase 9D extras ──────────────────────────────────────────
    run("activeSequencesPerRep (BDSequence status=active)", () =>
      prisma.bDSequence.groupBy({
        by: ["repId"],
        where: { repId: { in: repIds }, status: "active" },
        _count: { _all: true },
      }),
    ),
    run("forecastBrandsPerRep (Brand.forecast not null)", () =>
      prisma.brand.findMany({
        where: {
          salesRepId: { in: repIds },
          forecast: { not: null },
          updatedAt: { gte: since },
        },
        select: { salesRepId: true, forecast: true },
        take: 5,
      }),
    ),
    run("firstMeetingsByRep (FIXED — no contactId in select)", () =>
      prisma.meeting.findMany({
        where: {
          organizerId: { in: repIds },
          brandId: { not: null },
          startTime: { gte: since },
        },
        select: {
          organizerId: true,
          brandId: true,
          startTime: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
    ),
    run("firstSendsByRep (OutreachMessage status in [sent,delivered,replied])", () =>
      prisma.outreachMessage.findMany({
        where: {
          sentBy: { in: repIds },
          channel: "email",
          status: { in: ["sent", "delivered", "replied"] },
          sentAt: { gte: since },
        },
        select: { sentBy: true, contactId: true, sentAt: true },
        orderBy: { sentAt: "asc" },
        take: 5,
      }),
    ),
    run("closedWonByRep (Brand stage=CUSTOMER_WON 90d)", () =>
      prisma.brand.groupBy({
        by: ["salesRepId"],
        where: {
          salesRepId: { in: repIds },
          pipelineStage: "CUSTOMER_WON",
          updatedAt: { gte: ninetyDaysAgo },
        },
        _count: { _all: true },
      }),
    ),
    // ── Phase 9I — the suspect ───────────────────────────────────
    run("referralsDrivenByRep (Brand.referredByBrandId / referredByContactId)", () =>
      prisma.brand.groupBy({
        by: ["salesRepId"],
        where: {
          salesRepId: { in: repIds },
          OR: [
            { referredByBrandId: { not: null } },
            { referredByContactId: { not: null } },
          ],
        },
        _count: { _all: true },
      }),
    ),
  ]);

  const failures = results.filter((r) => !r.ok);

  return NextResponse.json({
    ok: failures.length === 0,
    repIdsCount: repIds.length,
    results,
    failures,
    verdict:
      failures.length === 0
        ? "all-queries-passed — bug is elsewhere (try Vercel runtime logs for /api/admin/bd/scoreboard)"
        : `${failures.length} query(ies) failed — these are the rejection sources for the real route's Promise.all`,
  });
}
