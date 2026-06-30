# Phase 19 — Auto-Translation Pipeline

**Date filed:** 2026-05-25
**Filed by:** Andrew (via Cowork session)
**Why now:** Phase 17 (real-time test tracking), Phase 18 (CSV importer), Phase 18.5 (contact importer), and every future feature will add new user-facing strings to `src/i18n/en.ts`. Without automation, every new feature creates 16 manual translation TODOs (one per non-English locale). The May 22-24 grind that took ~2,100 commits to bring all 17 locales to parity does NOT scale per-feature. We need: en.ts grows → auto-fan-out to all 16 locales → commit → done.

---

## STANDING RULES (read first)

1. **300-second auto-resume.** No check-ins between tracks.
2. **Brand voice strict.** Every auto-generated translation runs through the brand-voice grep before commit. ZERO silver/nano/Ag/silver-ion/銀/银/纳米/ナノ/나노/سلور/نانو/plata/gümüş/argento/perak/etc. matches in any translated value. If the grep catches a leak, retry that translation up to 3 times with explicit "do not use {banned_word}" guidance. If still leaks, skip and flag for manual review.
3. **Tina is the sole human reviewer.** Her coverage: zh-CN / zh-TW / ja / ko. For her 4 locales, auto-translations land with `NATIVE-REVIEW-PENDING` flag. The other 12 locales ship without human review (Claude-quality, flagged in commit body).
4. **Verify-after-every-push.** Vercel green + tsc clean + diag-all-surfaces green.
5. **Git workflow.** `rm -f .git/index.lock`, `--no-verify` on commit, one commit per (locale × namespace) for blast-radius control.
6. **NEVER auto-translate** competitor chemistry names, certification names, tier names (F1/F2/F3/F4), test method names (AATCC 100, ASTM E2149, ISO 20743, JIS L 1902, OEKO-TEX, bluesign®, EPA), product brand names (FUZE, Nike, Lululemon, Penfabric, etc.). These pass through verbatim.

---

## ARCHITECTURE OVERVIEW

Two execution modes:

**Mode A — Manual trigger** (Track 4):
- Admin runs `fzcron translate-missing-keys` from terminal
- Endpoint diffs each locale against `en.ts`, identifies missing leaf keys
- Calls Claude API per (locale × namespace) batch
- Commits + pushes per (locale × namespace)
- One CLI invocation can complete a full sync in 5-15 minutes

**Mode B — Pre-commit hook** (Track 6):
- Git hook on `src/i18n/en.ts` save: detect new/changed keys
- Triggers auto-translation as a pre-commit step
- Translated locale files staged alongside the en.ts change
- Single commit captures the en.ts change + all 16 locale updates atomically

Mode A is the primary delivery. Mode B is the nice-to-have that prevents drift from happening in the first place.

---

## TRACKS

8 tracks. Strict order.

### TRACK 1 — Diff helper (which keys are missing per locale)

New file: `src/lib/i18n-diff.ts`

Exports:
```typescript
diffLocale(locale: Locale): Promise<{
  locale: string;
  missingKeys: string[];        // dot-path keys missing entirely
  emptyKeys: string[];          // keys present but value is "" or English-copy
  totalEnKeys: number;
  totalLocaleKeys: number;
  coverage: number;             // 0.0 to 1.0
}>;

diffAllLocales(): Promise<{ /* same shape, all 16 */ }>;
```

Implementation:
- Walks `en.ts` exported object recursively, collects every leaf key as dot-path (`factoryPortal.intake.step1.fieldLabel.fabricWidth` etc.).
- Same walk on target locale file.
- Compares sets. Returns missing + empty.
- Empty-key detection: value === "" OR (value === enValue AND enValue is more than 3 words) — heuristic for "didn't translate, just copied".

### TRACK 2 — Claude API translation helper

New file: `src/lib/i18n-translate.ts`

Exports:
```typescript
translateBatch(opts: {
  locale: Locale;
  namespace: string;             // e.g. "factoryPortal.intake"
  keys: Array<{ key: string; enValue: string }>;
  context?: string;              // optional namespace blurb passed to Claude
}): Promise<Array<{ key: string; translatedValue: string }>>;
```

Implementation:
- Composes Claude API prompt:
  - System: locked brand voice rules (verbatim from `src/lib/fuze-knowledge.ts` + per-locale ban list).
  - User: the batch of keys + English values + target language + namespace context.
  - Output format: JSON `{ key: translated }` per row.
- Calls `claude-3-5-sonnet-latest` (or latest available). Uses `messages.create` with explicit JSON output.
- Validates response shape, retries with "fix format" message if malformed.
- Brand-voice grep on each translated value. If leak detected, retry that specific key with explicit "do not use {leaked_word}" guidance (max 3 retries per key).

Per-locale instructions (these become part of the Claude prompt):
- **zh-CN:** Simplified Chinese, mainland conventions. Use 超材料 for metamaterial.
- **zh-TW:** Traditional Chinese, Taiwan conventions (软體 not 软件, 滑鼠 not 鼠标, etc.). Use 超材料 for metamaterial.
- **ja:** Japanese, 敬語 (formal). Use メタマテリアル for metamaterial.
- **ko:** Korean, 존댓말 (formal). Use 메타물질 for metamaterial.
- **vi:** Vietnamese, full diacritics. Use "vật liệu siêu cấp" or "metamaterial" verbatim.
- **bn:** Bengali (Bangladesh conventions), Bengali script. Use মেটাম্যাটেরিয়াল for metamaterial.
- **hi:** Hindi, Devanagari, technical register. Use मेटामटीरियल for metamaterial.
- **ta:** Tamil, professional register. Use மெட்டாமெட்டீரியல் for metamaterial.
- **th:** Thai, formal register. Use เมตาวัสดุ or metamaterial verbatim.
- **id:** Indonesian, accepts loanwords. Use metamaterial verbatim.
- **ms:** Malaysian Malay (distinct from id). Use metamaterial or "bahan meta" verbatim.
- **ur:** Urdu, formal, RTL-aware. Use میٹامیٹیریل for metamaterial.
- **es:** Spanish, neutral. Use metamaterial verbatim.
- **it:** Italian, standard formal. Use metamateriale.
- **tr:** Turkish, modern. Use metamateryal.
- **km:** Khmer, industrial register. Use មេតាមេតារៀល for metamaterial.

### TRACK 3 — Locale file writer (preserve TS structure)

New file: `src/lib/i18n-writer.ts`

Exports:
```typescript
writeTranslatedKeys(opts: {
  locale: Locale;
  translations: Array<{ key: string; translatedValue: string }>;
}): Promise<void>;
```

Implementation:
- Reads existing `src/i18n/<locale>.ts` as text.
- For each translation, find the existing key (if present) and replace its value, OR append to the appropriate namespace.
- Preserves TypeScript syntax, indentation, comments, namespace structure.
- Uses an AST-aware approach (parse with `@babel/parser` or similar, walk + mutate, regenerate) — NOT raw string replacement (too fragile with nested objects).
- Validates output with `npx tsc --noEmit` on the modified file before write. If tsc fails, error out (don't corrupt the file).

### TRACK 4 — `translate-missing-keys` cron endpoint

New: `POST /api/cron/translate-missing-keys`

Bearer-authed. Body:
```typescript
{
  locales?: Locale[];           // default: all 16 non-English
  namespaces?: string[];        // default: all
  dryRun?: boolean;             // default: false
  maxKeysPerLocale?: number;    // default: 500 — stops runaway costs
}
```

Steps:
1. For each locale, run `diffLocale()` from Track 1.
2. Group missing keys by namespace.
3. For each (locale × namespace) batch:
   a. Call `translateBatch()` from Track 2.
   b. If `dryRun`, return what would be translated.
   c. Else: write to locale file via Track 3.
   d. Git stage + commit + push (one commit per locale × namespace).
4. Return summary: `{ locale, namespace, keysTranslated, commitHash, brandVoiceLeaksFlagged }`.

Use shell calls (`execSync`) for git operations from within the endpoint — same pattern Code already uses.

### TRACK 5 — Run-on-demand from CLI

Add `fzcron` alias for the new endpoint (it already supports POST):
```bash
fzcron translate-missing-keys -X POST -d '{"locales":["vi"], "namespaces":["factoryPortal.intake"]}'
```

Document in CLAUDE.md.

### TRACK 6 — Pre-commit hook (Mode B)

New: `.husky/pre-commit` script (or extend existing).

When `src/i18n/en.ts` is staged for commit:
1. Run `npx tsx scripts/i18n-pre-commit.ts`
2. That script:
   - Reads the current en.ts
   - Runs `diffAllLocales()` to find missing keys (likely the new ones the developer just added)
   - Calls the translate endpoint in dryRun=false mode
   - Git-stages the modified locale files alongside the en.ts change
3. Original commit proceeds with all locale files included.

This means: when a developer adds 5 new keys to en.ts and commits, the commit automatically includes the translated values in all 16 other locale files. Zero manual follow-up.

Edge case: if Claude API is unreachable, fall back to skipping translation (with a console warning). Translator can run `fzcron translate-missing-keys` manually later. Don't block commits on API availability.

### TRACK 7 — Weekly drift-detection cron

New: `GET /api/cron/i18n-drift-report`

Scheduled weekly via `vercel.json`. Runs `diffAllLocales()` and emails Andrew if any locale has > 10 missing keys (signals that Track 6 hook is failing or someone is committing en.ts changes without the hook firing).

Email body: per-locale coverage % + count of missing keys + suggested `fzcron translate-missing-keys` invocation.

### TRACK 8 — `/admin/i18n/review` page integration

Phase 16 shipped `/admin/i18n/review` for native-speaker review tracking. Extend it with:
- "Coverage" column per locale (from `diffLocale()`)
- "Run auto-translate" button per locale that triggers `fzcron translate-missing-keys` scoped to that locale
- "Last auto-translation run" timestamp
- "Last brand-voice leak caught + retried" log

---

## DONE CRITERIA

- [ ] `fzcron translate-missing-keys` invokable from CLI, dry-run mode shows correct missing-key counts.
- [ ] Adding a single new key to en.ts + committing via the pre-commit hook produces an atomic commit with all 16 locale files updated.
- [ ] Brand-voice grep across all 17 locales after 1 full pipeline run: ZERO leaks.
- [ ] Weekly drift cron added to vercel.json + tested manually.
- [ ] `/admin/i18n/review` shows coverage % per locale + per-locale "Run auto-translate" button.
- [ ] CLAUDE.md updated with the pipeline pattern + how to use it.
- [ ] `fzcron diag-all-surfaces` green.

---

## OUT OF SCOPE (Phase 19.X follow-ups)

- Human-in-the-loop review queue (translator reviews + approves each translation before commit) — Phase 19.5
- Multi-model fallback (try GPT-4 if Claude rate-limits) — Phase 19.5
- Translation memory (cache prior translations to avoid re-translating identical English strings) — Phase 19.5
- Glossary management UI (admin maintains a list of locked-translation terms) — Phase 19.5

---

## COST GUARDRAILS

Each translation batch costs ~$0.01-0.05 in Claude API calls depending on namespace size. Full 16-locale × 38-namespace catchup = ~$5-20 per run. Cron throttled to weekly maximum to prevent runaway costs.

Set ANTHROPIC_API_KEY in Vercel env (already present per CLAUDE.md). Track API spend per run + log to `Notification` so Andrew can monitor.

---

## REPORT BACK

```
Per-track status:
T1 (diff helper) — ✅ shipped <hash>
T2 (Claude API translator) — ...
T3 (locale file writer) — ...
T4 (translate-missing-keys cron) — ...
T5 (CLI integration) — ...
T6 (pre-commit hook) — ...
T7 (drift cron) — ...
T8 (admin UI integration) — ...

Brand-voice retries triggered (count): <number>
Brand-voice leaks unresolved after 3 retries (flagged): <list>
API cost for first full pipeline run: $<amount>
fzcron diag-all-surfaces: ✅ / ❌
```
