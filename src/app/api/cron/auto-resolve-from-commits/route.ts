// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * GET/POST /api/cron/auto-resolve-from-commits
 *
 * Runs hourly. Pulls the last 25 commits on main from GitHub, scans
 * each commit message body for FeedbackReport cuid IDs preceded by
 * GitHub-convention close keywords (Close / Closes / Closed / Fix /
 * Fixes / Fixed / Resolve / Resolves / Resolved). Case-insensitive.
 * For each ID found in a close-segment:
 *
 *   - Skip if the report is already FIXED / CLOSED / REJECTED /
 *     DUPLICATE (idempotent — re-runs are safe).
 *   - Otherwise flip to FIXED, stamp the commit SHA + author +
 *     message snippet as the resolution note, send the standard
 *     fixed-it email to the reporter.
 *
 * Scope tightened 2026-05-20 after multiple false-FIXED incidents
 * where Code referenced ticket cuids in passing (e.g. "see ticket
 * cmXXX") and the old regex (any cuid anywhere) auto-closed those
 * tickets incorrectly. Now requires explicit keyword prefix — same
 * convention as GitHub's commit-to-issue close syntax.
 *
 * Supported patterns:
 *   "Closes cmAAA"                  → [cmAAA]
 *   "Fixes cmAAA, cmBBB"            → [cmAAA, cmBBB] (multi-close)
 *   "Resolves cmAAA and cmBBB"      → [cmAAA, cmBBB]
 *   "Closed cmAAA. Other stuff."    → [cmAAA] (sentence-scoped)
 *   "See ticket cmAAA"              → []  (no keyword)
 *   "Implementation for cmAAA"      → []  (no keyword)
 *
 * Tracking "last successful run" via idempotency rather than a
 * separate side-table — already-FIXED reports never get re-emailed
 * because the email block guards on `existing.status !== "FIXED" &&
 * !existing.notifiedAt`.
 *
 * Bearer-authed: `Authorization: Bearer $CRON_SECRET`.
 * GitHub access: anonymous if the repo is public; otherwise set
 * GITHUB_TOKEN in Vercel env.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const REPO = process.env.GITHUB_REPO || "fuze47101/fuzeatlas";
const COMMIT_FETCH_COUNT = 25;

// Two-stage matcher (clearer than a single mega-regex):
//   1. KEYWORD_SEGMENT_RX finds each close-keyword sentence/clause
//      (terminated by period, newline, or end-of-string). This bounds
//      the cuid harvest to the explicit close context so a later
//      "see ticket cmXXX" reference doesn't get sucked in.
//   2. CUID_RX harvests all cuids from each matched segment. Supports
//      multi-close via comma, space, or "and" separation.
//
// Cuid length note: real-world Prisma cuids in this codebase are 25
// characters total (`cm` + 23 chars). The PRIOR regex `cm[a-z0-9]{24}`
// required 26 chars and therefore never matched anything in production —
// the cron had been silently no-op'ing since it shipped. Range
// {22,28} covers current cuid format with comfortable headroom for
// future Prisma cuid spec changes without re-introducing fragility.
const KEYWORD_SEGMENT_RX =
  /\b(?:close[ds]?|fix(?:e[ds])?|resolve[ds]?)\s+[^.\n]*(?:\.|\n|$)/gi;
const CUID_RX = /\bcm[a-z0-9]{22,28}\b/g;

// Statuses that mean "already resolved" — skip these so re-runs
// don't churn or send duplicate emails.
const TERMINAL = new Set(["FIXED", "CLOSED", "REJECTED", "DUPLICATE"]);

interface GhCommit {
  sha: string;
  commit: {
    author: { name: string; email: string; date: string };
    message: string;
  };
  author: { login: string } | null;
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ─── 1. Fetch recent commits via GitHub API ───────────────
  const ghHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "fuzeatlas-auto-resolve-cron",
  };
  if (process.env.GITHUB_TOKEN) {
    ghHeaders["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const ghUrl = `https://api.github.com/repos/${REPO}/commits?per_page=${COMMIT_FETCH_COUNT}&sha=main`;
  let commits: GhCommit[] = [];
  try {
    const r = await fetch(ghUrl, { headers: ghHeaders });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { ok: false, error: `GitHub API ${r.status}: ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
    commits = (await r.json()) as GhCommit[];
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `GitHub fetch failed: ${e?.message || String(e)}` },
      { status: 502 },
    );
  }

  // ─── 2. For each commit, scan body for cuid IDs ───────────
  const results: Array<{
    feedbackId: string;
    commitSha: string;
    action: "resolved" | "skipped-already-terminal" | "skipped-not-found" | "error";
    detail?: string;
  }> = [];

  for (const c of commits) {
    const sha = c.sha;
    const msg = c.commit?.message || "";
    const author = c.commit?.author?.name || c.author?.login || "unknown";

    // Two-stage: find every close-keyword segment, then harvest cuids
    // from each. Skip the commit entirely if no close keyword present.
    const closeSegments = msg.match(KEYWORD_SEGMENT_RX) || [];
    const cuidsInClose: string[] = [];
    for (const segment of closeSegments) {
      const ids = segment.match(CUID_RX);
      if (ids) cuidsInClose.push(...ids);
    }
    const matches = Array.from(new Set(cuidsInClose));
    if (matches.length === 0) continue;

    for (const feedbackId of matches) {
      try {
        const existing = await prisma.feedbackReport.findUnique({
          where: { id: feedbackId },
        });
        if (!existing) {
          results.push({
            feedbackId,
            commitSha: sha,
            action: "skipped-not-found",
          });
          continue;
        }
        if (TERMINAL.has(existing.status)) {
          // Already terminal — re-run safe, just record and move on.
          results.push({
            feedbackId,
            commitSha: sha,
            action: "skipped-already-terminal",
            detail: existing.status,
          });
          continue;
        }

        // Build resolution note from commit metadata.
        const firstLine = (msg.split("\n")[0] || "").trim().slice(0, 140);
        const shortSha = sha.slice(0, 7);
        const noteParts = [
          existing.resolution || "",
          `[auto-resolve] Commit ${shortSha} by ${author}: ${firstLine}`,
        ].filter(Boolean);
        const resolutionNote = noteParts.join("\n\n");

        const updated = await prisma.feedbackReport.update({
          where: { id: feedbackId },
          data: {
            status: "FIXED",
            resolvedAt: new Date(),
            resolution: resolutionNote,
            resolutionUrl: `https://github.com/${REPO}/commit/${sha}`,
          },
        });

        // Send the same "we fixed it" email the PATCH endpoint sends,
        // gated on never-notified + has-email. Failure non-blocking.
        let emailed = false;
        if (!existing.notifiedAt && updated.userEmail) {
          try {
            await sendFixedEmail(updated);
            await prisma.feedbackReport.update({
              where: { id: feedbackId },
              data: { notifiedAt: new Date() },
            });
            emailed = true;
          } catch (emailErr) {
            console.error(
              `[auto-resolve-from-commits] email ${feedbackId} failed:`,
              emailErr,
            );
          }
        }

        results.push({
          feedbackId,
          commitSha: sha,
          action: "resolved",
          detail: `${emailed ? "emailed" : "no-email"} · ${firstLine}`,
        });
      } catch (e: any) {
        console.error(`[auto-resolve-from-commits] ${feedbackId} failed:`, e);
        results.push({
          feedbackId,
          commitSha: sha,
          action: "error",
          detail: e?.message || String(e),
        });
      }
    }
  }

  const resolved = results.filter((r) => r.action === "resolved").length;
  return NextResponse.json({
    ok: true,
    verdict: `Scanned ${commits.length} commits · resolved ${resolved} feedback report(s).`,
    summary: {
      commitsScanned: commits.length,
      resolved,
      skipped: results.filter((r) => r.action.startsWith("skipped")).length,
      errors: results.filter((r) => r.action === "error").length,
    },
    results,
  });
}

async function sendFixedEmail(r: any) {
  const subject = `We fixed what you reported: ${truncate(r.title, 80)}`;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const pageLink = r.url
    ? `<p style="margin:16px 0 8px">You can pick up where you left off here:</p>
       <p><a href="${escapeHtml(r.url)}" style="color:#00b4c3;font-weight:bold">${escapeHtml(r.url)}</a></p>`
    : "";
  const resolutionBlock = r.resolution
    ? `<div style="background:#f0f9ff;border-left:4px solid #00b4c3;padding:12px;margin:16px 0;border-radius:6px">
         <p style="margin:0;font-size:13px;color:#0f172a"><strong>What we did:</strong></p>
         <p style="margin:6px 0 0;font-size:14px;color:#334155;white-space:pre-wrap">${escapeHtml(r.resolution)}</p>
       </div>`
    : "";
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:auto;padding:20px;color:#0f172a">
      <h1 style="color:#00b4c3;font-size:22px;margin:0 0 12px">Fixed ✅</h1>
      <p style="font-size:15px;line-height:1.5;color:#334155">
        Hey ${escapeHtml(r.userName || "there")}, the issue you reported is now resolved.
      </p>
      <p style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:14px;color:#0f172a">
        <strong>Your report:</strong> ${escapeHtml(r.title)}
      </p>
      ${resolutionBlock}
      ${pageLink}
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">
        Thanks for taking the time to flag this — it genuinely helps us make Atlas better.
        If it&#39;s still not working right, reply to this email or hit the 🐛 button again.
        ${baseUrl ? `<br>— <a href="${baseUrl}" style="color:#94a3b8">FUZE Atlas</a>` : "— FUZE Atlas"}
      </p>
    </div>
  `;
  await sendEmail({ to: r.userEmail, subject, html });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
