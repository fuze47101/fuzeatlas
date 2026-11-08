/**
 * Emails and in-app notifications for the weekly check-in.
 * Everything goes through sendEmail() (keepAlive-wrapped) — never a bare
 * promise in a request handler.
 */
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { keepAlive } from "@/lib/keep-alive";
import { appUrl, entityHref, MANAGER_ROLES, type EntityType } from "@/lib/book";

const ESCALATION_TO = ["andrew@fuze47.com"];
const HI_GOAL_ESCALATION_CC = ["tandy@fuze47.com"];

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

function shell(title: string, body: string, cta?: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#F4F7F8;font-family:Helvetica,Arial,sans-serif;color:#12181B">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
 <div style="background:#003B4A;color:#fff;padding:12px 18px;border-radius:8px 8px 0 0;font-size:12px;letter-spacing:.12em;text-transform:uppercase">FUZE Atlas · My Book</div>
 <div style="background:#fff;padding:20px 18px;border:1px solid #DDE2E4;border-top:0;border-radius:0 0 8px 8px">
  <h1 style="font-size:18px;margin:0 0 12px;color:#003B4A">${esc(title)}</h1>
  <div style="font-size:14px;line-height:1.5">${body}</div>
  ${cta ? `<p style="margin:20px 0 4px"><a href="${cta.href}" style="display:inline-block;background:#0DA8D2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:700">${esc(cta.label)}</a></p>` : ""}
 </div>
 <p style="font-size:11px;color:#8A9096;margin:12px 4px">You are receiving this because you are on the FUZE Atlas team. ${esc(appUrl())}</p>
</div></body></html>`;
}

async function internalRecipients(): Promise<{ id: string; email: string }[]> {
  return prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: MANAGER_ROLES } },
    select: { id: true, email: true },
  });
}

async function createNotification(userId: string, title: string, message: string, link?: string) {
  try {
    await prisma.notification.create({
      data: { userId, type: "SYSTEM", title, message, link: link || null, metadata: {} },
    });
  } catch (e) {
    console.error("[BOOK] notification failed", e);
  }
}

/** SUPER update → every internal manager gets an in-app notice + one email. */
export function notifySuperUpdate(p: {
  actor: { id: string; name: string };
  entityType: EntityType;
  entityId: string;
  entityName: string;
  headline: string;
  note: string | null;
}) {
  return keepAlive(
    (async () => {
      const link = `${appUrl()}${entityHref(p.entityType, p.entityId)}`;
      const title = `${p.entityName}: ${p.headline}`;
      const recips = await internalRecipients();
      await Promise.all(
        recips
          .filter((r) => r.id !== p.actor.id)
          .map((r) =>
            createNotification(
              r.id,
              `Super update · ${p.entityName}`,
              p.headline,
              entityHref(p.entityType, p.entityId),
            ),
          ),
      );
      const emails = recips.map((r) => r.email).filter(Boolean);
      if (!emails.length) return;
      await sendEmail({
        to: emails,
        subject: `⭐ ${title}`,
        html: shell(
          title,
          `<p><b>${esc(p.actor.name)}</b> posted a super update on <b>${esc(p.entityName)}</b>.</p>${p.note ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #0DA8D2;background:#F4F7F8;white-space:pre-wrap">${esc(p.note)}</blockquote>` : ""}<p style="color:#5C646A;font-size:12px">This is flagged for the Monday exec review.</p>`,
          { href: link, label: `Open ${p.entityName}` },
        ),
      });
    })(),
  );
}

/** HELP → the assignee gets an in-app notice + email with the ask. */
export function notifyHelpRequested(p: {
  requester: { id: string; name: string };
  assignee: { id: string; email: string; name: string };
  entityType: EntityType;
  entityId: string;
  entityName: string;
  ask: string;
  dueAt: Date;
  helpId: string;
}) {
  return keepAlive(
    (async () => {
      const link = `${appUrl()}/book?help=${p.helpId}`;
      await createNotification(
        p.assignee.id,
        `Help needed · ${p.entityName}`,
        p.ask.slice(0, 180),
        `/book?help=${p.helpId}`,
      );
      await sendEmail({
        to: p.assignee.email,
        subject: `🙋 ${p.requester.name} needs help on ${p.entityName}`,
        html: shell(
          `${p.requester.name} needs your help on ${p.entityName}`,
          `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #B4740A;background:#FDF8F0;white-space:pre-wrap">${esc(p.ask)}</blockquote><p>Due by <b>${p.dueAt.toUTCString().slice(0, 16)}</b>. If it is still open then, ${esc(p.requester.name)} can escalate it to Andrew.</p>`,
          { href: link, label: "Open in My Book" },
        ),
      });
    })(),
  );
}

/** ESCALATED → Andrew (+ Tandy when the requester is a distributor user) + the assignee. */
export function notifyHelpEscalated(p: {
  requester: { id: string; name: string; distributorId: string | null };
  assignee: { id: string; email: string; name: string };
  entityType: EntityType;
  entityId: string;
  entityName: string;
  ask: string;
  helpId: string;
  createdAt: Date;
}) {
  return keepAlive(
    (async () => {
      const link = `${appUrl()}/book/team?help=${p.helpId}`;
      const to = [...ESCALATION_TO];
      const cc = p.requester.distributorId
        ? [...HI_GOAL_ESCALATION_CC, p.assignee.email]
        : [p.assignee.email];
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", status: "ACTIVE", email: { in: ESCALATION_TO } },
        select: { id: true },
      });
      await Promise.all(
        admins.map((a) =>
          createNotification(
            a.id,
            `Escalated · ${p.entityName}`,
            `${p.requester.name} → ${p.assignee.name}: ${p.ask.slice(0, 140)}`,
            `/book/team?help=${p.helpId}`,
          ),
        ),
      );
      await createNotification(
        p.assignee.id,
        `Escalated · ${p.entityName}`,
        `Your help request from ${p.requester.name} was escalated.`,
        `/book?help=${p.helpId}`,
      );
      await sendEmail({
        to,
        cc,
        subject: `🔺 Escalated: ${p.entityName} — ${p.requester.name} → ${p.assignee.name}`,
        html: shell(
          `Escalated help request on ${p.entityName}`,
          `<p><b>${esc(p.requester.name)}</b> asked <b>${esc(p.assignee.name)}</b> on ${p.createdAt.toUTCString().slice(0, 16)} and has not received help.</p><blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #B4740A;background:#FDF8F0;white-space:pre-wrap">${esc(p.ask)}</blockquote>`,
          { href: link, label: "Open the team board" },
        ),
      });
    })(),
  );
}
