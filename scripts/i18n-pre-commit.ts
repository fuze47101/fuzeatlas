/**
 * Phase 19 T6 — pre-commit auto-translate script.
 *
 * Runs from .husky/pre-commit when src/i18n/en.ts is staged.
 * Detects missing keys across all 16 non-English locales and
 * fans out auto-translations so the commit captures the en.ts
 * change + all 16 locale updates atomically.
 *
 * Falls back to a no-op + warning if ANTHROPIC_API_KEY is unset
 * or the Claude API is unreachable — never blocks a commit.
 */

import { execSync } from "child_process";
import * as path from "path";
import { LOCALES, type Locale } from "../src/i18n/core";
import { diffLocale, groupByNamespace, collectEnLeaves } from "../src/lib/i18n-diff";
import { translateBatch } from "../src/lib/i18n-translate";
import { writeTranslatedKeys } from "../src/lib/i18n-writer";

const REPO_ROOT = path.resolve(__dirname, "..");
const SKIP_FLAG = "FUZE_SKIP_I18N_HOOK";

function log(s: string) {
  process.stderr.write(`[i18n-pre-commit] ${s}\n`);
}

function isStaged(file: string): boolean {
  try {
    const out = execSync("git diff --cached --name-only", { cwd: REPO_ROOT, encoding: "utf8" });
    return out.split("\n").some((l) => l.trim() === file);
  } catch {
    return false;
  }
}

async function main() {
  if (process.env[SKIP_FLAG]) {
    log(`${SKIP_FLAG} set — skipping`);
    return;
  }
  if (!isStaged("src/i18n/en.ts")) {
    return; // No en.ts change → no work to do
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    log("ANTHROPIC_API_KEY not set — skipping (no auto-translate)");
    return;
  }

  log("en.ts is staged — diffing locales");

  const enMap = new Map(collectEnLeaves().map((l) => [l.path, l.enValue]));
  const targets = LOCALES.map((l) => l.code).filter((c) => c !== "en") as Locale[];
  let totalTranslated = 0;
  let totalRetries = 0;
  let totalCost = 0;

  for (const locale of targets) {
    const diff = await diffLocale(locale);
    const candidatePaths = [...diff.missingKeys, ...diff.emptyKeys];
    if (candidatePaths.length === 0) continue;

    // Hard cap per locale at 100 in the pre-commit path — keeps
    // commits fast. Larger backfills go through the cron.
    const capped = candidatePaths.slice(0, 100);
    const grouped = groupByNamespace(capped);

    for (const ns of Object.keys(grouped)) {
      const inputs = grouped[ns]
        .map((p) => ({ key: p, enValue: enMap.get(p) || "" }))
        .filter((x) => x.enValue);
      if (inputs.length === 0) continue;

      log(`  ${locale} · ${ns} · ${inputs.length} keys`);
      try {
        const out = await translateBatch({ locale, namespace: ns, keys: inputs });
        totalRetries += out.brandVoiceRetries;
        totalCost += out.estimatedCostUsd;
        if (out.translations.length > 0) {
          const wrote = await writeTranslatedKeys(
            locale,
            out.translations.map((t) => ({
              path: t.key,
              translatedValue: t.translatedValue,
            })),
          );
          totalTranslated += wrote.applied;
          if (wrote.applied > 0) {
            execSync(`git add ${JSON.stringify(`src/i18n/${locale}.ts`)}`, {
              cwd: REPO_ROOT,
              stdio: "ignore",
            });
          }
        }
        if (out.flagged.length > 0) {
          log(`    ⚠ ${out.flagged.length} key(s) flagged for manual review:`);
          for (const f of out.flagged) log(`      ${f.key} — ${f.reason}`);
        }
      } catch (e: any) {
        log(`    ! ${locale}/${ns} failed: ${e?.message || e}`);
      }
    }
  }

  log(`done — ${totalTranslated} keys translated, ${totalRetries} brand-voice retries, $${totalCost.toFixed(4)} est`);
}

main().catch((e) => {
  log(`fatal: ${e?.message || e}`);
  // Don't block the commit even on hard error
  process.exit(0);
});
