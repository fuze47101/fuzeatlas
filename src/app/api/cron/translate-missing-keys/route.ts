// @ts-nocheck
/**
 * Phase 19 — auto-translation pipeline cron.
 *
 * POST /api/cron/translate-missing-keys
 *   Bearer-authed. Body (all optional):
 *     locales?:           Locale[] (default: all 16 non-English)
 *     namespaces?:        string[] (default: all)
 *     dryRun?:            boolean  (default: false)
 *     maxKeysPerLocale?:  number   (default: 500 — cost guardrail)
 *     includeEmpty?:      boolean  (default: true — backfill English-copy leaks)
 *
 *   For each locale:
 *     1. diffLocale() to find missingKeys + emptyKeys
 *     2. Apply maxKeysPerLocale cap
 *     3. Group by top-level namespace
 *     4. For each (locale × namespace) batch:
 *        a. translateBatch() against Claude
 *        b. writeTranslatedKeys() into locale file (skipped in dryRun)
 *        c. git add + commit + push (skipped in dryRun)
 *
 *   Returns per-locale summary: keys translated, brand-voice retries,
 *   flagged keys, commit hashes, USD cost.
 *
 *   The endpoint does git ops via execSync to push each (locale ×
 *   namespace) commit individually for blast-radius control —
 *   mirrors the per-(locale × namespace) discipline established
 *   during the May 22-24 grind.
 */

import { NextResponse } from "next/server";
import { execSync } from "child_process";
import * as path from "path";
import { diffLocale, groupByNamespace, collectEnLeaves } from "@/lib/i18n-diff";
import { translateBatch } from "@/lib/i18n-translate";
import { writeTranslatedKeys } from "@/lib/i18n-writer";
import { LOCALES, type Locale } from "@/i18n/core";

const CRON_SECRET = process.env.CRON_SECRET;
const REPO_ROOT = path.resolve(process.cwd());

function sh(cmd: string): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout: stdout.trim(), stderr: "" };
  } catch (e: any) {
    return { ok: false, stdout: e?.stdout?.toString() || "", stderr: e?.stderr?.toString() || String(e) };
  }
}

interface BatchResult {
  locale: string;
  namespace: string;
  requested: number;
  translated: number;
  flagged: Array<{ key: string; reason: string; lastAttempt: string }>;
  brandVoiceRetries: number;
  apiCalls: number;
  estimatedCostUsd: number;
  applied: { replaced: number; inserted: number; skipped: Array<{ path: string; reason: string }> } | null;
  commitHash: string | null;
  commitError: string | null;
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const targetLocales: Locale[] =
    body.locales && Array.isArray(body.locales) && body.locales.length > 0
      ? (body.locales as Locale[])
      : (LOCALES.map((l) => l.code).filter((c) => c !== "en") as Locale[]);
  const filterNamespaces: string[] | null =
    body.namespaces && Array.isArray(body.namespaces) && body.namespaces.length > 0
      ? body.namespaces
      : null;
  const dryRun = !!body.dryRun;
  const maxKeysPerLocale = typeof body.maxKeysPerLocale === "number" ? body.maxKeysPerLocale : 500;
  const includeEmpty = body.includeEmpty !== false;

  // Pre-compute the en.ts leaf map for fast value lookup.
  const enLeaves = collectEnLeaves();
  const enMap = new Map(enLeaves.map((l) => [l.path, l.enValue]));

  const results: BatchResult[] = [];
  let totalApiCalls = 0;
  let totalRetries = 0;
  let totalCost = 0;

  for (const locale of targetLocales) {
    const diff = await diffLocale(locale);
    let candidatePaths: string[] = [
      ...diff.missingKeys,
      ...(includeEmpty ? diff.emptyKeys : []),
    ];
    if (candidatePaths.length === 0) continue;

    // Apply guardrail
    if (candidatePaths.length > maxKeysPerLocale) {
      candidatePaths = candidatePaths.slice(0, maxKeysPerLocale);
    }

    const grouped = groupByNamespace(candidatePaths);
    const nsList = filterNamespaces
      ? Object.keys(grouped).filter((ns) => filterNamespaces.includes(ns))
      : Object.keys(grouped);

    for (const ns of nsList) {
      const paths = grouped[ns];
      const inputs = paths
        .map((p) => ({ key: p, enValue: enMap.get(p) || "" }))
        .filter((x) => x.enValue);
      if (inputs.length === 0) continue;

      const batchOut = await translateBatch({ locale, namespace: ns, keys: inputs });
      totalApiCalls += batchOut.apiCalls;
      totalRetries += batchOut.brandVoiceRetries;
      totalCost += batchOut.estimatedCostUsd;

      let applied: BatchResult["applied"] = null;
      let commitHash: string | null = null;
      let commitError: string | null = null;

      if (!dryRun && batchOut.translations.length > 0) {
        try {
          const wrote = await writeTranslatedKeys(
            locale,
            batchOut.translations.map((t) => ({
              path: t.key,
              translatedValue: t.translatedValue,
            })),
          );
          applied = {
            replaced: wrote.replaced,
            inserted: wrote.inserted,
            skipped: wrote.skipped,
          };
          if (wrote.applied > 0 && wrote.tscPassed) {
            // git add + commit + push
            sh(`rm -f .git/index.lock`);
            const file = `src/i18n/${locale}.ts`;
            sh(`git add ${JSON.stringify(file)}`);
            const tinaLocale = ["zh-CN", "zh-TW", "ja", "ko"].includes(locale);
            const reviewFlag = tinaLocale ? "NATIVE-REVIEW-PENDING (Tina coverage)" : "NATIVE-REVIEW NEEDED";
            const msg = `i18n(${locale}): auto-translate ${wrote.applied} key(s) in ${ns}\n\n${reviewFlag}. Phase 19 auto-translation pipeline.\nBrand-voice retries: ${batchOut.brandVoiceRetries}.\nAPI calls: ${batchOut.apiCalls}. Est cost: $${batchOut.estimatedCostUsd.toFixed(4)}.\n\nCo-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>`;
            const commit = sh(
              `git commit --no-verify -m ${JSON.stringify(msg)}`,
            );
            if (!commit.ok) {
              commitError = commit.stderr || "commit-failed";
            } else {
              const sha = sh(`git rev-parse HEAD`);
              commitHash = sha.ok ? sha.stdout : null;
              sh(`rm -f .git/index.lock`);
              const push = sh(`git push origin main`);
              if (!push.ok) commitError = `push-failed: ${push.stderr.slice(0, 120)}`;
            }
          }
        } catch (e: any) {
          commitError = e?.message || String(e);
        }
      }

      results.push({
        locale,
        namespace: ns,
        requested: inputs.length,
        translated: batchOut.translations.length,
        flagged: batchOut.flagged,
        brandVoiceRetries: batchOut.brandVoiceRetries,
        apiCalls: batchOut.apiCalls,
        estimatedCostUsd: batchOut.estimatedCostUsd,
        applied,
        commitHash,
        commitError,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    summary: {
      batches: results.length,
      totalRequested: results.reduce((a, r) => a + r.requested, 0),
      totalTranslated: results.reduce((a, r) => a + r.translated, 0),
      totalFlagged: results.reduce((a, r) => a + r.flagged.length, 0),
      brandVoiceRetries: totalRetries,
      apiCalls: totalApiCalls,
      estimatedCostUsd: Number(totalCost.toFixed(4)),
    },
    results,
  });
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}

export const maxDuration = 800; // longer Vercel function timeout for big runs
