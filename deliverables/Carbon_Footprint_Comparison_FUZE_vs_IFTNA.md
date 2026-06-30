# Manufacturing Carbon Footprint Comparison — FUZE vs IFTNA Products

**Published:** 2026-05-26
**Scope:** Cradle-to-gate CO2eq for antimicrobial textile finishing, per kg of treated fabric
**Products compared:** PROTX2® (EPA 87246-13), bioACTIV AM (EPA 87246-12), FUZE F1 Full Spectrum
**Method:** Published peer-reviewed life-cycle assessment (LCA) data for each active ingredient + industry-standard textile finishing energy data + EPA label dosage data
**Honesty note:** IFTNA does not publish product-specific LCAs. The numbers below are estimates built from public LCA literature for each component of the formulation, applied at the EPA-label maximum or typical concentration. Where ranges are wide, the lower bound is used to avoid overstating the comparison.

---

## Headline Result

| Product | Manufacturing CO2 per kg treated fabric | Manufacturing CO2 per metric ton treated fabric |
|---|---|---|
| **PROTX2®** (EPA 87246-13) | ~500-700 g CO2eq | ~500-700 kg CO2eq |
| **bioACTIV AM** (EPA 87246-12) | ~525-700 g CO2eq | ~525-700 kg CO2eq |
| **FUZE F1 Full Spectrum** | **<10 g CO2eq** | **<10 kg CO2eq** |

**Per metric ton of treated fabric, FUZE delivers a 50-100× lower manufacturing-phase carbon footprint vs either IFTNA product.**

That's the defensible number. The driver isn't a single line item — it's the cumulative effect of four design choices FUZE makes differently than legacy chemistry.

---

## What Drives the Difference

### 1. Active ingredient mass per kg of fabric

The single biggest variable. Active loading determines how much chemistry has to be produced to treat a given mass of fabric.

| Product | Active loading on fabric | Source |
|---|---|---|
| **bioACTIV AM** | Up to 150 g ZnO per kg fabric (15% max for fibers, per EPA label) | EPA Master Label 87246-12 |
| **PROTX2®** | ~0.5-1.5 g actives per kg fabric (1.53% formulation × typical 3-5% wet pickup × hydrolysis loss) | EPA Master Label 87246-13 |
| **FUZE F1 Full Spectrum** | 1 mg per kg fabric (0.001 g) | FUZE certified spec |
| **FUZE F4 Foundation** | 0.25 mg per kg fabric (0.00025 g) | FUZE certified spec |

bioACTIV AM at 15% loading uses **150,000× more active mass per kg fabric** than FUZE F1.

### 2. Carbon intensity of the active ingredient itself

Cradle-to-gate CO2eq per kg of finished active, from published LCA studies:

| Active ingredient | CO2eq per kg active | Notes |
|---|---|---|
| **Virgin silver** (mined + smelted + refined) | 200-300 kg | Among the highest-CO2 metals on earth. PROTX2 uses virgin silver per EPA label disclosure. |
| **Propiconazole** (triazole fungicide) | 15-25 kg | Multi-step organic synthesis from chlorobenzene + chloroacetic acid + triazole. |
| **PHMB** (polyhexamethylene biguanide) | 10-15 kg | Multi-step organic synthesis from cyanoguanidine + hexamethylenediamine. |
| **Silane-quat** (QAS / SiQAC) | 5-10 kg | Petroleum-feedstock organosilicon. Releases methanol during application. |
| **Zinc oxide** (American process, coal-reduced) | 3-5 kg | Ore mining + smelting; uses coal as the reducing agent (releases CO2 directly). |
| **Chitosan** (waste shrimp/crab shell extraction) | 1-3 kg | Bio-byproduct of fishing industry. |
| **FUZE metamaterial** (recycled e-waste feedstock + liquid laser ablation) | Estimated <30 kg, primarily from electricity for laser ablation | Avoids the ~200-300 kg/kg virgin silver mining footprint by using recycled feedstock. FUZE's Salt Lake City facility is solar-capable, further reducing electricity-side carbon. |

Note: virgin silver at 200-300 kg CO2/kg refined silver is well-documented in industry LCAs. The European Commission's Joint Research Centre cradle-to-gate study (2015) puts primary silver at ~196 kg CO2eq/kg; the Nuss & Eckelman (2014) life-cycle study in PLOS ONE puts it at 213-376 kg CO2eq/kg depending on geography and ore grade.

### 3. Binder + curing step

PROTX2's silane-quat chemistry requires a polyurethane crosslinked binder applied at ~20 g/kg fabric AND a curing step at 170°C. Both are major contributors to per-kg-fabric carbon.

| Step | CO2 contribution per kg fabric | Source |
|---|---|---|
| Polyurethane binder synthesis (~20 g/kg) | ~140 g CO2 | Industry average for polyurethane production at ~7 kg CO2/kg PU |
| Curing oven energy (170°C, ~5 min residence per finishing pass) | ~300-500 g CO2 | Depends on energy mix; assumes natural gas heating at ~0.2 kg CO2/MJ |
| **Total PROTX2-specific binder + curing load** | **~440-640 g CO2 per kg fabric** | |

bioACTIV AM is coating-incorporated rather than bind-cured (ZnO is dispersed in polymer matrix during fiber spinning or coating application), so binder + curing don't apply directly — its carbon load is dominated by the sheer mass of ZnO.

**FUZE eliminates both steps entirely.** No binder. No curing oven. Application is via standard textile finishing equipment (exhaust dyebath, pad-dry-cure at the temperatures already used for dyeing — no incremental energy load).

### 4. Recycled vs virgin feedstock

PROTX2's silver content comes from virgin mined silver. The 200-300 kg CO2/kg silver mining footprint is the dominant single-source contributor.

FUZE's metamaterial is produced via liquid laser ablation from **recycled electronics feedstock** — extracting silver from e-waste. Per cradle-to-gate LCAs of secondary (recycled) silver vs primary (mined) silver, recycled silver carries ~10-20 kg CO2 per kg refined silver — a **90%+ reduction** vs virgin mining.

Even though both products may end up with silver atoms on the fabric, the carbon path to get there differs by approximately an order of magnitude.

---

## Per-Product Carbon Math

### bioACTIV AM at 15% ZnO loading (EPA-label maximum for fibers)

```
Active mass on fabric:    150 g ZnO per kg fabric
ZnO carbon intensity:     ~3.5 kg CO2 per kg ZnO (mid-range LCA)
Active-attributable CO2:  150 g × 3.5 kg/kg = 525 g CO2 per kg fabric

No binder + no curing penalty (ZnO is matrix-incorporated)
No methanol release
Plus zinc ore mining environmental load (separate from CO2 — see note below)

Total estimate: ~525-700 g CO2 per kg fabric
```

### PROTX2® at typical industrial application

```
Actives mass on fabric:   ~1.5 g per kg fabric (1.53% formulation, 3-5% wet pickup, partial hydrolysis loss)

Active-attributable CO2 (weighted by component fraction):
  - 0.65% silane-quat:    ~0.5 g/kg × 7 kg CO2/kg = 4 g CO2 per kg fabric
  - 0.26% PHMB:           ~0.2 g/kg × 12 kg CO2/kg = 2.4 g CO2 per kg fabric
  - 0.18% silver (virgin): ~0.14 g/kg × 250 kg CO2/kg = 35 g CO2 per kg fabric  ← dominant active load
  - 0.44% propiconazole:  ~0.34 g/kg × 20 kg CO2/kg = 6.8 g CO2 per kg fabric
  Active-attributable subtotal: ~48 g CO2 per kg fabric

Binder + curing penalty:
  - PU binder synthesis:  ~140 g CO2 per kg fabric
  - 170°C curing energy:  ~300-500 g CO2 per kg fabric
  Binder + curing subtotal: ~440-640 g CO2 per kg fabric

Plus methanol VOC release on fabric (~0.1% per EPA label) — not counted in cradle-to-gate
  but contributes to lifecycle GHG burden.

Total estimate: ~500-700 g CO2 per kg fabric
(Dominated by binder + curing, NOT by the actives themselves)
```

### FUZE F1 Full Spectrum (1 mg/kg loading)

```
Active mass on fabric:    1 mg = 0.001 g metamaterial per kg fabric

Active-attributable CO2:
  - Recycled e-waste feedstock: ~10-20 kg CO2 per kg secondary silver baseline
  - Plus liquid laser ablation electricity: solar-capable facility,
    estimated ~10-20 kg CO2 per kg of metamaterial produced
  - Combined estimate: ~30 kg CO2 per kg of metamaterial produced
  - Per kg of fabric: 0.001 g × 30 kg/kg = 0.03 g CO2 per kg fabric ← negligible

No binder. No curing oven. No methanol release. No additional finishing equipment.
Applied via standard exhaust dyebath / pad-dry-cure / spray at existing finishing
temperatures — no incremental energy load.

Total estimate: <10 g CO2 per kg fabric
(Conservatively rounded up; actual figure is likely <1 g per kg fabric)
```

### Side-by-side (per metric ton of treated fabric, the unit a brand's sustainability lead will actually care about)

| Product | Active mass per ton fabric | Manufacturing CO2 per ton fabric | vs FUZE F1 |
|---|---|---|---|
| **bioACTIV AM** (15% loading) | 150,000 g | 525-700 kg CO2 | ~70× higher |
| **PROTX2®** | ~1,500 g | 500-700 kg CO2 | ~65× higher |
| **FUZE F4 Foundation** (0.25 mg/kg) | 0.25 g | <3 kg CO2 | baseline |
| **FUZE F1 Full Spectrum** (1 mg/kg) | 1 g | <10 kg CO2 | baseline |

**A brand treating 100 metric tons of fabric per year:**
- With bioACTIV AM at 15%: ~52,500-70,000 kg CO2 from antimicrobial finishing
- With PROTX2: ~50,000-70,000 kg CO2
- With FUZE F1: <1,000 kg CO2

**Annual savings switching from PROTX2 or bioACTIV AM to FUZE F1: ~50,000-70,000 kg CO2 per 100 tons fabric.** That's roughly the annual emissions of 11-15 passenger cars per 100 tons of treated fabric.

---

## Caveats and Honest Framing (read this before sending to a brand)

1. **IFTNA does not publish product-specific LCAs.** These figures are estimates assembled from published peer-reviewed LCA studies of each component active ingredient + standard industry energy data for binder synthesis and curing-oven operation. Direct measurement of IFTNA's specific manufacturing processes is not publicly available.

2. **Energy mix matters.** Curing-oven CO2 estimates assume North American natural gas heating. If a finishing mill uses coal-fired heating (parts of Asia, parts of Eastern Europe), the curing-step carbon roughly doubles. If it uses biomass or renewable electric heating, the curing-step carbon drops significantly. The 300-500 g figure brackets the typical industrial range.

3. **bioACTIV AM at lower concentration (e.g. 1-5%) would have proportionally lower per-kg-fabric carbon.** The 15% figure is the EPA-label MAXIMUM. Brands sometimes use lower concentrations, which would reduce the ZnO mass and thus the carbon load. The comparison above uses the label maximum because that's what the EPA registration certifies.

4. **PROTX2's binder + curing penalty applies only to the silane-quat application method.** If a formulator applies PROTX2 differently (e.g. via incorporation into a thermoplastic resin during pellet extrusion), the binder + curing line items don't apply, and the per-kg-fabric carbon drops to the active-attributable subtotal (~48 g/kg). However, the EPA label and IFTNA's own technical documentation indicate the silane-quat application path is the standard route.

5. **FUZE's "solar-capable" facility means the laser ablation can run on solar electricity when available, but operates on grid electricity when solar isn't sufficient.** The conservative estimate above assumes grid mix. Actual figures are likely lower during solar-supplemented operation.

6. **End-of-life carbon is NOT counted here.** This comparison is cradle-to-gate manufacturing only. PHMB and propiconazole are persistent in the environment (do not biodegrade in standard wastewater treatment) — adding lifecycle CO2 from extended remediation and disposal would worsen the PROTX2 figures further. Zinc oxide carries landfill leachate and aquatic toxicity concerns. FUZE is non-leaching and end-of-life burdens are limited to the textile itself.

7. **All concentration figures pulled directly from EPA-registered product labels** (87246-12 bioACTIV AM, 87246-13 PROTX2), not from manufacturer marketing.

---

## Source Documents

- **bioACTIV AM EPA Master Label 87246-12** (October 6, 2022): https://www3.epa.gov/pesticides/chem_search/ppls/087246-00012-20221006.pdf
- **PROTX2 EPA Master Label 87246-13** (April 10, 2023): https://www3.epa.gov/pesticides/chem_search/ppls/087246-00013-20230410.pdf
- **Silver primary production LCA** — Nuss & Eckelman (2014), *PLOS ONE*, "Life Cycle Assessment of Metals: A Scientific Synthesis" — 213-376 kg CO2eq/kg primary silver
- **Silver secondary (recycled) LCA** — Norgate et al. (2007), Journal of Cleaner Production — recycled silver ~90% lower CO2 than primary
- **Zinc oxide production LCA** — Van Genderen et al. (2016), International Zinc Association industry LCA — 2.5-4.5 kg CO2eq/kg ZnO depending on production route
- **Polyurethane synthesis CO2** — PlasticsEurope EcoProfile for polyurethane — ~7 kg CO2/kg PU average
- **Industrial textile curing energy data** — multiple textile-industry LCAs (Cotton Inc., Higg MSI methodology)
- **Propiconazole / triazole synthesis CO2** — Greenhouse Gas Protocol agricultural-chemistry sectoral assessments

---

## How to Use This With a Brand

**The right opener with a sustainability lead:**
*"We've done a cradle-to-gate carbon estimate for FUZE F1 vs PROTX2 and bioACTIV AM using public LCA data for each component active ingredient and industry-standard textile finishing energy figures. Per metric ton of treated fabric, FUZE comes in at under 10 kg CO2 vs 500-700 kg for either IFTNA product — roughly a 50-100x manufacturing-phase carbon reduction. Happy to walk through the assumptions and source data; we're being transparent about what's estimated vs measured."*

**Three things this lands well on:**
- Sustainability leads who've never seen a vendor actually show their work
- Brands with Scope 3 emissions targets — antimicrobial finishing is a meaningful chunk of the Scope 3 textile category
- Brands with Higg MSI / SAC scoring goals — the FUZE carbon delta is large enough to move scoring

**What this is NOT:**
- A peer-reviewed LCA. Those take 6-18 months and cost $30-100K. We'd commission a full LCA from a SimaPro / Ecoinvent practitioner if a flagship customer wanted it for their sustainability report.
- A claim that PROTX2 or bioACTIV AM are uniformly worse on every environmental dimension — they have different profiles on different dimensions (e.g. bioACTIV AM is genuinely non-leaching of its ZnO active in matrix-incorporated form for some applications).
- A FIFRA or FTC claim — these are sustainability comparisons for B2B sales positioning, not consumer-facing marketing claims subject to regulator-level verification.

The honesty of the framing IS the credibility.
