// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/feedback-list
 *
 * Bearer-authenticated read-only endpoint that returns the open ticket
 * queue as raw JSON. Lives under /api/cron so middleware exempts it
 * (sibling to /api/cron/feedback-digest which emails the same data).
 *
 * Built so the .github/workflows/auto-triage.yml workflow can pull
 * tickets without a session cookie. The admin UI keeps using
 * /api/admin/feedback (cookie-authed) — this route is for unattended
 * automation only.
 *
 * Default scope is "open" (NEW + TRIAGED + ACCEPTED + IN_PROGRESS) since
 * that's what auto-triage cares about. Pass ?status=NEW to narrow, or
 * ?status=ALL to dump everything (capped at 500).
 */

const CRON_SECRET = process.env.CRON_SECRET;

const OPEN_STATUSES = ["NEW", "TRIAGED", "ACCEPTED", "IN_PROGRESS"];

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const statusParam = (url.searchParams.get("status") || "OPEN").toUpperCase();
  const category = url.searchParams.get("category");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 500);

  const where: any = {};
  if (statusParam === "ALL") {
    // no status filter
  } else if (statusParam === "OPEN") {
    where.status = { in: OPEN_STATUSES };
  } else {
    where.status = statusParam;
  }
  if (category) where.category = category;

  try {
    const reports = await prisma.feedbackReport.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    const counts = await prisma.feedbackReport.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    for (const c of counts) byStatus[c.status] = c._count._all;

    return NextResponse.json({
      ok: true,
      scope: statusParam,
      reports,
      byStatus,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[feedback-list] failed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
