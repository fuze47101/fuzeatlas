// @ts-nocheck
/**
 * GET /api/admin/red-rover/exec — read-only exec rollup: Engagement Brief
 * (project goalMd), agreement-progress KPIs, ranked target table with
 * primary contact + attachments. Gated to ADMIN/EMPLOYEE/SALES_MANAGER OR
 * a user with User.canViewRedRover (board / management logins).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);
const RED_ROVER_PROJECT_ID = "cmpvutgx1001vks04s7v48sqj";
const TIER_ORDER: Record<string, number> = { TIER1: 0, TIER2: 1, PARKED: 2 };

export async function GET() {
  const user = await getRealUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let allowed = ADMIN_ROLES.has(user.role);
  if (!allowed) {
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      select: { canViewRedRover: true },
    });
    allowed = !!full?.canViewRedRover;
  }
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const [rows, project, activityRows] = await Promise.all([
    prisma.redRoverTarget.findMany({
      include: {
        owner: { select: { name: true } },
        contacts: { select: { name: true, title: true, side: true, role: true } },
        attachments: {
          where: { deletedAt: null },
          select: { id: true, filename: true, url: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.project
      .findUnique({ where: { id: RED_ROVER_PROJECT_ID }, select: { goalMd: true, name: true } })
      .catch(() => null),
    prisma.redRoverActivity.findMany({ select: { targetId: true, type: true, body: true, occurredAt: true } }),
  ]);

  const targets = rows
    .map((t) => {
      const neg = t.contacts.filter((c) => c.role === "NEGOTIATION");
      const primaryContact = neg.find((c) => c.side === "TARGET") || neg[0] || t.contacts[0] || null;
      return {
        id: t.id,
        rank: t.rank,
        tier: t.tier,
        stage: t.stage,
        name: t.name,
        geo: t.geo,
        companyClass: t.companyClass,
        tripLeg: t.tripLeg,
        ownerName: t.owner?.name || null,
        nextStep: t.nextStep,
        currentStatus: t.currentStatus,
        currentAgreements: t.currentAgreements,
        primaryContact: primaryContact ? { name: primaryContact.name, title: primaryContact.title } : null,
        attachments: t.attachments,
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

  // KPIs (same derivation as the dashboard).
  const lc = (s: any) => String(s || "").toLowerCase();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
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
    activityRows.filter((a) => a.type === "STATUS_CHANGE" && new Date(a.occurredAt) >= monthStart).map((a) => a.targetId),
  ).size;

  const kpis = {
    execMeetings: activityRows.filter((a) => a.type === "MEETING").length,
    lois: loiTargets.size,
    draftContracts: draftTargets.size,
    ndasExecuted: ndaTargets.size,
    advancedThisMonth,
    totalTargets: targets.length,
  };

  return NextResponse.json({
    ok: true,
    brief: { name: project?.name || "Project Red Rover", goalMd: project?.goalMd || null },
    kpis,
    targets,
  });
}
