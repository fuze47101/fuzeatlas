/**
 * notify-ticket-filers.ts
 *
 * Email the original reporter of every FeedbackReport that has been
 * resolved or triaged but NOT yet notified (notifiedAt IS NULL).
 *
 * Sends a per-ticket email tailored to its status:
 *   FIXED     → "We fixed your ticket" + resolution + commit link
 *   ACCEPTED  → "We think a recent fix addresses this — please re-test"
 *   TRIAGED   → "We reviewed it and queued it up — we'll email you when it ships"
 *   REJECTED  → "We won't be making this change — here's why"
 *   DUPLICATE → "Merged with another report"
 *   CLOSED    → "This ticket was closed"
 *
 * Dry-run by default. Prints the subject + recipient + body preview for
 * each email it WOULD send. Pass --apply to actually send via Resend and
 * stamp notifiedAt.
 *
 * Usage:
 *   npx tsx scripts/notify-ticket-filers.ts              # dry-run
 *   npx tsx scripts/notify-ticket-filers.ts --apply      # actually send
 *   npx tsx scripts/notify-ticket-filers.ts --only=<id>  # dry-run a single ticket
 *   npx tsx scripts/notify-ticket-filers.ts --apply --only=<id>   # send one
 *
 * Idempotent — the query filters on notifiedAt IS NULL, so re-running
 * never double-sends.
 */
import { PrismaClient, FeedbackStatus } from "@prisma/client";

const prisma = new PrismaClient();

const FUZE_COLOR = "#00b4c3";
const FUZE_FROM =
  process.env.RESEND_FROM || "FUZE Atlas <notifications@fuzeatlas.com>";
const REPLY_TO = "andrew@fuze47.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

type StatusConfig = {
  badge: string;           // short label (rendered in pill)
  badgeBg: string;
  badgeFg: string;
  subjectPrefix: string;   // "We fixed your ticket" / "Update on your ticket" etc.
  lead: string;            // one-sentence opener
  cta: string;             // closing line ("reply if still broken" etc.)
  showResolution: boolean; // whether to render the resolution text block
  fallbackResolution?: string; // used when resolution is empty (mainly TRIAGED)
};

const STATUS_CONFIG: Record<FeedbackStatus, StatusConfig | null> = {
  NEW: null,          // should never notify these
  IN_PROGRESS: null,  // in-flight, not ready to notify
  FIXED: {
    badge: "Fixed",
    badgeBg: "#d1fae5",
    badgeFg: "#065f46",
    subjectPrefix: "We fixed your ticket",
    lead: "Thanks for flagging this — we've shipped a fix.",
    cta: "If it's still not working on your end, just reply to this email and we'll dig back in.",
    showResolution: true,
  },
  ACCEPTED: {
    badge: "Likely fixed — please re-test",
    badgeBg: "#fef3c7",
    badgeFg: "#92400e",
    subjectPrefix: "Update on your ticket",
    lead: "We believe a recent update addresses what you reported. Would you mind re-testing?",
    cta: "Reply to this email if it's still broken and we'll reopen the ticket.",
    showResolution: true,
  },
  TRIAGED: {
    badge: "Queued",
    badgeBg: "#dbeafe",
    badgeFg: "#1e40af",
    subjectPrefix: "Update on your ticket",
    lead: "Thanks for the report. We've reviewed it and added it to our backlog.",
    cta: "We'll email you again once this ships. If something else comes up, submit another ticket any time.",
    showResolution: true,
    fallbackResolution:
      "We've reviewed your ticket and added it to our active work queue. No action needed from you.",
  },
  REJECTED: {
    badge: "Not planned",
    badgeBg: "#fee2e2",
    badgeFg: "#991b1b",
    subjectPrefix: "About your ticket",
    lead: "Thanks for taking the time to report this. After review, we've decided not to make this change.",
    cta: "If you think we're missing something, reply to this email and we'll take another look.",
    showResolution: true,
    fallbackResolution:
      "We've reviewed this and decided not to pursue it at this time.",
  },
  DUPLICATE: {
    badge: "Merged",
    badgeBg: "#e5e7eb",
    badgeFg: "#374151",
    subjectPrefix: "Your ticket was merged with another",
    lead: "We've merged this with another report tracking the same issue. You'll get an update when the combined ticket is resolved.",
    cta: "Reply if you think this isn't actually the same issue.",
    showResolution: true,
    fallbackResolution:
      "This was merged with another open report tracking the same issue.",
  },
  CLOSED: {
    badge: "Closed",
    badgeBg: "#e5e7eb",
    badgeFg: "#374151",
    subjectPrefix: "Your ticket was closed",
    lead: "This ticket has been closed.",
    cta: "Reply to this email if you'd like us to reopen it.",
    showResolution: true,
    fallbackResolution: "Closed.",
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderEmail(ticket: {
  id: string;
  title: string;
  category: string;
  description: string;
  status: FeedbackStatus;
  userName: string | null;
  portal: string | null;
  url: string | null;
  createdAt: Date;
  resolution: string | null;
  resolutionUrl: string | null;
}): { subject: string; html: string; text: string } {
  const config = STATUS_CONFIG[ticket.status];
  if (!config) {
    throw new Error(
      `No STATUS_CONFIG for status ${ticket.status} — cannot render notification`,
    );
  }

  const name = (ticket.userName || "there").trim() || "there";
  const firstName = name.split(/\s+/)[0];

  const resolutionText =
    (ticket.resolution && ticket.resolution.trim()) ||
    config.fallbackResolution ||
    "";

  const subject = `FUZE Atlas — ${config.subjectPrefix}: "${ticket.title}"`;

  const resolutionBlock =
    config.showResolution && resolutionText
      ? `
    <div style="background: #f9fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #111827; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(resolutionText)}</p>
    </div>`
      : "";

  const commitLink = ticket.resolutionUrl
    ? `
    <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">
      Reference: <a href="${escapeHtml(ticket.resolutionUrl)}" style="color: ${FUZE_COLOR};">${escapeHtml(ticket.resolutionUrl)}</a>
    </p>`
    : "";

  const contextRows = [
    ["Ticket", `#${ticket.id.slice(-8)}`],
    ["Category", ticket.category],
    ["Submitted", formatDate(ticket.createdAt)],
    ticket.portal ? ["Portal", ticket.portal] : null,
    ticket.url ? ["Page", ticket.url] : null,
  ].filter(Boolean) as [string, string][];

  const contextTable = `
    <table style="border-collapse: collapse; font-size: 13px; color: #4b5563; margin: 16px 0;">
      ${contextRows
        .map(
          ([k, v]) => `
        <tr>
          <td style="padding: 3px 12px 3px 0; color: #9ca3af; vertical-align: top; white-space: nowrap;">${escapeHtml(k)}</td>
          <td style="padding: 3px 0; word-break: break-all;">${escapeHtml(v)}</td>
        </tr>`,
        )
        .join("")}
    </table>`;

  const descPreview =
    ticket.description && ticket.description.length > 400
      ? ticket.description.slice(0, 400) + "…"
      : ticket.description || "";

  const yourWords = descPreview
    ? `
    <p style="color: #6b7280; font-size: 13px; margin: 20px 0 6px;">What you originally reported:</p>
    <blockquote style="margin: 0; padding: 10px 14px; border-left: 3px solid #e5e7eb; color: #6b7280; font-size: 13px; line-height: 1.55; white-space: pre-wrap;">${escapeHtml(descPreview)}</blockquote>`
    : "";

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; padding: 20px; color: #111827;">
    <div style="text-align: center; padding: 18px 0; border-bottom: 3px solid ${FUZE_COLOR};">
      <h1 style="margin: 0; color: ${FUZE_COLOR}; font-size: 22px; letter-spacing: 0.5px;">FUZE Atlas</h1>
    </div>
    <div style="padding: 24px 0;">
      <div style="display: inline-block; background: ${config.badgeBg}; color: ${config.badgeFg}; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; letter-spacing: 0.2px; margin-bottom: 14px;">
        ${escapeHtml(config.badge)}
      </div>
      <h2 style="color: #111827; margin: 0 0 8px; font-size: 20px; line-height: 1.35;">${escapeHtml(ticket.title)}</h2>
      <p style="color: #4b5563; line-height: 1.6; margin: 14px 0;">
        Hi ${escapeHtml(firstName)}, ${config.lead}
      </p>
      ${resolutionBlock}
      ${contextTable}
      ${yourWords}
      <p style="color: #4b5563; line-height: 1.6; margin: 24px 0 0;">${escapeHtml(config.cta)}</p>
      ${commitLink}
      <p style="color: #9ca3af; font-size: 12px; margin: 28px 0 0;">— Andrew + the FUZE Atlas team</p>
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 14px 0; text-align: center; color: #9ca3af; font-size: 12px;">
      FUZE Biotech · <a href="${APP_URL}" style="color: #9ca3af;">fuzeatlas.com</a>
    </div>
  </div>`;

  const textLines = [
    `${config.subjectPrefix}: ${ticket.title}`,
    "",
    `Hi ${firstName},`,
    "",
    config.lead,
    "",
  ];
  if (resolutionText) {
    textLines.push(resolutionText, "");
  }
  textLines.push(`Ticket #${ticket.id.slice(-8)}  ·  ${ticket.category}  ·  submitted ${formatDate(ticket.createdAt)}`);
  if (ticket.url) textLines.push(`Page: ${ticket.url}`);
  textLines.push("", config.cta);
  if (ticket.resolutionUrl) {
    textLines.push("", `Reference: ${ticket.resolutionUrl}`);
  }
  textLines.push("", "— Andrew + the FUZE Atlas team");

  return { subject, html, text: textLines.join("\n") };
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; id?: string; stub?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { ok: true, stub: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FUZE_FROM,
        to: [params.to],
        reply_to: REPLY_TO,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err };
    }
    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const onlyId = onlyArg ? onlyArg.split("=")[1] : null;

  const notifiableStatuses: FeedbackStatus[] = [
    "FIXED",
    "ACCEPTED",
    "TRIAGED",
    "REJECTED",
    "DUPLICATE",
    "CLOSED",
  ];

  const tickets = await prisma.feedbackReport.findMany({
    where: {
      notifiedAt: null,
      userEmail: { not: null },
      status: { in: notifiableStatuses },
      ...(onlyId ? { id: onlyId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      status: true,
      userName: true,
      userEmail: true,
      portal: true,
      url: true,
      createdAt: true,
      resolution: true,
      resolutionUrl: true,
    },
  });

  console.log("");
  console.log(`Mode: ${apply ? "APPLY (sending real emails via Resend)" : "DRY-RUN (no emails sent — pass --apply to send)"}`);
  if (onlyId) console.log(`Filter: only ticket id=${onlyId}`);
  console.log(`Queue: ${tickets.length} ticket(s) pending notification`);
  if (tickets.length === 0) {
    console.log("\nNothing to notify — inbox zero on notifications.");
    return;
  }
  if (apply && !process.env.RESEND_API_KEY) {
    console.log(
      "\n⚠  RESEND_API_KEY not set — emails will be logged (stubbed) instead of actually sent.",
    );
  }
  console.log("");

  let sent = 0;
  let stubbed = 0;
  let failed = 0;
  let skippedNoEmail = 0;

  for (const t of tickets) {
    if (!t.userEmail) {
      console.log(`  SKIP (no email)  ${t.id}  ${t.title}`);
      skippedNoEmail++;
      continue;
    }

    const rendered = renderEmail({
      id: t.id,
      title: t.title,
      category: t.category,
      description: t.description,
      status: t.status,
      userName: t.userName,
      portal: t.portal,
      url: t.url,
      createdAt: t.createdAt,
      resolution: t.resolution,
      resolutionUrl: t.resolutionUrl,
    });

    console.log(`─── ${t.status}  ${t.id}  ${t.title}`);
    console.log(`    to:      ${t.userName || "—"} <${t.userEmail}>`);
    console.log(`    subject: ${rendered.subject}`);
    if (t.resolutionUrl) console.log(`    ref:     ${t.resolutionUrl}`);
    const preview =
      (t.resolution || STATUS_CONFIG[t.status]?.fallbackResolution || "")
        .split("\n")
        .join(" ")
        .slice(0, 160);
    if (preview) console.log(`    preview: ${preview}${preview.length >= 160 ? "…" : ""}`);

    if (!apply) continue;

    const result = await sendViaResend({
      to: t.userEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    if (result.stub) {
      console.log(`    → STUB (no RESEND_API_KEY, would have sent)`);
      stubbed++;
      // intentionally do NOT stamp notifiedAt on stubs — we want a real
      // delivery before we consider the requester notified.
      continue;
    }

    if (!result.ok) {
      console.log(`    ✗ SEND FAILED: ${result.error}`);
      failed++;
      continue;
    }

    await prisma.feedbackReport.update({
      where: { id: t.id },
      data: { notifiedAt: new Date() },
    });
    console.log(`    ✓ sent (resend id=${result.id})`);
    sent++;
  }

  console.log("");
  console.log(`Summary:`);
  console.log(`  candidates:       ${tickets.length}`);
  console.log(`  skipped (no email): ${skippedNoEmail}`);
  if (apply) {
    console.log(`  sent:             ${sent}`);
    console.log(`  stubbed:          ${stubbed}  (no RESEND_API_KEY — NOT marked notified)`);
    console.log(`  failed:           ${failed}`);
  } else {
    console.log(`  (dry-run — pass --apply to actually send)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
