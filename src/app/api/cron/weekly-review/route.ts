// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildSnapshot, mondayOf } from "@/lib/weekly-review/snapshot";

/**
 * GET /api/cron/weekly-review
 *
 * Vercel Cron Job — runs Monday at 7am MST (14:00 UTC).
 *
 * Andrew's complaint May 2026: "make sure that full week review is
 * emailing me." Root cause: there was NO cron registered for the
 * weekly exec review at all. The /admin/weekly-review page was a
 * manual click-to-create flow only — Andrew had to remember to hit
 * "Refresh" every Monday and never received the email summary.
 *
 * What this does:
 *   1. Computes the Monday anchor for the week that just ended (we
 *      run on Monday morning, so the report covers the previous
 *      Monday→Sunday).
 *   2. Builds the snapshot via the canonical buildSnapshot() helper.
 *   3. Upserts the WeeklyExecReport row (system-owned — first owner
 *      becomes whichever admin user we resolve, or null if none).
 *   4. Emails Andrew an HTML summary with the headline KPIs and a
 *      direct link to the full report.
 *
 * Auth: standard CRON_SECRET bearer token, same as every other cron.
 * Middleware exemption is already in place via /api/cron prefix.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const REVIEW_RECIPIENTS = ["andrew@801inc.com", "andrew@fuze47.com"];

export async function GET(req: Request) {
  // Auth — Vercel cron sends Authorization: Bearer $CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://fuzeatlas.com");

  try {
    // We run Monday morning, so the report covers the *previous* Monday →
    // Sunday window. mondayOf(today) for a Monday is today, so step back
    // 7 days to get the week we want to summarize.
    const today = new Date();
    const thisMonday = mondayOf(today);
    const reportMonday = new Date(thisMonday);
    reportMonday.setUTCDate(reportMonday.getUTCDate() - 7);

    const snapshot = await buildSnapshot(reportMonday, 7);

    // Resolve a default owner — first admin we find. The cron itself is
    // system-driven so we don't have a session user to attribute it to,
    // but the model requires `ownedById`. Fall back to creating a
    // "system" placeholder if no admin exists (shouldn't happen in
    // practice but keeps the cron from blowing up on a fresh DB).
    let ownerId: string | null = null;
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    if (admin) ownerId = admin.id;

    const existing = await prisma.weeklyExecReport.findUnique({
      where: { weekOf: reportMonday },
      select: { id: true, ownedById: true },
    });

    const report = existing
      ? await prisma.weeklyExecReport.update({
          where: { id: existing.id },
          data: { snapshot, lookbackDays: 7, generatedAt: new Date() },
        })
      : await prisma.weeklyExecReport.create({
          data: {
            weekOf: reportMonday,
            lookbackDays: 7,
            snapshot,
            ownedById: ownerId || (await getOrCreateSystemOwnerId()),
            status: "DRAFT",
          },
        });

    const reportUrl = `${appUrl}/admin/weekly-review/${report.id}`;

    // ── Email body ──────────────────────────────────────────────
    const fmtRange = (start: string, end: string) => {
      const s = new Date(start);
      const e = new Date(end);
      const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
      return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString(
        "en-US",
        { ...opts, year: "numeric" },
      )}`;
    };
    const weekLabel = fmtRange(snapshot.period.start, snapshot.period.end);

    const kpiRows = (snapshot.kpis || [])
      .slice(0, 8)
      .map((k: any) => {
        const tone = k.tone || "neutral";
        const toneColor =
          tone === "good"
            ? "#059669"
            : tone === "warn"
              ? "#d97706"
              : tone === "bad"
                ? "#dc2626"
                : "#475569";
        const deltaStr =
          typeof k.deltaPct === "number"
            ? ` (${k.deltaPct >= 0 ? "+" : ""}${k.deltaPct.toFixed(1)}% vs prior)`
            : "";
        const valueStr =
          typeof k.value === "number"
            ? `${k.unit === "$" ? "$" : ""}${k.value.toLocaleString()}${k.unit && k.unit !== "$" ? " " + k.unit : ""}`
            : `${k.value}${k.unit && k.unit !== "$" ? " " + k.unit : ""}`;
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">${escape(k.label)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;color:${toneColor};font-size:14px;">${escape(valueStr)}<span style="font-weight:400;font-size:12px;color:#94a3b8;">${escape(deltaStr)}</span></td>
          </tr>
        `;
      })
      .join("");

    const sales = snapshot.sales || {};
    const bd = snapshot.bd || {};
    const testing = snapshot.testing || {};

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:640px;color:#0f172a;">
        <div style="background:linear-gradient(135deg,#00b4c3,#009ba8);padding:18px 24px;border-radius:12px 12px 0 0;color:white;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.9;">FUZE Atlas — Weekly Exec Review</div>
          <h2 style="margin:4px 0 0;font-size:22px;font-weight:800;">${escape(weekLabel)}</h2>
        </div>
        <div style="padding:20px 24px;background:white;border:1px solid #e2e8f0;border-top:none;">
          <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Headline KPIs</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
            ${kpiRows || `<tr><td style="padding:12px;color:#94a3b8;font-size:13px;">No KPI data yet for this window.</td></tr>`}
          </table>

          ${
            snapshot.customersAtRisk?.length
              ? `<h3 style="margin:18px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#dc2626;">Customers at Risk (${snapshot.customersAtRisk.length})</h3>
                 <ul style="margin:0;padding-left:18px;color:#475569;font-size:13px;">
                   ${snapshot.customersAtRisk.slice(0, 6).map((c: any) => `<li>${escape(c.name || c.brandName || "Unknown")}${c.reason ? ` — <span style="color:#94a3b8;">${escape(c.reason)}</span>` : ""}</li>`).join("")}
                 </ul>`
              : ""
          }

          ${
            snapshot.thisWeek?.length
              ? `<h3 style="margin:18px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">On Andrew's Plate</h3>
                 <ul style="margin:0;padding-left:18px;color:#475569;font-size:13px;">
                   ${snapshot.thisWeek.slice(0, 6).map((a: any) => `<li>${escape(a.title || a.label || "Untitled")}${a.due ? ` <span style="color:#94a3b8;">(${escape(a.due)})</span>` : ""}</li>`).join("")}
                 </ul>`
              : ""
          }

          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e2e8f0;text-align:center;">
            <a href="${reportUrl}" style="display:inline-block;padding:11px 22px;background:#00b4c3;color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Open full review →</a>
          </div>

          <p style="margin:18px 0 0;font-size:11px;color:#94a3b8;">
            Auto-generated by /api/cron/weekly-review every Monday at 14:00 UTC.
            Adjust recipients in the route's REVIEW_RECIPIENTS constant.
          </p>
        </div>
      </div>
    `;

    const result = await sendEmail({
      to: REVIEW_RECIPIENTS,
      subject: `📊 FUZE Weekly Review — ${weekLabel}`,
      html,
    });

    return NextResponse.json({
      ok: true,
      reportId: report.id,
      weekOf: reportMonday.toISOString(),
      emailed: result.ok,
      stub: result.stub || false,
    });
  } catch (err: any) {
    console.error("[weekly-review cron] Failed:", err);
    // Best-effort error notification so silent failures stop happening
    // (same defensive pattern as daily-digest).
    try {
      await sendEmail({
        to: REVIEW_RECIPIENTS,
        subject: "❌ Weekly Review cron FAILED",
        html: `<pre style="font-family:monospace;background:#fef2f2;padding:14px;border-left:4px solid #dc2626;color:#991b1b;">${escape(err?.stack || err?.message || String(err))}</pre>`,
      });
    } catch {
      // can't email — just log and 500
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

/**
 * Make sure SOMETHING owns the snapshot row. The schema requires
 * ownedById to be non-null. If the prod DB has no ADMIN user yet (only
 * possible on a brand-new env) we create a placeholder system user so
 * the cron doesn't permanently fail.
 */
async function getOrCreateSystemOwnerId(): Promise<string> {
  const existing = await prisma.user.findFirst({
    where: { email: "system@fuzeatlas.local" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.user.create({
    data: {
      email: "system@fuzeatlas.local",
      name: "System (Cron)",
      role: "ADMIN",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return created.id;
}
