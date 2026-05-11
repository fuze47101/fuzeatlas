// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/diag-bd
 *
 * Bearer-authenticated diagnostic for the BD scoreboard. Answers the
 * question: "why is my scoreboard empty when I know we sent emails?"
 *
 * Returns:
 *   - totalRows / sent30d / sent7d / sent24h — row counts on
 *     OutreachMessage to confirm the table is populated at all
 *   - bySentBy30d — top 20 (sentBy, count) pairs in the last 30 days,
 *     joined to user.name/email/role so we can see if reps are being
 *     stamped correctly
 *   - byChannel30d — email vs linkedin split
 *   - mostRecent — last 5 rows, full snapshot, so we can confirm sentBy +
 *     sentAt + channel are all populated on fresh sends
 *   - dateRange — earliest + latest sentAt in the table (catches the case
 *     where data exists but is older than the 30-day window)
 *   - dbHostHint — first 30 chars of DATABASE_URL host so we can confirm
 *     which Railway DB this prod runtime is actually pointing at
 *     (the documented DSN-drift issue from CLAUDE.md)
 *
 * Lives under /api/cron/* so middleware exempts it. Bearer-only — never
 * call from the browser.
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const since30 = new Date(now - 30 * 86400_000);
    const since7 = new Date(now - 7 * 86400_000);
    const since24 = new Date(now - 1 * 86400_000);

    const [
      totalRows,
      sent30d,
      sent7d,
      sent24h,
      sentByAgg,
      channelAgg,
      mostRecent,
      earliest,
      latest,
    ] = await Promise.all([
      prisma.outreachMessage.count(),
      prisma.outreachMessage.count({ where: { sentAt: { gte: since30 } } }),
      prisma.outreachMessage.count({ where: { sentAt: { gte: since7 } } }),
      prisma.outreachMessage.count({ where: { sentAt: { gte: since24 } } }),
      prisma.outreachMessage.groupBy({
        by: ["sentBy"],
        where: { sentAt: { gte: since30 } },
        _count: { _all: true },
        orderBy: { _count: { sentBy: "desc" } },
        take: 20,
      }),
      prisma.outreachMessage.groupBy({
        by: ["channel"],
        where: { sentAt: { gte: since30 } },
        _count: { _all: true },
      }),
      prisma.outreachMessage.findMany({
        orderBy: { sentAt: "desc" },
        take: 5,
        select: {
          id: true,
          channel: true,
          subject: true,
          status: true,
          sentBy: true,
          sentAt: true,
          contactId: true,
          openedAt: true,
          repliedAt: true,
        },
      }),
      prisma.outreachMessage.findFirst({
        orderBy: { sentAt: "asc" },
        select: { sentAt: true },
      }),
      prisma.outreachMessage.findFirst({
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      }),
    ]);

    // Resolve sentBy IDs → user identity so we can see if rows are stamped
    // with valid users (and which reps are most active in the window).
    const sentByIds = sentByAgg
      .map((r) => r.sentBy)
      .filter((id): id is string => !!id);
    const users =
      sentByIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: sentByIds } },
            select: { id: true, name: true, email: true, role: true, status: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const bySentBy30d = sentByAgg.map((r) => ({
      sentBy: r.sentBy,
      count: r._count._all,
      user: r.sentBy ? userMap.get(r.sentBy) || null : null,
    }));

    // Cross-check: rows where sentBy is null (system or legacy)
    const nullSentByCount = await prisma.outreachMessage.count({
      where: { sentAt: { gte: since30 }, sentBy: null },
    });

    // DSN host hint — first 30 chars of the post-@ portion of the DATABASE_URL,
    // so we can verify which Railway DB this prod is actually talking to.
    // We never expose user/password, just the host:port so DSN drift is
    // diagnosable. If this returns "interchange.proxy.rlwy.net:31700" or
    // similar, we know we're on the empty mirror DB.
    const dsn = process.env.DATABASE_URL || "";
    const dsnHostHint = (() => {
      try {
        const at = dsn.indexOf("@");
        if (at < 0) return "no-@-in-dsn";
        const after = dsn.slice(at + 1, at + 80);
        const slash = after.indexOf("/");
        return slash > 0 ? after.slice(0, slash) : after;
      } catch {
        return "parse-failed";
      }
    })();

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      counts: {
        totalRows,
        sent30d,
        sent7d,
        sent24h,
        nullSentBy30d: nullSentByCount,
      },
      bySentBy30d,
      byChannel30d: channelAgg.map((c) => ({
        channel: c.channel,
        count: c._count._all,
      })),
      mostRecent,
      dateRange: {
        earliest: earliest?.sentAt ?? null,
        latest: latest?.sentAt ?? null,
      },
      dbHostHint: dsnHostHint,
    });
  } catch (e: any) {
    console.error("[diag-bd] failed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error", stack: e?.stack || null },
      { status: 500 },
    );
  }
}
