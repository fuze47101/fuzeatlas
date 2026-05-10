// @ts-nocheck
/**
 * GET /api/admin/bd/calendar?from=ISO&to=ISO&mine=1 — Phase 9G.
 *
 * Combines four touchpoint sources into a single per-day stream for
 * the /admin/bd/calendar weekly grid:
 *   1. Meeting rows (scheduled OR rescheduled)
 *   2. Open CrmTask rows (dueAt in window)
 *   3. BDSequenceStep rows scheduled to fire in window (channel=email)
 *   4. Brand engagement warnings — brands with no activity for 75d+
 *
 * `mine=1` scopes the result to the caller's assignments via
 * EntityManager OR Brand.salesRepId — managers/admins still see
 * everything when mine=1 is omitted.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const BD_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BD_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const now = new Date();
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from")!)
    : new Date(now.getTime() - 1 * 86400_000);
  const to = url.searchParams.get("to")
    ? new Date(url.searchParams.get("to")!)
    : new Date(now.getTime() + 13 * 86400_000);
  const mine = url.searchParams.get("mine") === "1";

  // Brands the caller "owns" via EntityManager OR salesRepId. Only
  // applied when mine=1.
  let myBrandIds: string[] | null = null;
  if (mine) {
    const [byManager, bySalesRep] = await Promise.all([
      prisma.entityManager.findMany({
        where: { userId: user.id, entityType: "BRAND" },
        select: { entityId: true },
      }),
      prisma.brand.findMany({
        where: { salesRepId: user.id },
        select: { id: true },
      }),
    ]);
    const set = new Set<string>();
    for (const r of byManager) set.add(r.entityId);
    for (const r of bySalesRep) set.add(r.id);
    myBrandIds = Array.from(set);
  }

  const brandFilter = myBrandIds ? { brandId: { in: myBrandIds } } : {};

  const [meetings, tasks, sequenceSteps, atRiskBrands] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        startTime: { gte: from, lte: to },
        ...(myBrandIds ? { brandId: { in: myBrandIds } } : {}),
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        meetingType: true,
        brandId: true,
        organizerId: true,
        brand: { select: { name: true } },
      },
    }),
    prisma.crmTask.findMany({
      where: {
        status: "OPEN",
        dueAt: { gte: from, lte: to },
        ...(mine ? { ownerId: user.id } : {}),
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        priority: true,
        brandId: true,
        ownerId: true,
        brand: { select: { name: true } },
      },
    }),
    prisma.bDSequenceStep.findMany({
      where: {
        status: { in: ["pending", "ready"] },
        scheduledFor: { gte: from, lte: to },
        ...(mine
          ? { sequence: { repId: user.id, status: "active" } }
          : { sequence: { status: "active" } }),
      },
      select: {
        id: true,
        stepIndex: true,
        channel: true,
        scheduledFor: true,
        status: true,
        sequence: {
          select: {
            id: true,
            brandId: true,
            contactId: true,
            repId: true,
            brand: { select: { name: true } },
            contact: { select: { name: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
    // Engagement warning — brands inactive for 75+ days. We surface them
    // as a single touchpoint on today's date so they show up in the
    // current week without spamming every cell.
    prisma.brand.findMany({
      where: {
        ...(myBrandIds ? { id: { in: myBrandIds } } : {}),
        OR: [
          { lastActivityAt: { lt: new Date(Date.now() - 75 * 86400_000) } },
          { lastActivityAt: null },
        ],
        pipelineStage: { notIn: ["ARCHIVE", "CUSTOMER_WON"] },
      },
      select: {
        id: true,
        name: true,
        lastActivityAt: true,
        salesRepId: true,
      },
      take: 100,
    }),
  ]);

  const items: any[] = [];

  for (const m of meetings) {
    items.push({
      kind: "MEETING",
      id: `meeting:${m.id}`,
      at: m.startTime.toISOString(),
      title: m.title,
      brandId: m.brandId,
      brandName: m.brand?.name || null,
      meta: { meetingType: m.meetingType },
      link: `/calendar/${m.id}`,
    });
  }

  for (const t of tasks) {
    items.push({
      kind: "TASK",
      id: `task:${t.id}`,
      at: t.dueAt.toISOString(),
      title: t.title,
      brandId: t.brandId,
      brandName: t.brand?.name || null,
      meta: { priority: t.priority },
      link: t.brandId ? `/brands/${t.brandId}` : "/acm/tasks",
    });
  }

  for (const s of sequenceSteps) {
    const c = s.sequence?.contact;
    const cName =
      c?.name ||
      [c?.firstName, c?.lastName].filter(Boolean).join(" ") ||
      null;
    items.push({
      kind: "SEQUENCE_STEP",
      id: `step:${s.id}`,
      at: s.scheduledFor.toISOString(),
      title: `Step ${s.stepIndex + 1} · ${s.channel} → ${cName || "—"}`,
      brandId: s.sequence?.brandId || null,
      brandName: s.sequence?.brand?.name || null,
      meta: { stepIndex: s.stepIndex, channel: s.channel, status: s.status },
      link: `/admin/bd/sequences/${s.sequence?.id || ""}`,
    });
  }

  const today = new Date();
  today.setHours(9, 0, 0, 0);
  for (const b of atRiskBrands) {
    const last = b.lastActivityAt
      ? Math.floor((Date.now() - b.lastActivityAt.getTime()) / 86400_000)
      : null;
    items.push({
      kind: "WARNING",
      id: `warn:${b.id}`,
      at: today.toISOString(),
      title: last == null
        ? `${b.name} — no activity logged yet`
        : `${b.name} — ${last}d since last activity`,
      brandId: b.id,
      brandName: b.name,
      meta: { daysSince: last },
      link: `/brands/${b.id}`,
    });
  }

  items.sort((a, b) => a.at.localeCompare(b.at));

  return NextResponse.json({
    ok: true,
    from: from.toISOString(),
    to: to.toISOString(),
    mine,
    items,
  });
}
