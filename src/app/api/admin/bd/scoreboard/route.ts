// @ts-nocheck
/**
 * GET /api/admin/bd/scoreboard
 *
 * Phase 5 — per-rep BD scoreboard.
 *
 * Aggregates sequence + outreach + brand-pipeline activity per rep over
 * a rolling time window (default: last 30 days). Used by:
 *   - /admin/bd/scoreboard (full-page leaderboard for SALES_MANAGER)
 *   - /home dashboard card for SALES_REP / BD_REP (self-row only)
 *
 * Query params:
 *   - days?  number — window length (default 30, max 365)
 *   - all?   "1" — return rows for all reps (manager / admin only).
 *            Without this, returns just the caller's row.
 *
 * Per-rep metrics:
 *   - sequencesStarted: BDSequence.startedAt in window, repId=rep
 *   - stepsSent:        BDSequenceStep.status=sent && sentAt in window,
 *                       joined to seq.repId=rep
 *   - stepsReady:       BDSequenceStep.status=ready, joined to seq.repId
 *                       (point-in-time — what's waiting for this rep right
 *                       now, regardless of window)
 *   - replies:          BDSequence.exitReason="replied" &&
 *                       completedAt in window, repId=rep
 *   - meetingsBooked:   Meeting.organizerId=rep, brandId not null,
 *                       startTime in window
 *   - brandsConverted:  Brand.salesRepId=rep, pipelineStage past
 *                       PRESENTATION, updatedAt in window
 *   - replyRate:        replies / max(sequencesStarted, 1) — capped 0..1
 *
 * Response:
 *   { ok: true, windowDays, since, rows: [...], totals: {...} }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ADVANCED_STAGES = [
  "BRAND_TESTING",
  "FACTORY_ONBOARDING",
  "FACTORY_TESTING",
  "PRODUCTION",
  "BRAND_EXPANSION",
  "CUSTOMER_WON",
];

const BD_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!BD_ROLES.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const isManager =
      user.role === "ADMIN" ||
      user.role === "EMPLOYEE" ||
      user.role === "SALES_MANAGER";

    const url = new URL(req.url);
    const allReps = url.searchParams.get("all") === "1";
    const daysRaw = parseInt(url.searchParams.get("days") || "30", 10);
    const windowDays = Math.max(1, Math.min(isNaN(daysRaw) ? 30 : daysRaw, 365));
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // Decide which reps to aggregate over.
    let repIds: string[];
    let reps: { id: string; name: string | null; email: string; role: string }[];

    if (allReps && isManager) {
      reps = await prisma.user.findMany({
        where: {
          role: { in: ["SALES_REP", "SALES_MANAGER", "BD_REP"] },
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
      repIds = reps.map((r) => r.id);
    } else {
      reps = [
        {
          id: user.id,
          name: user.name || null,
          email: user.email || "",
          role: user.role,
        },
      ];
      repIds = [user.id];
    }

    if (repIds.length === 0) {
      return NextResponse.json({
        ok: true,
        windowDays,
        since,
        rows: [],
        totals: emptyTotals(),
      });
    }

    // Run all aggregations in parallel — Prisma groupBy with where clauses
    // gives us per-rep counts in a single round-trip per metric.
    const [
      seqStartedAgg,
      seqRepliedAgg,
      stepsSentAgg,
      stepsReadyAgg,
      meetingsAgg,
      brandsConvertedAgg,
    ] = await Promise.all([
      // sequencesStarted
      prisma.bDSequence.groupBy({
        by: ["repId"],
        where: {
          repId: { in: repIds },
          startedAt: { gte: since },
        },
        _count: { _all: true },
      }),

      // replies (exited with reason=replied within window)
      prisma.bDSequence.groupBy({
        by: ["repId"],
        where: {
          repId: { in: repIds },
          exitReason: "replied",
          completedAt: { gte: since },
        },
        _count: { _all: true },
      }),

      // stepsSent — join via sequence.repId
      prisma.bDSequenceStep.findMany({
        where: {
          status: "sent",
          sentAt: { gte: since },
          sequence: { repId: { in: repIds } },
        },
        select: { sequence: { select: { repId: true } } },
      }),

      // stepsReady (point-in-time, no window — what's waiting now)
      prisma.bDSequenceStep.findMany({
        where: {
          status: "ready",
          sequence: { repId: { in: repIds }, status: "active" },
        },
        select: { sequence: { select: { repId: true } } },
      }),

      // meetingsBooked — Meeting.organizerId, brandId required so we count
      // BD-context meetings only (not internal standups)
      prisma.meeting.groupBy({
        by: ["organizerId"],
        where: {
          organizerId: { in: repIds },
          brandId: { not: null },
          startTime: { gte: since },
        },
        _count: { _all: true },
      }),

      // brandsConverted — past PRESENTATION, owned by rep, moved in window
      prisma.brand.groupBy({
        by: ["salesRepId"],
        where: {
          salesRepId: { in: repIds },
          pipelineStage: { in: ADVANCED_STAGES },
          updatedAt: { gte: since },
        },
        _count: { _all: true },
      }),
    ]);

    // Materialize into a per-rep map.
    const seqStartedByRep = mapAgg(seqStartedAgg, "repId");
    const seqRepliedByRep = mapAgg(seqRepliedAgg, "repId");
    const meetingsByRep = mapAgg(meetingsAgg, "organizerId");
    const brandsConvertedByRep = mapAgg(brandsConvertedAgg, "salesRepId");

    const stepsSentByRep: Record<string, number> = {};
    for (const s of stepsSentAgg) {
      const rid = s?.sequence?.repId;
      if (!rid) continue;
      stepsSentByRep[rid] = (stepsSentByRep[rid] || 0) + 1;
    }
    const stepsReadyByRep: Record<string, number> = {};
    for (const s of stepsReadyAgg) {
      const rid = s?.sequence?.repId;
      if (!rid) continue;
      stepsReadyByRep[rid] = (stepsReadyByRep[rid] || 0) + 1;
    }

    const rows = reps.map((rep) => {
      const sequencesStarted = seqStartedByRep[rep.id] || 0;
      const replies = seqRepliedByRep[rep.id] || 0;
      const stepsSent = stepsSentByRep[rep.id] || 0;
      const stepsReady = stepsReadyByRep[rep.id] || 0;
      const meetingsBooked = meetingsByRep[rep.id] || 0;
      const brandsConverted = brandsConvertedByRep[rep.id] || 0;
      const replyRate =
        sequencesStarted > 0
          ? Math.min(1, replies / sequencesStarted)
          : 0;
      return {
        rep,
        sequencesStarted,
        stepsSent,
        stepsReady,
        replies,
        meetingsBooked,
        brandsConverted,
        replyRate,
      };
    });

    // Sort the leaderboard by replies desc, then stepsSent desc.
    rows.sort((a, b) => {
      if (b.replies !== a.replies) return b.replies - a.replies;
      return b.stepsSent - a.stepsSent;
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.sequencesStarted += r.sequencesStarted;
        acc.stepsSent += r.stepsSent;
        acc.stepsReady += r.stepsReady;
        acc.replies += r.replies;
        acc.meetingsBooked += r.meetingsBooked;
        acc.brandsConverted += r.brandsConverted;
        return acc;
      },
      emptyTotals(),
    );
    totals.replyRate =
      totals.sequencesStarted > 0
        ? Math.min(1, totals.replies / totals.sequencesStarted)
        : 0;

    return NextResponse.json({
      ok: true,
      windowDays,
      since,
      rows,
      totals,
    });
  } catch (err: any) {
    console.error("[bd/scoreboard] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load scoreboard" },
      { status: 500 },
    );
  }
}

function mapAgg(rows: any[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = r?.[key];
    if (!k) continue;
    out[k] = r?._count?._all ?? 0;
  }
  return out;
}

function emptyTotals() {
  return {
    sequencesStarted: 0,
    stepsSent: 0,
    stepsReady: 0,
    replies: 0,
    meetingsBooked: 0,
    brandsConverted: 0,
    replyRate: 0,
  };
}
