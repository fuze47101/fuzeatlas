/**
 * Phase 10K — quiet-hours-aware notification delivery scheduler.
 *
 * Anyone wanting to fire a notification should call
 * scheduleNotification() instead of writing directly to
 * prisma.notification.create. This helper:
 *   1. Creates the Notification row immediately (in-app
 *      surfaces still show it without delay — only push
 *      channels are deferred).
 *   2. Inspects the recipient's User.timezone. If the local
 *      hour falls inside quiet hours (22:00 - 07:00) AND
 *      severity != "error" AND channel != "in_app", schedule
 *      a NotificationDelivery row for 08:00 local time the
 *      next morning. Otherwise schedule for immediate delivery
 *      (now).
 *   3. The /api/cron/notification-deliveries worker (every 15
 *      min) walks scheduledFor <= now AND deliveredAt is null
 *      rows and fires the channel-specific delivery.
 *
 * Errors and approval-required signals are NEVER delayed —
 * pass severity: "error" or channel: "in_app" to bypass.
 */
import { prisma } from "@/lib/prisma";

type Channel = "in_app" | "email" | "sms";
type Severity = "info" | "warn" | "error";

interface ScheduleParams {
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string | null;
  metadata?: Record<string, any>;
  channels?: Channel[];
  severity?: Severity;
}

const QUIET_START_HOUR = 22; // 22:00 local
const QUIET_END_HOUR = 7; // 07:00 local

function isQuietHour(tz: string, at: Date = new Date()): boolean {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    });
    const hourStr = fmt.format(at);
    const hour = parseInt(hourStr, 10);
    return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
  } catch {
    return false;
  }
}

/**
 * For a given recipient timezone, compute the next 08:00 local
 * moment as a UTC Date. This is the "deliver after quiet hours"
 * timestamp.
 */
function next8amLocal(tz: string, now: Date = new Date()): Date {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    const localHour = parseInt(get("hour"), 10);
    const y = parseInt(get("year"), 10);
    const m = parseInt(get("month"), 10);
    const d = parseInt(get("day"), 10);
    // If it's already past midnight local time but before 7am,
    // schedule today at 8am; if 22-23, schedule tomorrow at 8am.
    const targetDate = new Date(Date.UTC(y, m - 1, d, 8, 0, 0));
    if (localHour >= QUIET_START_HOUR) {
      targetDate.setUTCDate(targetDate.getUTCDate() + 1);
    }
    // We computed 08:00 in the same calendar day as `now` in `tz`.
    // Re-interpret as the matching UTC instant by adjusting for
    // the offset of `tz` from UTC at that target instant.
    const offsetMs = getTzOffsetMs(tz, targetDate);
    return new Date(targetDate.getTime() - offsetMs);
  } catch {
    return new Date(now.getTime() + 60 * 60_000);
  }
}

function getTzOffsetMs(tz: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);
    const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || "0", 10);
    const utc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    return utc - at.getTime();
  } catch {
    return 0;
  }
}

export async function scheduleNotification(params: ScheduleParams) {
  const channels: Channel[] = params.channels || ["in_app"];
  const severity: Severity = params.severity || "info";

  const notif = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message || "",
      link: params.link || null,
      metadata: params.metadata || {},
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { timezone: true },
  });
  const tz = user?.timezone || null;
  const now = new Date();

  const deliveries = channels.map((channel) => {
    if (channel === "in_app" || severity === "error" || !tz || !isQuietHour(tz, now)) {
      return { channel, scheduledFor: now };
    }
    return { channel, scheduledFor: next8amLocal(tz, now) };
  });

  await prisma.notificationDelivery.createMany({
    data: deliveries.map((d) => ({
      notificationId: notif.id,
      channel: d.channel,
      scheduledFor: d.scheduledFor,
    })),
  });

  return { notification: notif, deliveries };
}
