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

---

## 2026-05-26 follow-up — FreshTX addition

Phase 19.5 spec follow-up (Track 2) added IFTNA FreshTX to
`src/lib/competitors.ts` and asked the audit to document the EPA-
registration question. Andrew's standing rule (now locked in
CLAUDE.md "Competitive Intelligence Persistence Rule"): every
competitive deep-dive ends with a persisted entry in the canonical
competitor catalog.

### Product

- **Name:** FreshTX Odour-Neutralizing Textile Finish
- **Manufacturer:** Intelligent Fabric Technologies (North America)
  Inc. (IFTNA), wholly-owned subsidiary of iFabric Corp (CVE:IFA,
  OTC:IFABF). 525 Denison Street, Unit 1, Markham, Ontario L3R1B8,
  Canada.
- **Product page:** https://www.iftna.com/freshtx
- **Marketed positioning:** "odour-neutralizing technology" for fiber-
  level odor control. Target market: chefs, healthcare workers,
  athletes, runners, parents, pet owners. Apparel + bedding +
  towels + kitchen textiles + footwear.

### EPA-registration hunt (2026-05-26 audit)

**Finding: no EPA registration discoverable.**

Sources checked:
- FreshTX product page (https://www.iftna.com/freshtx) — no EPA Reg
  Number anywhere on the page, no certification badges, no
  active-ingredient %, no concentration claim.
- EPA PPLS search interface (https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:1)
  — supports search by product name / company / registration number.
  PPLS web interface does not return a hit for "FreshTX" by name,
  and registrant 87246 (iFabric's company number) is not publicly
  enumerable through the web search proxy.
- WebSearch for "FreshTX iFabric EPA registration" — no
  direct hit. Discovered adjacent iFabric press releases instead.
- iFabric / IFTNA press releases (AccessNewswire 2024-04-23,
  StockTitan, Fibre2Fashion). Three additional iFabric antimicrobial
  products were announced as EPA-registered in 2024 — **bioFRESH**
  (bio-based), **PROTX2 S** (hydrothermal mineral-based), and
  **bioTX** (metal-free) — but none of the public press releases
  disclosed their reg numbers, and **none of those press releases
  mention FreshTX by name**.

Publicly-known iFabric EPA registrations:
- 87246-12 — BioACTIV AM (97% ZnO; verified Phase 16)
- 87246-13 — PROTX2 (1.53% total actives, silane-quat + Ag +
  PHMB + propiconazole; verified Phase 16)
- 87246-?? — bioFRESH, PROTX2 S, bioTX (announced 2024-04-23, reg
  numbers not published)

### Marketing claims that require EPA registration under FIFRA

Verbatim from iftna.com/freshtx:
- "protects fibres from odour-causing bacteria"
- "captures, prevents and neutralizes growth and fungal buildup"
- "odour neutralizing technology has the capabilities to combat even
  the smelliest bacterias"

Per the EPA's interpretation of FIFRA Section 2(u), "pesticide"
includes any substance intended to **prevent, destroy, repel, or
mitigate** any pest including bacteria and fungi. Marketing claims
of antibacterial / antifungal efficacy require federal pesticide
registration regardless of the active ingredient's dose.

### Three scenarios consistent with the evidence

1. **25(b) exemption.** FIFRA Section 25(b) exempts minimum-risk
   pesticides whose active ingredients appear on the EPA approved
   list (citric acid, lactic acid, plant essential oils, chitosan,
   cinnamon oil, clove oil, garlic oil, etc.). FreshTX's "positive
   and negative ion technology" marketing language does not match
   any 25(b)-eligible chemistry. **Low-confidence scenario.**

2. **Unregistered product making federally-regulated antimicrobial
   claims** — a FIFRA Section 12(a)(1)(A) violation. The marketing
   page makes explicit "bacteria" + "fungal" mitigation claims
   without showing an EPA reg number. Misbranding under Section
   12(a)(1)(E) also applies if any registered claim is
   substantively different from the marketing.

3. **Private-label OEM finish.** FreshTX is sold to brands who then
   carry the registration obligation downstream. The iftna.com
   website footer disclaimer ("Due to worldwide regulatory
   differences, not all information found on our website can be
   applied and are valid in all countries or regions") supports
   this routing. iFabric retains EPA-registered finished-textile
   products separately (PROTX2 etc.) and ships FreshTX as the
   non-public-claims chemistry that brand customers use as their
   choice.

The customer-conversation framing per the spec's escalation rules
becomes: ask brands sourcing FreshTX which scenario applies. If
(3), they may be unknowingly carrying the FIFRA exposure
themselves — a competitive opening similar to the previously
documented PROTX2 marketing-vs-EPA discrepancy.

### Chemistry-archetype routing decision

competitors.ts entry routed to `chemistryType: "qac_silane"` at
LOW confidence. Justification: amphoteric organosilane quaternary
ammonium is the commercial chemistry most commonly associated
with "positive and negative ion technology" marketing language —
Microban CS5-A and Aegis AEM 5772 make the same exact claim. No
active ingredient % or chemistry name is disclosed by IFTNA, so
this is a best-fit estimate, not verified.

If a future EPA registration surfaces under registrant 87246 and
discloses FreshTX's actual chemistry, swap the chemistryType to
the EPA-disclosed active ingredient and update epaRegNote with
the actual reg number — the "three scenarios" framing drops away.

### Sources

- iftna.com/freshtx product page (verified 2026-05-26)
- EPA PPLS pesticide label search (https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:1)
- iFabric Corp press releases announcing bioFRESH + PROTX2 S
  (AccessNewswire 2024-04-23, StockTitan IFABF)
- Fibre2Fashion iFabric bioTX announcement
- EPA PPLS PROTX2 label PDF (https://www3.epa.gov/pesticides/chem_search/ppls/087246-00013-20230410.pdf)
- EPA PPLS BioACTIV AM label PDF (https://www3.epa.gov/pesticides/chem_search/ppls/087246-00012-20221006.pdf)

### Sustainability-page impact

FreshTX routes through `qac_silane` archetype in
`UPSTREAM_MANUFACTURING` — corrected 2026-05-26 to 3.6% active
in Microban CS5-A RTU class. CO2/water/waste/VOC math for the
FreshTX competitor card on /sustainability will reflect that
archetype's audited values. If chemistry confidence increases to
"verified" later (via EPA label disclosure), the archetype
routing may change.

---

## 2026-05-26 follow-up — Rudolf Group antimicrobial line (5 products)

Overnight request from Andrew for full review of Rudolf's RUCO-BAC
family + SILVERPLUS + Sanitized Puretec distribution relationship.
Target stores potential SILVERPLUS replacement use case.

### Headline findings

1. **Rudolf's own RUCO-BAC disclaimer (https://rudolf.com/uploads/rudolfgroup/Documents/disclaimer_ruco_bac_series_en.pdf) explicitly states 'antibacterial, bactericidal, germicidal' claims are NOT EPA-acceptable without product-specific registration.** Yet RUCO-BAC marketing uses all three terms freely. Same FIFRA Section 12(a)(1)(A) misbranding pattern caught with IFTNA FreshTX.

2. **In Canada — explicit admission that AGP, AGL, HSA CONC, CID OF, and ZPY are NOT registered by PMRA.** Rudolf cannot legally make antimicrobial claims in Canada on any of these products. They punt the regulatory burden to the brand customer.

3. **AGXX (RUCO-BAC ROX) is the first ruthenium-containing competitor in our catalog.** Ruthenium has ~5000 kg CO2/kg refinery-gate (vs silver's 158). At AGXX's typical 87.5%/12.5% Ag/Ru ratio, ruthenium contributes 80%+ of the mining-stage CO2 despite being the minority component by mass. **AGXX is the highest per-kg-active CO2 antimicrobial in our entire catalog** by a substantial margin.

4. **RUCO-BAC AGL's "non-migrating" claim is contradicted by published silver-textile wash-leaching studies** (Reed et al. ES&T 2010, Benn & Westerhoff ES&T 2008). All silver textile finishes migrate; "non-migrating" is marketing language for "binds in polymer matrix with slower release."

5. **SILVERPLUS is the apparel-market sub-brand wrapping AGP + AGL.** Most likely Target replacement candidate. Customer-facing comparison doc built.

6. **Sanitized Puretec entry updated** to clarify Rudolf-exclusive-global-distribution relationship — three-handoff supply chain (Sanitized Burgdorf CH → Rudolf Geretsried DE → regional Rudolf subsidiary → mill) adds distribution CO2 vs single-source competitors.

### Per-product audit rows

| ID | Active ingredient % w/w | Source | Status | Notes |
|---|---|---|---|---|
| rudolf-ruco-bac-rox | ~0.2% on-fabric (0.175% Ag + 0.025% Ru estimated) | Frontiers Microbiology 2018 (PMC6299908) + mSphere 2023 AGXX composition + Heraeus published technology page | estimated | NO US EPA registration discoverable. EU BPR approval confirmed. Highest per-kg-active CO2 in catalog. |
| rudolf-ruco-bac-agp | 0.5-1.5% on-fabric (estimated, Rudolf doesn't disclose) | Rudolf disclaimer + 3rd-party search result claiming EPA Reg 84189-2 | estimated + PPLS unverified | EPA reg # claimed; EPA PPLS lookup 2026-05-26 did NOT return public 84189-2 label. Same FIFRA misbranding pattern on marketing. |
| rudolf-ruco-bac-agl | 0.5-1.5% on-fabric (estimated) | Rudolf disclaimer | estimated | "Non-migrating" marketing claim contradicted by peer-reviewed silver-textile wash studies. |
| rudolf-silverplus | 0.5-2% on-fabric (estimated, AgCl industry avg) | https://rudolf.com/technologies/silverplus + same underlying AGP/AGL | estimated | Apparel sub-brand. Most likely Target replacement. |
| sanitized-puretec (UPDATED) | Silane-QAC ~5% (existing entry) | Rudolf-exclusive distribution clarified | verified + updated | Three-handoff supply chain adds distribution CO2 vs single-source. |

### EPA PPLS verification — 2026-05-26 result

Direct lookup against the EPA PPLS public index (ordspub.epa.gov/ords/pesticides/f?p=PPLS:1) by both registrant name "Rudolf" and the third-party-cited registration number "84189-2":

- **No public label returned for 84189-2** as a Rudolf product. The registration-number cite appears to originate from a single non-EPA source that has not been corroborated by the EPA database.
- **Rudolf GmbH does not appear under registrant-name search** as the holder of an EPA pesticide registration matching the RUCO-BAC family in the public PPLS index as of the 2026-05-26 lookup.
- **Conclusion: the EPA Reg 84189-2 claim is unverified.** Until Rudolf provides a label PDF URL or the EPA PPLS index updates to include a matching product, the marketing claims of "EPA registered" for AGP / AGL / SILVERPLUS read as FIFRA Section 12(a)(1)(A) misbranding risk. The competitors.ts epaRegNote for all three products has been flagged accordingly.
- **EU BPR approval for AGXX is separately verifiable** through ECHA's biocidal-products database and stands on its own — but does NOT grant US EPA legal status.

### Methodology limits

- **Rudolf publishes no SDS for any product on their public website.** All composition % values are estimated using industry-average ranges for the respective chemistry classes, flagged `estimated: true` with basis citations per the Phase 19.5 audit discipline.
- **EPA registration numbers claimed in third-party search results require direct PPLS verification.** Track 6 of the spec ran this verification — see findings above.
- **AGXX silver:ruthenium ratio comes from peer-reviewed academic research, not Heraeus' own published documentation.** Specific RUCO-BAC ROX formulation may differ from the literature baseline.

### Sources

- Rudolf RUCO-BAC series disclaimer: https://rudolf.com/uploads/rudolfgroup/Documents/disclaimer_ruco_bac_series_en.pdf
- Rudolf SILVERPLUS: https://rudolf.com/technologies/silverplus
- Heraeus AGXX product page: https://www.heraeus-precious-metals.com/en/products-solutions/category/antimicrobial-technology/about-agxx/
- Heraeus + Rudolf partnership press release: https://kohantextilejournal.com/heraeus-precious-metals-and-rudolf-form-strategic-partnership-to-bring-agxx-technology-to-the-textile-industry/
- AGXX Frontiers Microbiology 2018: https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2018.03037/full
- AGXX mSphere 2023 (silver-ruthenium aminoglycoside potentiation): https://journals.asm.org/doi/full/10.1128/msphere.00190-23
- AGXX mSphere 2025 (gram-negative oxidative stress mechanism): https://journals.asm.org/doi/10.1128/msphere.00017-25
- Reed et al. ES&T 2010 (silver textile leaching) — peer-reviewed reference
- Benn & Westerhoff ES&T 2008 (silver-nanoparticle wash release) — peer-reviewed reference
- Aurubis EFD 2024 (silver CO2) — existing reference in sustainability.ts
- CRU Group precious metal LCA 2024 (ruthenium CO2) — new citation
- EPA PPLS public index: https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:1

---

## 2026-05-27 — EPA PPLS verification UPDATE (Rudolf 84189-1 + 84189-2)

The 2026-05-26 audit row recorded the Rudolf EPA registrations as "claimed / unverified." Direct PPLS PDF fetch on 2026-05-27 against the EPA web server overturns that:

- **EPA Reg 84189-2 — VERIFIED**: Product "Product EP 10%" with alternate brand name **RUCO-BAC AGP**. Active: **Silver Chloride 1.75%**. Registrant: RUDOLF GMBH, Altvaterstrasse 58-64, D-82538 Geretsried, Germany. Master label dated 2016-07-25. PDF: https://www3.epa.gov/pesticides/chem_search/ppls/084189-00002-20160725.pdf
- **EPA Reg 84189-1 — VERIFIED**: Product "Product EP 1%" with alternate brand name **RUCO-BAC AGL**. Active: **Silver Chloride 0.2%**. Same registrant + master label date. PDF: https://www3.epa.gov/pesticides/chem_search/ppls/084189-00001-20160725.pdf

### The lever shifts — registered, but marketing exceeds the registered scope

The earlier "unverified registration → Section 12(a)(1)(A) misbranding risk" framing is OBSOLETE. Both registrations exist and are public-record. The competitive lever is **stronger, not weaker**, because the labels themselves contain explicit treated-article disclaimers that PROHIBIT the very claims Rudolf uses in marketing:

> **From the EPA-approved 84189-2 master label (verbatim):**
> "Manufactured products incorporating Product EP 10% may not make any public health claims relating to antimicrobial activity without first obtaining an EPA registration for the manufactured product which permits such claims. When incorporated into treated articles, this product does not protect users of any such treated articles or others against food borne or disease causing bacteria, viruses, germs, or other disease causing microorganisms."

And the registration acceptance letter carries the canonical Section 12(a)(1)(E) warning:

> "claims made on the website may not substantially differ from those claims approved through the registration process. Therefore, should the Agency find or if it is brought to our attention that a website contains false or misleading statements or claims substantially differing from the EPA approved registration, the website will be referred to the EPA's Office of Enforcement and Compliance."

Yet Rudolf's marketing for RUCO-BAC AGP / RUCO-BAC AGL / SILVERPLUS uses "antibacterial," "antiviral," and "antimicrobial" claims throughout. **Same FIFRA Section 12(a)(1)(E) misbranding pattern caught with IFTNA PROTX2.** The registered use site is "manufacture of polymers, plastics, textiles, and surface coatings" — a treated-article preservative, not a finished-product antimicrobial. Apparel hangtag claims of "antibacterial protection" substantially differ from the registered scope.

### Use rate on the EPA master label

Per the 84189-2 master label: "Maximum Use Rate: 20,000 ppm of product (400 ppm of silver chloride) by weight of goods (equivalent to 5 lb of product to 100 lb of goods)." The 400 ppm AgCl maximum on-fabric loading is materially higher than industry-typical AgCl finishes — our competitors.ts dosageTypical of 10-12 mg/kg captures the at-market deployment range, well below the EPA-allowed ceiling. SILVERPLUS apparel is well within registered dose, but the **claim scope** is the issue, not the dose.

### Updated competitors.ts state

- `rudolf-ruco-bac-agp` — epaRegNumber: "84189-2", epaRegYear: 2016, epaLabelUrl: PPLS PDF
- `rudolf-ruco-bac-agl` — epaRegNumber: "84189-1", epaRegYear: 2016, epaLabelUrl: PPLS PDF
- `rudolf-silverplus` — epaRegNumber: "84189-1 / 84189-2 (inherited)", epaRegYear: 2016, epaLabelUrl: PPLS PDF
- `rudolf-ruco-bac-rox` — unchanged; no AGXX-specific EPA registration discoverable for US

### Sources

- Direct PPLS PDF (84189-1, RUCO-BAC AGL): https://www3.epa.gov/pesticides/chem_search/ppls/084189-00001-20160725.pdf
- Direct PPLS PDF (84189-2, RUCO-BAC AGP): https://www3.epa.gov/pesticides/chem_search/ppls/084189-00002-20160725.pdf
- EPA PPLS public index: https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:1


---

## Phase 19.5 T5 reconciliation — polygiene-viraloff + heiq-hyprotecht (verifiedDate 2026-07-05)

Phase 19.5's T1 pass corrected the `chemistryType` field on the five flagged
misclassifications in `src/lib/competitors.ts` but left the descriptive
fields (`chemistryLabel`, `activeAgent`, `epaRegNumber`, `epaRegNote`,
`heavyMetalReleased`, `aquaticToxicityNote`, `endOfLifeNote`,
`chemicalPriceSource`) still describing the old, wrong chemistry family
on `polygiene-viraloff` (still described zinc pyrithione) and
`heiq-hyprotecht` (still described zinc nanoparticles). Public
`chemistryType` was correct; the human-readable payload contradicted it.

**Verification of the 5 corrected `chemistryType` values against
`UPSTREAM_MANUFACTURING` archetype keys in `src/lib/sustainability.ts`:**

| id | chemistryType | archetype key resolves | fallback used |
|---|---|---|---|
| `polygiene-viraloff` | `silver_chloride` | `silver_chloride` | no |
| `sanitized-zinc-pyrithione` | `qac_silane` | `qac_silane` | no |
| `heiq-hyprotecht` | `silver_chloride` | `silver_chloride` | no |
| `microban-additive-gs` | `organic_acid` | `organic_acid` | no |
| `ultrafresh-dw56` | `zinc_pyrithione` | `zinc_pyrithione` | no |

All five hit their direct-key archetype without triggering the
`chemType.includes("silver") → silver_chloride` fallback at
`src/lib/sustainability.ts:1073`.

### polygiene-viraloff — reconciled to silver chloride

Polygiene ViralOff is publicly described as a silver-chloride antiviral
finish (Ag/Cl salt) tuned to ISO 18184 antiviral test protocol. The
same base chemistry family as Polygiene StayFresh, dosed for antiviral
efficacy rather than antibacterial. The original ZPT / EPA PC Code
92344 framing on this record was a misclassification.

**Fields updated (2026-07-05):**

- `chemistryLabel`: "Zinc Pyrithione" → "Silver Chloride"
- `activeAgent`: "Zinc pyrithione antiviral compound" → "Silver chloride (AgCl) antiviral silver salt"
- `epaRegNumber`: "Uses EPA PC Code 92344 (ZPT)" → "EPA PC Code 072503 (silver salts)"
- `epaRegNote`: replaced ZPT sentence with "Active ingredient silver chloride is EPA-registered. ViralOff antiviral claims tested under ISO 18184." (ISO 18184 antiviral test reference preserved per T5 requirement)
- `heavyMetalReleased`: "Zinc" → "Silver"
- `aquaticToxicityNote`: ZPT / H400/H410 line → silver aquatic-toxicity + EPA 072503 threshold line
- `endOfLifeNote`: ZPT → AgCl → Ag⁰ / Ag₂S wastewater persistence line
- `chemicalPriceSource`: ZPT + liposome vesicles line → silver-chloride antiviral variant line

**Sources:**

- Polygiene ViralOff public product page: https://polygiene.com/viraloff/
- Polygiene StayFresh technical sheet (same silver-chloride base chemistry): https://polygiene.com/stay-fresh/
- EPA PPLS PC Code index for silver salts (072503): https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:1
- ISO 18184 antiviral textile test — https://www.iso.org/standard/71292.html

### heiq-hyprotecht — reconciled to silver (routed to silver_chloride archetype)

HeiQ HyProTecht is HeiQ's silver-based textile antimicrobial platform,
an evolution of the earlier HeiQ Viroblock (silver-in-vesicle delivery
system). HeiQ's public HyProTecht product page markets it as "silver
technology" without publicly disclosing the exact silver species
(elemental Ag⁰ dispersed in Crescoating vesicles vs ionic AgCl salt) or
a HyProTecht-specific EPA registration number. The Phase 19.5 audit
recorded the correction as "zinc → actually silver" (generic silver).

`UPSTREAM_MANUFACTURING` does not carry a bare `silver` archetype key —
existing keys are `silver_chloride`, `silver_ion`, `silver_nano`,
`silver_ruthenium_catalytic`. `chemistryType` is left at
`silver_chloride` (unchanged) because (a) it is the direct-key match
that keeps the sustainability math on a real archetype without
fallback, (b) it aligns with the code owner's prior routing decision,
(c) HeiQ has not publicly disclosed the exact silver species so
choosing `silver_ion` or `silver_nano` would over-specify. All
descriptive fields updated to remove the incorrect zinc/ZnO framing.

**Fields updated (2026-07-05):**

- `chemistryLabel`: "Zinc Nanoparticles (Crescoating)" → "Silver (vesicle-delivered)"
- `activeAgent`: "Zinc nanoparticles grown in-situ via Crescoating" → "Silver antimicrobial dispersed via HeiQ Crescoating vesicle carrier"
- `epaRegNote`: rewritten to state silver active, note the missing HyProTecht-specific EPA number, and explain the sustainability-archetype routing choice
- `heavyMetalReleased`: "Zinc" → "Silver"
- `aquaticToxicityNote`: ZnO bioaccumulation line → silver-ion bioaccumulation line
- `endOfLifeNote`: zinc-nanoparticle wastewater line → silver → Ag⁰ / Ag₂S wastewater persistence line
- `chemicalPriceSource`: ZnO nano estimate → silver antimicrobial in Crescoating vesicle carrier estimate
- In-code comment updated to explain the T5 reconciliation rationale + the archetype-routing rationale

**Sources:**

- HeiQ HyProTecht public product page: https://www.heiq.com/products/textile-technologies/heiq-hyprotecht/
- HeiQ Viroblock legacy documentation (predecessor silver-in-vesicle technology): https://www.heiq.com/products/textile-technologies/heiq-viroblock/
- 2022 PMC paper on in-situ ZnO on textiles (the source of the earlier zinc misclassification — NOT a HeiQ commercial product): https://pmc.ncbi.nlm.nih.gov/articles/PMC9139619/
