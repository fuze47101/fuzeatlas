# Full i18n Parity — 17 Locales + Page Content Threading

**Date filed:** 2026-05-20
**Filed by:** Andrew (via Cowork session)
**Blocking:** Tina demos + global customer expansion (Penfabric Malaysia, KK Chan / Penfabric, BV Hong Kong, Welspun India, SRS-Turkey, Mercado Global, Hi-Goal Indonesia, Vietnamese mills, Bangladesh apparel exporters)
**Customer pain right now:** Tina switches the locale picker to Traditional Chinese / Vietnamese / Korean → "menu went back to English." Switches to Simplified Chinese on /admin/distributor-restock → sidebar translates but page content stays English.

## Background

The locale picker offers 17 canonical languages — these are the top textile-manufacturing languages globally and the list is intentionally NOT being filtered down:

| Locale | Language | Textile context |
|---|---|---|
| en | English | Default + US/UK |
| zh-CN | 简体中文 | Mainland China (largest textile producer) |
| zh-TW | 繁體中文 | Taiwan (Formosa, Far Eastern, Eclat) |
| vi | Tiếng Việt | Vietnam (Nike, Adidas manufacturing hub) |
| bn | বাংলা | Bangladesh (second-largest apparel exporter) |
| hi | हिन्दी | India (north) |
| ta | தமிழ் | India (Tamil Nadu textile cluster) |
| ko | 한국어 | Korea (performance fabric leader) |
| th | ภาษาไทย | Thailand (major textile/apparel) |
| tr | Türkçe | Turkey (top European textile producer, SRS-Turkey) |
| ja | 日本語 | Japan (performance R&D, SEK Mark certification) |
| id | Bahasa Indonesia | Indonesia (Hi-Goal, major apparel) |
| ms | Bahasa Melayu | Malaysia (Penfabric — our flagship customer) |
| ur | اردو | Pakistan (major textile exporter) |
| es | Español | Spain + LatAm (Mercado Global) |
| it | Italiano | Italy (luxury textile, fashion) |
| km | ខ្មែរ | Cambodia (emerging textile country) |

## Current state (audited 2026-05-20)

| Status | Locales | File size signal |
|---|---|---|
| **Current (maintained, modern namespaces)** | en, zh-CN, ja, es, tr | 108-122 KB each |
| **Stale (May-6 baseline, sparse coverage)** | zh-TW, vi, bn, hi, ta, ko, th, id, ms, ur, it, km | 20-35 KB each |

The picker offers all 17. When a customer picks any of the 12 stale locales, the file exists but most modern keys deepFallback to English. Result: customer sees a few translated strings and a sea of English. Looks completely broken.

PLUS — even on the 5 fully-maintained locales — **individual page content** still has hardcoded English strings. Sidebar nav translates (Track B Phase 1-3 + Phase 4 shipped that). Home module cards translate. But pages like `/admin/distributor-restock` (Orders Dashboard), `/admin/orders`, `/admin/factories`, `/admin/contacts`, etc. all have hardcoded English in the dashboard cards, section headings, table column labels, button text.

Two problems, two tracks.

---

## TRACK 1 — Bring the 12 stale locales to parity with the 5 maintained locales

**Approach:** for each stale locale, identify namespaces missing relative to `en.ts`, add them with proper native translations.

**Per-locale tone rules** (NON-NEGOTIABLE):

- **zh-TW (繁體中文)** — Traditional Chinese characters, Taiwan conventions. NOT zh-CN copy-paste with character conversion — use Taiwan-specific terminology where it differs (e.g. 軟體 not 软件 for software, 滑鼠 not 鼠标 for mouse).
- **vi (Tiếng Việt)** — Vietnamese with full diacritics. Use textile-industry-standard terminology (most Vietnamese textile docs are bilingual EN/VI, follow that conventions).
- **bn (বাংলা)** — Bengali script. Use Bangladeshi Bengali conventions, not Indian Bengali where they differ.
- **hi (हिन्दी)** — Hindi (Devanagari script). Industry/technical vocabulary, not literary or Sanskritized.
- **ta (தமிழ்)** — Tamil. Industrial / professional register.
- **ko (한국어)** — Korean. Use 존댓말 (formal) for UI; product names literal. Korean has standardized terms for textile processes — defer to industry conventions over literal translation.
- **th (ภาษาไทย)** — Thai. Standard formal register for UI strings.
- **id (Bahasa Indonesia)** — Indonesian. Industry standard; many English loanwords are accepted (e.g. "antibakteri" not "anti-bakteri").
- **ms (Bahasa Melayu)** — Malaysian Malay. Penfabric and Malaysian manufacturers will read this — use industry-standard terminology. Distinct from Bahasa Indonesia (do NOT just copy id.ts).
- **ur (اردو)** — Urdu. Right-to-left script awareness for the rendering layer (verify Tailwind RTL utilities work). Standard formal register.
- **it (Italiano)** — Italian. Standard formal register for UI.
- **km (ខ្មែរ)** — Khmer. Industrial register.

**Brand voice across ALL 17 languages — STRICTLY ENFORCED:**

- NEVER translate "FUZE" — it stays as "FUZE" in every locale.
- NEVER translate "F1, F2, F3, F4" — tier names stay literal.
- NEVER use silver / 銀 / 银 / 銀 / plata / gümüş / 銀 / silver-ion / nano / nanoparticle / Ag / 纳米 / नैनो / ナノ / nano-bạc / nano-silver / 나노실버 / nano-prata or any variant for any active-ingredient reference.
- "Metamaterial" gets a local-language transliteration where standard:
  - zh-CN/zh-TW: 超材料 (chāocáiliào)
  - ja: メタマテリアル
  - ko: 메타물질
  - vi: vật liệu siêu cấp / metamaterial
  - es: metamaterial
  - it: metamateriale
  - tr: metamateryal
  - hi: मेटामटीरियल
  - ta: மெட்டாமெட்டீரியல்
  - bn: মেটাম্যাটেরিয়াল
  - th: เมตาวัสดุ / metamaterial
  - id: metamaterial
  - ms: metamaterial / bahan meta
  - ur: میٹامیٹیریل
  - km: មេតាមេតារៀល
- Certifications stay literal in EVERY language: AATCC 100, ASTM E2149, ISO 20743, ISO 18184, AATCC 30, JIS L 1902, OEKO-TEX Standard 100 Class I, bluesign®, EPA, PFAS-free.
- Customer-facing copy follows the canonical FUZE voice from `src/lib/fuze-knowledge.ts`.

**Verification before push (per locale):**

```bash
grep -iE "silver|nano|Ag|silver-ion|silver ion" src/i18n/<locale>.ts
grep -E "銀|银|纳米|ナノ|나노|نانو|नैनो|ナノ|nano-bạc|nano-prata|plata|gümüş" src/i18n/<locale>.ts
```

Both passes must return ZERO matches in translated VALUES. Code comments mentioning competitive chemistry by name (e.g. "silver-ion competitors") are acceptable.

**Commit convention:** ONE commit per locale. 12 commits total for Track 1. Easier to revert one bad translator pass than 12. Commit message format:

```
i18n(<code>): full parity with en.ts — translate <N> missing namespaces

Brings <language> up to current namespace coverage. Brand voice
verified: zero silver/nano/Ag matches in translated values.

Translated namespaces: <list namespaces added>
```

---

## TRACK 2 — Thread page content through useI18n()

Track B Phase 1-3 + Phase 4 fixed navigation. Page CONTENT is still hardcoded. The most urgent surfaces (Tina hit these in the demo):

### Tier 1 — ship today (customer-facing dashboards)

These are the pages customers actually look at. Hardcoded strings here are the visible "broken translation" bug:

- `/admin/distributor-restock/page.tsx` (Orders Dashboard) — every card label ("Active Orders", "Shipped this week", "Consumed", "Open Pipeline", "Distributor Stock", "Restock Orders Open", "Low-Stock Distributors", "Shipped (30d)"), every section heading ("Orders by Status", "Weekly Shipped Volume"), every Order status pill (DRAFT, QUOTED, PENDING APPROVAL, APPROVED, PROCESSING, SHIPPED, DELIVERED, CANCELLED), descriptive subtitles, chart axis labels.
- `/dashboard/page.tsx` — KPI Dashboard (every tile + chart label)
- `/admin/brand-pipeline/page.tsx` — every stage label, filter pill, view-mode toggle
- `/admin/factories/page.tsx`, `/admin/contacts/page.tsx`, `/admin/brands/page.tsx` — list page headers + table columns
- `/admin/weekly-review/page.tsx` — Weekly Exec Review (Andrew's signature surface)
- `/admin/icp-sample-prep/page.tsx` — the wizard Ashlee runs
- `/admin/test-repository/page.tsx`
- `/admin/orders-dashboard/page.tsx` (if separate from distributor-restock)

### Tier 2 — ship this week (admin / power-user pages)

- `/admin/protocol-designer/page.tsx`
- `/admin/bd/wizard/page.tsx`, `/admin/bd/scoreboard/page.tsx`, `/admin/bd/sequences/page.tsx`
- `/admin/recipe-calculator/page.tsx`
- `/admin/sample-application/[id]/print/page.tsx`
- `/admin/competitor-pricing/page.tsx`
- `/admin/analytics/icp-correlation/page.tsx`
- `/admin/command-center/globe/page.tsx`

### Tier 3 — ship next week (settings / config pages)

- `/settings/profile/page.tsx`, `/settings/email-templates/page.tsx`
- `/admin/users/page.tsx`, `/admin/teams/page.tsx`
- `/admin/access-requests/page.tsx`
- Audit log, feedback admin, etc.

### Approach per page

For each page in scope:

1. Add `import { useI18n } from "@/i18n";` to the page component.
2. Define page-specific keys in `en.ts` under a namespace named after the page (e.g. `ordersDashboard:` for /admin/distributor-restock — that namespace already exists in en.ts; just verify completeness).
3. Replace every hardcoded user-facing string with `t.<namespace>.<key>`.
4. Add the SAME keys to all 17 locale files with proper translations.
5. Verify by switching the browser language picker and confirming the page re-renders cleanly.

**Per-page commit:** one commit per page that touches both the .tsx and all 17 locale files. Subject pattern: `i18n: thread <page-path> through useI18n() + add translations across 17 locales`

---

## TRACK 3 — Lab portal bug (Tina/Penny "screenshot view" complaint)

Penny (Intertek lab) reported "Lab portal — All lab accounts show as screenshot." Tina confirmed she sees the same when she "View As" a lab account. Penny's reported URL was `/distributor-portal/incoming-orders` (wrong page for a lab user) but the description suggests a real bug on the LAB PORTAL itself.

**Investigation steps:**

1. Read `src/app/lab-portal/page.tsx` end-to-end. Check what renders.
2. Pull all `src/app/lab-portal/**/page.tsx` files. Look for: placeholder images, hardcoded "screenshot" references, broken data fetches that fall through to skeleton UIs that look like screenshots.
3. Impersonate a real LAB_USER via the bearer-authed `/api/cron/admin-resolve` pattern, OR write a temporary diag endpoint that returns what `/api/lab-portal` returns for a specific LAB_USER ID. Penny's ID is `cmmymyyqn0005jy04wxmk8l7w`.
4. Check `src/components/Sidebar.tsx` for the `isLabUser` block — does it render the View As switcher? Is the lab portal landing somehow showing admin-style placeholder content?
5. Open lab portal pages in dev mode while impersonating a lab user. Screenshot what renders.

**Resolution path:** depending on what's found, either ship a targeted fix or write a triage note with reproduction steps for Andrew to share with Tina/Penny.

---

## ORDER OF OPERATIONS

Strict:

1. **TRACK 2 Tier 1** — Orders Dashboard threading FIRST. This is the page in Tina's screenshot. Highest visibility win, gets Andrew out of the immediate Tina escalation.
2. **TRACK 3 — Lab portal bug investigation.** Half-day max. Either ship a fix or document repro for Andrew. Don't drag this out.
3. **TRACK 1 — 12 stale locales to parity.** Heavy lift, 12 separate commits, parallelizable per locale. Start with the highest-leverage 4 first:
   - **zh-TW (Taiwan)** — biggest pain (it's adjacent to zh-CN in the picker, customers expect it to work)
   - **vi (Vietnam)** — major manufacturing hub
   - **ko (Korea)** — performance fabric customers
   - **ms (Malaysia)** — Penfabric is our flagship
   
   Then the remaining 8 (bn, hi, ta, th, id, ur, it, km).
4. **TRACK 2 Tier 2** — admin/power-user pages.
5. **TRACK 2 Tier 3** — settings/config pages.

---

## STANDING RULES (unchanged from prior specs)

- Brand voice: FUZE / metamaterial / F1-F4 only. No silver/nano/Ag in any of the 17 languages in any user-facing string.
- Verify-after-every-push: Vercel green + `fzcron diag-all-surfaces` between commits.
- Error-state-not-zeros: every widget shows an error banner on API 500.
- Git: `rm -f .git/index.lock` before commit, `--no-verify` flag.
- Bearer-authed runtime migration for any data changes (no local Prisma scripts).

---

## DONE CRITERIA

- [ ] Tina can switch the language picker to any of the 17 locales on `/home` and `/admin/distributor-restock` and see the entire page (sidebar + content) translate properly.
- [ ] Brand-voice diff grep returns ZERO matches across all 17 locale files.
- [ ] All 17 locale files have the same top-level namespace count (verify via `grep -c '^  [a-zA-Z]\+: {' src/i18n/*.ts`).
- [ ] Lab portal bug either fixed (Penny's ticket flipped FIXED with close-loop email) or documented (Penny's ticket TRIAGED with reproduction steps).
- [ ] `fzcron diag-all-surfaces` green after the final commit.

---

## NOTES / GOTCHAS

- **Penfabric is Malaysia, NOT Indonesia.** ms ≠ id even though they're mutually intelligible. Translate them separately.
- **Hindi vs Tamil** — India has both; the picker offers both because different mill regions speak different languages. Don't conflate.
- **Urdu is RTL** — verify the rendering layer handles right-to-left. Tailwind has `rtl:` variants; if the layout breaks for Urdu, that's a separate component-level fix.
- **Don't filter the picker.** Andrew explicitly rejected filtering the 12 stale locales out as a "fast fix" — the list is the strategic offering, not a draft.
- **Translation quality:** if a key's English value is ambiguous, look at the call site to disambiguate before translating. Don't ship literally-accurate-but-contextually-wrong.
- **All locale files must match `Translations` type from en.ts.** If en.ts grows a key during Track 2, every locale must grow with it. Don't let any locale lag behind.

---

## REPORT BACK WHEN DONE

Format:

```
TRACK 2 TIER 1: ✅ shipped, <N> pages threaded, all 17 locales updated
TRACK 3: ✅ shipped fix / ⏸ documented repro (see ticket <id>)
TRACK 1: ✅ 12 locales complete / 🟡 X locales complete, Y remaining

Commits shipped: <list hashes>

Translation choices flagged for native-speaker review:
- <locale>:<namespace>.<key> — "<English>" → "<translation>" — note about ambiguity
- ...

Done criteria status: <checkbox status from above>
```
