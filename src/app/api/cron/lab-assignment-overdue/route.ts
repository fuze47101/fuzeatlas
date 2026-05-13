// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyLabAssignmentOverdue } from "@/lib/notify";

/**
 * GET/POST /api/cron/lab-assignment-overdue
 *
 * NEED-7 — 24h SLA escalation. Finds every TestRequest in
 * ASSIGNED_TO_LAB status whose labAssignedAt is older than 24h
 * with neither labAcceptedAt nor labRejectedAt set. Fires an
 * admin-only escalation notification per row.
 *
 * Bearer-authed. Fire from Andrew's Mac via `fzcron
 * lab-assignment-overdue` or wire to a daily Vercel cron.
 *
 * notifyLabAssignmentOverdue dedupes on (testRequestId) for 22h so
 * repeated cron firings don't re-page admins about the same row.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const SLA_HOURS = 24;

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000);

  let overdue: any[] = [];
  try {
    overdue = await prisma.testRequest.findMany({
      where: {
        status: "ASSIGNED_TO_LAB",
        labAssignedAt: { lt: cutoff, not: null },
        labAcceptedAt: null,
        labRejectedAt: null,
      },
      select: {
        id: true,
        poNumber: true,
        labAssignedAt: true,
        brand: { select: { name: true } },
        lab: { select: { name: true } },
      },
      take: 200,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Query failed — has migrate-lab-assignment run?" },
      { status: 500 },
    );
  }

  const now = Date.now();
  const results: any[] = [];
  for (const row of overdue) {
    const hoursOverdue = row.labAssignedAt
      ? Math.round((now - row.labAssignedAt.getTime()) / 3600_000)
      : SLA_HOURS;
    try {
      await notifyLabAssignmentOverdue({
        testRequestId: row.id,
        poNumber: row.poNumber,
        labName: row.lab?.name || null,
        brandName: row.brand?.name || null,
        hoursOverdue,
      });
      results.push({ id: row.id, poNumber: row.poNumber, hoursOverdue, escalated: true });
    } catch (e: any) {
      results.push({
        id: row.id,
        poNumber: row.poNumber,
        escalated: false,
        error: e?.message || String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    slaHours: SLA_HOURS,
    cutoff: cutoff.toISOString(),
    overdueCount: overdue.length,
    results,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
