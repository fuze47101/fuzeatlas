# Phase 19.5 — Competitor SDS Audit + Sustainability Rewrite

**Date filed:** 2026-05-26
**Filed by:** Andrew (via Cowork session)
**Why now:** Andrew caught that the sustainability page's competitor CO2 numbers (Silvadur showing 434,338 kg CO2 per 100,000m of fabric) rely on concentration assumptions in `src/lib/sustainability.ts` that may not survive a brand sustainability lead's audit. The Silvadur model assumes 0.45 kg silver salt per kg of product — that's 45% silver content, which is dramatically higher than typical published Silvadur 930 Flex SDS values (~1-2% silver in solution). If Silvadur is wrong, then Polygiene, Sanitized, Aegis, HeiQ, and every other silver/zinc/QAC competitor in the model is likely wrong too.
**Stakes:** The sustainability page is customer-facing. If a brand's sustainability lead checks our numbers against the actual SDSs and finds 20-40× inflation, FUZE loses all credibility on the comparison. **The honesty IS the credibility.** Audit + fix is non-negotiable.
**Goal:** Every CO2/water/waste/VOC number on the sustainability page is traceable to a sourced citation. Inline source URLs on each number. PDF generator emits a sources footnotes section. No assumption survives without a citation.

---

## STANDING RULES (read first — same as all prior specs)

1. **300-second auto-resume.** No check-ins between tracks. Execute end-to-end.
2. **No invented numbers.** If you can't find a published source, do NOT estimate without an explicit `estimated: true` flag and a reasoned justification. Better to under-claim with citations than over-claim without.
3. **Brand voice strict.** FUZE / metamaterial / F1-F4. Even in audit notes — never silver/nano/Ag/silver-ion/etc when describing FUZE itself. Competitor chemistry names are fine and expected.
4. **Verify-after-every-push.** Vercel green + diag-all-surfaces.
5. **Git workflow.** `rm -f .git/index.lock`, `--no-verify` on commit, one commit per audited chemistry group (silver / zinc / QAC / other) — NOT one commit per competitor (too noisy).
6. **i18n parity.** Any new user-facing string (source citation labels, "verified by" badges, "data updated" timestamps) added to all 17 locale files.
7. **Bearer-authed runtime migration.** Likely not needed — this is data updates, not schema changes. If you do need schema changes (e.g. adding a `sourcedFields` table for audit tracking), use the standard `/api/cron/migrate-19-5-bundle` pattern.

---

## SCOPE — 22 competitor entries to audit

Located in `src/lib/competitors.ts`. Grouped by chemistry type:

### Silver-based (highest priority — most inflated risk)

1. `silvadur-930` — Silvadur 930 Flex (LANXESS, formerly Dow)
2. `polygiene-stayfresh` — Polygiene StayFresh
3. `sanitized-silver` — Sanitized Silver (Sanitized AG)
4. `agion-silver` — Agion Silver Antimicrobial (Sciessent)
5. `zeomic-silver` — Zeomic Silver Zeolite (Sinanen Zeomic)
6. `vesta-silver-copper` — Vesta Silver/Copper Zeolite
7. `heiq-ags-20` — HeiQ AGS-20 Nanosilver
8. `heiq-viroblock` — HeiQ Viroblock (recycled silver claim — verify recycled fraction)

### Zinc-based

9. `polygiene-viraloff` — Polygiene ViralOff (zinc pyrithione)
10. `sanitized-t-99-19` — Sanitized T 99-19 (zinc pyrithione)
11. `heiq-hyprotecht` — HeiQ HyProTecht (zinc nano, Crescoating)
12. **bioACTIV AM (IFTNA, 97% ZnO)** — already verified from EPA Master Label 87246-12, NO audit needed; just confirm the entry exists in competitors.ts and is correct

### QAC silane

13. `aegis-microbe-shield` — Aegis Microbe Shield (Microban) — current entry says 42% silane-quat, verify from EPA label
14. `microban-additive-gs` — Microban Additive GS
15. `microban-cs5-a` — Microban CS5-A (current entry says 3.6%, verify)
16. `biosafe-organosilane` — BIOSAFE Organosilane Antimicrobial
17. `sanitized-puretec` — Sanitized Puretec
18. `ultra-fresh-dw-56` — Ultra-Fresh DW-56 (Thomson Research Associates)
19. **PROTX2 (IFTNA, 0.18% Ag + 0.26% PHMB + 0.44% propiconazole + 0.65% silane-quat)** — already verified from EPA Master Label 87246-13, NO audit needed; confirm entry is correct

### Other chemistries

20. `cupron-copper` — Cupron Copper-Infused
21. `chitosan` — Generic Chitosan Antimicrobial Finish
22. `citex` — CiTex (8% citric acid claim — verify)
23. `biolayr` — BioLayr (coniferous resin acid)
24. `crisp` — Crisp (wood extract)

### Fragrance / microcapsule (different chemistry math — keep separate)

25. `heiq-fresh` — HeiQ Fresh (mint scent in microcapsule)
26. `heiq-mint` — HeiQ Mint legacy

**Total: 22 competitor entries requiring audit + 2 already-verified IFTNA entries (PROTX2 + bioACTIV AM) requiring verification of correctness.**

---

## TRACKS

7 tracks. Strict order.

### TRACK 1 — Build the audit tracker

New file: `deliverables/Competitor_SDS_Audit_2026-05.md`

Markdown table with one row per competitor:

| ID | Product | Chemistry | Current assumption (sustainability.ts) | SDS URL | SDS date | Actual published value | Source page/section | Corrected value | Delta | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| silvadur-930 | Silvadur 930 Flex | silver_ion | 0.45 kg Ag salt / kg product | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

Initialize with current values from `src/lib/sustainability.ts`. Status starts as "pending audit" for all.

This is the source-of-truth audit document that Code fills in as it works.

### TRACK 2 — Audit silver-based products (8 entries)

For each silver-based competitor:

1. **Pull the SDS** from the manufacturer's website. If not publicly available, try:
   - EPA Pesticide Product Label System (PPLS) at `epa.gov/pesticides/chem_search/ppls/...` — many silver textile products are EPA-registered
   - Company's "Technical Documents" or "Downloads" page
   - Bluesign / OEKO-TEX product database entries
   - Third-party distributors (Archroma, CHT, DyStar, Pulcra — some host SDSs)
2. **Extract from Section 3 (Composition / Information on Ingredients):**
   - Active ingredient name
   - Active ingredient concentration (% w/w in the as-sold product)
   - CAS number for verification
3. **Compare to current assumption in sustainability.ts.** If delta > 5%, mark as REQUIRES_FIX.
4. **Update sustainability.ts** with corrected value AND add an inline source field:

```typescript
silver_ion: {
  chemistryName: "Silver ion (in-fiber)",
  rawMaterials: [
    {
      name: "Silver salt precursor",
      kgPerKgProduct: 0.015,  // CORRECTED from 0.45 — was 30× overstated
      costPerKg: 750,
      source: {
        sdsUrl: "https://lanxess.com/-/media/.../silvadur-930-flex-sds.pdf",
        sdsDate: "2024-03-15",
        sdsSection: "Section 3.2 — Composition",
        valueAsPublished: "1.5% silver salt (as silver acetate) in aqueous polymer carrier",
        verifiedDate: "2026-05-26",
        verifiedBy: "Phase 19.5 audit (Code, automated)",
        notes: "LANXESS SDS lists silver as 1.5%, not 45%. Prior 0.45 assumption confused per-kg-active with per-kg-product.",
      },
    },
    // ... continue with other raw materials
  ],
  // ... rest of chemistry profile
}
```

5. **Recompute downstream values** (kgCO2PerKgProduct, etc.) and verify they match the new concentration math.
6. **Commit** with subject: `audit(sustainability): silver-based competitors — corrected concentrations per published SDSs`

### TRACK 3 — Audit zinc-based products (4 entries)

Same methodology as Track 2. For zinc pyrithione products (Polygiene ViralOff, Sanitized T 99-19), verify the active concentration from SDS. For HeiQ HyProTecht (Crescoating zinc), confirm zinc nano concentration. bioACTIV AM (IFTNA) is already verified from EPA label 87246-12 — confirm the existing entry.

Commit: `audit(sustainability): zinc-based competitors — corrected concentrations per published SDSs`

### TRACK 4 — Audit QAC silane products (7 entries)

QAC silane SDSs typically list the active concentration as a single line item (e.g. "3-(Trihydroxysilyl)propyldimethyloctadecyl ammonium chloride — 42%"). Verify each entry. PROTX2 already verified from EPA label 87246-13.

Commit: `audit(sustainability): QAC silane competitors — corrected concentrations per published SDSs`

### TRACK 5 — Audit other chemistries (5 entries)

- **Cupron:** copper oxide content from manufacturer's tech bulletin
- **Chitosan:** typical commercial chitosan finishes are 0.5-1% chitosan in solution — verify with a published SDS (e.g. Heraeus or Primex chitosan)
- **CiTex:** verify 8% citric acid claim from product TDS
- **BioLayr:** verify resin acid concentration
- **Crisp:** verify wood extract concentration

Commit: `audit(sustainability): other chemistries — corrected concentrations per published SDSs`

### TRACK 6 — Update sustainability.ts data structure to require sourced citations

Refactor the type definitions in `src/lib/sustainability.ts` so that EVERY numeric field that drives a customer-visible CO2/water/waste/VOC calculation MUST have a companion `source` field. Make it a TypeScript-enforced requirement so future entries can't ship without sourcing.

```typescript
type SourcedNumber = {
  value: number;
  source: {
    sdsUrl?: string;
    sdsDate?: string;
    sdsSection?: string;
    valueAsPublished?: string;
    verifiedDate: string;
    verifiedBy: string;
    estimated?: boolean;  // true if no published source — must include justification
    estimationBasis?: string;  // required when estimated=true
    notes?: string;
  };
};
```

Refactor existing numeric fields to use `SourcedNumber`. Anywhere `estimated: true` is set without a source, TypeScript should warn (or eslint should). This locks future-you and future-Code into rigor.

Commit: `feat(sustainability): require sourced citations on all CO2 / water / waste / VOC inputs`

### TRACK 7 — Update sustainability page render + PDF generator

1. **Render side** (`src/app/sustainability/page.tsx` or wherever the sustainability page lives):
   - Add an info-icon (ⓘ) next to every CO2/water/waste/VOC number on the page.
   - On hover (desktop) or tap (mobile): show a tooltip with: source citation, SDS link (if available), verified date, "value as published" raw quote.
   - Footer of the page: "All competitor CO2 / water / waste / VOC figures verified against published Safety Data Sheets and EPA registration labels in the latest audit. Hover any number for source. Last full audit: [date]. Sources may have updated; click any source link to verify against the current published SDS."

2. **PDF generator side** (`src/lib/pdf-sustainability-competitive.ts`):
   - Add an automatic "Sources & Methodology" appendix at the end of every generated PDF.
   - Lists every source citation used in the PDF body.
   - Includes a methodology note explaining how per-100,000m-fabric calculations were derived (and what assumptions remain estimated).

3. **Customer-facing language change:**
   - Where the page currently uses adjectives like "based on industry data" or "estimated from published LCAs", replace with specific source citations.
   - Where the page makes a comparative claim (e.g. "PROTX2 is X× higher than FUZE"), append the specific data points and sources that justify it.

Commit: `feat(sustainability): inline source tooltips + PDF sources appendix`

### TRACK 8 — Verify + publish

1. Run `npx tsc --noEmit` — must be clean.
2. Visit `/sustainability` on prod after push, walk through every competitor card, hover every number, confirm source tooltips populate correctly.
3. Generate a competitive PDF (`fzcron generate-competitive-pdf -X POST -d '{"brandId":"test"}'` or whatever the existing endpoint is), download, verify the Sources & Methodology appendix is present.
4. Run `fzcron diag-all-surfaces` — confirm 50+ surfaces healthy.
5. Final commit: `chore(sustainability): Phase 19.5 audit complete — all competitor numbers sourced`

---

## DONE CRITERIA

- [ ] `deliverables/Competitor_SDS_Audit_2026-05.md` populated with verified data for all 22 competitors (24 with the 2 already-verified IFTNA entries confirmed).
- [ ] Every numeric field in `src/lib/sustainability.ts` has a `source` companion field with at minimum: verifiedDate + verifiedBy + (sdsUrl OR estimationBasis).
- [ ] TypeScript build clean.
- [ ] `/sustainability` page hover-tooltips functional on every number.
- [ ] Generated competitive PDF includes Sources & Methodology appendix.
- [ ] Audit document committed alongside code changes (so future audits can reference prior decisions).
- [ ] `fzcron diag-all-surfaces` green.
- [ ] CLAUDE.md updated with the audit pattern (so future competitor additions follow it).

---

## OUT OF SCOPE

- **Commissioning a third-party LCA** for FUZE itself. That's a $30-100K project with a SimaPro/Ecoinvent practitioner. Not in scope of this code work.
- **Auditing FUZE's own production carbon estimate.** Andrew has direct insight into the Salt Lake City facility's actual energy use, recycled feedstock sourcing, and solar contribution. Code shouldn't invent FUZE numbers — confirm with Andrew before changing any FUZE-side figure.
- **Re-doing the per-100,000m fabric framework.** The framework is sound; only the input concentrations need correcting.
- **Auditing competitors we've labeled INACTIVE in CLAUDE.md** (Archroma, CHT, DyStar, Pulcra, Honghao-Chemical, etc.) — they were chemical suppliers/distributors, not standalone competitors with their own chemistries.

---

## ESCALATION

Stop and ping Andrew only if:

- **A competitor's SDS is genuinely not publicly available** and the entry needs to be flagged as `estimated: true` with industry-average data — Andrew should approve the estimation basis.
- **The audit reveals a competitor whose actual concentration makes our existing CO2 comparison WORSE for FUZE** (e.g., we find a competitor that's actually lower-impact than we said). Andrew needs to know before publishing.
- **A competitor's published claims directly contradict their SDS** (similar to the IFTNA PROTX2 marketing-vs-EPA discrepancy from Phase 16 / 17 work) — Andrew may want a competitive intel deliverable on that finding, similar to the Sustainability_Comparison_FUZE_vs_Protx2.md doc.
- Anthropic rate-limited > 30 minutes.

---

## REPORT BACK

```
Per-competitor audit status:
silvadur-930 — ✅ verified <date> via LANXESS SDS <link> — corrected 0.45 → 0.015 (30× overstated)
polygiene-stayfresh — ✅ verified <date> via Polygiene SDS <link> — corrected X → Y
... (all 22 + 2 confirmations)

Aggregate impact:
- Silver-based competitors: average correction X% (lower / higher than prior)
- Zinc-based: average correction X%
- QAC silane: average correction X%
- Other: average correction X%
- Estimates remaining (no public SDS available): N competitors, each flagged in tracker

Sustainability page CO2 totals (per 100,000m fabric, before vs after audit):
- Silvadur:    434,339 → <new>
- Polygiene:   <prior> → <new>
- Aegis:       <prior> → <new>
- ...
- FUZE F1:     <unchanged>

Documents emitted:
- deliverables/Competitor_SDS_Audit_2026-05.md (audit tracker)
- Updated /sustainability page render
- Updated competitive PDF generator with Sources appendix

Commits shipped: <list with hashes>
fzcron diag-all-surfaces: ✅
Escalations requiring Andrew's input: <list>
```

---

## ONE NOTE ON CREDIBILITY POSTURE

If the audit reveals that several competitors were significantly OVERSTATED (which is the likely finding for Silvadur given the 0.45 vs ~0.015 silver fraction gap), the corrected numbers will SHRINK the dramatic competitive gap.

**That's the right outcome.** A 50× corrected FUZE advantage with bulletproof citations is more powerful than a 1000× uncorrected advantage that crumbles under audit. Brands' sustainability leads expect to fact-check vendor claims; the moment they catch a vendor overstating, that vendor is dismissed permanently.

Code should NOT preserve inflated numbers to maintain a dramatic narrative. Truth + sourcing wins long-term. Andrew is aligned on this — that's why this spec exists.

If after correction the FUZE advantage on any specific dimension is smaller than expected, that's a customer conversation we can have honestly — "here's the actual delta, here's the source, here's why we think it still matters for your sustainability goals" — rather than a brand finding it during their own check and losing trust.
