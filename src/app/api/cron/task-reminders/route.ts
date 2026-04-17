// @ts-nocheck
/**
 * GET /api/cron/task-reminders
 *
 * Daily cron (8 AM Taipei = 0:00 UTC). Finds OPEN CrmTasks whose due date is
 * roughly 7 days out (week reminder) or 1 day out (day reminder) and fires:
 *   1. An in-app bell notification via notify-realtime (SSE push + DB row)
 *   2. An email to the task owner
 *
 * Each reminder fires once per task per stage — gated by weekReminderSentAt
 * and dayReminderSentAt columns. Safe to re-run (idempotent).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushCustomNotification } from "@/lib/notify-realtime";
import { sendEmail } from "@/lib/email";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    weekSent: 0,
    daySent: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const eightDaysOut = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const oneDayOut = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const twoDaysOut = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    /* ── Week-before: dueAt in [now+7d, now+8d) and weekReminderSentAt is null ── */
    const weekTargets = await prisma.crmTask.findMany({
      where: {
        status: "OPEN",
        weekReminderSentAt: null,
        dueAt: { gte: sevenDaysOut, lt: eightDaysOut },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    for (const t of weekTargets) {
      try {
        await fireReminder(t, "week");
        await prisma.crmTask.update({
          where: { id: t.id },
          data: { weekReminderSentAt: now },
        });
        results.weekSent += 1;
      } catch (err: any) {
        console.error("[task-reminders] week fail", t.id, err);
        results.errors.push(`week ${t.id}: ${err.message}`);
      }
    }

    /* ── Day-before: dueAt in [now+1d, now+2d) and dayReminderSentAt is null ── */
    const dayTargets = await prisma.crmTask.findMany({
      where: {
        status: "OPEN",
        dayReminderSentAt: null,
        dueAt: { gte: oneDayOut, lt: twoDaysOut },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    for (const t of dayTargets) {
      try {
        await fireReminder(t, "day");
        await prisma.crmTask.update({
          where: { id: t.id },
          data: { dayReminderSentAt: now },
        });
        results.daySent += 1;
      } catch (err: any) {
        console.error("[task-reminders] day fail", t.id, err);
        results.errors.push(`day ${t.id}: ${err.message}`);
      }
    }

    return NextResponse.json({ ok: true, ranAt: now.toISOString(), ...results });
  } catch (err: any) {
    console.error("[task-reminders] fatal:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "task-reminders failed", ...results },
      { status: 500 },
    );
  }
}

async function fireReminder(task: any, stage: "week" | "day") {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const brandLabel = task.brand?.name ? ` — ${task.brand.name}` : "";
  const dueTxt = formatDue(task.dueAt, stage);
  const title =
    stage === "week"
      ? `Task due in 1 week: ${task.title}${brandLabel}`
      : `Task due tomorrow: ${task.title}${brandLabel}`;
  const message = `${dueTxt}${task.notes ? `\n\n${task.notes.slice(0, 240)}` : ""}`;

  const link = task.brandId ? `/brands/${task.brandId}` : `/crm/tasks`;

  // In-app bell
  await pushCustomNotification(task.ownerId, "TASK_REMINDER", title, message, link, {
    taskId: task.id,
    stage,
    dueAt: task.dueAt,
    brandId: task.brandId || null,
  });

  // Email
  if (task.owner?.email) {
    const html = buildTaskEmailHtml({
      ownerName: task.owner.name || "there",
      title: task.title,
      notes: task.notes || "",
      dueAt: task.dueAt,
      stage,
      brandName: task.brand?.name || null,
      brandId: task.brandId || null,
      baseUrl,
    });
    await sendEmail({
      to: task.owner.email,
      subject:
        stage === "week"
          ? `🗓️ Due in a week: ${task.title}${brandLabel}`
          : `⏰ Due tomorrow: ${task.title}${brandLabel}`,
      html,
    });
  }
}

function formatDue(dueAt: Date, stage: "week" | "day") {
  const tz = "Asia/Taipei";
  const dateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dueAt));
  return stage === "week"
    ? `Heads up — this is due ${dateStr} (1 week out).`
    : `Reminder — this is due ${dateStr} (tomorrow).`;
}

function buildTaskEmailHtml(params: {
  ownerName: string;
  title: string;
  notes: string;
  dueAt: Date;
  stage: "week" | "day";
  brandName: string | null;
  brandId: string | null;
  baseUrl: string;
}) {
  const { ownerName, title, notes, dueAt, stage, brandName, brandId, baseUrl } = params;
  const dueStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(dueAt));

  const link = brandId ? `${baseUrl}/brands/${brandId}` : `${baseUrl}/crm/tasks`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1A1A2E;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#00b4c3;margin:0">${stage === "week" ? "Task due in 1 week" : "Task due tomorrow"}</h2>
      </div>
      <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
        <p style="color:#111;font-size:15px;margin:0 0 8px">Hi ${ownerName},</p>
        <p style="color:#4b5563;margin:0 0 16px">
          ${stage === "week" ? "You have a task coming up next week." : "A quick nudge — a task of yours is due tomorrow."}
        </p>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin-bottom:16px">
          <div style="font-weight:700;color:#111;font-size:16px;margin-bottom:4px">${escapeHtml(title)}</div>
          ${brandName ? `<div style="color:#6b7280;font-size:13px;margin-bottom:6px">Brand: <strong>${escapeHtml(brandName)}</strong></div>` : ""}
          <div style="color:#374151;font-size:13px;margin-bottom:8px"><strong>Due:</strong> ${dueStr}</div>
          ${notes ? `<div style="color:#4b5563;font-size:13px;line-height:1.5;white-space:pre-wrap;border-top:1px dashed #e5e7eb;padding-top:8px;margin-top:8px">${escapeHtml(notes)}</div>` : ""}
        </div>
        <div style="text-align:center">
          <a href="${link}"
             style="display:inline-block;background:#00b4c3;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
            Open in Atlas
          </a>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
