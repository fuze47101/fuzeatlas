// @ts-nocheck
/**
 * Phase 19 T7 — weekly i18n drift detector.
 *
 * GET /api/cron/i18n-drift-report
 *
 * Runs diffAllLocales(). If any locale shows > 10 missing keys
 * (signals the pre-commit hook is failing or someone is committing
 * en.ts changes without the hook firing), emails Andrew a digest
 * with per-locale coverage + the canonical `fzcron` recovery line.
 *
 * No DB writes. Bearer-authed like every other /api/cron/*.
 * Scheduled weekly in vercel.json.
 */

import { NextResponse } from "next/server";
import { diffAllLocales } from "@/lib/i18n-diff";
import { sendEmail } from "@/lib/email";

const CRON_SECRET = process.env.CRON_SECRET;
const THRESHOLD_MISSING = 10;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const diffs = await diffAllLocales();
  const flagged = diffs.filter((d) => d.missingKeys.length > THRESHOLD_MISSING);

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (flagged.length === 0 && !force) {
    return NextResponse.json({
      ok: true,
      verdict: "All locales below drift threshold — no email sent.",
      threshold: THRESHOLD_MISSING,
      locales: diffs.map((d) => ({
        locale: d.locale,
        coverage: Number((d.coverage * 100).toFixed(1)),
        missingKeys: d.missingKeys.length,
        emptyKeys: d.emptyKeys.length,
      })),
    });
  }

  const rows = diffs
    .sort((a, b) => b.missingKeys.length - a.missingKeys.length)
    .map((d) => {
      const cov = (d.coverage * 100).toFixed(1);
      const flag = d.missingKeys.length > THRESHOLD_MISSING ? " ⚠" : "";
      return `<tr><td>${d.locale}${flag}</td><td style="text-align:right">${cov}%</td><td style="text-align:right">${d.missingKeys.length}</td><td style="text-align:right">${d.emptyKeys.length}</td></tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:640px;color:#0f172a">
      <h2 style="color:#0f172a;margin:0 0 8px">FUZE Atlas — i18n drift report</h2>
      <p style="margin:0 0 12px;color:#475569">
        ${flagged.length} locale(s) have more than ${THRESHOLD_MISSING} missing keys.
        This usually means the pre-commit auto-translation hook didn't fire on a recent en.ts change.
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <thead style="background:#f1f5f9;text-align:left">
          <tr>
            <th style="padding:6px 8px">Locale</th>
            <th style="padding:6px 8px;text-align:right">Coverage</th>
            <th style="padding:6px 8px;text-align:right">Missing</th>
            <th style="padding:6px 8px;text-align:right">Empty/Copy</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:16px 0 0;padding:12px;background:#f1f5f9;border-radius:6px;font-family:monospace;font-size:12px">
        # Recover locally on Andrew's Mac with:<br>
        npx tsx scripts/translate-i18n.ts --locales ${flagged.map((f) => f.locale).join(",")}
      </p>
    </div>
  `;

  await sendEmail({
    to: "andrew@801inc.com",
    subject: `🌐 i18n drift — ${flagged.length} locale(s) over threshold`,
    html,
  }).catch((e) => {
    console.error("[i18n-drift-report] email failed:", e);
  });

  return NextResponse.json({
    ok: true,
    verdict: `Emailed Andrew about ${flagged.length} drifting locale(s).`,
    flagged: flagged.map((d) => ({
      locale: d.locale,
      missingKeys: d.missingKeys.length,
      coverage: Number((d.coverage * 100).toFixed(1)),
    })),
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
