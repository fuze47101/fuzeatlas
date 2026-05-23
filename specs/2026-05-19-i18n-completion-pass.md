# i18n Completion Pass — Tina-blocking translation gap

**Date filed:** 2026-05-19
**Filed by:** Andrew (via Cowork session)
**Blocking:** Tina demo (Spanx + SanMar fabric portfolio walkthrough)
**Customer-reported on call:** "Not a single thing is in Chinese on the home page."

## Background

Atlas has had an i18n framework in place for weeks (`src/i18n/` with `useI18n()`, `I18nProvider`, `deepFallback` to English). The framework works. The problem is **the wiring is incomplete in two distinct ways:**

1. **Missing namespaces in non-English locale files.** `zh-CN.ts` is missing 14 namespaces relative to `en.ts`. So even when a page IS threaded through `useI18n()`, switching to Chinese silently falls back to English for any key under a missing namespace.

2. **Hardcoded English strings in core nav surfaces.** `src/lib/modules.ts` defines the 6 module cards on `/home` and the scoped sidebar items beneath each. All 36 sidebar item labels + 10 home shortcut bar tiles are hardcoded English — they bypass i18n entirely. No translation key exists for them.

Result: when Tina switches to Chinese, she sees Chinese page titles + greetings but every navigation item and sidebar entry stays English. It looks half-broken. She told Andrew "nothing is translated" — and from her POV, she's right.

This spec is the comprehensive cleanup to get coverage from ~35% → ~85% for Chinese (and also patches `ja`, `es`, `tr` for symmetry).

## Scope

### Phase 1 — Add 14 missing namespaces to `zh-CN.ts` (highest priority)

Reference: `src/i18n/en.ts` is the source of truth for namespace structure + key names. **Translate every key value, do not copy English.**

Namespaces to add to `src/i18n/zh-CN.ts`:

1. `accounts` — Accounts page (brands past Lead stage)
2. `ordersDashboard` — `/admin/orders-dashboard`
3. `distributorPortal` — `/distributor-portal/*` strings
4. `restock` — `/distributor-portal/restock/*`
5. `batches` — Production batches surface
6. `verify` — Public verification + hangtag QR pages
7. `factoryPortal` — `/factory-portal/*` (Andrew's note: factoryPortal already exists; verify whether it's the new one or stale)
8. `settings` — `/settings/*` family
9. `fabricTimeline` — Fabric timeline component
10. `portalFeed` — Cross-portal activity feed
11. `library` — `/fabric-library` and `/compliance-library`
12. `admin` — `/admin/*` family (top-level admin pages)
13. `brandPortal` — `/brand-portal/*` strings
14. `labPortal` — `/lab-portal/*` strings
15. `productDocs` — `/admin/product-documents`

For each namespace, walk `en.ts` to get every key, write proper Simplified Chinese translation. Use the same patterns and tone established in already-translated namespaces (e.g. `brands`, `dashboard`, `home` — see them for voice reference).

**Brand voice rules (NON-NEGOTIABLE):**
- **NEVER** translate "FUZE" — it's the brand name. Leave it as "FUZE" in every locale.
- **NEVER** translate "metamaterial" via a chemistry-evoking word. Use 超材料 (chāocáiliào) — the standard Chinese term for metamaterial in physics/materials science. Do NOT introduce silver / 银 / nano / 纳米 anywhere.
- **NEVER** use 银 (silver), 银离子, 银纳米, 纳米银 in any translation. The brand voice is "FUZE / metamaterial" only. See `CLAUDE.md` Critical Brand Language table.
- Tier names (F1, F2, F3, F4) stay literal — do not translate.
- Test names (AATCC 100, ASTM E2149, ISO 20743, OEKO-TEX, bluesign®, EPA) stay literal.

### Phase 2 — Refactor `src/lib/modules.ts` to use translation keys

Every item in the `MODULES` array has hardcoded `label` + `blurb` strings. Goal: replace hardcoded strings with i18n key references so the items translate everywhere they render (the home cards AND the scoped sidebar).

Approach:

1. **Define a new `modules:` namespace in `en.ts`** with keys for every module item label + blurb. Key naming convention:
   ```
   modules: {
     bdWizard: "BD Wizard",
     bdWizardBlurb: "Outreach automation for cold leads",
     kpiDashboard: "KPI Dashboard",
     ...
   }
   ```

2. **Change `src/lib/modules.ts`** so item labels reference a key, not a string. Two ways to do this — pick whichever causes the least churn at call sites:

   **Option A (preferred):** Add a `labelKey` field to `ModuleItem` (and `blurbKey` where applicable). Keep `label` as a fallback English string for back-compat / non-i18n call sites. Then update consumers (`src/app/home/page.tsx` ModuleCard, `src/components/Sidebar.tsx` scoped sidebar renderer) to use `t.modules[item.labelKey] || item.label`.

   **Option B:** Move modules.ts to a hook (`useModules()`) that takes `t` and returns the fully-translated MODULES array. More invasive but cleaner long-term.

   Use Option A for this pass. Option B can be a future refactor.

3. **Add the same `modules:` namespace to `zh-CN.ts`** with all keys translated. Translate every item label + blurb. (And to `ja.ts` / `es.ts` / `tr.ts` if you have bandwidth — otherwise leave them and let deepFallback handle it for now.)

4. **Update consumers:**
   - `src/app/home/page.tsx` — the `ModuleCard` component uses `m.label` and `m.blurb`. Switch to `t.modules[m.labelKey] || m.label`.
   - `src/components/Sidebar.tsx` — the scoped-module sidebar renders items with `item.label`. Same treatment.
   - The existing `translatedModules` block in `src/app/home/page.tsx` (lines 57-74) currently does this for the 6 module group labels — extend the same pattern to each item under each group.

### Phase 3 — Refactor `/home` shortcut bar

`src/app/home/page.tsx` lines 117-178 have 10 hardcoded tile labels: "🪄 BD Wizard", "📊 KPI Dashboard", "📦 Orders", "🔥 Pipeline", "⚖️ ICP Sample Prep", "🔔 Notifications", "📋 Documents", "🎓 Education", "👤 My Profile", "✉️ Email Templates".

These can reuse the new `modules:` namespace keys from Phase 2 (e.g. `t.modules.bdWizard`, `t.modules.kpiDashboard`). For tiles not represented in the `MODULES` array (Notifications, My Profile, Email Templates), add the keys to the same `modules:` namespace or to a sibling `home.shortcuts:` namespace — your call.

Also: **role-gate the shortcut bar entries.** A previous fix in this same Cowork session already wrapped the first 5 tiles in `{isInternal && ...}` / `{isAdmin && ...}` checks (see `src/app/home/page.tsx` diff staged locally). Verify those gates are still in place after your refactor and extend them to the remaining 5 tiles (Notifications, Documents, Education, My Profile, Email Templates — these are fine for all roles, but confirm the role logic is consistent).

### Phase 4 — Portal sidebars (LATER — do not ship in this pass unless time allows)

`src/components/Sidebar.tsx` has separate hardcoded item lists for `isFactoryUser`, `isBrandUser`, `isDistributorUser`, `isLabUser`. These are also fully hardcoded English. Same treatment as Phase 2: define keys, reference them, add zh-CN values.

**Defer this to Phase 16 unless Phases 1-3 leave you time today.** Phase 1-3 alone get the most visible nav surfaces into Chinese.

## Verification

Before pushing:

1. **TypeScript build green:** `npm run typecheck` (or `npx tsc --noEmit`).
2. **Linter clean:** `npx eslint .` — no new errors.
3. **Manual smoke test in dev:**
   - Run `npm run dev`
   - Visit `/home` → switch language picker to 🇨🇳 简体中文 → confirm: greeting, subtitle, all 6 module card titles + blurbs, every sidebar item under the scoped module, every visible shortcut tile is in Chinese.
   - Click into a module (e.g. Operations) → confirm scoped sidebar items are in Chinese.
   - Switch back to 🇺🇸 English → confirm everything reverts cleanly.
   - Repeat the switch test on `/admin/brands/cmm5e21b304lxo8tr8801tmmu/fabrics` (SanMar fabric portfolio).
4. **Diff review:** Run `git diff` on `src/i18n/zh-CN.ts` and confirm: no English words leaked into Chinese values (other than FUZE, F1-F4, test method names, certifications). Search the diff for `silver`, `nano`, `银`, `纳米`, `Ag` — should return zero matches in translated values.

## Push instructions

When verification is green, commit + push as ONE comprehensive commit. Suggested message:

```
i18n: complete zh-CN coverage + refactor modules.ts to use translation keys

Tina-blocking issue raised 2026-05-19. Previous i18n coverage was ~35%
in Chinese — page titles and common buttons translated, but every
sidebar nav item, home shortcut tile, and portal page stayed English
because (1) modules.ts hardcoded English strings and (2) zh-CN.ts was
missing 14 namespaces relative to en.ts.

Phase 1: Added 14 missing namespaces to zh-CN.ts:
  accounts, ordersDashboard, distributorPortal, restock, batches,
  verify, factoryPortal (refreshed), settings, fabricTimeline,
  portalFeed, library, admin, brandPortal, labPortal, productDocs.

Phase 2: New modules: namespace + labelKey/blurbKey fields on
ModuleItem. Consumers (home page card grid, scoped sidebar) now
reference t.modules.xxx with fallback to original English string.

Phase 3: /home shortcut bar uses t.modules.xxx keys (reuses Phase 2)
and adds remaining role gates on tiles that were leaking to
non-internal users.

Brand voice locked: no silver/nano/Ag in any Chinese translation
(verified via diff grep for 银/纳米/silver/nano in translated values).

Coverage: ~35% → ~85% for Chinese on the surfaces Tina demos. Portal
sidebars (factory/distributor/brand/lab) deferred to Phase 16 — same
pattern, larger scope.

Closes the call escalation logged 2026-05-19 with Tina (SanMar /
Spanx demo) and Danny (distributor showing BD links — that fix is
already staged locally and lands in a sibling commit).
```

## What to do AFTER push

1. Wait for Vercel green on the deploy.
2. Tell Andrew it's ready.
3. Suggested verification ping from Andrew's Mac:
   ```bash
   fzcron 'diag-brand-fabrics?brand=SanMar'    # confirm DB responsive
   ```
4. Andrew will manually verify in browser: hard refresh /home, switch to Chinese, screenshot.

## Out of scope for this pass

- Portal sidebars (factory/distributor/brand/lab) — Phase 4, defer
- Translating `ja.ts`, `es.ts`, `tr.ts` for the missing namespaces — leave for translator pass, deepFallback handles for now
- Hardcoded strings inside individual page components (e.g. modal copy, error messages) — those need to be tackled page-by-page in a separate audit pass
- Right-to-left language support — not needed (no Arabic / Hebrew in our locales list)

## Notes / gotchas

- **Distributor BD-link leak fix is already staged locally** in `src/components/Sidebar.tsx` (gate on `user.canClaim` so pure distributors don't see BD links). Do not undo it. Verify it survives the i18n refactor.
- **View As race-condition fix is already staged locally** in `src/components/Sidebar.tsx` (`loading || user?.role === "ADMIN"` guard). Do not undo it.
- **/home shortcut bar role gates are already staged locally** in `src/app/home/page.tsx`. Do not undo them — extend them in Phase 3.
- The `home:` namespace was already added to `zh-CN.ts` in this Cowork session — verify it's intact and don't duplicate it in Phase 1.
- **Railway is currently in a major outage** as of the time this spec was written (2026-05-19 22:43 UTC). Do not push until Railway is green. Use the outage window to do the work; push when status.railway.com shows "Resolved."
