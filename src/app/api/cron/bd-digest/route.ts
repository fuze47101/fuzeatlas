// @ts-nocheck
/**
 * GET /api/cron/bd-digest
 *
 * BD Portal #36 Phase 7. Daily cron (7:15am SLC = 13:15 UTC).
 *
 * A BD-specific digest for Andrew (+ Scott). Everything the main
 * daily-digest doesn't surface, cut specifically for BD rhythm:
 *
 *   • Unclaimed LEAD + PRESENTATION brands (anyone can grab these)
 *   • Brands at risk (lastActivityAt >60 days) with their rep
 *   • Brands auto-released in the last 24h by the inactivity cron
 *   • Handoff queue: brands past PRESENTATION waiting on admin triage
 *   • Claims created/dropped in the last 24h
 *
 * If there's nothing to report in any bucket, still send a one-line
 * "all quiet" email so Andrew knows the cron is alive.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const CRON_SECRET = process.env.CRON_SECRET;
const DIGEST_RECIPIENTS = ["andrew@801inc.com", "scott@fuzebiotech.com"];

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const since24h = daysAgo(1);

    // ─── 1. Unclaimed pre-PRESENTATION brands ───
    const unclaimed = await prisma.brand.findMany({
      where: {
        pipelineStage: { in: ["LEAD", "PRESENTATION"] as any },
        salesRepId: null,
      },
      select: { id: true, name: true, pipelineStage: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    // ─── 2. At-risk (60+ day dormant, still claimed) ───
    const atRisk = await prisma.brand.findMany({
      where: {
        pipelineStage: { in: ["LEAD", "PRESENTATION"] as any },
        NOT: { salesRepId: null },
        lastActivityAt: { lte: daysAgo(60) },
      },
      select: {
        id: true,
        name: true,
        pipelineStage: true,
        lastActivityAt: true,
        salesRep: { select: { name: true } },
      },
      orderBy: { lastActivityAt: "asc" },
      take: 40,
    });

    // ─── 3. Auto-released in last 24h (system note) ───
    const autoReleasedNotes = await prisma.note.findMany({
      where: {
        noteType: "SYSTEM",
        createdAt: { gte: since24h },
        content: { contains: "Auto-released", mode: "insensitive" },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        brand: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    // ─── 4. Handoff queue ───
    const handoffs = await prisma.brand.findMany({
      where: { handoffPending: true },
      select: {
        id: true,
        name: true,
        pipelineStage: true,
        salesRep: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });

    // ─── 5. Claims created/dropped in last 24h ───
    //   We don't keep a full claim history table yet. Approximate with:
    //   - brands whose updatedAt is in the last 24h AND have a salesRep → claimed
    //   - handled via the system notes above for releases
    const recentClaims = await prisma.brand.findMany({
      where: {
        updatedAt: { gte: since24h },
        NOT: { salesRepId: null },
      },
      select: {
        id: true,
        name: true,
        pipelineStage: true,
        salesRep: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });

    const nothingToReport =
      unclaimed.length === 0 &&
      atRisk.length === 0 &&
      autoReleasedNotes.length === 0 &&
      handoffs.length === 0 &&
      recentClaims.length === 0;

    const html = buildBdDigestHtml({
      unclaimed,
      atRisk,
      autoReleasedNotes,
      handoffs,
      recentClaims,
      nothingToReport,
    });

    const todayStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "America/Denver",
    });

    await sendEmail({
      to: DIGEST_RECIPIENTS,
      subject: `📊 BD Digest — ${todayStr}${nothingToReport ? " (all quiet)" : ""}`,
      html,
    });

    return NextResponse.json({
      ok: true,
      counts: {
        unclaimed: unclaimed.length,
        atRisk: atRisk.length,
        autoReleased: autoReleasedNotes.length,
        handoffs: handoffs.length,
        recentClaims: recentClaims.length,
      },
    });
  } catch (err: any) {
    console.error("[bd-digest] fatal:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "bd-digest failed" },
      { status: 500 },
    );
  }
}

function buildBdDigestHtml({
  unclaimed,
  atRisk,
  autoReleasedNotes,
  handoffs,
  recentClaims,
  nothingToReport,
}: any) {
  const row = (
    name: string,
    stage: string,
    meta: string,
    id: string,
    tone: "ok" | "warn" | "bad" = "ok",
  ) => {
    const color = tone === "bad" ? "#dc2626" : tone === "warn" ? "#d97706" : "#0f766e";
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
          <a href="${BASE_URL}/brands/${id}" style="color:${color};font-weight:600;text-decoration:none">
            ${escapeHtml(name)}
          </a>
          <div style="color:#64748b;font-size:12px">${escapeHtml(stage)} — ${escapeHtml(meta)}</div>
        </td>
      </tr>`;
  };

  const daysSince = (d: Date | null) => {
    if (!d) return "—";
    const days = Math.floor((Date.now() - new Date(d).getTime()) / (24 * 60 * 60 * 1000));
    return `${days}d quiet`;
  };

  const unclaimedRows = unclaimed
    .map((b: any) => row(b.name, b.pipelineStage, "unclaimed", b.id, "warn"))
    .join("");

  const atRiskRows = atRisk
    .map((b: any) =>
      row(
        b.name,
        b.pipelineStage,
        `${b.salesRep?.name || "—"} · ${daysSince(b.lastActivityAt)}`,
        b.id,
        "bad",
      ),
    )
    .join("");

  const releasedRows = autoReleasedNotes
    .map(
      (n: any) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
            <a href="${BASE_URL}/brands/${n.brand?.id}" style="color:#dc2626;font-weight:600;text-decoration:none">
              ${escapeHtml(n.brand?.name || "(unknown)")}
            </a>
            <div style="color:#64748b;font-size:12px">${escapeHtml(n.content.slice(0, 140))}</div>
          </td>
        </tr>`,
    )
    .join("");

  const handoffRows = handoffs
    .map((b: any) =>
      row(b.name, b.pipelineStage, `→ ${b.salesRep?.name || "unassigned"}`, b.id, "warn"),
    )
    .join("");

  const claimRows = recentClaims
    .map((b: any) =>
      row(b.name, b.pipelineStage, `claimed by ${b.salesRep?.name || "—"}`, b.id, "ok"),
    )
    .join("");

  const section = (title: string, emoji: string, count: number, rows: string, emptyMsg: string) => `
    <h3 style="color:#0f172a;font-size:15px;margin:24px 0 8px;border-bottom:2px solid #e5e7eb;padding-bottom:6px">
      ${emoji} ${title} (${count})
    </h3>
    ${
      count === 0
        ? `<p style="color:#94a3b8;font-size:13px;margin:8px 0">${emptyMsg}</p>`
        : `<table style="width:100%;border-collapse:collapse">${rows}</table>`
    }
  `;

  return `
    <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto">
      <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#22d3ee;margin:0">📊 BD Digest</h2>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Daily 7am SLC — FUZE Atlas BD Portal</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
        ${
          nothingToReport
            ? `<p style="color:#16a34a;font-size:15px;font-weight:600">✅ All quiet — nothing to triage this morning.</p>`
            : ""
        }
        ${section(
          "Unclaimed",
          "🙋",
          unclaimed.length,
          unclaimedRows,
          "No unclaimed leads or presentations.",
        )}
        ${section(
          "At risk (60+ days dormant)",
          "⏳",
          atRisk.length,
          atRiskRows,
          "Every claimed brand has recent activity.",
        )}
        ${section(
          "Auto-released (last 24h)",
          "🔓",
          autoReleasedNotes.length,
          releasedRows,
          "No auto-releases in the last 24h.",
        )}
        ${section(
          "Handoff queue",
          "🤝",
          handoffs.length,
          handoffRows,
          "No brands waiting on admin handoff.",
        )}
        ${section(
          "Claims in last 24h",
          "✅",
          recentClaims.length,
          claimRows,
          "No new claims in the last 24h.",
        )}
      </div>
    </div>
  `;
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
