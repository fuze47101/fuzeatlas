// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET/POST /api/cron/archive-old-notifications
 *
 * T10 phase 16 — auto-archive cron. Runs weekly (configure in
 * vercel.json). Stamps Notification.archivedAt on any notification
 * older than DEFAULT_AGE_DAYS that isn't already archived. Does NOT
 * delete — archive flag preserves history while dropping noise off
 * the default list view.
 *
 * Optional ?days=N override for one-off backfill catch-ups.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const DEFAULT_AGE_DAYS = 90;

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = Math.max(7, parseInt(url.searchParams.get("days") || String(DEFAULT_AGE_DAYS), 10));
  const cutoff = new Date(Date.now() - days * 86400000);

  const result = await prisma.notification.updateMany({
    where: {
      createdAt: { lt: cutoff },
      archivedAt: null,
    },
    data: { archivedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    verdict: `Archived ${result.count} notification(s) older than ${days} days (cutoff ${cutoff.toISOString()}).`,
    archived: result.count,
    cutoff: cutoff.toISOString(),
    days,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
