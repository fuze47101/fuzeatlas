# Multi-track Spec — Tina recovery + full i18n rollout

**Date filed:** 2026-05-19
**Filed by:** Andrew (via Cowork session)
**Blocking:** Tina demo + multilingual customer expansion (SRS-Turkey, Mercado Global, Global Shine, Hi-Goal, plus Penfabric/Welspun/KK Chan in Asia)
**Outage status:** Railway recovered ~22:43 UTC. Safe to push.

## Context

Today's session surfaced four classes of work that all need to ship in the next 24 hours:

1. **Four staged-but-uncommitted bug fixes** sitting in the working tree from the live call with Tina + Danny earlier today.
2. **i18n completion** — zh-CN coverage is only ~35% because 14 namespaces are missing AND `src/lib/modules.ts` uses hardcoded English strings instead of translation keys.
3. **Full multilingual rollout** — Andrew wants ja, es, tr brought up to parity with zh-CN, not left at deepFallback.
4. **Tina's latest ticket batch** — multiple new support tickets need triage + resolution. Source of truth is `/admin/feedback` (or `fzcron feedback-list` for the JSON).

This spec gives Code a complete, multi-track plan with strict ordering so we don't ship broken pieces mid-flight.

---

## STAGED-BUT-UNCOMMITTED CHANGES (start here — do not undo these)

Four edits sit in the local working tree from earlier in the session. Code MUST preserve them. They are:

1. **`src/components/Sidebar.tsx`** —
   - Line ~149: destructured `loading` from `useAuth()`
   - Line ~715: ViewAsSwitcher conditional changed to `(loading || user?.role === "ADMIN" || impersonation?.active)` so the button doesn't flicker out on every refresh during auth hydration.
   - Lines ~334-357: Distributor BD links wrapped in `...(user?.canClaim ? [...] : [])` so pure distributors (Danny) don't see BD wizard / scoreboard / pipeline. BD-rep distributors (Jeremy, Kathir, Tandy, Scott Smith) still get them via `canClaim: true`.

2. **`src/app/home/page.tsx`** —
   - Lines ~117-178: First 5 shortcut bar tiles (BD Wizard, KPI Dashboard, Orders, Pipeline, ICP Sample Prep) wrapped in `{isInternal && ...}` / `{isAdmin && ...}` role gates.

3. **`src/i18n/zh-CN.ts`** —
   - New `home:` namespace inserted between `common:` and `dashboard:` with full Simplified Chinese translations for the 6 module card titles + blurbs + greeting + subtitle + quickJump label.

4. **`src/app/api/admin/brands/[id]/suggestions/route.ts`** —
   - POST handler rewritten to use `userId` (correct field) instead of `authorId` (didn't exist, was silently 500ing). Wrapped in try/catch with explicit error response so future schema mismatches surface.
   - Also added `date: new Date()` field to the Note create.

5. **`src/app/admin/brands/[id]/fabrics/page.tsx`** —
   - Split FUZE # column from Mill Fabric # column. CSV export reordered to match.

6. **`src/app/api/cron/seed-sanmar/route.ts`** —
   - Added `ensureBrandFactoryLink()` helper that upserts BrandFactory + SupplyChainLink rows for every (brand, factory) pair touched.
   - Added `nextFuzeNumber()` helper using `max(fuzeNumber) + 1` pattern. Every newly-inserted fabric gets a number; every existing fabric missing one gets backfilled on update.

7. **`src/app/api/cron/backfill-brand-factory-links/route.ts`** (NEW file) — bearer-authed migration endpoint that derives BrandFactory + SupplyChainLink from every fabric's `factoryId`. Optional `?brandId=` scope. Idempotent.

8. **`src/app/api/cron/diag-brand-fabrics/route.ts`** (NEW file) — generic bearer-authed diag for any brand's fabric portfolio readiness.

**Do not undo any of these. If you refactor a file that contains one of these edits, preserve the existing logic and extend.**

---

## TRACK STRUCTURE

Four parallel tracks. Track A and Track D are blocking; B and C can ship in parallel after A lands.

### Track A — Ship staged fixes (DO FIRST, takes ~5 minutes)

Commit + push the 8 changes listed above as a single commit. Do not touch i18n or modules.ts in this commit — keep it surgical so if anything breaks, the blast radius is small.

**Commit message:**
```
fix: live-call escalation cleanup (Tina + Danny, 2026-05-19)

Six bugs caught during today's live call with Tina (SanMar demo) +
Danny (distributor screenshot):

1. ViewAsSwitcher flickered out on every page refresh because
   useAuth() returns user=null during the ~100ms hydration window
   and the conditional hid the component. Now guards on
   `loading || user?.role === "ADMIN" || impersonation?.active`
   so admin slot stays rendered across the entire load lifecycle.

2. Pure distributors (Danny) saw BD Wizard / Scoreboard / Pipeline
   links in their sidebar — meant only for BD-rep distributors
   (Jeremy, Kathir, Tandy, Scott Smith). Gated on `user.canClaim`
   so only BD-eligible distributors see the BD group.

3. /home shortcut bar leaked admin/BD tiles to non-internal users
   during the redirect-to-portal window. Role-gated first 5 tiles
   on isInternal / isAdmin.

4. Brand suggestions Dismiss button silently 500'd because the POST
   route used 'authorId' but the Note model field is 'userId'.
   Schema-drift fix + try/catch with explicit error surface.

5. /admin/brands/[id]/fabrics conflated FUZE # and Mill Fabric # in
   a single column ('FUZE-2512' alongside 'PT-WX-31997-2' under
   the same header). Split into two columns. CSV export reordered.

6. seed-sanmar now auto-assigns fuzeNumber via nextFuzeNumber()
   AND upserts BrandFactory + SupplyChainLink rows for every
   factory it touches — keeps the Factories tile count + the
   'No factory linked' suggested-next-move card in sync with the
   real supply chain. Sibling /api/cron/backfill-brand-factory-links
   endpoint runs the same upsert across every brand globally.

Also adds: /api/cron/diag-brand-fabrics?brand=NAME — generic
read-only readiness check for any brand's fabric portfolio.

Closes: Tina ticket batch from 2026-05-19 call (View As + Dismiss
+ FUZE/Mill column overlap + Factories tile = 1).
```

After push, verify on Vercel green. Then run:

```bash
fzcron 'diag-brand-fabrics?brand=SanMar'
```

Expect: 200, 18 fabrics, 9 distinct factories via fabrics, BrandFactory count = 9, SupplyChainLink count = 9.

If those numbers come back wrong, stop and investigate before moving to Track B.

### Track B — i18n completion pass (~3-4 hours)

This is the original spec at `/Users/a801/Desktop/fuzeatlas/specs/2026-05-19-i18n-completion-pass.md`. Read it in full. Execute it. Key elements (do not skip):

**Phase 1: Add 14 missing namespaces to `zh-CN.ts`:**
- `accounts`, `ordersDashboard`, `distributorPortal`, `restock`, `batches`, `verify`, `factoryPortal` (verify whether existing one is current), `settings`, `fabricTimeline`, `portalFeed`, `library`, `admin`, `brandPortal`, `labPortal`, `productDocs`.
- Translate every key value to proper Simplified Chinese. **Do not copy English.**
- Brand voice non-negotiable: NEVER use 银 (silver), 银离子, 纳米, 纳米银, Ag, silver-ion, or any variant in any value. Use 超材料 (chāocáiliào) for "metamaterial." Keep FUZE / F1-F4 / AATCC / ISO / EPA / OEKO-TEX / bluesign literal. See `CLAUDE.md` Critical Brand Language table.

**Phase 2: Refactor `src/lib/modules.ts` to use translation keys.**
- Define new `modules:` namespace in `en.ts` with keys for every item label + blurb.
- Add `labelKey?: keyof typeof t.modules` field to `ModuleItem` type (keep `label` as fallback for back-compat).
- Update consumers in `src/app/home/page.tsx` (ModuleCard) + `src/components/Sidebar.tsx` (scoped sidebar items) to render via `t.modules[item.labelKey] || item.label`.

**Phase 3: /home shortcut bar uses `t.modules.*` keys.**
- Lines ~117-178 of `src/app/home/page.tsx`. Reuse Phase 2 keys for tiles that map to a module item; add `home.shortcuts:` namespace for the rest (Notifications, My Profile, Email Templates).
- Verify the role gates I staged on the first 5 tiles survive the refactor; extend the same logic to the remaining 5 tiles.

**Phase 4: PORTAL SIDEBARS — DEFER UNLESS TIME ALLOWS.**
- `src/components/Sidebar.tsx` has hardcoded item lists for `isFactoryUser`, `isBrandUser`, `isDistributorUser`, `isLabUser`. Same treatment as Phase 2 — define keys, reference them. **Don't ship this in the same commit as Phase 1-3.** It's a larger refactor and a worse-than-usual rollback risk if anything breaks. File this as Phase 4 and tackle in a separate commit AFTER Phase 1-3 lands and is verified.

**Commit Phase 1-3 as one commit. Phase 4 (if attempted) as a separate commit.**

### Track C — ja.ts / es.ts / tr.ts parity (~2-3 hours, can run in parallel with Track B)

Today's audit found that `ja.ts`, `es.ts`, `tr.ts` are missing even more namespaces than `zh-CN.ts`. Bring them to parity:

**Step 1 — diff against en.ts** for each locale and identify which namespaces are missing. Use the same audit logic as Track B Phase 1. Expected gaps:

- All three are missing the `home:` namespace.
- Likely missing same 14 namespaces as zh-CN.
- Probably also missing some namespaces zh-CN has (because zh-CN got more love).

**Step 2 — translate every missing namespace** in each locale:
- **ja** — proper Japanese (敬語 for formal UI; product names stay literal).
- **es** — neutral Spanish (Latin American / Spain-neutral; avoid regional slang).
- **tr** — proper Turkish (Latin script, no ottoman archaisms). Customer context: SRS-Turkey, Zen Kem Kimya.

**Step 3 — brand voice locked in EVERY language:**
- Never translate "FUZE", "F1", "F2", "F3", "F4".
- "Metamaterial" stays as a literal English word transliterated when needed (ja: メタマテリアル, es: metamaterial, tr: metamateryal). Never use silver-equivalent words: 銀, plata, gümüş for any active-ingredient reference.
- Test/certification names stay literal in every language: AATCC 100, ASTM E2149, ISO 20743, OEKO-TEX Standard 100 Class I, bluesign®, EPA, PFAS-free.

**Step 4 — verify with diff grep** before push:
```bash
grep -i -E "silver|nano|nanopart|silver-ion|silver ion" src/i18n/zh-CN.ts src/i18n/ja.ts src/i18n/es.ts src/i18n/tr.ts
grep -E "銀|银|纳米|纳米银|plata|gümüş" src/i18n/zh-CN.ts src/i18n/ja.ts src/i18n/es.ts src/i18n/tr.ts
```
Both greps must return ZERO matches.

**Commit Track C as one commit per locale** (one for ja, one for es, one for tr). Easier to revert one bad translator pass than three.

### Track D — Tina's new ticket batch (do AFTER Track A, parallel with B/C)

Pull the open ticket queue:

```bash
fzcron feedback-list
```

That returns JSON of every `FeedbackReport` row in NEW / TRIAGED / ACCEPTED / IN_PROGRESS status. Filter to Tina's tickets from today (`reporterEmail` contains "tina" or `createdAt >= 2026-05-19T00:00:00Z`).

For each ticket:
1. Read the ticket body + screenshot + browser URL.
2. Classify: bug / UX gap / data drift / feature request.
3. If it's a BUG with a concrete file/page target → attempt a fix. One PR per ticket on branch `auto/<ticketId>`.
4. If it's a UX gap that needs Andrew's product call → mark as ACCEPTED + drop a note explaining the proposed approach, do not attempt a fix.
5. If it's a feature request → mark as ACCEPTED + add to Phase 16 wishlist.
6. If it's data drift (specific record needs fixing) → write a one-off bearer-authed `/api/cron/fix-<ticketId>` endpoint; do not run Prisma scripts locally (DSN drift).

Cap at 8 PRs from this track to avoid PR-review fatigue. If there are >8 tickets, prioritize: (1) anything blocking the Tina demo, (2) anything affecting > 1 user, (3) the rest.

**Per-ticket resolve protocol** when shipping a fix:
```bash
fzcron admin-resolve -X POST \
  -H "Content-Type: application/json" \
  -d '{"feedbackId":"<id>","newStatus":"FIXED","resolution":"<one-line summary>","notify":true}'
```

That posts to the bearer-authed admin-resolve endpoint, marks the ticket FIXED, and emails Tina the close-loop notification.

---

## STANDING RULES (READ BEFORE TOUCHING ANYTHING)

These are non-negotiable. Listed in `CLAUDE.md` and enforced session-wide.

1. **Brand voice.** FUZE / metamaterial / F1-F4 only. NEVER silver, nano, nanoparticle, silver-ion, water-based silver, Ag, 银, 纳米, plata, gümüş, etc. — in any code, comment, translation, default email template, error message, or anywhere a user could see it. Compliance docs (CIL, ARSL, SDS) may use chemical names; marketing + UI may not. Source of truth: `src/lib/fuze-knowledge.ts`.

2. **Verify-after-every-push.** Wait for Vercel green AND `fzcron diag-all-surfaces` green between every commit. Do not chain commits without verification.

3. **Error-state-not-zeros.** Every dashboard widget must surface an explicit error banner on API 500 — never silently fall through to zeros. The Tina-Penfabric all-zero stats bug was the trigger; this is now a standing rule.

4. **Bearer-authed runtime migration pattern.** Local DATABASE_URL points at an empty mirror. Don't try to run Prisma scripts from Andrew's Mac for one-off data fixes — write a bearer-authed `/api/cron/migrate-<scope>` or `/api/cron/fix-<scope>` endpoint instead, run via `fzcron`.

5. **Git workflow.** Always `--no-verify` on commits (ESLint pre-commit hook is broken). `rm -f .git/index.lock .git/HEAD.lock` before every commit (FUSE-mount idiosyncrasy). `prisma db push` for schema changes (not `prisma migrate deploy`).

6. **Auto-close from commit message.** Reference a `FeedbackReport` cuid (`cm[a-z0-9]{24}`) in the commit body to auto-close that ticket via the hourly `/api/cron/auto-resolve-from-commits` cron. Example: `Closes cmot3i3pk00iijo04hgcjcvyf`.

7. **`fzcron` POST.** `fzcron` was GET-only originally. It now forwards `-X POST -d` args. Used like `fzcron seed-sanmar -X POST`, `fzcron admin-resolve -X POST -H "Content-Type: application/json" -d '...'`.

8. **diag-all-surfaces.** After every multi-file commit, run `fzcron diag-all-surfaces` and confirm green. If a new dashboard widget or API surface is added, ALSO add a smoke check entry to `diag-all-surfaces` in the same commit.

---

## ORDER OF OPERATIONS

Strict. Do not deviate.

1. **Track A** (5 min) — push staged fixes, verify Vercel green + diag-brand-fabrics SanMar green.
2. **Track D triage** (30 min) — pull ticket list, classify into bug/gap/feature/data piles. Don't fix anything yet — just classify.
3. **Track B Phase 1-3** (3 hours) — i18n completion for zh-CN. Push as one commit. Verify by manual /home + Chinese toggle.
4. **Track D bug fixes** (variable) — work through the BUG-classified tickets one at a time. One PR per ticket.
5. **Track C** (2-3 hours) — ja/es/tr parity. Push as three separate commits (one per locale).
6. **Track B Phase 4 (DEFERRED)** — portal sidebars i18n. Only if time allows AFTER everything else lands clean.

---

## DONE CRITERIA

This spec is "done" when ALL of the following are true:

- [ ] Staged fixes pushed; Vercel green; SanMar fabric portfolio renders with `Factories: 9` tile and Dismiss buttons work.
- [ ] `/home` in Chinese: greeting, subtitle, all 6 module card titles + blurbs, every visible sidebar item, every shortcut tile is in Chinese.
- [ ] `/home` in Japanese, Spanish, Turkish: same coverage as Chinese.
- [ ] Brand-voice diff grep returns ZERO matches across all four locale files.
- [ ] At least 5 of Tina's open tickets resolved to FIXED status with close-loop emails sent.
- [ ] `fzcron diag-all-surfaces` green.
- [ ] No regression in `/admin/brands/cmm5e21b304lxo8tr8801tmmu/fabrics` (the SanMar portfolio Tina is demoing).

---

## ESCALATION

If you hit something this spec doesn't cover:

- **Schema drift** (Prisma "Unknown field" / "Unknown argument" runtime errors) — schema drift is the #1 cause of silent 500s in this codebase. Pattern: a `select` or `where` references a field/relation that doesn't exist. Fix the call site, don't change the schema unless you know exactly what you're doing. See `CLAUDE.md` "Built Features (Sessions — May 12-16, 2026)" section for the 12 fixes shipped that week.

- **Build breaking** — most common cause this codebase: Next.js 15 Promise-based route params (`{ params: Promise<{ id: string }> }`) used with `params.id` instead of `await params`. Fix the call site.

- **Translation ambiguity** — if a key's English value is ambiguous in context (e.g. "Submit" could mean form-submit, sample-submit, or report-submit), look at the call site to disambiguate before translating. Don't ship a translation that's literally accurate but contextually wrong.

- **Anthropic credits / Claude API errors** — Atlas's MB-3 narration + BD coach + FAQ chat call Claude. If credits low, all four go silent. Andrew tops up at console.anthropic.com.

- **Vercel cron silently not firing** — check middleware exemption first. `/api/cron/*` must be in `PUBLIC_PATHS` (`src/middleware.ts`), or Vercel Cron's Bearer-only auth never reaches the handler.

Anything else: ping Andrew via thumbs-down on a tool call. Don't keep going if uncertain.
