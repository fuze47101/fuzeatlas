// @ts-nocheck
/**
 * GET /api/cron/bd-inactivity
 *
 * BD Portal #36 — Phase 5. Daily cron (7am SLC = 13:00 UTC).
 *
 * Two passes over every claimed brand whose pipelineStage is LEAD or
 * PRESENTATION (these are the only stages a rep can "hold"; past
 * PRESENTATION the brand belongs to Andrew / Scott / Tina for handoff
 * triage — see Phase 6 handoffPending).
 *
 *   1. WARN pass  — Brand.lastActivityAt is ≥75 days old AND
 *                   inactivityWarnedAt is null
 *                   → email the rep "15 days until auto-release", in-app bell
 *                   → set inactivityWarnedAt = now
 *
 *   2. RELEASE pass — Brand.lastActivityAt is ≥90 days old
 *                     → clear salesRepId (unclaim), reset inactivityWarnedAt
 *                     → email the (former) rep + admins, in-app bell
 *                     → write a system Note on the brand timeline so the
 *                       history isn't lost
 *
 * Brand-new brands (no lastActivityAt yet) are ignored — the Phase 1
 * migration backfills lastActivityAt = updatedAt so existing brands don't
 * all look 90+ days dormant.
 *
 * Idempotent — safe to re-run. Warn-once is gated by inactivityWarnedAt.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushCustomNotification } from "@/lib/notify-realtime";
import { sendEmail } from "@/lib/email";

const CRON_SECRET = process.env.CRON_SECRET;

const WARN_DAYS = 75;
const RELEASE_DAYS = 90;

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const results = {
    warned: 0,
    released: 0,
    errors: [] as string[],
  };

  try {
    // ─── 1. WARN PASS — 75+ days dormant, not yet warned ────
    const warnTargets = await prisma.brand.findMany({
      where: {
        pipelineStage: { in: ["LEAD", "PRESENTATION"] as any },
        NOT: { salesRepId: null },
        inactivityWarnedAt: null,
        lastActivityAt: { lte: daysAgo(WARN_DAYS), gt: daysAgo(RELEASE_DAYS) },
      },
      select: {
        id: true,
        name: true,
        lastActivityAt: true,
        salesRepId: true,
        salesRep: { select: { id: true, name: true, email: true } },
      },
      take: 200,
    });

    for (const b of warnTargets) {
      try {
        await warnRep(b, baseUrl);
        await prisma.brand.update({
          where: { id: b.id },
          data: { inactivityWarnedAt: now },
        });
        results.warned += 1;
      } catch (err: any) {
        console.error("[bd-inactivity] warn fail", b.id, err);
        results.errors.push(`warn ${b.id}: ${err.message}`);
      }
    }

    // ─── 2. RELEASE PASS — 90+ days dormant ────────────────
    const releaseTargets = await prisma.brand.findMany({
      where: {
        pipelineStage: { in: ["LEAD", "PRESENTATION"] as any },
        NOT: { salesRepId: null },
        lastActivityAt: { lte: daysAgo(RELEASE_DAYS) },
      },
      select: {
        id: true,
        name: true,
        lastActivityAt: true,
        salesRepId: true,
        salesRep: { select: { id: true, name: true, email: true } },
      },
      take: 200,
    });

    for (const b of releaseTargets) {
      try {
        await releaseBrand(b, baseUrl);
        results.released += 1;
      } catch (err: any) {
        console.error("[bd-inactivity] release fail", b.id, err);
        results.errors.push(`release ${b.id}: ${err.message}`);
      }
    }

    return NextResponse.json({ ok: true, ranAt: now.toISOString(), ...results });
  } catch (err: any) {
    console.error("[bd-inactivity] fatal:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "bd-inactivity failed", ...results },
      { status: 500 },
    );
  }
}

async function warnRep(brand: any, baseUrl: string) {
  const rep = brand.salesRep;
  if (!rep) return;

  const since = brand.lastActivityAt
    ? Math.floor((Date.now() - new Date(brand.lastActivityAt).getTime()) / (24 * 60 * 60 * 1000))
    : WARN_DAYS;
  const daysLeft = Math.max(1, RELEASE_DAYS - since);

  const title = `Heads up — ${brand.name} will auto-release in ${daysLeft} days`;
  const message = `No activity logged on ${brand.name} for ${since} days. Log a note, send an email, or schedule a meeting to keep the claim.`;
  const link = `/brands/${brand.id}`;

  // In-app bell
  await pushCustomNotification(rep.id, "BD_INACTIVITY_WARN", title, message, link, {
    brandId: brand.id,
    daysSince: since,
    daysLeft,
  }).catch(() => {});

  // Email
  if (rep.email) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1A1A2E;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fbbf24;margin:0">⏳ Claim at risk — ${escapeHtml(brand.name)}</h2>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#111;font-size:15px;margin:0 0 8px">Hi ${escapeHtml(rep.name || "there")},</p>
          <p style="color:#4b5563;margin:0 0 16px">
            You haven't logged any activity on <strong>${escapeHtml(brand.name)}</strong>
            for <strong>${since} days</strong>. Under FUZE BD policy, claims auto-release
            after ${RELEASE_DAYS} days of inactivity — that's <strong>${daysLeft} days</strong> from now.
          </p>
          <p style="color:#4b5563;margin:0 0 16px">
            To keep it, log any of the following on the brand page:
          </p>
          <ul style="color:#4b5563;margin:0 0 16px;padding-left:20px">
            <li>A note or call log</li>
            <li>A meeting (internal or with the brand)</li>
            <li>An outbound email (via the BCC-to-Atlas logger)</li>
            <li>A follow-up task</li>
          </ul>
          <div style="text-align:center;margin-top:20px">
            <a href="${baseUrl}${link}"
               style="display:inline-block;background:#00b4c3;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
              Open ${escapeHtml(brand.name)} in Atlas
            </a>
          </div>
        </div>
      </div>`;

    await sendEmail({
      to: rep.email,
      subject: `⏳ ${brand.name} auto-releases in ${daysLeft} days`,
      html,
    }).catch(() => {});
  }
}

async function releaseBrand(brand: any, baseUrl: string) {
  const rep = brand.salesRep;
  const since = brand.lastActivityAt
    ? Math.floor((Date.now() - new Date(brand.lastActivityAt).getTime()) / (24 * 60 * 60 * 1000))
    : RELEASE_DAYS;

  // ─── 1. Transactional: unclaim + reset warn + system note ───
  await prisma.$transaction([
    prisma.brand.update({
      where: { id: brand.id },
      data: { salesRepId: null, inactivityWarnedAt: null },
    }),
    prisma.note.create({
      data: {
        brandId: brand.id,
        noteType: "SYSTEM",
        content: `🔓 Auto-released by BD inactivity cron. Previous rep: ${rep?.name || "—"}. Last activity: ${since} days ago.`,
        date: new Date(),
        userId: null,
      },
    }),
  ]);

  if (!rep) return;

  // ─── 2. In-app bell to the former rep ───
  const title = `🔓 ${brand.name} was auto-released`;
  const message = `No activity for ${since} days. The account is now unclaimed and available for any BD rep to pick up.`;
  const link = `/brands/${brand.id}`;
  await pushCustomNotification(rep.id, "BD_INACTIVITY_RELEASE", title, message, link, {
    brandId: brand.id,
    daysSince: since,
  }).catch(() => {});

  // ─── 3. Email the former rep + loop in admins ───
  const adminEmails = (
    await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { email: true },
    })
  )
    .map((u: any) => u.email)
    .filter(Boolean);

  if (rep.email) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1A1A2E;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#f87171;margin:0">🔓 Auto-released: ${escapeHtml(brand.name)}</h2>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#111;font-size:15px;margin:0 0 8px">Hi ${escapeHtml(rep.name || "there")},</p>
          <p style="color:#4b5563;margin:0 0 16px">
            <strong>${escapeHtml(brand.name)}</strong> has been auto-released after
            <strong>${since} days</strong> of no logged activity. It's now unclaimed and
            any BD rep can pick it up.
          </p>
          <p style="color:#4b5563;margin:0 0 16px">
            If you're still actively working this account, just re-claim it and log
            what you've been doing — notes, calls, meetings, or emails — so it doesn't
            slip again.
          </p>
          <div style="text-align:center;margin-top:20px">
            <a href="${baseUrl}${link}"
               style="display:inline-block;background:#00b4c3;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
              Open ${escapeHtml(brand.name)} in Atlas
            </a>
          </div>
        </div>
      </div>`;

    // sendEmail takes a single `to` (string or array); combine rep + admins
    const recipients = Array.from(new Set([rep.email, ...adminEmails].filter(Boolean)));
    await sendEmail({
      to: recipients,
      subject: `🔓 Auto-released: ${brand.name} (${since} days inactive)`,
      html,
    }).catch(() => {});
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
