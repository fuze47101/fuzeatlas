// @ts-nocheck
/**
 * Snapshot generator for Weekly Exec Review.
 *
 * Pulls the current state of the DB over a given window and returns a
 * `WeeklySnapshot` shaped payload ready to store in
 * WeeklyExecReport.snapshot.
 *
 * This is the ONE place that knows how to turn raw DB rows into the
 * exec-review shape. Every API route that needs a snapshot goes through
 * here — historical weeks read their frozen copy straight out of the
 * JSON column and never re-query source data.
 */
import { prisma } from "@/lib/prisma";
import type { WeeklySnapshot, SnapshotPeriod, Kpi } from "./types";
import { SNAPSHOT_VERSION } from "./types";

/** Return the Monday 00:00:00 UTC that anchors the week containing `d`. */
export function mondayOf(d: Date): Date {
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = u.getUTCDay(); // 0 = Sun .. 6 = Sat
  const delta = dow === 0 ? -6 : 1 - dow;
  u.setUTCDate(u.getUTCDate() + delta);
  u.setUTCHours(0, 0, 0, 0);
  return u;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function endOfWindow(start: Date, days: number): Date {
  const end = addDays(start, days - 1);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function pct(now: number, prev: number): number | undefined {
  if (prev === 0) return now === 0 ? 0 : undefined;
  return Math.round(((now - prev) / prev) * 100);
}

/**
 * Main entry point. `weekOf` must be a Monday UTC midnight.
 * `lookbackDays` is 7 (normal week) or more (e.g. 14 for the first backfill run).
 */
export async function buildSnapshot(weekOf: Date, lookbackDays = 7): Promise<WeeklySnapshot> {
  const days = Math.max(lookbackDays, 1);
  const end = endOfWindow(weekOf, 1); // Monday end-of-day — but we actually want the window *ending* this Monday
  // We report on the window [weekOf - days, weekOf - 1ms], so the report
  // filed on Monday covers up through Sunday night. For a 2-week backfill,
  // shift the start back `days` instead of 7.
  const start = addDays(weekOf, -days);
  const windowEnd = addDays(weekOf, -1);
  windowEnd.setUTCHours(23, 59, 59, 999);

  const priorStart = addDays(start, -days);
  const priorEnd = addDays(start, -1);
  priorEnd.setUTCHours(23, 59, 59, 999);

  const period: SnapshotPeriod = {
    start: start.toISOString(),
    end: windowEnd.toISOString(),
    days,
    weekOf: weekOf.toISOString(),
  };
  const priorPeriod: SnapshotPeriod = {
    start: priorStart.toISOString(),
    end: priorEnd.toISOString(),
    days,
    weekOf: addDays(weekOf, -days).toISOString(),
  };
  const range = { gte: start, lte: windowEnd };
  const priorRange = { gte: priorStart, lte: priorEnd };

  // ─── Sales & Distribution ─────────────────────────────
  const orders = await prisma.fuzeOrder.findMany({
    where: {
      OR: [
        { createdAt: range },
        { shippedDate: range },
        { deliveredDate: range },
      ],
    },
    select: {
      id: true, orderNumber: true, orderType: true,
      volumeLiters: true, fabricMassKg: true, totalPrice: true,
      status: true, createdAt: true, shippedDate: true, deliveredDate: true,
      brand: { select: { id: true, name: true } },
    },
  });

  const priorOrders = await prisma.fuzeOrder.findMany({
    where: {
      OR: [
        { createdAt: priorRange },
        { shippedDate: priorRange },
      ],
    },
    select: {
      volumeLiters: true, fabricMassKg: true, totalPrice: true,
      createdAt: true, shippedDate: true,
    },
  });

  const sales = {
    bookedLiters: 0,
    shippedLiters: 0,
    bookedKg: 0,
    shippedKg: 0,
    bookedDollars: 0,
    shippedDollars: 0,
    newOrders: 0,
    shippedOrders: 0,
    deliveredOrders: 0,
    byOrderType: {} as Record<string, { count: number; dollars: number }>,
  };
  const priorSales = { bookedLiters: 0, shippedLiters: 0, bookedDollars: 0, shippedDollars: 0 };

  for (const o of orders) {
    const created = o.createdAt && o.createdAt >= start && o.createdAt <= windowEnd;
    const shipped = o.shippedDate && o.shippedDate >= start && o.shippedDate <= windowEnd;
    const delivered = o.deliveredDate && o.deliveredDate >= start && o.deliveredDate <= windowEnd;
    if (created) {
      sales.newOrders++;
      sales.bookedLiters += o.volumeLiters || 0;
      sales.bookedKg += o.fabricMassKg || 0;
      sales.bookedDollars += o.totalPrice || 0;
      const key = o.orderType || "UNKNOWN";
      if (!sales.byOrderType[key]) sales.byOrderType[key] = { count: 0, dollars: 0 };
      sales.byOrderType[key].count++;
      sales.byOrderType[key].dollars += o.totalPrice || 0;
    }
    if (shipped) {
      sales.shippedOrders++;
      sales.shippedLiters += o.volumeLiters || 0;
      sales.shippedKg += o.fabricMassKg || 0;
      sales.shippedDollars += o.totalPrice || 0;
    }
    if (delivered) sales.deliveredOrders++;
  }
  for (const o of priorOrders) {
    const created = o.createdAt && o.createdAt >= priorStart && o.createdAt <= priorEnd;
    const shipped = o.shippedDate && o.shippedDate >= priorStart && o.shippedDate <= priorEnd;
    if (created) {
      priorSales.bookedLiters += o.volumeLiters || 0;
      priorSales.bookedDollars += o.totalPrice || 0;
    }
    if (shipped) {
      priorSales.shippedLiters += o.volumeLiters || 0;
      priorSales.shippedDollars += o.totalPrice || 0;
    }
  }

  // ─── SOW Progress ─────────────────────────────────────
  const sowAll = await prisma.sOW.findMany({
    where: {
      OR: [
        { createdAt: range },
        { updatedAt: range },
        { status: { in: ["DRAFT", "SENT", "SIGNED", "ACTIVE"] } },
      ],
    },
    select: {
      id: true, title: true, status: true, signatory: true,
      createdAt: true, updatedAt: true,
      brand: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const sowCounts = await prisma.sOW.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countsMap: Record<string, number> = {};
  for (const c of sowCounts) countsMap[c.status] = c._count._all;

  const thirtyDaysAgo = addDays(new Date(), -30);
  const mapRow = (s: any) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    brandId: s.brand?.id,
    brandName: s.brand?.name || "—",
    updatedAt: s.updatedAt.toISOString(),
    signatory: s.signatory || null,
  });
  const sows = {
    new: sowAll.filter((s: any) => s.createdAt >= start && s.createdAt <= windowEnd).map(mapRow),
    signed: sowAll.filter((s: any) => s.status === "SIGNED" && s.updatedAt >= start && s.updatedAt <= windowEnd).map(mapRow),
    active: sowAll.filter((s: any) => s.status === "ACTIVE").slice(0, 25).map(mapRow),
    complete: sowAll.filter((s: any) => s.status === "COMPLETE" && s.updatedAt >= start && s.updatedAt <= windowEnd).map(mapRow),
    stale: sowAll.filter((s: any) => ["DRAFT", "SENT"].includes(s.status) && s.updatedAt < thirtyDaysAgo).slice(0, 25).map(mapRow),
    counts: {
      draft: countsMap["DRAFT"] || 0,
      sent: countsMap["SENT"] || 0,
      signed: countsMap["SIGNED"] || 0,
      active: countsMap["ACTIVE"] || 0,
      complete: countsMap["COMPLETE"] || 0,
      cancelled: countsMap["CANCELLED"] || 0,
    },
  };

  // ─── BD / Pipeline ────────────────────────────────────
  const brandsByStage = await prisma.brand.groupBy({
    by: ["pipelineStage"],
    _count: { _all: true },
  });
  const stageWaterfall = brandsByStage.map((r: any) => ({
    stage: r.pipelineStage || "UNSET",
    count: r._count._all,
    deltaFromStart: 0, // requires historical brand-stage snapshot; wired later
  }));

  const newBrands = await prisma.brand.findMany({
    where: { createdAt: range },
    select: { id: true, name: true, pipelineStage: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const handoffQueue = await prisma.brand.findMany({
    where: { handoffPending: true },
    select: { id: true, name: true, pipelineStage: true, handoffPending: true, lastActivityAt: true },
    orderBy: { lastActivityAt: "asc" },
    take: 20,
  });

  // Leaderboard — notes authored per user this window, with brand reach
  const notesThisWindow = await prisma.note.findMany({
    where: { createdAt: range, userId: { not: null } },
    select: { userId: true, brandId: true, user: { select: { id: true, name: true, role: true } } },
  });
  const meetingsThisWindow = await prisma.meeting.findMany({
    where: { startTime: range, organizerId: { not: null } },
    select: { organizerId: true },
  });
  const leaderBoard = new Map<string, any>();
  for (const n of notesThisWindow) {
    if (!n.user) continue;
    const row = leaderBoard.get(n.userId) || {
      userId: n.userId, userName: n.user.name, role: n.user.role,
      noteCount: 0, brandsTouched: 0, meetingsHeld: 0, _brands: new Set<string>(),
    };
    row.noteCount++;
    if (n.brandId) row._brands.add(n.brandId);
    leaderBoard.set(n.userId, row);
  }
  for (const m of meetingsThisWindow) {
    if (!m.organizerId) continue;
    const row = leaderBoard.get(m.organizerId);
    if (row) row.meetingsHeld++;
  }
  const leaderboard = Array.from(leaderBoard.values())
    .map((r: any) => ({
      userId: r.userId, userName: r.userName, role: r.role,
      noteCount: r.noteCount, brandsTouched: r._brands.size, meetingsHeld: r.meetingsHeld,
    }))
    .sort((a, b) => b.noteCount - a.noteCount)
    .slice(0, 10);

  // Customers at risk — lastActivityAt older than 45 days and in live stage.
  // Must match the PipelineStage enum exactly or Prisma throws "Invalid `prisma…`".
  // Live = we're still actively working them. Exclude ARCHIVE (dead), CUSTOMER_WON
  // (closed), and BRAND_EXPANSION (already scaling, not at-risk).
  const liveStages = [
    "LEAD",
    "PRESENTATION",
    "BRAND_TESTING",
    "FACTORY_ONBOARDING",
    "FACTORY_TESTING",
    "PRODUCTION",
  ];
  const fortyFiveDaysAgo = addDays(new Date(), -45);
  const staleBrands = await prisma.brand.findMany({
    where: {
      pipelineStage: { in: liveStages },
      OR: [
        { lastActivityAt: { lt: fortyFiveDaysAgo } },
        { lastActivityAt: null },
      ],
    },
    select: { id: true, name: true, pipelineStage: true, lastActivityAt: true },
    orderBy: { lastActivityAt: "asc" },
    take: 25,
  });
  const atRisk = staleBrands.map((b: any) => {
    const days = b.lastActivityAt
      ? Math.floor((Date.now() - b.lastActivityAt.getTime()) / 86400000)
      : null;
    return {
      id: b.id, name: b.name, pipelineStage: b.pipelineStage,
      lastActivityAt: b.lastActivityAt ? b.lastActivityAt.toISOString() : null,
      daysSinceActivity: days,
    };
  });

  // ─── Testing & Quality ────────────────────────────────
  const tests = await prisma.testRun.findMany({
    where: { createdAt: range },
    select: {
      id: true, testType: true, testDate: true,
      submission: { select: { fuzeFabricNumber: true, brand: { select: { name: true } } } },
      icpResult: { select: { agValue: true, auValue: true } },
      abResult: { select: { methodPass: true, pass: true } },
      fungalResult: { select: { pass: true } },
      odorResult: { select: { pass: true } },
    },
  });
  const byType: Record<string, { total: number; passed: number; failed: number }> = {};
  let passedTotal = 0;
  let failedTotal = 0;
  const recent: any[] = [];
  for (const t of tests) {
    const key = t.testType || "UNKNOWN";
    if (!byType[key]) byType[key] = { total: 0, passed: 0, failed: 0 };
    byType[key].total++;
    const pass = (t.icpResult?.agValue ?? 0) > 50
      || t.abResult?.methodPass === true || t.abResult?.pass === true
      || t.fungalResult?.pass === true || t.odorResult?.pass === true;
    const fail = (t.icpResult?.agValue !== undefined && t.icpResult.agValue <= 50)
      || t.abResult?.methodPass === false || t.abResult?.pass === false
      || t.fungalResult?.pass === false || t.odorResult?.pass === false;
    let passFlag: boolean | null = null;
    if (pass) { byType[key].passed++; passedTotal++; passFlag = true; }
    else if (fail) { byType[key].failed++; failedTotal++; passFlag = false; }
    recent.push({
      id: t.id,
      testType: t.testType,
      brandName: t.submission?.brand?.name || null,
      fuzeFabricNumber: t.submission?.fuzeFabricNumber || null,
      pass: passFlag,
      testDate: t.testDate ? t.testDate.toISOString() : null,
    });
  }

  // ─── Product & Build ──────────────────────────────────
  const fbResolved = await prisma.feedbackReport.findMany({
    where: { status: "FIXED", resolvedAt: range },
    select: { id: true, title: true, resolvedAt: true, resolution: true },
    orderBy: { resolvedAt: "desc" },
    take: 30,
  });
  const fbOpen = await prisma.feedbackReport.count({
    where: { status: { in: ["NEW", "TRIAGED", "ACCEPTED", "IN_PROGRESS"] } },
  });

  const buildNotes: string[] = [];
  if (fbResolved.length) buildNotes.push(`${fbResolved.length} user-reported issues resolved`);
  if (fbOpen) buildNotes.push(`${fbOpen} open feedback items in triage`);

  // ─── Agenda — upcoming meetings + CRM tasks due this week ─────
  const agendaStart = weekOf;
  const agendaEnd = addDays(weekOf, 7);
  const upMeetings = await prisma.meeting.findMany({
    where: { startTime: { gte: agendaStart, lt: agendaEnd } },
    select: {
      id: true, title: true, startTime: true,
      brand: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
  });
  const upTasks = await prisma.crmTask.findMany({
    where: {
      dueAt: { gte: agendaStart, lt: agendaEnd },
      status: { in: ["OPEN", "SNOOZED"] },
    },
    select: {
      id: true, title: true, dueAt: true,
      brand: { select: { id: true, name: true } },
    },
    orderBy: { dueAt: "asc" },
    take: 30,
  });
  const thisWeek: any[] = [
    ...upMeetings.map((m: any) => ({
      id: m.id, kind: "meeting", title: m.title,
      brandName: m.brand?.name || null,
      when: m.startTime.toISOString(),
      href: `/meetings/${m.id}`,
    })),
    ...upTasks.map((t: any) => ({
      id: t.id, kind: "task", title: t.title,
      brandName: t.brand?.name || null,
      when: t.dueAt ? t.dueAt.toISOString() : "",
      href: t.brand ? `/brands/${t.brand.id}` : "/tasks",
    })),
  ].sort((a, b) => (a.when < b.when ? -1 : 1));

  // ─── KPIs at the top of the report ────────────────────
  const kpis: Kpi[] = [
    {
      label: "Booked revenue",
      value: Math.round(sales.bookedDollars),
      unit: "$",
      deltaPct: pct(sales.bookedDollars, priorSales.bookedDollars),
      caption: `${sales.newOrders} new orders`,
      tone: sales.bookedDollars >= priorSales.bookedDollars ? "good" : "warn",
    },
    {
      label: "Shipped volume",
      value: Math.round(sales.shippedLiters),
      unit: "L",
      deltaPct: pct(sales.shippedLiters, priorSales.shippedLiters),
      caption: `${Math.round(sales.shippedKg)} kg · ${sales.shippedOrders} shipments`,
      tone: sales.shippedLiters >= priorSales.shippedLiters ? "good" : "warn",
    },
    {
      label: "Tests completed",
      value: tests.length,
      caption: `${passedTotal} passed · ${failedTotal} failed`,
      tone: failedTotal === 0 ? "good" : failedTotal > passedTotal ? "bad" : "warn",
    },
    {
      label: "New BD leads",
      value: newBrands.length,
      caption: `${handoffQueue.length} in handoff queue`,
      tone: "neutral",
    },
    {
      label: "SOW signed",
      value: sows.signed.length,
      caption: `${sows.counts.active} active · ${sows.stale.length} stale`,
      tone: sows.stale.length > 3 ? "warn" : "good",
    },
    {
      label: "Customers at risk",
      value: atRisk.length,
      caption: "≥45 days silent in live stages",
      tone: atRisk.length === 0 ? "good" : atRisk.length > 5 ? "bad" : "warn",
    },
  ];

  return {
    version: SNAPSHOT_VERSION,
    period,
    priorPeriod,
    kpis,
    sales,
    sows,
    bd: {
      stageWaterfall,
      leaderboard,
      handoffQueue: handoffQueue.map((b: any) => ({
        brandId: b.id,
        brandName: b.name,
        pipelineStage: b.pipelineStage || "UNSET",
        handoffPending: b.handoffPending,
        lastActivityAt: b.lastActivityAt ? b.lastActivityAt.toISOString() : null,
      })),
      newBrands: newBrands.map((b: any) => ({
        id: b.id, name: b.name, pipelineStage: b.pipelineStage || "UNSET",
      })),
      atRisk,
    },
    testing: {
      completed: tests.length,
      passed: passedTotal,
      failed: failedTotal,
      byType,
      recent: recent.slice(0, 25),
    },
    build: {
      feedbackOpen: fbOpen,
      feedbackResolved: fbResolved.length,
      featuresShipped: fbResolved.map((f: any) => ({
        id: f.id, title: f.title,
        resolvedAt: f.resolvedAt ? f.resolvedAt.toISOString() : "",
        resolution: f.resolution || null,
      })),
      buildNotes,
    },
    customersAtRisk: atRisk,
    thisWeek,
    generatedAt: new Date().toISOString(),
  };
}
