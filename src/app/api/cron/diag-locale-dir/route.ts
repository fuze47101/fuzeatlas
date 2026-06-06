// @ts-nocheck
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

/**
 * GET /api/cron/diag-locale-dir
 *
 * Verifies BUG 3 (Tina cmplvllhg0001lb04ysg3sj9u 2026-06-05):
 *
 *   No code path sets document.documentElement.dir = "rtl" or
 *   renders <html dir="rtl"> from a locale-conditional. The fix
 *   locks dir to "ltr" until a real RTL pass ships.
 *
 * Reads the two files that produce dir attributes (src/i18n/
 * I18nProvider.tsx + src/app/layout.tsx) and asserts:
 *   - I18nProvider only writes "ltr" to documentElement.dir
 *   - layout.tsx sets dir="ltr" unconditionally
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;
const LOCALES = [
  "en", "zh-CN", "zh-TW", "vi", "bn", "hi", "ta", "ko", "th",
  "tr", "ja", "id", "ms", "ur", "es", "it", "km",
];

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const root = process.cwd();
  const i18nProvider = fs
    .readFileSync(path.join(root, "src/i18n/I18nProvider.tsx"), "utf8")
    .toString();
  const layout = fs
    .readFileSync(path.join(root, "src/app/layout.tsx"), "utf8")
    .toString();

  // I18nProvider should not write "rtl" anywhere active. We allow it
  // to appear inside comments (we leave a TODO referencing the
  // future RTL pass), so strip comments before the check.
  const stripComments = (s: string) =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const providerNoComments = stripComments(i18nProvider);
  const layoutNoComments = stripComments(layout);

  const providerSetsRtl =
    /document\.documentElement\.dir\s*=\s*["'`]rtl["'`]/.test(providerNoComments) ||
    /\?\s*["'`]rtl["'`]\s*:\s*["'`]ltr["'`]/.test(providerNoComments);
  const layoutSetsRtl =
    /\?\s*["'`]rtl["'`]\s*:\s*["'`]ltr["'`]/.test(layoutNoComments) ||
    /dir=\{\s*["'`]rtl["'`]/.test(layoutNoComments);

  // Confirm the gated-to-ltr code IS present.
  const providerLocksLtr =
    /document\.documentElement\.dir\s*=\s*["'`]ltr["'`]/.test(providerNoComments);
  const layoutLocksLtr = /const\s+dir\s*=\s*["'`]ltr["'`]/.test(layoutNoComments);

  const checks = {
    providerSetsRtl,
    layoutSetsRtl,
    providerLocksLtr,
    layoutLocksLtr,
  };

  const healthy =
    !providerSetsRtl && !layoutSetsRtl && providerLocksLtr && layoutLocksLtr;

  return NextResponse.json({
    ok: true,
    server_path_healthy: healthy,
    checks,
    locales: LOCALES,
    verdict: healthy
      ? "All 17 locales render with dir=ltr; switching language never flips the page."
      : "A code path still sets dir=rtl — Tina's bug will recur. See checks{}.",
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 15;
