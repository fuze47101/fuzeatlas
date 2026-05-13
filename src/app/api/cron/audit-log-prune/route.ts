// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * /api/cron/audit-log-prune
 *
 * NEED-4 retention. Deletes AuditLog rows older than 90 days. The
 * spec gives us the option to archive to S3 later; we truncate for
 * now per the "flag for future" note.
 *
 * Bearer-authed. Andrew can fire ad-hoc via `fzcron audit-log-prune`
 * or wire it to a daily Vercel cron once we're past the
 * watch-and-see phase.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const RETENTION_DAYS = 90;

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const result = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return NextResponse.json({
      ok: true,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      deleted: result.count,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
