// @ts-nocheck
/**
 * GET /api/cron/red-rover-report — Red Rover Track 5.
 *
 * Vercel Cron — Mondays 15:00 UTC. Emails Andrew the weekly Red Rover
 * accountability rollup:
 *   • per-owner rollup (each owner's targets + days-since-activity + stage)
 *   • stage moves in the last 7 days (STATUS_CHANGE activities)
 *   • STALLED / >14d-stale target list (the accountability signal)
 *   • Tier 1 funnel (Tier 1 count by stage)
 *
 * Reuses the exec-report email pattern (sendEmail + inline HTML). Bearer
 * $CRON_SECRET; /api/cron is already exempt in middleware PUBLIC_PATHS.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const CRON_SECRET = process.env.CRON_SECRET;
const REPORT_RECIPIENTS = ["andrew@801inc.com", "andrew@fuze47.com"];
const DAY = 86_400_000;
const TIER_ORDER: Record<string, number> = { TIER1: 0, TIER2: 1, PARKED: 2 };
const STAGE_ORDER = [
  "IDENTIFIED",
  "CONTACTED",
  "PRESENTATION",
  "TESTING",
  "AGREEMENT",
  "ACTIVE",
  "STALLED",
  "PARKED",
];

function daysSince(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / DAY);
}

function esc(s: any): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const since7 = new Date(Date.now() - 7 * DAY);

  try {
    const [targets, moves] = await Promise.all([
      prisma.redRoverTarget.findMany({
        include: { owner: { select: { id: true, name: true } } },
      }),
      prisma.redRoverActivity.findMany({
        where: { type: "STATUS_CHANGE", occurredAt: { gte: since7 } },
        orderBy: { occurredAt: "desc" },
        include: { target: { select: { name: true } } },
      }),
    ]);

    const sorted = [...targets].sort((a, b) => {
      const to = (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9);
      if (to !== 0) return to;
      return (a.rank ?? 9999) - (b.rank ?? 9999);
    });

    // Per-owner rollup.
    const byOwner: Record<string, { name: string; rows: any[] }> = {};
    for (const t of sorted) {
      const key = t.ownerId || "_unassigned";
      if (!byOwner[key]) byOwner[key] = { name: t.owner?.name || "Unassigned", rows: [] };
      byOwner[key].rows.push(t);
    }

    // STALLED / stale list (exclude PARKED tier).
    const stale = sorted.filter((t) => {
      if (t.tier === "PARKED") return false;
      if (t.stage === "STALLED") return true;
      const d = daysSince(t.lastActivityAt);
      return d == null || d > 14;
    });

    // Tier 1 funnel.
    const tier1 = sorted.filter((t) => t.tier === "TIER1");
    const tier1Funnel: Record<string, number> = {};
    for (const t of tier1) tier1Funnel[t.stage] = (tier1Funnel[t.stage] || 0) + 1;

    // ── Build HTML ──
    const ownerBlocks = Object.values(byOwner)
      .map((o) => {
        const rows = o.rows
          .map((t) => {
            const d = daysSince(t.lastActivityAt);
            const label = d == null ? "no activity" : d === 0 ? "today" : `${d}d ago`;
            const color = d == null || d > 14 ? "#dc2626" : d > 7 ? "#d97706" : "#475569";
            return `<tr>
              <td style="padding:4px 8px;border-bottom:1px solid #eee;">#${t.rank ?? "—"} <b>${esc(t.name)}</b></td>
              <td style="padding:4px 8px;border-bottom:1px solid #eee;">${esc(t.tier)}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #eee;">${esc(t.stage)}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #eee;color:${color};">${label}</td>
            </tr>`;
          })
          .join("");
        return `<h3 style="margin:16px 0 6px;color:#0f172a;">${esc(o.name)} — ${o.rows.length} target(s)</h3>
          <table style="border-collapse:collapse;width:100%;font-size:13px;">
            <tr style="text-align:left;color:#64748b;"><th style="padding:4px 8px;">Target</th><th style="padding:4px 8px;">Tier</th><th style="padding:4px 8px;">Stage</th><th style="padding:4px 8px;">Last activity</th></tr>
            ${rows}
          </table>`;
      })
      .join("");

    const movesBlock = moves.length
      ? `<ul style="font-size:13px;color:#334155;">${moves
          .map(
            (m) =>
              `<li><b>${esc(m.target?.name)}</b>: ${esc(m.body)} <span style="color:#94a3b8;">(${new Date(
                m.occurredAt,
              ).toLocaleDateString()})</span></li>`,
          )
          .join("")}</ul>`
      : `<p style="font-size:13px;color:#94a3b8;">No stage moves logged in the last 7 days.</p>`;

    const staleBlock = stale.length
      ? `<ul style="font-size:13px;color:#334155;">${stale
          .map((t) => {
            const d = daysSince(t.lastActivityAt);
            const tag = t.stage === "STALLED" ? "STALLED" : d == null ? "no activity" : `${d}d stale`;
            return `<li>#${t.rank ?? "—"} <b>${esc(t.name)}</b> (${esc(t.stage)}) — <span style="color:#dc2626;">${tag}</span> · next: ${esc(t.nextStep) || "—"}</li>`;
          })
          .join("")}</ul>`
      : `<p style="font-size:13px;color:#16a34a;">🎉 Nothing stalled or stale &gt;14d.</p>`;

    const funnelBlock = STAGE_ORDER.filter((st) => tier1Funnel[st])
      .map((st) => `<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;background:#fee2e2;border-radius:10px;font-size:12px;">${st}: <b>${tier1Funnel[st]}</b></span>`)
      .join("");

    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:680px;margin:0 auto;color:#0f172a;">
      <h2 style="margin-bottom:2px;">🚀 Red Rover — Weekly Accountability</h2>
      <p style="color:#64748b;margin-top:0;font-size:13px;">${new Date().toDateString()} · ${targets.length} targets · <a href="${appUrl}/admin/red-rover" style="color:#e11d48;">open dashboard →</a></p>

      <h3 style="margin:18px 0 6px;color:#0f172a;">Tier 1 funnel</h3>
      <div>${funnelBlock || '<span style="color:#94a3b8;font-size:13px;">No Tier 1 targets.</span>'}</div>

      <h3 style="margin:18px 0 6px;color:#dc2626;">⚠ Stalled / &gt;14d stale (${stale.length})</h3>
      ${staleBlock}

      <h3 style="margin:18px 0 6px;color:#0f172a;">Stage moves — last 7 days (${moves.length})</h3>
      ${movesBlock}

      <h2 style="margin:22px 0 4px;color:#0f172a;">Per-owner rollup</h2>
      ${ownerBlocks}
    </div>`;

    const staleCount = stale.length;
    const subject = `🚀 Red Rover Weekly — ${targets.length} targets, ${staleCount} stalled/stale, ${moves.length} moves`;

    await sendEmail({ to: REPORT_RECIPIENTS, subject, html });

    return NextResponse.json({
      ok: true,
      targets: targets.length,
      stageMoves7d: moves.length,
      staleOrStalled: staleCount,
      tier1: tier1.length,
      tier1Funnel,
    });
  } catch (e: any) {
    // Error-fallback email so a handler crash is visible, not silent.
    try {
      await sendEmail({
        to: REPORT_RECIPIENTS,
        subject: "🚨 Red Rover Weekly FAILED",
        html: `<pre>${esc(e?.stack || e?.message || String(e))}</pre>`,
      });
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { ok: false, error: e?.message || String(e), code: e?.code || null },
      { status: 500 },
    );
  }
}
