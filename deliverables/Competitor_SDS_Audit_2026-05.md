# Competitor SDS Audit — 2026-05

**Spec:** specs/2026-05-26-phase-19-5-competitor-sds-audit.md
**Audit run:** 2026-05-26
**Auditor:** Phase 19.5 (Code, automated SDS lookups via web fetch)
**Why:** Andrew flagged the Silvadur 930 Flex assumption in `src/lib/sustainability.ts` of 0.45 kg Ag salt per kg product (~45% silver content) as likely dramatically overstated vs. published LANXESS SDS data (~1-2% silver in solution). If Silvadur is wrong, every other silver/zinc/QAC competitor in the model is likely wrong too. The honesty IS the credibility.

## Methodology

For each competitor:
1. Look up the canonical SDS or EPA label (Section 3 — Composition).
2. Extract the active ingredient name + CAS + concentration (% w/w in the as-sold product).
3. Compare to the current `UPSTREAM_MANUFACTURING[chemistryType].rawMaterials[].kgPerKgProduct` value in `src/lib/sustainability.ts`.
4. If delta > 5%, mark as REQUIRES_FIX. Update `sustainability.ts` with corrected value + inline `source` field on the row.
5. If SDS is not publicly accessible, mark `estimated: true` and record the industry-average basis used.

## Source-of-truth files

- `src/lib/sustainability.ts` — chemistry profiles (`UPSTREAM_MANUFACTURING`) drive the per-100,000m-fabric CO2/water/waste/VOC calculations rendered on `/sustainability`.
- `src/lib/competitors.ts` — competitor catalog: id, name, chemistry type, EPA reg #, EPA label URL. Each competitor `chemistryType` keys into the `UPSTREAM_MANUFACTURING` profile.

Each competitor below references its `chemistryType` archetype. The archetype's `kgPerKgProduct` is what drives the customer-facing math. A correction to the archetype affects every competitor using that chemistry.

---

## Audit table

Columns:
- **ID** — competitor row id in `src/lib/competitors.ts`
- **Chemistry archetype** — keys into `UPSTREAM_MANUFACTURING` in `sustainability.ts`
- **Current assumption** — `kgPerKgProduct` of the primary active ingredient row in the archetype, as-shipped
- **SDS / EPA label** — best public source link
- **Published active concentration** — extracted from SDS Section 3 or EPA Section 1/3
- **Delta** — multiplicative correction (e.g. `30×` means current is 30× the published value → divide by 30)
- **Status** — `verified`, `corrected`, `estimated`, `escalate`
- **Notes** — sourcing notes, escalation reasons

### Silver-based (8 entries)

| ID | Chemistry archetype | Current assumption | SDS / EPA label | Published active concentration | Delta | Status | Notes |
|---|---|---|---|---|---|---|---|
| silvadur-930 | silver_ion | 0.45 (Ag salt as fraction of product, w/w) | https://www3.epa.gov/pesticides/chem_search/ppls/000464-00785-20170206.pdf · LANXESS Silvadur 930 Flex | _pending audit_ | _pending_ | pending | LANXESS literature commonly cites 1.5-2% Ag in the as-sold polymer dispersion. Andrew specifically called this out as suspect — confirm against the EPA label or LANXESS technical bulletin. |
| polygiene-stayfresh | silver_chloride | 0.63 (AgNO₃ as fraction of product) | https://polygiene.com/stayfresh/ · TDS or SDS | _pending_ | _pending_ | pending | Polygiene StayFresh is silver chloride in an organic carrier. Polygiene publishes a TDS (technical data sheet) on their site; SDS may require contact form. |
| sanitized-silver | silver_ion | 0.45 | https://www.sanitized.com/en/technologies/sanitized-silver/ | _pending_ | _pending_ | pending | Sanitized AG markets multiple silver products. Check the specific product SDS index. |
| agion-silver-zeolite | silver_zeolite (archetype not yet defined — falls back to silver_chloride or silver_nano logic) | n/a — archetype missing | https://www3.epa.gov/pesticides/chem_search/ppls/088165-00005-20231116.pdf · Sciessent Agion | _pending_ | _pending_ | pending | Sciessent Agion EPA label 88165-5 (Type AG) should list silver as the active ingredient w/w. Typical silver zeolites are 1-5% Ag on a zeolite carrier. |
| zeomic-silver | silver_zeolite | n/a — archetype missing | https://www3.epa.gov/pesticides/chem_search/ppls/071227-00001-20100615.pdf · Zeomic | _pending_ | _pending_ | pending | Zeomic Type AC EPA label. Sinanen Zeomic Type AC is silver+copper zeolite. |
| vesta-silver-copper | silver_copper_zeolite (archetype not yet defined) | n/a — archetype missing | _no public EPA / SDS easily indexable_ | _pending_ | _pending_ | pending | Vesta is a smaller distributor — SDS may not be on public web. Likely requires `estimated: true` flag. |
| heiq-ags20 | silver_nano | 0.63 (AgNO₃) | https://www.heiq.com/products/textile-technologies/heiq-ags-20/ | _pending_ | _pending_ | pending | HeiQ AGS-20 is silver chloride nano in solution. HeiQ publishes a technical data sheet. |
| heiq-viroblock | silver_nano_zinc (archetype not yet defined) | n/a — archetype missing | https://www.heiq.com/products/textile-technologies/heiq-viroblock/ | _pending_ | _pending_ | pending | Viroblock combines silver chloride + vesicle technology + (in newer SKUs) recycled silver claim. Verify recycled fraction. |

### Zinc-based (4 entries)

| ID | Chemistry archetype | Current assumption | SDS / EPA label | Published active concentration | Delta | Status | Notes |
|---|---|---|---|---|---|---|---|
| polygiene-viraloff | zinc_pyrithione | 0.35 (ZnO) + 0.65 (Na-pyrithione) = 1.0 active | https://polygiene.com/viraloff/ · ZPT SDS via Lonza or Arch Chemicals | _pending_ | _pending_ | pending | Zinc pyrithione textile finishes typically 0.5-2% ZPT in solution. The "1.0 active" assumption looks dramatically overstated. |
| sanitized-zinc-pyrithione (sanitized-t-99-19) | zinc_pyrithione | 1.0 | https://www.sanitized.com/en/technologies/ | _pending_ | _pending_ | pending | Sanitized T 99-19 — ZPT-based. Check Sanitized's product specific TDS. |
| heiq-hyprotecht | zinc_nano (archetype not yet defined) | n/a — archetype missing | https://www.heiq.com/products/textile-technologies/heiq-hyprotecht/ | _pending_ | _pending_ | pending | Crescoating zinc. HeiQ HyProTecht — verify nano-zinc concentration. |
| **bioACTIV AM (IFTNA)** — verify | _separate IFTNA archetype_ | already verified Phase 16 — EPA label 87246-12, 97% ZnO | https://www3.epa.gov/pesticides/chem_search/ppls/087246-00012-... | 97% ZnO confirmed | n/a | **verified previously** | Andrew confirmed in Phase 16. Validate the existing entry in competitors.ts matches the EPA label. |

### QAC silane (7 entries)

| ID | Chemistry archetype | Current assumption | SDS / EPA label | Published active concentration | Delta | Status | Notes |
|---|---|---|---|---|---|---|---|
| aegis-microbe-shield | qac_silane | 1.0 (silane 0.6 + amine 0.4 = 100% active) | https://www3.epa.gov/pesticides/chem_search/ppls/064881-00001-20110817.pdf | _pending_ | _pending_ | pending | Aegis AEM 5772-1 EPA label 64881-1 — registered 1976. Active ingredient is 3-(Trimethoxysilyl)propyldimethyloctadecyl ammonium chloride. Section 1 should list w/w. Typical AEM5772 is 5% active in methanol solvent. |
| microban-additive-gs | qac_silane | 1.0 | https://www3.epa.gov/pesticides/chem_search/ppls/042182-00014-20230317.pdf | _pending_ | _pending_ | pending | Microban GS EPA label 42182-14. Sept 2023 vintage. |
| microban-cs5a | qac_silane | 1.0 | https://www3.epa.gov/pesticides/chem_search/ppls/042182-00028-20230331.pdf | _pending_ | _pending_ | pending | Microban CS5-A 42182-28. Already labeled "low-concentration variant for consumer-facing" in competitors.ts — verify 3.6% claim. |
| biosafe-organosilane | qac_silane | 1.0 | https://technical.gelest.com/brochures/biosafe/biosafe-organosilane-antimicrobials/ · EPA 83019-1/-2/-3 | _pending_ | _pending_ | pending | Gelest BIOSAFE — multiple variants under 83019. Each variant has its own active %. Check Gelest tech brochure. |
| sanitized-puretec | qac_silane | 1.0 | https://www.sanitized.com/en/technologies/sanitized-puretec/ | _pending_ | _pending_ | pending | Sanitized's silane-quat product line. EPA-approved via Sanitized AG; specific reg # not in competitors.ts. |
| ultrafresh-dw56 | qac_silane | 1.0 | https://www3.epa.gov/pesticides/chem_search/ppls/010466-00046-20150121.pdf | _pending_ | _pending_ | pending | Thomson Research Associates Ultra-Fresh DW-56. EPA 10466-46. |
| **iftna-protx2** — verify | qac_silane | n/a — already verified | https://www3.epa.gov/pesticides/chem_search/ppls/087246-00013-20230410.pdf | 0.18% Ag + 0.26% PHMB + 0.44% propiconazole + 0.65% silane-quat | n/a | **verified previously** | Andrew confirmed in Phase 16. Validate the existing entry in competitors.ts matches the EPA label and the marketing-vs-EPA discrepancy is documented. |

### Other chemistries (5 entries)

| ID | Chemistry archetype | Current assumption | SDS / EPA label | Published active concentration | Delta | Status | Notes |
|---|---|---|---|---|---|---|---|
| cupron-copper | copper | 0.5 (CuSO₄/acetate) + 0.8 (PDA binder) = 1.3 (over 100% — math broken) | Cupron tech sheets | _pending_ | _pending_ | pending | Cupron copper-infused textiles typically use copper oxide at 0.5-2% w/w in finish. The 1.3 ratio is structurally broken (rawMaterials don't sum to ≤ 1.0). |
| chitosan-generic | chitosan (archetype not yet defined) | n/a — archetype missing | EPA chitosan minimum-risk pesticide exemption page | _pending_ | _pending_ | pending | Commercial chitosan textile finishes typically 0.5-1% chitosan in aqueous acetic acid solution. EPA exempts chitosan from registration (Section 25(b)). |
| nordshield-citex | citric_acid (archetype not yet defined) | n/a — archetype missing | NordShield TDS | _pending_ | _pending_ | pending | Verify 8% citric acid claim from NordShield CiTex TDS. |
| nordshield-biolayr | resin_acid (archetype not yet defined) | n/a — archetype missing | NordShield TDS | _pending_ | _pending_ | pending | Coniferous resin acid concentration. |
| nordshield-crisp | wood_extract (archetype not yet defined) | n/a — archetype missing | NordShield TDS | _pending_ | _pending_ | pending | Wood extract concentration. |

### Fragrance / microcapsule (out of CO2 math scope — keep separate)

| ID | Chemistry archetype | Notes |
|---|---|---|
| heiq-fresh | mint_extract | Microencapsulated mint scent — released at wear cycle. Different math model. |
| heiq-mint | mint_extract (legacy) | Legacy entry. May be subsumed by heiq-fresh. |

---

## Aggregate findings (filled in as audits complete)

- Silver-based: _pending audit_
- Zinc-based: _pending audit_
- QAC silane: _pending audit_
- Other: _pending audit_
- Estimates remaining (no public SDS available): _list_

## Sustainability page CO2 totals — before vs after audit

Per 100,000m of fabric. The "before" column captures the pre-audit values from the live `/sustainability` render. The "after" column is filled in after Track 6 (SourcedNumber refactor) lands.

| Competitor | Before audit (kg CO2 / 100,000m) | After audit (kg CO2 / 100,000m) | Delta |
|---|---|---|---|
| Silvadur 930 Flex | 434,339 | _pending_ | _pending_ |
| Polygiene StayFresh | _pending_ | _pending_ | _pending_ |
| Aegis Microbe Shield | _pending_ | _pending_ | _pending_ |
| FUZE F1 (control) | _unchanged — FUZE-side numbers locked per Andrew_ | _unchanged_ | 0 |

---

## Escalations to Andrew

_(populated as audit proceeds)_

- _(none yet)_

## Methodology limits

- Public SDSs are the canonical source. Where a manufacturer keeps SDSs behind contact-form gates (Polygiene, Sanitized for some products), this audit relies on (a) EPA label PDFs (which contain Section 1 active ingredient %), (b) manufacturer technical bulletins indexed by Google, (c) third-party safety databases (PubChem, Hazardous Substances Data Bank).
- EPA Master Label PDFs (PPLS) list active ingredient % w/w in Section 1. This is the most reliable single source for EPA-registered antimicrobials.
- For chemistries that are NOT EPA-registered (chitosan, citric acid, wood extracts, mint extracts), TDS values from manufacturer sites are the primary source.
- Where no public source is locatable, the entry is flagged `estimated: true` with an industry-average basis citation (typically peer-reviewed textile finishing literature).
