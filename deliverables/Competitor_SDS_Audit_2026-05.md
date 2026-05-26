# Competitor SDS Audit — 2026-05

**Spec:** specs/2026-05-26-phase-19-5-competitor-sds-audit.md
**Audit run:** 2026-05-26
**Auditor:** Phase 19.5 (Code, automated SDS lookups + EPA Master Label fetches)

## Why this audit ran

Andrew flagged the Silvadur 930 Flex assumption in `src/lib/sustainability.ts` of 0.45 kg silver salt per kg product (~45% Ag) as likely dramatically overstated vs. published LANXESS SDS data. The audit confirmed it — and found the situation is **worse than Andrew suspected**, plus uncovered five chemistry **misclassifications** in `src/lib/competitors.ts`.

## Headline findings

1. **Silvadur 930 Flex is 0.098% Ag**, not 45%. The current sustainability.ts assumption is **459× overstated** (not 30×). Source: EPA Reg 464-785, confirmed via Pomerix EPA Master Label mirror.

2. **Five competitor entries are misclassified by chemistry**:
   - `polygiene-viraloff` — labeled `zinc_pyrithione`, actually silver chloride per Polygiene's own product page
   - `sanitized-zinc-pyrithione` (T 99-19) — labeled zinc, actually silane-QAC per NICNAS public report
   - `heiq-hyprotecht` — labeled `zinc_nano`, actually silver per HeiQ's own product page (the "Crescoating zinc" reference came from an academic R&D paper, not a HeiQ commercial product)
   - `microban-additive-gs` — labeled `qac_silane`, actually 100% benzoic acid per EPA Reg 42182-14
   - `ultrafresh-dw56` — labeled `qac_silane`, actually 15% zinc pyrithione + 15% thiabendazole per EPA Reg 10466-46

3. **Cupron has structurally broken math**: 0.5 CuSO4 + 0.8 polydopamine binder = 1.3 kg/kg product (over 100%). Also wrong vehicle — Cupron is masterbatch fiber extrusion, not a topical PDA finish. Corrected value 2.6% Cu2O per Cupron's own peer-reviewed paper.

4. **BioLayr is UNDERSTATED** in our model: we assume 1.5% on-fabric, but Nordic BioTech's own US patent 12,054,880 B2 documents 0.2% w/w. This makes BioLayr a slightly less-impactful comparison than we've been claiming. Per spec ESCALATION rules, Andrew should know before this lands.

5. **Five chemistry archetypes missing entirely** from `UPSTREAM_MANUFACTURING`: `chitosan`, `citric_acid`, `resin_acid`, `wood_extract`, `zinc_oxide`. Competitors using these chemistries currently fall back to `silver_chloride` math by accident (line 564 default). All five archetypes added in T5 commit.

6. **EPA Master Label PDFs at `www3.epa.gov/pesticides/chem_search/ppls/`** are not WebFetch-readable directly (binary/compressed). The Pomerix EPA mirror (`pomerix.com/pesticides/...`) reproduces Section 1 quotes verbatim and was the canonical source for several rows.

## Aggregate corrections

| Chemistry archetype | Old kgPerKgProduct (sum of rawMaterials) | New kgPerKgProduct (active in as-sold) | Avg correction factor |
|---|---|---|---|
| silver_ion (Silvadur class) | 0.45 | 0.001 — 0.025 depending on product | 18× – 459× lower |
| silver_chloride (Polygiene class) | 0.63 | ~0.020 | 32× lower |
| silver_nano (HeiQ AGS class) | 0.63 | 0.193 | 3.3× lower |
| silver_zeolite | _archetype missing_ | 0.025 | new |
| zinc_pyrithione | 1.0 | ~0.02 | 50× lower |
| zinc_oxide | _archetype missing_ | 0.97 (iFabric BioACTIV AM 97% ZnO) | new |
| qac_silane | 1.0 | 0.036 (CS5-A RTU) – 0.72 (AEM 5772 concentrate) | 1.4× – 28× lower |
| copper | 1.3 (broken — over 100%) | 0.026 (Cupron 2.6% Cu2O) | 50× lower |
| chitosan | _archetype missing_ | 0.01 | new |
| citric_acid | _archetype missing_ | 0.07 | new |
| resin_acid | _archetype missing_ | 0.002 | new |
| wood_extract | _archetype missing_ | 0.005 (estimated) | new |

## Per-competitor audit rows

### Silver-based (8 entries)

| ID | Active ingredient % w/w | Source | Status | Notes |
|---|---|---|---|---|
| silvadur-930 | 0.098% Ag (CAS 7440-22-4) | EPA Reg 464-785 via Pomerix mirror | corrected | Andrew's 30× hunch confirmed and exceeded — actual is 459× lower than the 0.45 assumption. |
| polygiene-stayfresh | ~2% AgCl (estimated) | https://polygiene.com/stayfresh/ + industry avg | estimated | Polygiene refuses to publish % w/w on any public page. Industry-average for AgCl textile dispersions is 2-5%. |
| sanitized-silver | ~2.5% (estimated) | https://www.sanitized.com/en/technologies/sanitized-silver/ — 404 at audit time | estimated | Sanitized AG SDS not publicly accessible. Industry avg. |
| agion-silver-zeolite | 2.5% Ag on zeolite | Sciessent technical literature + US Patent 7,645,824 + EPA Reg 88165-5 | corrected | Canonical Agion Type AG loading. |
| zeomic-silver | 2.5% Ag (Type AJ) / 3.5% Ag + 6.1% Cu (Type AC) | EPA Reg 71227-1 via Pomerix mirror | corrected | Spec referenced Type AC — bimetallic. Pick variant carefully. |
| vesta-silver-copper | ~3.5% Ag (estimated) | no public source | estimated | Small distributor. Likely re-labeled Zeomic or Sciessent material. |
| heiq-ags20 | 19.3% Ag | EPA Reg 85249-1 + SourceWatch mirror | corrected | Outlier — masterbatch concentrate, diluted heavily downstream. |
| heiq-viroblock | ~0.5% Ag (estimated) | HeiQ public page + Lyreco TDS (gated) | estimated | HeiQ markets "minute amount of recycled silver" without disclosing %. Recycled fraction not quantified publicly. |

### Zinc-based (4 entries) — 3 misclassifications

| ID | Actual chemistry | Audit finding | Status |
|---|---|---|---|
| polygiene-viraloff | **silver chloride**, NOT zinc | Polygiene's own page lists "silver chloride" as active. Move to `silver_chloride` archetype. ~0.2% w/w (estimated). | **ESCALATE** misclassification |
| sanitized-zinc-pyrithione (T 99-19) | **silane-QAC**, NOT zinc | NICNAS public report STD/1230 names dimethyltetradecyl-[3-(trimethoxysilyl)propyl]-ammonium chloride. ~5% w/w. | **ESCALATE** misclassification |
| heiq-hyprotecht | **silver**, NOT zinc | HeiQ's own page describes HyProTecht as "silver technology." "Crescoating zinc" in the spec came from a 2022 PMC academic paper, not a HeiQ product. ~0.15% w/w (estimated). | **ESCALATE** misclassification |
| iftna-bioactiv-am | zinc oxide — confirmed | EPA Reg 87246-12 stamped Oct 06, 2022: "Zinc Oxide 97% / Other 3%". Phase 16 verification correct. | verified |

### QAC silane (7 entries) — 2 misclassifications

| ID | Active ingredient % w/w | Source | Status | Notes |
|---|---|---|---|---|
| aegis-microbe-shield | 72% (AEM 5772 master) / 3.6% (RTU AEM 5772-5) / 42% (AEM 5700) | EPA Reg 64881-2 / 64881-7 / 64881-1 | corrected | Multi-SKU family. The competitors.ts entry should clarify which SKU is being modeled. |
| iftna-protx2 | 1.53% total (0.18% Ag + 0.26% PHMB + 0.44% propiconazole + 0.65% silane-quat) | EPA Reg 87246-13 | verified | Phase 16 values reconfirmed. 98.47% "Other Ingredients." Marketing-vs-EPA discrepancy stands. |
| microban-additive-gs | **100% benzoic acid**, NOT silane-quat | EPA Reg 42182-14 | **ESCALATE** misclassification | Move to a new `organic_acid` archetype. |
| microban-cs5a | 3.6% w/w | EPA Reg 42182-28 | corrected | competitors.ts "3.6%" tag was already correct. |
| biosafe-organosilane | 5% (HM4005/HE4005 textile finish) | Gelest BIOSAFE brochure | corrected | Product family; pick HM4005 as canonical textile-finish form. |
| sanitized-puretec | ~5% (estimated) | https://www.sanitized.com/silane-quat/ | estimated | Sanitized AG does not publish % w/w. EPA reg not findable in PPLS during audit. |
| ultrafresh-dw56 | **15% zinc pyrithione + 15% thiabendazole**, NOT silane-quat | EPA Reg 10466-46 | **ESCALATE** misclassification | Move to `zinc_pyrithione` archetype. |

### Other chemistries (5 entries) — 4 archetypes need creation

| ID | Active ingredient % w/w | Source | Status | Notes |
|---|---|---|---|---|
| cupron-copper | 2.6% Cu2O (masterbatch PET yarn) | Cupron-authored paper PMC7930948 + Palmer Holland PET masterbatch | corrected | Current 1.3 kg/kg is structurally broken (>100%). PDA binder is wrong vehicle entirely — Cupron is masterbatch fiber extrusion. |
| chitosan-generic | ~1% on-fabric (industry avg) | Ferrero & Periolatto 2012 + EPA 25(b) exemption page | estimated | New `chitosan` archetype. EPA-EXEMPT under FIFRA Section 25(b) — better regulatory optics than silver/QAC. |
| nordshield-citex | 7% citric acid on fabric (peer-reviewed proxy) | Schramm et al. PMC3046493 | corrected | Current 8% claim within ±15% — defensible. EPA-EXEMPT under FIFRA Section 25(b). New `citric_acid` archetype. |
| nordshield-biolayr | 0.2% w/w on-fabric | Nordic BioTech patent US 12,054,880 B2 | **ESCALATE — competitor LOWER-impact than we said** | competitors.ts says 1.5% — patent says 0.2%. Correcting this makes BioLayr a less dramatic comparison. Per spec ESCALATION rules, Andrew should know. |
| nordshield-crisp | ~0.5% (estimated) | Same patent family + nordshield.com/crisp qualitative description | estimated | No Crisp-specific quantitative source. Cellulose-substrate-only limitation is the more lethal competitive jab. |

### Fragrance / microcapsule (out of CO2 math scope)

| ID | Notes |
|---|---|
| heiq-fresh, heiq-mint | Different math model — released-on-wear microcapsules. Not corrected by this audit. |

---

## Escalations to Andrew

Per spec, "the audit reveals a competitor whose actual concentration makes our existing CO2 comparison WORSE for FUZE" requires escalation. Found one:

1. **BioLayr is LESS impactful than we've been claiming.** The current `competitors.ts` entry assumes 1.5% on-fabric load. Nordic BioTech's own patent documents 0.2% — a **7.5× reduction** in the implied per-fabric chemical mass. The FUZE-vs-BioLayr comparison still wins by ~2,000× (FUZE F1 at 0.0001% on-fabric vs BioLayr at 0.2%), but the dramatic narrative compresses. Recommended action: keep the corrected 0.2% value, augment the competitive narrative with cellulose-substrate-only limitation (BioLayr can't treat polyester/nylon at all, which kills it for the performance textile majority).

Plus five chemistry misclassifications in `competitors.ts` that need explicit confirmation before the rendered sustainability page tells customers "Competitor X is zinc-based" when Competitor X is actually silver-based:

2. `polygiene-viraloff` `chemistryType: zinc_pyrithione` → should be `silver_chloride`
3. `sanitized-zinc-pyrithione` `chemistryType: zinc_pyrithione` → should be `qac_silane`
4. `heiq-hyprotecht` `chemistryType: zinc_nano` → should be `silver_chloride` (or new `silver_misc`)
5. `microban-additive-gs` `chemistryType: qac_silane` → should be new `organic_acid` (100% benzoic acid)
6. `ultrafresh-dw56` `chemistryType: qac_silane` → should be `zinc_pyrithione` (15% ZPT + 15% thiabendazole)

These are LEAVING the misclassifications in place for now (T2-T5 commits correct the chemistry-archetype values themselves; the competitor-entry chemistryType pointers are unchanged pending Andrew's review). The audit tracker logs each as ESCALATE so Andrew can sign off before the misclassification fix lands.

## Methodology limits encountered

- **EPA Master Label PDFs at `www3.epa.gov/pesticides/chem_search/ppls/`** are binary; WebFetch cannot extract text directly. Workaround: Pomerix EPA mirror (`pomerix.com/pesticides/...`) reproduces Section 1 verbatim with citation. Used as canonical proxy for ~6 entries. Direct EPA URLs preserved as primary `sdsUrl` citation in the code; Pomerix URLs appear as backup in `notes`.
- **Polygiene, Sanitized AG, HeiQ** all decline to publish % w/w on public product pages or accessible SDSs. Their concentrations rely on industry-average estimates flagged `estimated: true` with peer-reviewed basis citations.
- **NordShield (BioLayr / Crisp / CiTex)** publishes no public TDS for any product. Their US patent 12,054,880 B2 is the only manufacturer-authored quantitative source — used directly for BioLayr; extrapolated for Crisp.

## Sources actually used

Primary EPA labels (active ingredient Section 1):
- EPA Reg 464-785 (Silvadur 930 Flex) — Pomerix mirror
- EPA Reg 85249-1 (HeiQ AGS-20) — SourceWatch mirror
- EPA Reg 71227-1 (Zeomic Type AJ) — Pomerix mirror
- EPA Reg 88165-5 (Sciessent Agion Type AG) — combined patent + EPA mirror
- EPA Reg 87246-12 (iFabric BioACTIV AM) — direct
- EPA Reg 87246-13 (iFabric PROTX2) — direct
- EPA Reg 64881-1/-2/-7 (Aegis AEM 5700/5772 family) — direct
- EPA Reg 42182-14 (Microban Additive GS) — direct
- EPA Reg 42182-28 (Microban CS5-A) — direct
- EPA Reg 10466-46 (Ultra-Fresh DW-56) — direct
- EPA Reg 83019-1/-2/-3 (Gelest BIOSAFE) — via Gelest brochure

Peer-reviewed / patent / industry:
- Borkow et al. (Cupron paper) — PMC7930948
- Ferrero & Periolatto (chitosan textile) — Carbohydrate Polymers 2012
- Schramm et al. (citric acid antimicrobial cotton) — PMC3046493
- Nordic BioTech BioLayr patent — US 12,054,880 B2
- NICNAS Public Report STD/1230 (Sanitized T 99-19) — Australian regulator
- Sciessent / AgION technical literature (Knowde)
- Aurubis EFD 2024 + ecoinvent 3.10 (existing CO2 emission factors — unchanged by this audit)
