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
 *   - emailsSent:       OutreachMessage.channel="email" && sentBy=rep &&
 *                       sentAt in window. This is the SUPERSET of all email
 *                       outreach — wizard sends + /brands/[id] send modal +
 *                       /contacts/[id] send modal all post to send routes
 *                       that atomically write an OutreachMessage row. Any
 *                       scoreboard number a BD manager would actually use
 *                       should come from here, not from the sequence table.
 *   - linkedinSent:     OutreachMessage.channel="linkedin" && sentBy=rep &&
 *                       sentAt in window.
 *   - contactsWorked:   distinct contactId across OutreachMessage for the
 *                       rep in window — "how many humans did this rep
 *                       actually touch".
 *   - sequencesStarted: BDSequence.startedAt in window, repId=rep
 *   - stepsSent:        BDSequenceStep.status=sent && sentAt in window,
 *                       joined to seq.repId=rep. SUBSET of emailsSent —
 *                       specifically the cadence-driven wizard sends.
 *   - stepsReady:       BDSequenceStep.status=ready, joined to seq.repId
 *                       (point-in-time — what's waiting for this rep right
 *                       now, regardless of window)
 *   - replies:          BDSequence.exitReason="replied" &&
 *                       completedAt in window, repId=rep
 *   - meetingsBooked:   Meeting.organizerId=rep, brandId not null,
 *                       startTime in window
 *   - brandsConverted:  Brand.salesRepId=rep, pipelineStage past
 *                       PRESENTATION, updatedAt in window
 *   - replyRate:        replies / max(emailsSent, 1) — capped 0..1. Uses the
 *                       broader emailsSent denominator so reply rate tracks
 *                       all outbound, not just sequence-wrapped throughput.
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

// "High tide raises all boats" — distributor-side BD reps (Jeremy at SRS,
// Kathir at Harris & Menuk, Tandy at Texwell, Scott Smith at SRS) all
// run BD outreach for FUZE alongside their distributor day-jobs. Letting
// DISTRIBUTOR_USER read the scoreboard means they see the team-wide BD
// picture and their own row, exactly like an internal rep.
const BD_ROLES = [
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "DISTRIBUTOR_USER",
];

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

    // Phase 9D — period preset: week / month / quarter. The legacy
    // `days` param still works and takes precedence for backward
    // compat with /home and existing dashboard cards.
    const periodMap: Record<string, number> = { week: 7, month: 30, quarter: 90 };
    const periodRaw = (url.searchParams.get("period") || "").toLowerCase();
    const periodDays = periodMap[periodRaw];
    const daysRaw = parseInt(url.searchParams.get("days") || "", 10);
    const windowDays = !isNaN(daysRaw)
      ? Math.max(1, Math.min(daysRaw, 365))
      : periodDays || 30;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Decide which reps to aggregate over.
    let repIds: string[];
    let reps: { id: string; name: string | null; email: string; role: string }[];

    if (allReps && isManager) {
      // Two-source rep discovery — fixes the "Ryan and Barth are missing"
      // bug (#8). The earlier role-only filter excluded reps whose User
      // record was stamped EMPLOYEE / ADMIN even though they were running
      // outreach through the wizard. Now we OR in:
      //   (a) anyone with a BD-eligible role (the canonical list), AND
      //   (b) anyone who has actually authored an OutreachMessage or
      //       BDSequence in the window — caught by activity, not by
      //       role-tag drift.
      // This is self-healing: if Andrew adds a new "Account Manager" as
      // EMPLOYEE and they start sending wizard emails, they show up on
      // the scoreboard immediately without needing a role migration.
      const [activeMessageAuthors, activeSeqOwners] = await Promise.all([
        prisma.outreachMessage.findMany({
          where: { sentAt: { gte: since }, sentBy: { not: null } },
          select: { sentBy: true },
          distinct: ["sentBy"],
        }),
        prisma.bDSequence.findMany({
          where: { startedAt: { gte: since } },
          select: { repId: true },
          distinct: ["repId"],
        }),
      ]);
      const activityIds = new Set<string>();
      for (const m of activeMessageAuthors) {
        if (m.sentBy) activityIds.add(m.sentBy);
      }
      for (const s of activeSeqOwners) {
        if (s.repId) activityIds.add(s.repId);
      }

      // Canonical BD-role list does NOT include DISTRIBUTOR_USER —
      // we don't want every dist user (Angela, Danny, Jessica, KJ,
      // Tina-Distributor) cluttering the scoreboard. Distributor-side
      // BD reps (Jeremy, Kathir, Tandy, Scott Smith) still surface
      // via the activity-based branch below the moment they actually
      // send a wizard email or start a sequence. "High tide raises
      // all boats" = activity-driven, not role-driven.
      //
      // ALSO: a user can have a SALES_REP role tag but be a BRAND
      // contact who got mis-tagged at signup (Josie Ross-MacLeod at
      // Spanx is a real example). If a user has brandId / factoryId /
      // distributorId / labId set, they're an external entity contact,
      // not a FUZE BD rep. Exclude them from the role-based branch.
      // The activity branch is unaffected — if a brand contact ever
      // somehow sent a wizard email, they'd still show up there.
      reps = await prisma.user.findMany({
        where: {
          OR: [
            {
              AND: [
                { role: { in: ["SALES_REP", "SALES_MANAGER", "BD_REP"] } },
                { brandId: null },
                { factoryId: null },
                { distributorId: null },
                { labId: null },
                { status: "ACTIVE" },
              ],
            },
            ...(activityIds.size > 0
              ? [{ id: { in: Array.from(activityIds) } }]
              : []),
          ],
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
      outreachMessagesAgg,
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

      // All OutreachMessage rows authored by any of these reps in window.
      // Phase 9D — also pulls openedAt/clickedAt/repliedAt so the
      // scoreboard can report open + reply rate without a second
      // round trip.
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
      }),
    ]);

    // Phase 9D extras — gathered separately to avoid making the
    // Promise.all above unwieldy. Each one is scoped to repIds so
    // result sets stay small.
    const [
      activeSequencesPerRep,
      forecastBrandsPerRep,
      firstMeetingsByRep,
      firstSendsByRep,
      closedWonByRep,
      referralsDrivenByRep,
    ] = await Promise.all([
      // Sequences in flight (status=active, point-in-time)
      prisma.bDSequence.groupBy({
        by: ["repId"],
        where: { repId: { in: repIds }, status: "active" },
        _count: { _all: true },
      }),
      // Brands owned by rep with a non-empty forecast string. Forecast
      // is free-text; we'll parse $ in JS below.
      prisma.brand.findMany({
        where: {
          salesRepId: { in: repIds },
          forecast: { not: null },
          updatedAt: { gte: since },
        },
        select: { salesRepId: true, forecast: true },
      }),
      // First Meeting per rep within the window — for velocity calc.
      prisma.meeting.findMany({
        where: {
          organizerId: { in: repIds },
          brandId: { not: null },
          startTime: { gte: since },
        },
        select: { organizerId: true, brandId: true, contactId: true, startTime: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      // First OutreachMessage per (rep, contact) within the window —
      // pairs with firstMeetingsByRep to compute pipeline velocity.
      prisma.outreachMessage.findMany({
        where: {
          sentBy: { in: repIds },
          channel: "email",
          status: { in: ["sent", "delivered", "replied"] },
          sentAt: { gte: since },
        },
        select: { sentBy: true, contactId: true, sentAt: true },
        orderBy: { sentAt: "asc" },
      }),
      // Closed-won contribution — last 90 days, regardless of window.
      prisma.brand.groupBy({
        by: ["salesRepId"],
        where: {
          salesRepId: { in: repIds },
          pipelineStage: "CUSTOMER_WON",
          updatedAt: { gte: ninetyDaysAgo },
        },
        _count: { _all: true },
      }),
      // Phase 9I — referrals driven per rep. Counts brands where the
      // rep is salesRepId AND referredByBrandId/referredByContactId
      // is set. Lifetime, not windowed — referrals are sticky.
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

    // Roll up OutreachMessage rows by (rep, channel) and track distinct
    // contactIds for contactsWorked. Using Set-of-strings as the dedupe
    // primitive so we don't need another DB round-trip.
    const emailsSentByRep: Record<string, number> = {};
    const linkedinSentByRep: Record<string, number> = {};
    const contactsWorkedByRep: Record<string, Set<string>> = {};
    const openCountByRep: Record<string, number> = {};
    const clickCountByRep: Record<string, number> = {};
    const replyCountByRep: Record<string, number> = {};
    for (const m of outreachMessagesAgg) {
      const rid = m?.sentBy;
      if (!rid) continue;
      if (m.channel === "email") {
        emailsSentByRep[rid] = (emailsSentByRep[rid] || 0) + 1;
        if (m.openedAt) openCountByRep[rid] = (openCountByRep[rid] || 0) + 1;
        if (m.clickedAt) clickCountByRep[rid] = (clickCountByRep[rid] || 0) + 1;
        if (m.repliedAt) replyCountByRep[rid] = (replyCountByRep[rid] || 0) + 1;
      } else if (m.channel === "linkedin") {
        linkedinSentByRep[rid] = (linkedinSentByRep[rid] || 0) + 1;
      }
      if (m.contactId) {
        (contactsWorkedByRep[rid] ||= new Set()).add(m.contactId);
      }
    }

    // Phase 9D rollups.
    const activeSeqByRep = mapAgg(activeSequencesPerRep, "repId");
    const closedWonAgg = mapAgg(closedWonByRep, "salesRepId");
    const referralsAgg = mapAgg(referralsDrivenByRep, "salesRepId");

    // Pipeline created $ — parse forecast strings ("$15K", "$2M", "120000")
    function parseForecastUSD(s: string | null | undefined): number {
      if (!s) return 0;
      const m = s.replace(/[\s,]/g, "").match(/\$?(\d+(?:\.\d+)?)\s*([kKmMbB]?)/);
      if (!m) return 0;
      const n = parseFloat(m[1]);
      const mult =
        m[2] === "k" || m[2] === "K"
          ? 1_000
          : m[2] === "m" || m[2] === "M"
            ? 1_000_000
            : m[2] === "b" || m[2] === "B"
              ? 1_000_000_000
              : 1;
      return n * mult;
    }
    const pipelineCreatedByRep: Record<string, number> = {};
    for (const b of forecastBrandsPerRep) {
      if (!b.salesRepId) continue;
      pipelineCreatedByRep[b.salesRepId] =
        (pipelineCreatedByRep[b.salesRepId] || 0) + parseForecastUSD(b.forecast);
    }

    // Pipeline velocity: avg days from first email to first meeting per rep.
    // For each rep, walk their messages oldest-first, snapshot earliest
    // send per contact, then snapshot earliest meeting per contact.
    const earliestSendPerRepContact = new Map<string, Date>();
    for (const s of firstSendsByRep) {
      if (!s.sentBy || !s.contactId || !s.sentAt) continue;
      const key = `${s.sentBy}|${s.contactId}`;
      if (!earliestSendPerRepContact.has(key))
        earliestSendPerRepContact.set(key, s.sentAt);
    }
    const velocityBucket: Record<string, { sum: number; n: number }> = {};
    for (const m of firstMeetingsByRep) {
      if (!m.organizerId || !m.contactId) continue;
      const key = `${m.organizerId}|${m.contactId}`;
      const firstSend = earliestSendPerRepContact.get(key);
      if (!firstSend) continue;
      const t = m.createdAt || m.startTime;
      const days = (t.getTime() - firstSend.getTime()) / 86400_000;
      if (days < 0) continue;
      const b = (velocityBucket[m.organizerId] ||= { sum: 0, n: 0 });
      b.sum += days;
      b.n += 1;
    }

    const rows = reps.map((rep) => {
      const sequencesStarted = seqStartedByRep[rep.id] || 0;
      const replies = seqRepliedByRep[rep.id] || 0;
      const stepsSent = stepsSentByRep[rep.id] || 0;
      const stepsReady = stepsReadyByRep[rep.id] || 0;
      const meetingsBooked = meetingsByRep[rep.id] || 0;
      const brandsConverted = brandsConvertedByRep[rep.id] || 0;
      const emailsSent = emailsSentByRep[rep.id] || 0;
      const linkedinSent = linkedinSentByRep[rep.id] || 0;
      const contactsWorked = contactsWorkedByRep[rep.id]?.size || 0;
      // Reply rate now measured against ALL email outreach, not just
      // sequence-wrapped. If a rep only sends one-off emails and never
      // runs sequences, they still get a meaningful reply rate.
      const replyDenom = emailsSent > 0 ? emailsSent : sequencesStarted;
      const replyRate =
        replyDenom > 0 ? Math.min(1, replies / replyDenom) : 0;
      // Phase 9D additions
      const opens = openCountByRep[rep.id] || 0;
      const clicks = clickCountByRep[rep.id] || 0;
      const repliesViaTracking = replyCountByRep[rep.id] || 0;
      const openRate = emailsSent > 0 ? opens / emailsSent : 0;
      const clickRate = emailsSent > 0 ? clicks / emailsSent : 0;
      const replyRateTracked =
        emailsSent > 0 ? repliesViaTracking / emailsSent : 0;
      const activeSequences = activeSeqByRep[rep.id] || 0;
      const pipelineCreatedUSD = pipelineCreatedByRep[rep.id] || 0;
      const closedWonContribution = closedWonAgg[rep.id] || 0;
      const referralsDriven = referralsAgg[rep.id] || 0;
      const v = velocityBucket[rep.id];
      const pipelineVelocityDays = v ? v.sum / v.n : null;
      return {
        rep,
        emailsSent,
        linkedinSent,
        contactsWorked,
        sequencesStarted,
        stepsSent,
        stepsReady,
        replies,
        meetingsBooked,
        brandsConverted,
        replyRate,
        // Phase 9D
        opens,
        clicks,
        openRate,
        clickRate,
        repliesViaTracking,
        replyRateTracked,
        activeSequences,
        pipelineCreatedUSD,
        closedWonContribution,
        pipelineVelocityDays,
        // Phase 9I
        referralsDriven,
      };
    });

    // Sort the leaderboard by replies desc, then emailsSent desc (so a rep
    // with lots of outbound but zero replies still ranks above the idle
    // ones).
    rows.sort((a, b) => {
      if (b.replies !== a.replies) return b.replies - a.replies;
      return b.emailsSent - a.emailsSent;
    });

    // Distinct-contacts total across all reps (dedupe again at the team
    // level — two reps touching the same contact only count once).
    const teamContactSet = new Set<string>();
    for (const m of outreachMessagesAgg) {
      if (m?.contactId) teamContactSet.add(m.contactId);
    }

    const totals = rows.reduce(
      (acc, r) => {
        acc.emailsSent += r.emailsSent;
        acc.linkedinSent += r.linkedinSent;
        acc.sequencesStarted += r.sequencesStarted;
        acc.stepsSent += r.stepsSent;
        acc.stepsReady += r.stepsReady;
        acc.replies += r.replies;
        acc.meetingsBooked += r.meetingsBooked;
        acc.brandsConverted += r.brandsConverted;
        // Phase 9D
        acc.opens += r.opens;
        acc.clicks += r.clicks;
        acc.activeSequences += r.activeSequences;
        acc.pipelineCreatedUSD += r.pipelineCreatedUSD;
        acc.closedWonContribution += r.closedWonContribution;
        acc.referralsDriven += r.referralsDriven;
        return acc;
      },
      emptyTotals(),
    );
    totals.openRate = totals.emailsSent > 0 ? totals.opens / totals.emailsSent : 0;
    totals.clickRate = totals.emailsSent > 0 ? totals.clicks / totals.emailsSent : 0;
    totals.contactsWorked = teamContactSet.size;
    totals.replyRate =
      totals.emailsSent > 0
        ? Math.min(1, totals.replies / totals.emailsSent)
        : totals.sequencesStarted > 0
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
    emailsSent: 0,
    linkedinSent: 0,
    contactsWorked: 0,
    sequencesStarted: 0,
    stepsSent: 0,
    stepsReady: 0,
    replies: 0,
    meetingsBooked: 0,
    brandsConverted: 0,
    replyRate: 0,
    // Phase 9D
    opens: 0,
    clicks: 0,
    openRate: 0,
    clickRate: 0,
    activeSequences: 0,
    pipelineCreatedUSD: 0,
    closedWonContribution: 0,
    referralsDriven: 0,
  };
}
