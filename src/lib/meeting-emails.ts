// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * Phase 53 T7 — meeting action-item email helpers.
 *
 * sendImmediateAssignmentEmail()  fires on each new MeetingActionItem
 *                                  that has an assignee + the assignee
 *                                  has an email on record.
 *
 * sendActionItemDigest()           daily 7am UTC cron loops every user
 *                                  with at least one OPEN action item.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

const PRIORITY_PILL: Record<string, string> = {
  URGENT: "background:#dc2626;color:white",
  HIGH: "background:#f59e0b;color:white",
  NORMAL: "background:#64748b;color:white",
  LOW: "background:#e2e8f0;color:#475569",
};

function priorityChip(p: string): string {
  const style = PRIORITY_PILL[p] || PRIORITY_PILL.NORMAL;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;${style}">${p}</span>`;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

export async function sendImmediateAssignmentEmail(opts: {
  actionItemId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const item = await (prisma as any).meetingActionItem.findUnique({
      where: { id: opts.actionItemId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
        meetingNote: { select: { id: true, title: true } },
      },
    });
    if (!item || !item.assignee?.email) {
      return { ok: false, error: "no assignee email" };
    }

    const assigner =
      item.createdBy?.name || item.createdBy?.email || "the FUZE team";
    const subject = `[FUZE Atlas] New action item: ${String(item.description).slice(0, 60)}`;
    const meetingLink = `${APP_URL}/meeting-notes/${item.meetingNote?.id}`;
    const tasksLink = `${APP_URL}/my-tasks`;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;color:#0f172a">
        <h2 style="margin:0 0 8px">New action item assigned to you</h2>
        <p style="margin:0 0 16px;color:#475569">${assigner} assigned this to you in <a href="${meetingLink}" style="color:#2563eb">${item.meetingNote?.title || "a meeting"}</a>.</p>
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#f8fafc">
          <div style="margin-bottom:8px">${priorityChip(item.priority)}${item.dueDate ? ` · Due <strong>${fmtDate(item.dueDate)}</strong>` : ""}</div>
          <p style="margin:0;font-size:15px;line-height:1.4;color:#0f172a">${item.description}</p>
        </div>
        <p style="margin:16px 0 0">
          <a href="${tasksLink}" style="display:inline-block;padding:9px 16px;background:#4f46e5;color:white;border-radius:6px;text-decoration:none;font-weight:600">Open My Tasks →</a>
        </p>
      </div>
    `;

    await sendEmail({ to: item.assignee.email, subject, html });
    return { ok: true };
  } catch (e: any) {
    console.error("[meeting-emails] immediate-assignment failed:", e);
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function sendActionItemDigest(): Promise<{
  ok: boolean;
  sent: number;
  errors: number;
}> {
  const grouped = await (prisma as any).meetingActionItem.findMany({
    where: { status: "OPEN", assigneeId: { not: null } },
    select: {
      id: true,
      description: true,
      priority: true,
      dueDate: true,
      assigneeId: true,
      assignee: { select: { id: true, name: true, email: true } },
      meetingNote: { select: { id: true, title: true } },
    },
    orderBy: [{ assigneeId: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
  });

  const byUser = new Map<string, any[]>();
  for (const item of grouped) {
    if (!item.assignee?.email) continue;
    const list = byUser.get(item.assigneeId) || [];
    list.push(item);
    byUser.set(item.assigneeId, list);
  }

  let sent = 0;
  let errors = 0;

  for (const [userId, items] of byUser.entries()) {
    const email = items[0]?.assignee?.email;
    if (!email) continue;

    const rows = items
      .map((i: any) => {
        const meetingLink = `${APP_URL}/meeting-notes/${i.meetingNote?.id}`;
        return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:13px">
            <a href="${meetingLink}" style="color:#2563eb;text-decoration:none">${i.meetingNote?.title || "(no meeting)"}</a>
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:13px">${i.description}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center">${priorityChip(i.priority)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:13px;white-space:nowrap">${fmtDate(i.dueDate)}</td>
        </tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;color:#0f172a">
        <h2 style="margin:0 0 8px">You have ${items.length} open action item(s)</h2>
        <p style="margin:0 0 16px;color:#475569">FUZE Atlas daily digest — ${new Date().toISOString().slice(0, 10)}.</p>
        <table style="border-collapse:collapse;width:100%;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <thead><tr style="background:#f1f5f9">
            <th style="padding:8px;text-align:left;font-size:12px;color:#475569">Meeting</th>
            <th style="padding:8px;text-align:left;font-size:12px;color:#475569">Item</th>
            <th style="padding:8px;text-align:center;font-size:12px;color:#475569">Priority</th>
            <th style="padding:8px;text-align:left;font-size:12px;color:#475569">Due</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:16px 0 0">
          <a href="${APP_URL}/my-tasks" style="display:inline-block;padding:9px 16px;background:#4f46e5;color:white;border-radius:6px;text-decoration:none;font-weight:600">Open My Tasks →</a>
        </p>
      </div>
    `;

    try {
      await sendEmail({
        to: email,
        subject: `[FUZE Atlas] You have ${items.length} open action item(s)`,
        html,
      });
      sent++;
    } catch (e: any) {
      console.error("[meeting-emails] digest send failed:", e);
      errors++;
    }
  }

  return { ok: true, sent, errors };
}
