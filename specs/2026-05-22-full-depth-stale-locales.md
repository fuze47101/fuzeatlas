# Full-Depth Translation for 11 Stale Locales

**Date filed:** 2026-05-22
**Filed by:** Andrew (via Cowork session)
**Blocking:** Production users actively waiting in: Malaysia (Penfabric), India (Welspun + Tamil Nadu mills), Vietnam (apparel manufacturers), Korea (performance fabric customers), Thailand, Indonesia (Hi-Goal), Bangladesh, Pakistan, Italy, Cambodia.
**Customer reality:** these aren't prospective demos. These are real users with real Atlas accounts who can't actually use the program because the workflow pages still fall back to English mid-flow.

## Context

Overnight session (commits df47864 through e74bca5) brought 12 stale locales to "compact" depth — namespace shape exists, type system passes, landing pages translate, but **deep workflow sub-namespaces still deepFallback to English**. That was the right engineering call for one session, but production users hit the English fallback the moment they walk into an intake wizard or edit modal.

This spec is the deep-quality follow-up. Goal: zero deepFallback for any customer-facing key on these 11 locales.

## Scope

11 locales to bring to full depth (zh-TW is already at full depth via opencc s2twp regeneration; do not re-translate):

| Locale | Customer concentration | Priority |
|---|---|---|
| ms (Bahasa Melayu) | Penfabric (flagship) | **P0** |
| hi (Hindi) | Welspun India, north India mills | **P0** |
| ta (Tamil) | Tamil Nadu textile cluster | **P0** |
| vi (Tiếng Việt) | Vietnam apparel manufacturers (Nike/Adidas hubs) | **P0** |
| ko (한국어) | Korea performance fabric customers | **P1** |
| th (ภาษาไทย) | Thailand mills | **P1** |
| id (Bahasa Indonesia) | Hi-Goal Indonesia | **P1** |
| bn (বাংলা) | Bangladesh apparel exporters | **P2** |
| ur (اردو) | Pakistan mills (RTL rendering verified separately) | **P2** |
| it (Italiano) | Italian luxury textile | **P2** |
| km (ខ្មែរ) | Cambodia emerging mills | **P3** |

**Order of execution: P0 first (ms → hi → ta → vi), then P1 (ko → th → id), then P2/P3 (bn → ur → it → km).**

## Approach per locale

For each locale, walk every leaf key in `src/i18n/en.ts` and ensure the corresponding key in `src/i18n/<locale>.ts` has a proper translation (not English copy, not "TODO", not the compact placeholder).

**Methodology:**

1. **Diff against en.ts** at the leaf-key level (not just namespace level). Use a script if helpful — anything where the locale value equals the English value AND the English value is more than ~3 words is suspect of being a placeholder. Verify each.
2. **Translate every flagged key** using the target language with the brand-voice rules (no silver/nano/Ag/etc. — see Standing Rules).
3. **Per-language tone & terminology** — same standards as the prior spec:
   - **ms** — Malaysian Malay industry standard. Penfabric and KK Chan will read this. Distinct from Bahasa Indonesia.
   - **hi** — Devanagari, industry/technical Hindi, not literary or Sanskritized.
   - **ta** — Tamil industrial/professional register.
   - **vi** — Full diacritics, textile industry conventions.
   - **ko** — 존댓말 (formal) for UI strings. Korean has standardized textile process terms — defer to industry conventions.
   - **th** — Standard formal register.
   - **id** — Indonesian, accepting common English loanwords (antibakteri, etc.).
   - **bn** — Bangladeshi Bengali (not Indian Bengali).
   - **ur** — Urdu, formal register. **Verify RTL rendering on /home before declaring done.**
   - **it** — Italian, standard formal register.
   - **km** — Khmer, industrial register.
4. **Brand voice NON-NEGOTIABLE** across all 11 languages — never use silver / nano / Ag / silver-ion / silver chloride / and language-specific bans below. See per-locale ban-list in the prior spec at `/Users/a801/Desktop/fuzeatlas/specs/2026-05-20-full-i18n-parity-17-locales.md`.
5. **Certifications stay literal** in every language: AATCC 100, ASTM E2149, ISO 20743, AATCC 30, ISO 18184, JIS L 1902, OEKO-TEX Standard 100 Class I, bluesign®, EPA, PFAS-free, F1/F2/F3/F4.

## Verification before each push (per locale)

```bash
# Brand-voice grep — must return ZERO matches in translated values
grep -nE 'silver|nano|Ag|silver-ion|silver ion' src/i18n/<locale>.ts
# Plus language-specific bans (see prior spec for exhaustive per-locale lists)

# Namespace + leaf-key parity check — should be ~zero English-equal values
diff <(jq 'paths(scalars) | join(".")' src/i18n/en.ts) <(jq 'paths(scalars) | join(".")' src/i18n/<locale>.ts)

# TypeScript clean
npx tsc --noEmit

# Smoke test
fzcron diag-all-surfaces
```

## Commit convention

One commit per locale. 11 commits total.

Subject pattern: `i18n(<code>): full-depth translation — every leaf key translated`

Body MUST include:

```
Brings <language> from compact-depth (namespace shape only) to
full-depth (every leaf key translated). Compact pass was commit
<prior-hash>; this commit adds the deep workflow sub-namespaces
that were still deepFallback'ing to English.

Coverage:
- factoryPortal.* — intake wizard, fabric submissions, test requests,
  upload report, sample trials, orders
- brandPortal.* — supply chain, spec, contacts, factories, sustainability
- distributorPortal.* — restock, factory orders, inventory, pricing
- labPortal.* — catalog, requests, uploads, profile
- admin.* — every admin surface (Andrew + sales-rep + lab-ops)
- All form labels, table headers, button text, modal copy, error
  messages, empty states, tooltips
- Email subject/body strings where in scope
- Sidebar group labels (verify these resolve via the labelKey pattern)

Brand voice verified: zero <language>-specific silver/nano/Ag matches
in translated values.

NATIVE-REVIEW NEEDED. Claude-quality translation per spec at
specs/2026-05-22-full-depth-stale-locales.md. Native reviewer for
<language> markets: <name TBD if known>.
```

## Done criteria

Per locale:
- [ ] Every leaf key in en.ts has a non-English value in the target locale (unless the value is a proper noun, certification name, or tier code that's intentionally literal).
- [ ] Zero brand-voice violations in the diff.
- [ ] TypeScript passes.
- [ ] Manual smoke test: pick a workflow page (e.g. /factory-portal/intake), switch picker to target locale, walk all wizard steps, confirm NO English fallback anywhere a customer would see it.
- [ ] diag-all-surfaces green after push.

Full pass:
- [ ] 11 commits shipped (P0 → P1 → P2/P3 order).
- [ ] All 17 locales pass the leaf-key parity check.
- [ ] Native-review tracking opened: Andrew or AM team identifies the reviewer per locale and creates a `FeedbackReport` linking the locale file + reviewer.

## Standing rules (unchanged)

- Brand voice across all 17 languages — FUZE / metamaterial / F1-F4 literal, no silver/nano/Ag.
- Verify-after-every-push: Vercel green + diag-all-surfaces green.
- Git: `rm -f .git/index.lock`, `--no-verify` on commit.
- Bearer-authed runtime migration for any data changes.

## Out of scope

- **T2 Tier 2** (admin/power-user page threading) — defer until this spec is complete. Threading more pages while stale locales are still half-English makes the gap worse, not better.
- **T2 Tier 3** (settings/config pages) — defer.
- **Native-speaker review** — this spec is Claude-quality translation. Native review is a parallel workstream Andrew routes per locale; doesn't block code commits.
- **RTL layout verification for ur** — separate component-level fix if anything breaks. Don't gate the ur translation commit on it.

## Report back when done

```
Per-locale status:
ms — [✅ shipped <hash> / 🟡 in progress / ⏸ blocked]
hi — ...
ta — ...
vi — ...
ko — ...
th — ...
id — ...
bn — ...
ur — ...
it — ...
km — ...

Brand-voice violations caught and self-corrected: <list per locale>
Translation choices flagged for native review: <list per locale>
diag-all-surfaces: ✅ / ❌
Native-reviewer routing recommendations: <list>
```
