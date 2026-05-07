// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * GET /api/cron/feedback-digest
 *
 * Vercel Cron Job — runs daily at 6:30am MST (13:30 UTC).
 *
 * Andrew's ask May 2026: "the entire point of the support ticket
 * submission is to automate this where we can schedule a task for
 * Claude to pull them, read it, and fix them. I want to have this
 * done daily."
 *
 * This cron is the FIRST half of that loop — pull all open feedback
 * tickets and email Andrew a triage-friendly digest every morning so
 * nothing falls on the floor. The SECOND half (Claude actually
 * fixing them) lives outside this cron — a GitHub Action running
 * claude-code on a schedule reads this same data through the admin
 * API and opens PRs. See repo's docs/AUTOMATION.md for the full plan.
 *
 * "Open" = NEW | TRIAGED | ACCEPTED | IN_PROGRESS. Skips REJECTED,
 * DUPLICATE, FIXED, CLOSED — those don't need eyes.
 *
 * Auth: standard CRON_SECRET bearer token, same as every other cron.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const DIGEST_RECIPIENTS = ["andrew@801inc.com", "andrew@fuze47.com"];

const OPEN_STATUSES = ["NEW", "TRIAGED", "ACCEPTED", "IN_PROGRESS"];

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://fuzeatlas.com");

  try {
    // Pull every open ticket. Order new → in-progress so Andrew sees
    // unblocked work first.
    const reports = await prisma.feedbackReport.findMany({
      where: { status: { in: OPEN_STATUSES } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      take: 200,
    });

    // Group by status for the email
    const byStatus: Record<string, typeof reports> = {};
    for (const r of reports) {
      const key = r.status || "UNKNOWN";
      (byStatus[key] = byStatus[key] || []).push(r);
    }

    // Counts (incl. ones that aren't open) so we can show
    // "92 fixed all-time, 6 open right now" framing.
    const counts = await prisma.feedbackReport.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const countByStatus: Record<string, number> = {};
    for (const c of counts) countByStatus[c.status] = c._count._all;

    // Bucket helpers
    const newCount = countByStatus.NEW || 0;
    const triagedCount = countByStatus.TRIAGED || 0;
    const acceptedCount = countByStatus.ACCEPTED || 0;
    const inProgressCount = countByStatus.IN_PROGRESS || 0;
    const fixedCount = countByStatus.FIXED || 0;
    const totalOpen = newCount + triagedCount + acceptedCount + inProgressCount;

    // ── Render ──────────────────────────────────────────────────
    const renderRow = (r: any) => {
      const ticketUrl = `${appUrl}/admin/feedback?focus=${r.id}`;
      const ageHours = Math.max(
        0,
        Math.round((Date.now() - new Date(r.createdAt).getTime()) / 36e5),
      );
      const ageStr =
        ageHours < 24 ? `${ageHours}h ago` : `${Math.floor(ageHours / 24)}d ago`;
      const cat = r.category || "OTHER";
      const catColor =
        cat === "BROKEN_LINK" || cat === "ERROR" || cat === "PROBLEM"
          ? "#dc2626"
          : cat === "MISSING" || cat === "CONFUSING"
            ? "#d97706"
            : cat === "SUGGESTION"
              ? "#0369a1"
              : "#64748b";
      const portalTag = r.portal
        ? `<span style="margin-left:6px;padding:1px 6px;border-radius:10px;background:#f1f5f9;color:#475569;font-size:10px;text-transform:uppercase;">${escape(r.portal)}</span>`
        : "";
      const reporter = r.user?.name || r.userName || r.userEmail || "anon";
      const desc = (r.description || "").slice(0, 220);
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;">
            <div>
              <a href="${ticketUrl}" style="color:#0f172a;text-decoration:none;font-weight:700;font-size:14px;">${escape(r.title)}</a>
              <span style="margin-left:8px;padding:1px 6px;border-radius:10px;background:#fef3f2;color:${catColor};font-size:10px;font-weight:700;text-transform:uppercase;">${escape(cat)}</span>
              ${portalTag}
            </div>
            <div style="margin-top:4px;font-size:13px;color:#475569;line-height:1.4;">${escape(desc)}${(r.description || "").length > 220 ? "…" : ""}</div>
            <div style="margin-top:6px;font-size:11px;color:#94a3b8;">
              ${escape(reporter)}${r.userRole ? ` · ${escape(r.userRole)}` : ""} · ${ageStr}${r.url ? ` · <a href="${escape(r.url)}" style="color:#0369a1;">page</a>` : ""}
            </div>
          </td>
        </tr>
      `;
    };

    const renderBucket = (label: string, color: string, items: any[]) => {
      if (!items?.length) return "";
      return `
        <h3 style="margin:18px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:${color};">${escape(label)} (${items.length})</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          ${items.map(renderRow).join("")}
        </table>
      `;
    };

    const todayStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:680px;color:#0f172a;">
        <div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);padding:18px 24px;border-radius:12px 12px 0 0;color:white;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.9;">FUZE Atlas — Open Support Tickets</div>
          <h2 style="margin:4px 0 0;font-size:22px;font-weight:800;">${escape(todayStr)}</h2>
          <div style="margin-top:8px;font-size:13px;opacity:0.95;">
            ${totalOpen} open · ${newCount} new · ${inProgressCount} in progress · ${fixedCount} fixed all-time
          </div>
        </div>
        <div style="padding:16px 24px;background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          ${
            totalOpen === 0
              ? `<p style="margin:12px 0;color:#059669;font-size:14px;">🎉 No open tickets. Inbox zero.</p>`
              : ""
          }

          ${renderBucket("New — needs triage", "#dc2626", byStatus.NEW || [])}
          ${renderBucket("In Progress", "#0369a1", byStatus.IN_PROGRESS || [])}
          ${renderBucket("Accepted (queued to fix)", "#7c3aed", byStatus.ACCEPTED || [])}
          ${renderBucket("Triaged (decision needed)", "#d97706", byStatus.TRIAGED || [])}

          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e2e8f0;text-align:center;">
            <a href="${appUrl}/admin/feedback" style="display:inline-block;padding:10px 18px;background:#7c3aed;color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;">Open feedback queue →</a>
          </div>

          <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">
            Auto-sent by /api/cron/feedback-digest daily at 13:30 UTC. Skip the
            email by resolving tickets to FIXED, CLOSED, REJECTED, or DUPLICATE.
          </p>
        </div>
      </div>
    `;

    const result = await sendEmail({
      to: DIGEST_RECIPIENTS,
      subject:
        totalOpen === 0
          ? "🎉 Support Tickets — Inbox zero"
          : `🎫 Support Tickets — ${totalOpen} open (${newCount} new)`,
      html,
    });

    return NextResponse.json({
      ok: true,
      counts: {
        open: totalOpen,
        new: newCount,
        triaged: triagedCount,
        accepted: acceptedCount,
        inProgress: inProgressCount,
        fixed: fixedCount,
      },
      emailed: result.ok,
      stub: result.stub || false,
    });
  } catch (err: any) {
    console.error("[feedback-digest cron] Failed:", err);
    try {
      await sendEmail({
        to: DIGEST_RECIPIENTS,
        subject: "❌ Feedback Digest cron FAILED",
        html: `<pre style="font-family:monospace;background:#fef2f2;padding:14px;border-left:4px solid #dc2626;color:#991b1b;">${escape(err?.stack || err?.message || String(err))}</pre>`,
      });
    } catch {
      // give up
    }
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

function escape(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
