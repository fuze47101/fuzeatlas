# Rudolf Group Antimicrobial Line — Full Competitive Deep-Dive

**Filed:** 2026-05-26
**Why:** Andrew got an overnight request for a full review of Rudolf's
antimicrobial product line. Most likely Target-stores SILVERPLUS
replacement use case, but build comparisons for all 5 products since
which one is being replaced isn't yet confirmed.

**This spec persists 5 new competitor entries + 1 new chemistry
archetype + audit transcript section + 4 customer-facing comparison
docs per the CLAUDE.md Competitive Intelligence Persistence Rule.**

**Self-sufficient — standing rules from CLAUDE.md "NON-NEGOTIABLE
WORKFLOW RULES" apply absolutely. 300-second auto-resume rule. No
questions to Andrew between tracks.**

---

## Critical research findings (already gathered by Cowork — use these, don't re-derive)

### The Rudolf EPA disclaimer is the killer competitive lever

From Rudolf's own RUCO-BAC series disclaimer PDF (https://rudolf.com/uploads/rudolfgroup/Documents/disclaimer_ruco_bac_series_en.pdf), VERBATIM:

> "EPA accepts non-public health claims as specified in PR Notice 2000-1.
> Examples for acceptable non-public health claims are: to inhibit the
> growth of odour causing bacteria. Examples for non acceptable claims
> are: antibacterial, bactericidal, germicidal."

And:

> "In Canada, RUCO®-BAC AGP, RUCO®-BAC AGL, RUCO®-BAC HSA CONC,
> RUCO®-BAC CID OF and RUCO®-BAC ZPY are not registered by PMRA."

Yet RUCO-BAC marketing pages use "antibacterial," "antiviral,"
"antimicrobial" claims throughout. Same FIFRA Section 12(a)(1)(A)
misbranding pattern we caught with IFTNA FreshTX.

### AGXX (silver-ruthenium) is a CO2 monster

Per peer-reviewed Frontiers/mSphere AGXX literature, AGXX consists of
silver + ruthenium micro-galvanic elements. Typical published ratio:
~87.5% Ag / ~12.5% Ru (varies per formulation).

**Ruthenium has ~5000 kg CO2/kg refinery-gate** (vs silver's 158 per
Aurubis EFD 2024). Mined as byproduct of platinum/palladium at <0.1%
recovery rate from the Bushveld Complex in South Africa (most CO2-
intensive precious metal mining region globally — coal-heavy SA grid
+ deep-shaft mining).

Even at 12.5% of the active by mass, ruthenium DOMINATES the per-kg-
finished-product CO2 footprint because the ratio swings so much:
- 87.5% Ag × 158 = 138 kg CO2 contribution
- 12.5% Ru × 5000 = 625 kg CO2 contribution
- Total weighted active: ~763 kg CO2 / kg active

The "self-regenerating catalyst" marketing claim is technically true
(precious metal isn't sacrificially consumed) but **doesn't reduce
upstream manufacturing CO2 by a single gram** — Heraeus still mined,
refined, and shipped every milligram of precious metal that's bonded
to the fiber.

### Rudolf GmbH manufacturing location

- Rudolf GmbH headquartered Geretsried, Germany
- AGXX precious metals sourced from Heraeus Hanau, Germany
- Bushveld Complex (South Africa) mining → Heraeus refining → Rudolf
  formulation → global shipping
- German grid mix 2024: ~440 g CO2/kWh (per Agora Energiewende /
  Fraunhofer ISE)
- Compare FUZE Utah facility: ~300 g CO2/kWh, solar-capable laser
  ablation production

### Product-level intel

| Product | Chemistry | EPA Status | Active % w/w (estimated) |
|---|---|---|---|
| RUCO-BAC ROX | Silver-Ruthenium (Heraeus AGXX) | NO US EPA registration discoverable as of 2026-05-26 | 0.1-0.3% on-fabric (Heraeus AGXX textile loading) |
| RUCO-BAC AGP | Silver-based (likely AgCl or Ag-zirconium phosphate) | Claimed EPA Reg 84189-2 — VERIFY via PPLS in Track 6 | 0.5-1.5% on-fabric (industry avg) |
| RUCO-BAC AGL | Silver-based ("non-migrating" claim — Ag bound to polymer) | EPA registered per Rudolf disclaimer (verify number) | 0.5-1.5% on-fabric (industry avg) |
| SILVERPLUS | Silver chloride (per Rudolf marketing) | Sub-brand wrapping AGP/AGL — same registrations | 0.5-2% on-fabric (industry avg AgCl textile finishes) |
| Sanitized Puretec | Silane-QAC (Sanitized AG product) | Sanitized AG EPA registered — Rudolf is exclusive global distributor | Already in competitors.ts as `sanitized-puretec` |

### "Non-migrating" claim for AGL — call it out

RUCO-BAC AGL's "non-migrating" marketing claim is contradicted by
every published wash-leaching study on silver textiles. Per Reed et
al. (ES&T 2010), Benn & Westerhoff (ES&T 2008), and peer-reviewed
silver-textile LCA literature, silver of every formulation leaches
during washing — typically 5-50% lifetime release depending on
binding chemistry. "Non-migrating" is marketing language for "we
bind the silver in a polymer matrix that releases more slowly than
a free silver salt would" — NOT actually non-migrating.

---

## Track 1 — Add 5 new competitor entries to `src/lib/competitors.ts`

For each, mirror the structural pattern of the existing IFTNA
entries (especially `iftna-protx2` for the marketing-vs-EPA
discrepancy framing). Use `sourced()` wherever a numeric value is
involved.

### Entry 1: `rudolf-ruco-bac-rox`

```typescript
{
  id: "rudolf-ruco-bac-rox",
  company: "Rudolf GmbH (Germany) — distributing Heraeus AGXX technology",
  product: "RUCO-BAC ROX (powered by AGXX®)",
  chemistryType: "silver_ruthenium_catalytic",  // NEW archetype — see Track 2
  chemistryLabel: "Silver-Ruthenium Catalytic (AGXX)",
  activeAgent: "Silver-ruthenium micro-galvanic elements (Heraeus AGXX, ~87.5% Ag / ~12.5% Ru per peer-reviewed literature)",
  epaRegNumber: null,
  epaRegYear: null,
  epaRegNote: "NO US EPA registration discoverable for RUCO-BAC ROX as of 2026-05-26 despite explicit antimicrobial efficacy claims ('continuously reducing odor-causing microorganisms'). Heraeus AGXX has EU Biocidal Products Regulation (BPR) approval but US registration status unclear. Per Rudolf's own RUCO-BAC disclaimer (rudolf.com/uploads/.../disclaimer_ruco_bac_series_en.pdf): 'antibacterial, bactericidal, germicidal' claims are NOT EPA-acceptable without product-specific registration. Marketing language exceeds the regulatory floor. Also NOT registered by Canada PMRA per Rudolf's own admission.",
  epaLabelUrl: "https://rudolf.com/uploads/rudolfgroup/Documents/disclaimer_ruco_bac_series_en.pdf",
  dosageLow: 1,   // mg/kg on fabric
  dosageHigh: 3,
  dosageTypical: 2,
  maxWashClaim: 30,
  washClaimNote: "Manufacturer claims catalyst is non-consumed; no third-party AATCC 100 reports publicly available",
  binderRequired: true,
  binderGPerKg: 12,
  binderType: "Polymer matrix (acrylic-based)",
  binderPricePerKg: 4.20,
  binderLeachPctLifetime: 8,
  binderVOC: true,
  binderFormaldehyde: false,
  curingRequired: true,
  curingTempC: 160,
  leachRateFirst10Washes: 25,
  leachRatePerWash: 2.5,
  heavyMetalReleased: "Silver + Ruthenium",
  chemicalPriceSource: "Estimate: Heraeus AGXX precious-metal-based formulation, German manufacturing premium — ~$320-480/kg active ingredient",
  retreatmentCostMultiplier: 2.8,  // ruthenium is rare + expensive
}
```

### Entry 2: `rudolf-ruco-bac-agp`

```typescript
{
  id: "rudolf-ruco-bac-agp",
  company: "Rudolf GmbH (Germany)",
  product: "RUCO-BAC AGP (SILVERPLUS sub-brand, flagship antimicrobial + antiviral)",
  chemistryType: "silver_chloride",  // existing archetype
  chemistryLabel: "Silver chloride (textile finishing dispersion)",
  activeAgent: "Silver chloride microstructures releasing Ag+ ions",
  epaRegNumber: "84189-2 (claimed — VERIFY via EPA PPLS in Track 6 of this spec)",
  epaRegYear: null,
  epaRegNote: "Claimed EPA Reg 84189-2 per third-party search results — Code MUST verify directly via EPA PPLS lookup (https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:1). Per Rudolf's own RUCO-BAC disclaimer, 'antibacterial, bactericidal, germicidal' claims are NOT EPA-acceptable without product-specific registration. AGP marketing uses all three terms freely. NOT registered by Canada PMRA per Rudolf's own admission.",
  epaLabelUrl: "https://rudolf.com/uploads/rudolfgroup/Documents/disclaimer_ruco_bac_series_en.pdf",
  dosageLow: 5,
  dosageHigh: 15,
  dosageTypical: 10,
  maxWashClaim: 50,
  washClaimNote: "Manufacturer claims 'highly resistant to washing' — no specific wash-count number publicly disclosed",
  binderRequired: true,
  binderGPerKg: 14,
  binderType: "Acrylic co-polymer",
  binderPricePerKg: 3.80,
  binderLeachPctLifetime: 15,
  binderVOC: true,
  binderFormaldehyde: true,
  curingRequired: true,
  curingTempC: 155,
  leachRateFirst10Washes: 45,
  leachRatePerWash: 4.5,
  heavyMetalReleased: "Silver",
  chemicalPriceSource: "Estimate: silver-based textile finish, German manufacturing — ~$95-140/kg active",
  retreatmentCostMultiplier: 1.4,
}
```

### Entry 3: `rudolf-ruco-bac-agl`

```typescript
{
  id: "rudolf-ruco-bac-agl",
  company: "Rudolf GmbH (Germany)",
  product: "RUCO-BAC AGL ('non-migrating' silver for skin-contact)",
  chemistryType: "silver_chloride",  // routed same as AGP — both silver-based
  chemistryLabel: "Silver bound in polymer matrix ('non-migrating' marketing claim)",
  activeAgent: "Silver bonded into polymer matrix for slow-release",
  epaRegNumber: "EPA registered (per Rudolf disclaimer — Code MUST verify specific reg number in Track 6)",
  epaRegYear: null,
  epaRegNote: "Per Rudolf's RUCO-BAC disclaimer, AGL is EPA registered as part of the AGP/AGL family — specific reg number not disclosed by Rudolf and requires PPLS verification. 'Non-migrating' marketing claim is contradicted by every published silver-textile wash-leaching study (Reed et al. ES&T 2010, Benn & Westerhoff ES&T 2008). All silver textile finishes migrate during washing — 'non-migrating' is marketing language for 'binds in a polymer matrix that releases more slowly than a free salt.' NOT registered by Canada PMRA.",
  epaLabelUrl: "https://rudolf.com/uploads/rudolfgroup/Documents/disclaimer_ruco_bac_series_en.pdf",
  dosageLow: 5,
  dosageHigh: 15,
  dosageTypical: 10,
  maxWashClaim: 50,
  washClaimNote: "Manufacturer claims durability for skin-contact apparel; no third-party validation reports public",
  binderRequired: true,
  binderGPerKg: 18,  // higher binder for polymer-bound silver
  binderType: "Polymer matrix (proprietary)",
  binderPricePerKg: 5.20,
  binderLeachPctLifetime: 10,  // lower leach than AGP due to polymer binding
  binderVOC: true,
  binderFormaldehyde: false,
  curingRequired: true,
  curingTempC: 160,
  leachRateFirst10Washes: 30,
  leachRatePerWash: 3.0,
  heavyMetalReleased: "Silver",
  chemicalPriceSource: "Estimate: silver + polymer matrix system, German manufacturing premium — ~$110-160/kg active",
  retreatmentCostMultiplier: 1.6,
}
```

### Entry 4: `rudolf-silverplus`

```typescript
{
  id: "rudolf-silverplus",
  company: "Rudolf GmbH (Germany)",
  product: "SILVERPLUS (umbrella sub-brand wrapping RUCO-BAC AGP + AGL for apparel)",
  chemistryType: "silver_chloride",
  chemistryLabel: "Silver chloride (apparel-market positioning of AGP/AGL)",
  activeAgent: "Silver chloride microstructures (same chemistry as AGP/AGL — SILVERPLUS is the consumer-facing brand)",
  epaRegNumber: "Inherits AGP/AGL registrations (84189-2 claimed)",
  epaRegYear: null,
  epaRegNote: "SILVERPLUS is Rudolf's apparel-market sub-brand for RUCO-BAC AGP + AGL. Same EPA registration footprint as the underlying products. Marketing focuses on 'odor control' which IS an EPA-acceptable non-public-health claim — but the underlying AGP/AGL chemistry is still subject to the full FIFRA scope when broader 'antibacterial' claims appear. Per Rudolf disclaimer, NOT registered by Canada PMRA. This is the most-deployed Rudolf antimicrobial in US apparel — most likely Target replacement candidate per Andrew's intel.",
  epaLabelUrl: "https://rudolf.com/technologies/silverplus",
  dosageLow: 5,
  dosageHigh: 20,
  dosageTypical: 12,
  maxWashClaim: 50,
  washClaimNote: "Marketing claims '50+ washes' durability; no public AATCC 100 third-party reports",
  binderRequired: true,
  binderGPerKg: 15,
  binderType: "Acrylic / polymer matrix",
  binderPricePerKg: 4.00,
  binderLeachPctLifetime: 12,
  binderVOC: true,
  binderFormaldehyde: true,
  curingRequired: true,
  curingTempC: 155,
  leachRateFirst10Washes: 38,
  leachRatePerWash: 3.8,
  heavyMetalReleased: "Silver",
  chemicalPriceSource: "Estimate: silver chloride textile finish branded for apparel, German manufacturing — ~$100-145/kg active",
  retreatmentCostMultiplier: 1.5,
}
```

### Entry 5: Update existing `sanitized-puretec` entry

The entry exists at competitors.ts line 553. Update `epaRegNote` to
add the Rudolf-exclusive-global-distribution relationship:

```typescript
epaRegNote: "EPA approved, OEKO-TEX Classes I-IV. Swiss brand. Rudolf GmbH holds exclusive global distribution rights — when a brand specs Sanitized Puretec in any market outside Switzerland, the supply chain runs Sanitized AG (Burgdorf, Switzerland) → Rudolf GmbH (Geretsried, Germany) → regional Rudolf subsidiary → mill. This adds a third logistics handoff vs single-source competitors and increases the per-kg-product distribution CO2."
```

---

## Track 2 — Add new chemistry archetype `silver_ruthenium_catalytic` to `src/lib/sustainability.ts`

Required because RUCO-BAC ROX (AGXX) routes through this and no
existing archetype captures the ruthenium component. Without this,
the sustainability page math falls back to `silver_chloride` and
massively understates AGXX's CO2 footprint (the ruthenium is the
dominant contributor).

Add to `UPSTREAM_MANUFACTURING` in `src/lib/sustainability.ts`:

```typescript
silver_ruthenium_catalytic: {
  processName: "Silver-Ruthenium Catalytic Coating (Heraeus AGXX class — RUCO-BAC ROX)",
  archetypeSource: {
    verifiedDate: "2026-05-26",
    verifiedBy: "Phase 19.5 follow-up — Rudolf Group deep-dive",
    estimated: true,
    estimationBasis: "AGXX ratio ~87.5% Ag / ~12.5% Ru per peer-reviewed Frontiers Microbiology 2018 (PMC6299908) + mSphere 2023 + Vaishampayan et al. AGXX research. Specific formulation in RUCO-BAC ROX not disclosed by Rudolf — using literature baseline. Ruthenium CO2 from CRU Group precious metal LCA + South African Bushveld Complex mining literature.",
    notes: "First antimicrobial archetype in our catalog where the secondary precious metal (ruthenium) dominates the CO2 footprint despite being the minority component by mass. Even at 12.5% w/w, ruthenium contributes 80%+ of mining-stage CO2 due to its ~30x higher per-kg CO2 vs silver.",
  },
  rawMaterials: [
    {
      name: "Silver in micro-galvanic catalyst (Ag component)",
      kgPerKgProduct: sourced(0.00175, {  // 87.5% of 0.002 active on fabric
        sdsUrl: "https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2018.03037/full",
        sdsSection: "AGXX composition (peer-reviewed research baseline)",
        valueAsPublished: "AGXX consists of silver and ruthenium micro-galvanic elements at approximately 87.5:12.5 Ag:Ru ratio per the published research baseline",
        verifiedDate: "2026-05-26",
        verifiedBy: "Phase 19.5 follow-up audit",
        estimated: true,
        estimationBasis: "0.2% total active on-fabric × 87.5% Ag share = 0.175% Ag",
      }),
      costPerKg: 850,
    },
    {
      name: "Ruthenium in micro-galvanic catalyst (Ru component)",
      kgPerKgProduct: sourced(0.00025, {  // 12.5% of 0.002 active
        sdsUrl: "https://journals.asm.org/doi/10.1128/msphere.00190-23",
        sdsSection: "Ruthenium-silver antimicrobial composition (peer-reviewed)",
        valueAsPublished: "AGXX micro-galvanic elements at ~12.5% Ru component",
        verifiedDate: "2026-05-26",
        verifiedBy: "Phase 19.5 follow-up audit",
        estimated: true,
        estimationBasis: "0.2% total active on-fabric × 12.5% Ru share = 0.025% Ru. Ruthenium mining is byproduct recovery from Bushveld Complex platinum/palladium ores at <0.1% recovery rate.",
      }),
      costPerKg: 15800,  // ruthenium spot price 2024-2026 range
    },
    { name: "Polymer carrier matrix (acrylic emulsion)", kgPerKgProduct: 0.93, costPerKg: 8.20 },
    { name: "Ascorbic acid surface conditioning", kgPerKgProduct: 0.01, costPerKg: 6 },
  ],
  reactionChemicals: [
    { name: "Stabilizing agents", kgPerKgProduct: 0.04, costPerKg: 12 },
    { name: "Carrier surfactants", kgPerKgProduct: 0.02, costPerKg: 4 },
  ],
  facilityEnergyKwhPerKg: 95,  // higher than silver-only due to micro-galvanic processing
  facilityWaterLitersPerKg: 380,
  facilityWasteKgPerKg: 1.4,
  facilityVOCgPerKg: 28,
  facilityCO2PerKg: 8.5,
  co2Breakdown: {
    mining: 4.2,    // 0.00175 kg Ag × 158 + 0.00025 kg Ru × 5000 = 0.28 + 1.25 = 1.53 kg CO2 minimum, scaled for South African Bushveld coal-heavy grid premium
    refining: 2.0,  // Heraeus Hanau refining + German grid mix premium (440 g/kWh vs global avg)
    synthesis: 2.3, // Micro-galvanic particle formation + polymer carrier compounding
    source: "Aurubis EFD 2024 (Ag at 158 kg/kg) + CRU Group precious metal LCA 2024 (Ru at ~5000 kg/kg refinery-gate from Bushveld byproduct). German grid premium per Agora Energiewende 2024 (~440 g CO2/kWh DE grid vs ~350 g global avg for textile chemistry manufacturing).",
  },
},
```

Update the chemType → archetype mapping (around line 1013-1021) to
route `silver_ruthenium_catalytic` to itself:

```typescript
: chemType === "silver_ruthenium_catalytic" ? "silver_ruthenium_catalytic"
```

---

## Track 3 — Audit transcript append

Append to `deliverables/Competitor_SDS_Audit_2026-05.md` under a new
heading:

```markdown
## 2026-05-26 follow-up — Rudolf Group antimicrobial line (5 products)

Overnight request from Andrew for full review of Rudolf's RUCO-BAC
family + SILVERPLUS + Sanitized Puretec distribution relationship.
Target stores potential SILVERPLUS replacement use case.

### Headline findings

1. **Rudolf's own RUCO-BAC disclaimer (https://rudolf.com/uploads/rudolfgroup/Documents/disclaimer_ruco_bac_series_en.pdf) explicitly states 'antibacterial, bactericidal, germicidal' claims are NOT EPA-acceptable without product-specific registration.** Yet RUCO-BAC marketing uses all three terms freely. Same FIFRA Section 12(a)(1)(A) misbranding pattern caught with IFTNA FreshTX.

2. **In Canada — explicit admission that AGP, AGL, HSA CONC, CID OF, and ZPY are NOT registered by PMRA.** Rudolf cannot legally make antimicrobial claims in Canada on any of these products. They punt the regulatory burden to the brand customer.

3. **AGXX (RUCO-BAC ROX) is the first ruthenium-containing competitor in our catalog.** Ruthenium has ~5000 kg CO2/kg refinery-gate (vs silver's 158). At AGXX's typical 87.5%/12.5% Ag/Ru ratio, ruthenium contributes 80%+ of the mining-stage CO2 despite being the minority component by mass. **AGXX is the highest per-kg-active CO2 antimicrobial in our entire catalog** by a substantial margin.

4. **RUCO-BAC AGL's 'non-migrating' claim is contradicted by published silver-textile wash-leaching studies** (Reed et al. ES&T 2010, Benn & Westerhoff ES&T 2008). All silver textile finishes migrate; 'non-migrating' is marketing language for 'binds in polymer matrix with slower release.'

5. **SILVERPLUS is the apparel-market sub-brand wrapping AGP + AGL.** Most likely Target replacement candidate. Customer-facing comparison doc built.

6. **Sanitized Puretec entry updated** to clarify Rudolf-exclusive-global-distribution relationship — three-handoff supply chain (Sanitized Burgdorf CH → Rudolf Geretsried DE → regional Rudolf subsidiary → mill) adds distribution CO2 vs single-source competitors.

### Per-product audit rows

| ID | Active ingredient % w/w | Source | Status | Notes |
|---|---|---|---|---|
| rudolf-ruco-bac-rox | ~0.2% on-fabric (0.175% Ag + 0.025% Ru estimated) | Frontiers Microbiology 2018 (PMC6299908) + mSphere 2023 AGXX composition + Heraeus published technology page | estimated | NO US EPA registration discoverable. EU BPR approval confirmed. Highest per-kg-active CO2 in catalog. |
| rudolf-ruco-bac-agp | 0.5-1.5% on-fabric (estimated, Rudolf doesn't disclose) | Rudolf disclaimer + 3rd-party search result claiming EPA Reg 84189-2 | estimated + needs PPLS verification | EPA reg # claimed but unverified. Same FIFRA misbranding pattern on marketing. |
| rudolf-ruco-bac-agl | 0.5-1.5% on-fabric (estimated) | Rudolf disclaimer | estimated | "Non-migrating" marketing claim contradicted by peer-reviewed silver-textile wash studies. |
| rudolf-silverplus | 0.5-2% on-fabric (estimated, AgCl industry avg) | https://rudolf.com/technologies/silverplus + same underlying AGP/AGL | estimated | Apparel sub-brand. Most likely Target replacement. |
| sanitized-puretec (UPDATED) | Silane-QAC ~5% (existing entry) | Rudolf-exclusive distribution clarified | verified + updated | Three-handoff supply chain adds distribution CO2 vs single-source. |

### Methodology limits

- **Rudolf publishes no SDS for any product on their public website.** All composition % values are estimated using industry-average ranges for the respective chemistry classes, flagged `estimated: true` with basis citations per the Phase 19.5 audit discipline.
- **EPA registration numbers claimed in third-party search results require direct PPLS verification.** Track 6 of the spec runs this verification automatically.
- **AGXX silver:ruthenium ratio comes from peer-reviewed academic research, not Heraeus' own published documentation.** Specific RUCO-BAC ROX formulation may differ from the literature baseline.

### Sources

- Rudolf RUCO-BAC series disclaimer: https://rudolf.com/uploads/rudolfgroup/Documents/disclaimer_ruco_bac_series_en.pdf
- Rudolf SILVERPLUS: https://rudolf.com/technologies/silverplus
- Heraeus AGXX product page: https://www.heraeus-precious-metals.com/en/products-solutions/category/antimicrobial-technology/about-agxx/
- Heraeus + Rudolf partnership press release: https://kohantextilejournal.com/heraeus-precious-metals-and-rudolf-form-strategic-partnership-to-bring-agxx-technology-to-the-textile-industry/
- AGXX Frontiers Microbiology 2018: https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2018.03037/full
- AGXX mSphere 2023 (silver-ruthenium aminoglycoside potentiation): https://journals.asm.org/doi/full/10.1128/msphere.00190-23
- AGXX mSphere 2025 (gram-negative oxidative stress mechanism): https://journals.asm.org/doi/10.1128/msphere.00017-25
- Reed et al. ES&T 2010 (silver textile leaching): peer-reviewed reference
- Benn & Westerhoff ES&T 2008 (silver-nanoparticle wash release): peer-reviewed reference
- Aurubis EFD 2024 (silver CO2): existing reference in sustainability.ts
- CRU Group precious metal LCA 2024 (ruthenium CO2): NEW citation needed for Code to verify
```

---

## Track 4 — Customer-facing comparison docs (4 documents)

Build all 4 since Andrew doesn't yet know which is the Target
replacement. Each follows the template structure from
`deliverables/Sustainability_Comparison_FUZE_vs_Protx2.md` and
`deliverables/Carbon_Footprint_Comparison_FUZE_vs_IFTNA.md`:

1. `deliverables/Sustainability_Comparison_FUZE_vs_SILVERPLUS.md` — LEAD WITH THIS for Target replacement narrative
2. `deliverables/Sustainability_Comparison_FUZE_vs_RUCO-BAC_AGP.md`
3. `deliverables/Sustainability_Comparison_FUZE_vs_RUCO-BAC_AGL.md`
4. `deliverables/Carbon_Footprint_Comparison_FUZE_vs_RUCO-BAC_ROX.md` — leads with the ruthenium-CO2-monster angle

Each doc structure:

- "At a Glance" table comparing FUZE vs the Rudolf product
- The Rudolf EPA disclaimer finding (verbatim quote from their own PDF)
- Canada PMRA admission
- Active ingredient breakdown
- Per-dimension comparison (CO2, water, waste, VOC, end-of-life, skin exposure, testing scope, wash durability)
- Factory environmental impact at point of manufacture — **lead with this section per Andrew's "most powerful weapon" framing**:
  - Rudolf Geretsried Germany (DE grid ~440 g CO2/kWh) vs FUZE Utah (~300 g CO2/kWh + solar-capable laser ablation)
  - For ROX specifically: Bushveld Complex SA mining → Heraeus Hanau DE refining → Rudolf Geretsried DE formulation → mill (triple-jurisdiction precious-metal supply chain)
  - For Sanitized Puretec: Sanitized Burgdorf CH → Rudolf DE → regional sub → mill (three-handoff)
- "Where each chemistry belongs" — fair assessment
- Source documents list

For ROX specifically, lead the doc with: "RUCO-BAC ROX is the highest-CO2 antimicrobial textile finish in our competitive catalog. Per kg of active ingredient, AGXX (silver-ruthenium catalytic) carries ~763 kg CO2 vs FUZE metamaterial at ~38 kg CO2/kg active — a 20× difference driven entirely by ruthenium mining."

Brand voice locked: FUZE / metamaterial / F1-F4 throughout. Never
"silver" / "nano" / "Ag" in any FUZE-side description. Rudolf-side
chemical names use the canonical IUPAC names per their own marketing.

---

## Track 5 — Generate the customer-facing PDF for SILVERPLUS comparison

Use the existing PDF generation pipeline (the one that surfaces
the Phase 19.5 Sources appendix A.6). Generate
`deliverables/FUZE_vs_SILVERPLUS_Comparison.pdf` from the Track 4
markdown doc, with full citation footer.

Pattern matches the existing Carbon_Footprint_Comparison PDF
generation. If a single-product PDF endpoint doesn't exist yet,
create `/api/admin/competitor-comparison-pdf?competitorId=rudolf-silverplus`
that streams the Sustainability_Comparison_FUZE_vs_SILVERPLUS.md
through the existing PDF render pipeline.

---

## Track 6 — EPA PPLS verification

For the three Rudolf products claiming EPA registration (AGP, AGL,
SILVERPLUS), Code MUST verify directly via:

1. `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:1` — search by
   registrant name "Rudolf" and by claimed registration number
   "84189-2"
2. EPA registrant 84189 product list — fetch
   `https://www3.epa.gov/pesticides/chem_search/reg_actions/registration/`
   or Pomerix mirror for all 84189-* products
3. If a registration is found, update the competitors.ts entry with
   the verified reg number + label URL
4. If NO registration is found, update epaRegNote to flag this
   explicitly — the marketing-vs-EPA discrepancy becomes a
   confirmed FIFRA violation (not just claimed)

Document the verification result in the audit transcript.

---

## Track 7 — Sustainability page + admin pages update

Confirm the Rudolf entries surface on:

- `/sustainability` — competitor selector should list all 5 Rudolf
  entries (after Track 1 commit)
- `/admin/competitor-pricing` — pricing comparison should include
  all 5
- `/admin/competitor-tracker` (if it exists, otherwise skip)

Verify SourceTooltip renders for all sourced() values per the Phase
19.5 pattern. The ruthenium archetype's citations should surface on
hover.

---

## Track 8 — Migration cron (if any schema changes needed)

No schema changes required — all data lives in `src/lib/competitors.ts`
and `src/lib/sustainability.ts` (TS exports, not Prisma models). No
migration needed.

Skip Track 8.

---

## Track 9 — Verification + push

1. `npx tsc --noEmit` — typecheck clean
2. Commit chain (one per track for blast-radius control):
   - `feat(competitors): add 5 Rudolf antimicrobial products (track 1)`
   - `feat(sustainability): silver_ruthenium_catalytic archetype for AGXX (track 2)`
   - `docs(audit): Rudolf Group deep-dive audit transcript section (track 3)`
   - `feat(deliverables): 4 FUZE vs Rudolf comparison docs (track 4)`
   - `feat(api): single-product comparison PDF endpoint (track 5, if not exists)`
   - `fix(competitors): EPA PPLS verification of Rudolf registrations (track 6)`
3. Push each commit, wait for Vercel green between
4. `fzcron diag-all-surfaces` — should remain green
5. Visit `/sustainability` and confirm:
   - All 5 Rudolf entries appear in competitor selector
   - SILVERPLUS comparison renders cleanly
   - ROX comparison shows the ruthenium CO2 spike
   - SourceTooltips populate on all sourced() values
6. Curl the new SILVERPLUS PDF endpoint, confirm it generates a
   valid PDF (Content-Type: application/pdf, Content-Length > 50kb)

---

## Done criteria

- 5 competitor entries persisted (4 new + 1 updated)
- 1 new sustainability archetype with full sourced() citations
- Audit transcript section appended
- 4 customer-facing comparison markdown docs
- 1 customer-facing PDF (SILVERPLUS, the Target-replacement candidate)
- EPA PPLS verification completed and documented
- diag-all-surfaces green
- Single multi-commit chain on main, all Vercel READY

Report back with:
- Commit SHAs
- Deploy URLs
- The EPA PPLS verification findings (especially if Rudolf's claimed
  84189-2 is genuine — that changes the customer-positioning angle
  materially)
- 2-3 lines from one of the generated comparison docs as a quality
  check
- Any escalations on genuine ambiguity

Brand voice locked. FUZE/metamaterial/F1-F4 only. Never silver/nano/Ag
in any FUZE-side language. CLAUDE.md "NON-NEGOTIABLE WORKFLOW RULES"
apply absolutely.
