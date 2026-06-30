# i18n auto-translation — refactor to local script

**Filed:** 2026-05-26
**Why:** `/api/cron/translate-missing-keys` is architecturally broken for
Vercel serverless and can never work in prod (read-only filesystem, no
git binary, no SSH credentials, 25 MB typescript dep bloat). Andrew tried
to run `fzcron translate-missing-keys -X POST -d '{"dryRun":true}'`
2026-05-26 07:16 UTC; got back a Next.js HTML error page. Vercel runtime
logs confirm the function never returned cleanly.

**The fix:** lift the translation orchestration out of the API route and
into `scripts/translate-i18n.ts`. The building blocks (`i18n-diff.ts`,
`i18n-translate.ts`, `i18n-writer.ts`) are correct — they just need a
CLI driver that runs on Andrew's Mac with full git + filesystem access.

This is the same pattern as `scripts/i18n-pre-commit.ts` which already
works for the pre-commit hook flow.

**Self-sufficient — no Andrew interaction required during execution.
Standing rules from CLAUDE.md "NON-NEGOTIABLE WORKFLOW RULES" apply.**

---

## Track 1 — Write `scripts/translate-i18n.ts`

CLI ergonomics — mirror the JSON-body shape the broken cron endpoint
expected so the command-line UX is familiar:

```bash
# Dry-run all 16 locales
npx tsx scripts/translate-i18n.ts --dry-run

# Real run — 500-key cap per locale (default)
npx tsx scripts/translate-i18n.ts

# Big catch-up — 1000-key cap per locale
npx tsx scripts/translate-i18n.ts --max-keys-per-locale 1000

# Single locale
npx tsx scripts/translate-i18n.ts --locales vi

# Single namespace within one locale
npx tsx scripts/translate-i18n.ts --locales vi --namespaces factoryPortal

# Multiple locales
npx tsx scripts/translate-i18n.ts --locales vi,ms,id

# Skip the English-copy fallback detection (only fill genuinely-missing keys)
npx tsx scripts/translate-i18n.ts --no-include-empty
```

The script does the same per-(locale × namespace) loop the cron did:

1. `diffLocale(locale)` — missing + empty keys
2. Apply `maxKeysPerLocale` cap
3. `groupByNamespace()` the candidate keys
4. For each (locale × namespace) pair:
   a. `translateBatch()` against Claude
   b. `writeTranslatedKeys()` (skipped in dry-run)
   c. `git add src/i18n/<locale>.ts`
   d. `git commit --no-verify -m "..."` (same commit message format
      the cron uses — `i18n(<locale>): auto-translate N key(s) in
      <namespace>\n\n<NATIVE-REVIEW-PENDING|NATIVE-REVIEW NEEDED>...`)
   e. `git push origin main`

Each (locale × namespace) becomes its own commit. Per-batch progress
streams to stdout so Andrew can watch it. Final summary prints:

```
Done. 142 keys translated across 8 (locale × namespace) batches.
Brand-voice retries: 7. Total cost: $4.32. Pushed 8 commits.

Per-locale:
  vi   — 42 keys / 3 ns / 2 retries / $1.18
  ms   — 28 keys / 2 ns / 1 retry  / $0.89
  ...
```

In dry-run mode, prints the diff + estimated cost but does not call
Claude or write/commit anything. (Different from the broken cron's
"dryRun still calls Claude" behavior — the local script's dry-run is
genuinely free.)

### Wiring

- Source `.env.local` for `ANTHROPIC_API_KEY` at script entry via
  `import "dotenv/config"` or manual `dotenv` loader. Confirm with
  `if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY
  not set — check .env.local"); process.exit(1); }`.
- CLI parsing — keep it simple, no extra dep. Manual `process.argv`
  walk is fine for ~5 flags.
- Use the existing `LOCALES` from `src/i18n/core.ts` — same source of
  truth as the cron used.
- Brand-voice grep already lives inside `translateBatch` — don't
  re-implement.
- Commit message format MUST exactly match what the cron generated so
  git log reads consistently for the multi-day translation history.

### TypeScript compilation note

`scripts/i18n-pre-commit.ts` already runs under tsx. Same pattern works
here. Don't add a separate build step.

---

## Track 2 — Add npm script + fzcron-equivalent zsh helper

Add to `package.json` scripts:

```json
"i18n:translate": "tsx scripts/translate-i18n.ts"
```

So `npm run i18n:translate -- --dry-run` works as well as direct
`npx tsx scripts/translate-i18n.ts --dry-run`.

Add a one-line snippet to CLAUDE.md ("Built Features" section or the
Auto-Translation Pipeline section) documenting the new local workflow:

```markdown
### Auto-translation — local execution

The /api/cron/translate-missing-keys route is non-functional on Vercel
(serverless can't write files or push git). The auto-translation
pipeline runs locally on Andrew's Mac via:

  npx tsx scripts/translate-i18n.ts --dry-run         # see scope + cost
  npx tsx scripts/translate-i18n.ts                   # 500-key cap
  npx tsx scripts/translate-i18n.ts --max-keys-per-locale 1000  # catchup

Each (locale × namespace) becomes one commit. Pushes to origin/main
incrementally so a leak can be rolled back per locale-per-namespace.

The pre-commit hook (scripts/i18n-pre-commit.ts) still works
unchanged — it auto-translates new en.ts entries on commit using the
same building blocks.
```

---

## Track 3 — Remove the broken cron from vercel.json + delete the route

The route at `src/app/api/cron/translate-missing-keys/route.ts` is
dead code. Same for `/api/cron/i18n-drift-report/route.ts` which has
the same pattern (Vercel-cron-scheduled, but the drift report email
itself doesn't need git push, so check whether THAT one survives — if
the drift report only needs to email Andrew, it can stay as a Vercel
cron).

Specifically:
- DELETE `src/app/api/cron/translate-missing-keys/route.ts`.
- INSPECT `src/app/api/cron/i18n-drift-report/route.ts` — if it only
  calls `diffAllLocales()` and emails the result, keep it; if it also
  tries to write files or push git, delete it too.
- Remove any vercel.json cron entry for `translate-missing-keys`.
- Keep the drift-report cron entry if the route survives.

Verify nothing else in the codebase imports from the deleted route.

---

## Track 4 — Verification

After Track 1-3 commits land:

1. Run `npx tsx scripts/translate-i18n.ts --dry-run` end-to-end. Should
   print per-locale missing+empty counts plus estimated cost. NO
   Claude calls, NO writes, NO git ops.
2. Run `npx tsx scripts/translate-i18n.ts --locales vi --namespaces
   factoryPortal --max-keys-per-locale 5` as a smoke test. Translates
   at most 5 Vietnamese keys in factoryPortal namespace, writes the
   file, commits, pushes. Verify Vercel green on the new commit.
3. Spot-check the committed file — open `src/i18n/vi.ts` and confirm
   the new keys carry actual Vietnamese (not English fallback) and
   pass the brand-voice grep (no "silver" / "nano" / "Ag" / Vietnamese
   transliterations).
4. Confirm no orphaned imports — `grep -r "translate-missing-keys"
   src/` should only return the deleted file's history-erased path,
   no live references.

---

## Done criteria

- `scripts/translate-i18n.ts` exists and runs end-to-end via tsx.
- `npm run i18n:translate -- --dry-run` works.
- CLAUDE.md documents the new local workflow.
- The Vercel-cron route is deleted.
- 5-key smoke test against Vietnamese factoryPortal lands a clean
  commit on main with valid translations.
- Code reports back with: commit SHAs, the dry-run output for all 16
  locales (so Andrew knows what a full run would cost), and the
  smoke-test commit URL.

---

## Why this matters

Andrew has spent multiple sessions watching the i18n translation
pipeline pretend to work on Vercel. The cron was specced as if Vercel
were just a long-running computer; it isn't. Lifting this to local-only
execution makes the actual workflow match the actual constraints:
file mutation + git push are local-machine operations, not serverless
operations. Vercel handles HTTP + serving runtime; Andrew's Mac handles
the translation grind.

This is the same architectural lesson from the auto-triage GitHub
Action pattern (CLAUDE.md "Stage 2 (outside Atlas, daily GitHub
Action)") — anything that needs a writable filesystem + git auth
belongs outside the Vercel runtime.
