// @ts-nocheck
/**
 * GET /calendar/[token].ics — per-user iCalendar subscription feed.
 *
 * Phase 5 of ticket #23 calendar sync. Each rep gets a personal feed URL
 * (token derived from their userId via HMAC — see src/lib/ics-feed.ts).
 * They subscribe in Outlook / Google / Apple once; their app polls this
 * URL every ~hour and overlays their Atlas meetings + open CRM tasks
 * onto their personal calendar.
 *
 * NO permissions required at the URL level — possession of the token IS
 * the auth. This matches the Google Calendar "secret address" pattern
 * and Calendly subscription URLs. The token is HMAC-signed so we can
 * verify + decode the userId without scanning all users.
 *
 * Feed contents (for the resolved user):
 *   - Meetings where organizerId = user OR attendees JSON contains the
 *     user's email (last 90 days through next 365 days).
 *   - CrmTasks where ownerId = user, status = "OPEN" (or IN_PROGRESS),
 *     dueAt set, in the same window. Tasks render as 30-minute events
 *     starting at dueAt so they show on the day-grid.
 *
 * Cancelled meetings render with STATUS:CANCELLED so subscribers strike
 * them through (rather than removing — preserves history in the feed).
 */
import { prisma } from "@/lib/prisma";
import { verifyIcsToken } from "@/lib/ics-feed";

const FEED_PRODID = "-//FUZE Atlas//Subscription Feed//EN";
const WINDOW_PAST_DAYS = 90;
const WINDOW_FUTURE_DAYS = 365;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params;
  // Calendar apps sometimes append .ics to the URL automatically — strip it.
  const token = rawToken.replace(/\.ics$/i, "");

  const userId = verifyIcsToken(token);
  if (!userId) {
    return new Response("Invalid or expired calendar token.", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    return new Response("User not found or inactive.", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const since = new Date(Date.now() - WINDOW_PAST_DAYS * 86400000);
  const until = new Date(Date.now() + WINDOW_FUTURE_DAYS * 86400000);

  // Meetings: organized by user OR attendees JSON contains user.email.
  // Prisma can't deeply query inside JSON arrays cleanly across providers,
  // so we fetch organizer-matches via DB and attendee-matches via a broader
  // window + post-filter. Same window cap on both.
  const [organized, candidateAttended, openTasks] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        organizerId: user.id,
        startTime: { gte: since, lte: until },
      },
      include: { brand: { select: { name: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.meeting.findMany({
      where: {
        startTime: { gte: since, lte: until },
        organizerId: { not: user.id },
      },
      include: { brand: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 500,
    }),
    prisma.crmTask.findMany({
      where: {
        ownerId: user.id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        dueAt: { gte: since, lte: until },
      },
      include: { brand: { select: { name: true } } },
      orderBy: { dueAt: "asc" },
      take: 500,
    }),
  ]);

  const emailLower = user.email.toLowerCase();
  const attended = candidateAttended.filter((m) => {
    const att = Array.isArray(m.attendees) ? m.attendees : [];
    return att.some(
      (a: any) => a?.email && String(a.email).toLowerCase() === emailLower,
    );
  });

  // Dedup organized + attended (organizer also being an "attendee" by email
  // is rare but possible).
  const meetingMap = new Map<string, any>();
  for (const m of organized) meetingMap.set(m.id, m);
  for (const m of attended) if (!meetingMap.has(m.id)) meetingMap.set(m.id, m);
  const meetings = [...meetingMap.values()];

  // ─── Build VCALENDAR ──────────────────────────────────────────
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${FEED_PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:FUZE Atlas — ${user.name || user.email}`,
    `X-WR-CALDESC:Atlas meetings & open CRM tasks for ${user.email}`,
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const m of meetings) {
    const isCancelled = m.status === "CANCELLED";
    const titlePrefix = m.brand?.name ? `[${m.brand.name}] ` : "";
    const summary = `${titlePrefix}${m.title}`;
    const desc = [m.description, m.teamsLink ? `Teams: ${m.teamsLink}` : null]
      .filter(Boolean)
      .join("\n\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:fuze-atlas-meeting-${m.id}@fuzeatlas.com`,
      `DTSTAMP:${formatIcsDate(m.updatedAt || m.createdAt || new Date())}`,
      `DTSTART:${formatIcsDate(m.startTime)}`,
      `DTEND:${formatIcsDate(m.endTime)}`,
      `SUMMARY:${escapeIcs(summary)}`,
    );
    if (desc) lines.push(`DESCRIPTION:${escapeIcs(desc)}`);
    if (m.location) lines.push(`LOCATION:${escapeIcs(m.location)}`);
    lines.push(`STATUS:${isCancelled ? "CANCELLED" : "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }

  for (const t of openTasks) {
    if (!t.dueAt) continue;
    const start = new Date(t.dueAt);
    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30-min block
    const titlePrefix = t.brand?.name ? `[${t.brand.name}] ` : "";
    const summary = `Task: ${titlePrefix}${t.title}`;
    const desc = [
      t.notes,
      t.priority ? `Priority: ${t.priority}` : null,
      `Open in Atlas: https://fuzeatlas.com/acm/tasks`,
    ]
      .filter(Boolean)
      .join("\n\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:fuze-atlas-task-${t.id}@fuzeatlas.com`,
      `DTSTAMP:${formatIcsDate(t.updatedAt || t.createdAt || new Date())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(desc)}`,
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT", // tasks shouldn't block free/busy
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  const body = lines.join("\r\n") + "\r\n";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300", // 5-min cache nudge
      "Content-Disposition": `inline; filename="fuze-atlas.ics"`,
    },
  });
}

function formatIcsDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

// RFC 5545 escaping — backslash, comma, semicolon, newline.
function escapeIcs(s: string): string {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}
