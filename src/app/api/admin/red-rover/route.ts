// @ts-nocheck
/**
 * GET  /api/admin/red-rover — list every target for the dashboard, with
 *   owner name, primary NEGOTIATION contact, activity count, lastActivityAt,
 *   the summary-card rollups, the owner filter roster, and the Engagement
 *   Brief text (from the Red Rover project's goalMd).
 * POST /api/admin/red-rover — create a target (Add-target button).
 *
 * Admin-gated on getRealUser() (ignores impersonation). ADMIN / EMPLOYEE /
 * SALES_MANAGER (so Josh, the owner, can drive his own book too).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";
import { weightedValue, effectiveProb } from "@/lib/red-rover-ui";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);
const RED_ROVER_PROJECT_ID = "cmpvutgx1001vks04s7v48sqj";
const JOSH_ID = "cmrmb51hk0000lb04r6ceoemn";

const TIER_ORDER: Record<string, number> = { TIER1: 0, TIER2: 1, PARKED: 2 };
const DAY = 86_400_000;

async function gate() {
  const user = await getRealUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if (!ADMIN_ROLES.has(user.role))
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const g = await gate();
  if (g.error) return g.error;

  const [rows, project, owners, activityRows] = await Promise.all([
    prisma.redRoverTarget.findMany({
      include: {
        owner: { select: { id: true, name: true } },
        contacts: {
          select: { id: true, name: true, title: true, email: true, side: true, role: true },
        },
        _count: { select: { activities: true } },
      },
    }),
    prisma.project
      .findUnique({ where: { id: RED_ROVER_PROJECT_ID }, select: { goalMd: true, name: true } })
      .catch(() => null),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.redRoverActivity.findMany({
      select: { targetId: true, type: true, body: true, occurredAt: true },
    }),
  ]);

  const now = Date.now();
  const targets = rows
    .map((t) => {
      const negotiation = t.contacts.filter((c) => c.role === "NEGOTIATION");
      const gatekeepers = t.contacts.filter((c) => c.role === "TECHNICAL_GATEKEEPER");
      const primaryContact =
        negotiation.find((c) => c.side === "TARGET") || negotiation[0] || t.contacts[0] || null;
      const daysSince =
        t.lastActivityAt != null ? Math.floor((now - new Date(t.lastActivityAt).getTime()) / DAY) : null;
      return {
        id: t.id,
        name: t.name,
        rank: t.rank,
        tier: t.tier,
        companyClass: t.companyClass,
        geo: t.geo,
        stage: t.stage,
        tripLeg: t.tripLeg,
        projectedValueUsd: t.projectedValueUsd,
        winProbabilityPct: t.winProbabilityPct,
        effectiveProb: effectiveProb(t.stage, t.winProbabilityPct),
        weightedValue: weightedValue(t.projectedValueUsd, t.winProbabilityPct, t.stage),
        ownerId: t.ownerId,
        ownerName: t.owner?.name || null,
        nextStep: t.nextStep,
        primaryContact,
        contactCount: t.contacts.length,
        negotiationCount: negotiation.length,
        gatekeeperCount: gatekeepers.length,
        activityCount: t._count.activities,
        lastActivityAt: t.lastActivityAt,
        daysSinceActivity: daysSince,
      };
    })
    .sort((a, b) => {
      const to = (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9);
      if (to !== 0) return to;
      const ra = a.rank ?? 9999;
      const rb = b.rank ?? 9999;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });

  // ── Summary cards ──────────────────────────────────────────
  const stageFunnel: Record<string, number> = {};
  for (const t of targets) stageFunnel[t.stage] = (stageFunnel[t.stage] || 0) + 1;

  const tier1Count = targets.filter((t) => t.tier === "TIER1").length;
  const stalledCount = targets.filter((t) => t.stage === "STALLED").length;
  // Accountability signal — no activity in >14d (includes never-logged),
  // excluding formally PARKED targets which aren't being actively worked.
  const noActivity14d = targets.filter(
    (t) => t.tier !== "PARKED" && (t.daysSinceActivity == null || t.daysSinceActivity > 14),
  ).length;
  const ownedByJosh = targets.filter((t) => t.ownerId === JOSH_ID).length;

  // ── KPI strip — agreement-progress metrics from activity types + the
  // per-target agreement text (distinct targets, not raw counts). ────────
  const lc = (s: any) => String(s || "").toLowerCase();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const execMeetings = activityRows.filter((a) => a.type === "MEETING").length;
  const ndaTargets = new Set<string>();
  const loiTargets = new Set<string>();
  const draftTargets = new Set<string>();

  for (const r of rows) {
    const b = lc((r as any).currentAgreements);
    if (/nda/.test(b) && /(execut|signed|complet)/.test(b)) ndaTargets.add(r.id);
    if (/\bloi\b|letter of intent/.test(b)) loiTargets.add(r.id);
    if (/term sheet|draft (agreement|contract)|distribution agreement|offtake/.test(b)) draftTargets.add(r.id);
  }
  for (const a of activityRows) {
    const b = lc(a.body);
    if (/nda/.test(b) && /execut/.test(b)) ndaTargets.add(a.targetId);
    if (/\bloi\b|letter of intent/.test(b)) loiTargets.add(a.targetId);
    if (/term sheet|draft (agreement|contract)|offtake/.test(b)) draftTargets.add(a.targetId);
  }
  const advancedThisMonth = new Set(
    activityRows
      .filter((a) => a.type === "STATUS_CHANGE" && new Date(a.occurredAt) >= monthStart)
      .map((a) => a.targetId),
  ).size;

  const kpis = {
    execMeetings,
    lois: loiTargets.size,
    draftContracts: draftTargets.size,
    ndasExecuted: ndaTargets.size,
    advancedThisMonth,
    totalTargets: targets.length,
  };

  // ── Weighted forecast ─────────────────────────────────────
  let projectedTotal = 0;
  let weightedTotal = 0;
  const byStage: Record<string, { projected: number; weighted: number; count: number }> = {};
  const byTier: Record<string, { projected: number; weighted: number; count: number }> = {};
  for (const t of targets) {
    const p = t.projectedValueUsd || 0;
    const w = t.weightedValue || 0;
    projectedTotal += p;
    weightedTotal += w;
    (byStage[t.stage] ??= { projected: 0, weighted: 0, count: 0 });
    byStage[t.stage].projected += p;
    byStage[t.stage].weighted += w;
    byStage[t.stage].count += 1;
    (byTier[t.tier] ??= { projected: 0, weighted: 0, count: 0 });
    byTier[t.tier].projected += p;
    byTier[t.tier].weighted += w;
    byTier[t.tier].count += 1;
  }
  const goalRow = await prisma.redRoverGoal
    .upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton", annualGoalUsd: 0 } })
    .catch(() => null);
  const goal = goalRow?.annualGoalUsd || 0;
  const forecast = {
    projectedTotal,
    weightedTotal,
    byStage,
    byTier,
    goal,
    gapToGoal: goal - weightedTotal,
  };

  return NextResponse.json({
    ok: true,
    targets,
    owners,
    summary: {
      total: targets.length,
      stageFunnel,
      tier1Count,
      stalledCount,
      noActivity14d,
      ownedByJosh,
      kpis,
      forecast,
    },
    brief: {
      projectId: RED_ROVER_PROJECT_ID,
      name: project?.name || "Project Red Rover",
      goalMd: project?.goalMd || null,
    },
  });
}

export async function POST(req: Request) {
  const g = await gate();
  if (g.error) return g.error;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Target name is required" }, { status: 400 });
  }

  const VALID_TIER = new Set(["TIER1", "TIER2", "PARKED"]);
  const VALID_STAGE = new Set([
    "IDENTIFIED",
    "CONTACTED",
    "PRESENTATION",
    "TESTING",
    "AGREEMENT",
    "ACTIVE",
    "STALLED",
    "PARKED",
  ]);

  const created = await prisma.redRoverTarget.create({
    data: {
      name,
      rank: Number.isFinite(body.rank) ? Math.trunc(body.rank) : null,
      tier: VALID_TIER.has(body.tier) ? body.tier : "TIER2",
      stage: VALID_STAGE.has(body.stage) ? body.stage : "IDENTIFIED",
      companyClass: body.companyClass?.trim() || null,
      geo: body.geo?.trim() || null,
      // Default owner = Josh unless an explicit owner is passed.
      ownerId: body.ownerId || JOSH_ID,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ ok: true, target: created });
}
