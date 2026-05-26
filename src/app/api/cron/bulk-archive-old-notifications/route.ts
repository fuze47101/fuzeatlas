// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/bulk-archive-old-notifications
 *
 * Phase 16.6 Track 1 — one-time bulk archive for the 5,317-row admin
 * notifications backlog that pre-dates the weekly archive cron.
 *
 * Body: { olderThanDays: number }  (default 30)
 *
 * Stamps Notification.archivedAt = now() for every row where
 * archivedAt IS NULL AND createdAt < (now - olderThanDays).
 * Returns { archived, remaining } counts.
 *
 * Distinct from the recurring /api/cron/archive-old-notifications
 * which runs weekly at days=90. This endpoint is fired manually
 * via fzcron once to drain the backlog; the recurring cron keeps
 * it from regrowing.
 */

const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Accept body for POST, query for GET
  let olderThanDays = 30;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.olderThanDays === "number") {
        olderThanDays = Math.max(1, body.olderThanDays);
      }
    } else {
      const url = new URL(req.url);
      const q = url.searchParams.get("olderThanDays") || url.searchParams.get("days");
      if (q) olderThanDays = Math.max(1, parseInt(q, 10));
    }
  } catch {
    // fall through with default
  }

  const cutoff = new Date(Date.now() - olderThanDays * 86400000);
  const result = await prisma.notification.updateMany({
    where: { createdAt: { lt: cutoff }, archivedAt: null },
    data: { archivedAt: new Date() },
  });

  const remaining = await prisma.notification.count({
    where: { archivedAt: null, read: false },
  });

  return NextResponse.json({
    ok: true,
    archived: result.count,
    remaining,
    cutoff: cutoff.toISOString(),
    olderThanDays,
    verdict: `Bulk-archived ${result.count} notification(s) older than ${olderThanDays} days. ${remaining} unread remaining.`,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

export const maxDuration = 60;
