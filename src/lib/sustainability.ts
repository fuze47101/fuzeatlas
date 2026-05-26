// FUZE Sustainability & Carbon Footprint Scoring Engine
// Calculates per-garment and per-meter environmental impact savings when switching to FUZE

import type { Competitor } from "./competitors";

// ═══════════════════════════════════════════════════════
// FUZE PRODUCTION FACTS
// ═══════════════════════════════════════════════════════

export const FUZE_SUSTAINABILITY = {
  // Production
  productComposition: "99.98% deionized water + recycled high density allotrope",
  energySource: "30 amp laser — sole energy input for meta-material synthesis",
  metalSource: "Recycled from mixed electronic waste stream (e-waste recovery)",
  productionEffluent: 0,       // liters of wastewater per liter produced
  productionVOC: 0,            // grams VOC emitted per liter produced
  productionCO2PerLiter: 0.05, // kg CO2 per liter (laser energy only: 30A × ~120V × ~1hr / 1000 = ~3.6 kWh × 0.014 kg/kWh for low-carbon)
  packaging: "PET-1 recyclable bottles, returned for re-use (closed loop)",

  // Application at factory
  binderRequired: false,
  curingRequired: false,
  curingTempC: 0,
  additionalFactoryEnergy: 0,  // kWh per kg fabric
  additionalWaterUsage: 0,     // liters per kg fabric beyond existing bath
  surfactantsRequired: false,
  specialEquipment: false,

  // Application methods
  applicationMethods: [
    { method: "Existing dye bath", note: "Added directly to pad/exhaust bath — zero additional step" },
    { method: "Exhaust process", note: "Standard exhaust compatible — no modification needed" },
    { method: "Spray on finished rolls", note: "Spray application on finished goods — no bath needed" },
    { method: "Spray on finished products", note: "Post-construction spray — treats completed garments" },
    { method: "Jeanologia digital spray", note: "Water-saving digital application — current Target project" },
    { method: "Wash cycle (socks/circular knits)", note: "Added during garment wash — ideal for socks, underwear, activewear" },
    { method: "Yarn dye (limited experience)", note: "Can be integrated at yarn level — early stage development" },
  ],

  // Certifications
  certifications: [
    { name: "EPA Lifetime Registration", icon: "🏛️", category: "regulatory", note: "Only antimicrobial with EPA-verified lifetime durability claim" },
    { name: "bluesign System Partner", icon: "🔵", category: "sustainability", note: "Full audit — bluesign PRODUCT approved" },
    { name: "OEKO-TEX Standard 100", icon: "🏷️", category: "safety", note: "Safe for direct skin contact including baby clothing (Class I)" },
    { name: "ZDHC MRSL 3.1", icon: "💧", category: "chemical", note: "Zero Discharge of Hazardous Chemicals — Level 3.1 conformance via bluesign" },
  ],

  // Waste
  wasteProfile: {
    chemicalWaste: 0,
    hazardousWaste: 0,
    waterWaste: 0,
    onlyWaste: "DI water system replacement filters (non-hazardous, periodic)",
    packagingReturn: true,
  },

  // End of life
  leachRate: 0,         // zero leaching over garment lifetime
  heavyMetalRelease: 0, // zero heavy metal discharge
  binderPolymerShed: 0, // zero microplastic shedding
};

// ═══════════════════════════════════════════════════════
// CARBON FOOTPRINT CALCULATIONS
// ═══════════════════════════════════════════════════════

// Industry standard emission factors
// PRIMARY SOURCES:
//   Silver production: Aurubis Environmental Footprint Declaration 2024 (158 kg CO2/kg Ag)
//                      ecoinvent 3.10 global market avg (448 kg CO2/kg Ag)
//                      MKS PAMP recycled silver PER 2024 (~10 kg CO2/kg Ag)
//   Stenter curing:    IEA Textile Sector Energy Benchmarks (0.5–1.2 kWh/kg)
//   Grid emissions:    IEA World Energy Outlook 2024
//   Wastewater:        WHO/UNIDO Textile Effluent Treatment Guidelines
const EMISSION_FACTORS = {
  // Binder production: petrochemical polymer synthesis
  binderProductionKgCO2PerKg: 2.5,       // kg CO2 per kg of acrylic/PU binder produced

  // Curing oven energy: natural gas or electric stenter frame
  curingEnergyKwhPerKgFabric: 0.8,       // kWh per kg fabric for 150-170°C curing
  gridEmissionFactor: 0.5,                // kg CO2 per kWh (global average grid)
  chinaGridEmission: 0.58,               // kg CO2 per kWh (China grid — where most textiles are made)

  // Chemical production — Aurubis EFD 2024: 158 kg CO2/kg; ecoinvent 3.10: 448 kg CO2/kg global avg
  // Using 104 = conservative mid-range for primary silver (well below industry published data)
  silverProductionKgCO2PerKg: 104,        // kg CO2 per kg of mined virgin silver
  silverRecycledKgCO2PerKg: 15,           // kg CO2 per kg of recycled silver (85% reduction)
  copperProductionKgCO2PerKg: 3.5,        // kg CO2 per kg of copper
  zincProductionKgCO2PerKg: 3.1,          // kg CO2 per kg of zinc

  // Water treatment
  wastewaterTreatmentKgCO2PerM3: 0.3,    // kg CO2 per m3 of textile wastewater treated
  wastewaterVolumePerKgFabric: 0.05,      // m3 wastewater per kg fabric (antimicrobial application step)

  // Transport (minor but included for completeness)
  transportKgCO2PerKgKm: 0.00003,         // kg CO2 per kg·km ocean freight

  // Stage 4: Consumer & Municipal
  homeWashWaterLiters: 50,                 // liters per home wash cycle (avg front-loader)
  municipalWaterTreatmentKgCO2PerM3: 0.27, // kg CO2 per m3 municipal water treatment (advanced)
  municipalTreatmentCostPerM3: 2.50,       // USD per m3 municipal wastewater treatment (US avg)
  municipalMetalRemovalCostPerMg: 0.0045,  // USD per mg heavy metal removed at POTW
  bioaccumulationFactorSilver: 0.85,       // high — silver persists in aquatic sediment
  bioaccumulationFactorZinc: 0.55,         // moderate — some bioavailability
  bioaccumulationFactorCopper: 0.75,       // high — toxic to aquatic organisms at low conc
  bioaccumulationFactorQAC: 0.40,          // moderate — degrades slowly, toxic to microorganisms
  landfillLeachateTreatmentCostPerKg: 0.08, // USD per kg textile in landfill (leachate mgmt)
};

// ═══════════════════════════════════════════════════════
// SOURCED NUMBER TYPE (Phase 19.5)
// Every customer-visible CO2/water/waste/VOC input must carry
// a companion source citation. TypeScript-enforces the discipline
// so future entries can't ship without sourcing.
// ═══════════════════════════════════════════════════════

export type SourceCitation = {
  /** Public URL to the SDS, EPA label, TDS, or peer-reviewed source. Optional only when estimated:true. */
  sdsUrl?: string;
  /** ISO date the SDS / label was published or last revised. */
  sdsDate?: string;
  /** Section reference within the source document (e.g. "Section 3 — Composition", "Section 1 — Active Ingredient"). */
  sdsSection?: string;
  /** Verbatim quote of the line containing the published value. Quoted, not paraphrased. */
  valueAsPublished?: string;
  /** ISO date this audit row was verified. */
  verifiedDate: string;
  /** Who verified (e.g. "Phase 19.5 audit (Code, automated)" or a specific human). */
  verifiedBy: string;
  /**
   * True if no public source was located and the value is an industry-average
   * estimate. When true, `estimationBasis` must explain the basis (e.g. peer-
   * reviewed textile finishing literature, ecoinvent process, EPA average
   * for the chemical class).
   */
  estimated?: boolean;
  /** Required when estimated:true. The basis text travels into customer-facing tooltips. */
  estimationBasis?: string;
  /** Optional audit notes (escalations, marketing-vs-EPA discrepancies, etc.). */
  notes?: string;
};

/**
 * A numeric input paired with the source citation that justifies it.
 * Used everywhere a CO2 / water / waste / VOC value enters the
 * customer-facing math. TypeScript enforcement means a contributor
 * can't ship a new chemistry archetype without a citation.
 *
 * Legacy entries that pre-date Phase 19.5 are still raw numbers —
 * see RawMaterialEntry / ReactionChemicalEntry below, which accept
 * both shapes during the migration window. New chemistry archetypes
 * MUST use SourcedNumber.
 */
export type SourcedNumber = {
  value: number;
  source: SourceCitation;
};

/** Helper: build a SourcedNumber for an audited value. */
export function sourced(value: number, source: SourceCitation): SourcedNumber {
  return { value, source };
}

/** Helper: extract the numeric value from either a SourcedNumber or a raw number. */
export function valueOf(n: number | SourcedNumber): number {
  return typeof n === "number" ? n : n.value;
}

/** Helper: extract the source citation if present, else undefined. */
export function sourceOf(n: number | SourcedNumber): SourceCitation | undefined {
  return typeof n === "number" ? undefined : n.source;
}

// ═══════════════════════════════════════════════════════
// UPSTREAM CHEMICAL PLANT MANUFACTURING COSTS
// What happens at the chemical facility BEFORE the
// antimicrobial reaches the textile factory
// ═══════════════════════════════════════════════════════

/**
 * A raw material or reaction chemical row. The `kgPerKgProduct` field
 * is the customer-visible input that the audit corrects — it accepts
 * either a raw number (legacy entries) or a SourcedNumber (post-audit
 * entries). The render and PDF generator unwrap via valueOf().
 */
export type IngredientEntry = {
  name: string;
  kgPerKgProduct: number | SourcedNumber;
  costPerKg: number;
};

export type UpstreamManufacturing = {
  processName: string;
  rawMaterials: IngredientEntry[];
  reactionChemicals: IngredientEntry[];
  facilityEnergyKwhPerKg: number | SourcedNumber;    // kWh to produce 1 kg of antimicrobial product
  facilityWaterLitersPerKg: number | SourcedNumber;  // liters of process water per kg product
  facilityWasteKgPerKg: number | SourcedNumber;      // kg chemical waste per kg product
  facilityVOCgPerKg: number | SourcedNumber;         // grams VOC emitted per kg product at plant
  facilityCO2PerKg: number | SourcedNumber;          // total kg CO2 to manufacture 1 kg at the chemical plant
  // CO2 breakdown for transparency (must sum to facilityCO2PerKg)
  co2Breakdown?: {
    mining: number;       // kg CO2 — ore extraction, hauling, crushing, concentrating
    refining: number;     // kg CO2 — smelting, electrolytic refining to pure metal
    synthesis: number;    // kg CO2 — converting refined metal into antimicrobial product
    source: string;       // citation for the numbers
  };
  /** Phase 19.5 audit-level citation for the chemistry archetype itself. */
  archetypeSource?: SourceCitation;
};

export const UPSTREAM_MANUFACTURING: Record<string, UpstreamManufacturing> = {
  silver_chloride: {
    processName: "Silver Chloride Textile Dispersion (Polygiene StayFresh class)",
    archetypeSource: {
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      estimated: true,
      estimationBasis: "Polygiene AB refuses to publish % w/w on any public page or accessible SDS. Industry-average AgCl textile finishing dispersions cluster at 2-5% w/w per commercial AgCl dispersion benchmarks (Thermo Fisher AgCl 4.9%; published Polygiene-class textile finishing data). Conservative low-end estimate 2% used.",
      notes: "Was 0.63 (silver nitrate as feedstock). Corrected to as-sold AgCl in textile dispersion. Polygiene's silver_chloride product line dominates this archetype; Sanitized AG silver line also maps here.",
    },
    rawMaterials: [
      {
        name: "Silver chloride (AgCl) in aqueous textile dispersion",
        kgPerKgProduct: sourced(0.020, {
          sdsUrl: "https://polygiene.com/stayfresh/",
          sdsSection: "Manufacturer product page (Polygiene does not publish % w/w publicly)",
          valueAsPublished: "\"a very low concentration of silver salt\" — Polygiene marketing language; quantitative % not disclosed",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
          estimated: true,
          estimationBasis: "Industry-average AgCl textile finishing dispersions 2-5% w/w; conservative low-end estimate 2%.",
          notes: "Polygiene refuses to publish concentration. Recommend escalating to Polygiene for SDS Section 3 before publishing.",
        }),
        costPerKg: 850,
      },
      { name: "Aqueous carrier (DI water + dispersant package)", kgPerKgProduct: 0.97, costPerKg: 0.05 },
    ],
    reactionChemicals: [
      { name: "Stabilizing dispersant", kgPerKgProduct: 0.01, costPerKg: 12 },
    ],
    facilityEnergyKwhPerKg: 28,
    facilityWaterLitersPerKg: 220,
    facilityWasteKgPerKg: 0.6,
    facilityVOCgPerKg: 8,
    facilityCO2PerKg: 6.2,
    co2Breakdown: {
      mining: 2.0,      // 0.020 kg AgCl × ~75% Ag × 158 kg CO2/kg Ag
      refining: 1.4,    // Included in Aurubis 158 figure; split for transparency
      synthesis: 2.8,   // AgCl precipitation + dispersion stabilization at 2% loading
      source: "Aurubis EFD 2024 (158 kg/kg Ag) scaled by 0.020 kg AgCl × 0.75 Ag fraction; ecoinvent 3.10 silver market (448 kg/kg global avg). Synthesis from textile finishing industry process LCAs.",
    },
  },
  silver_ion: {
    processName: "Polymeric Silver Ion Delivery System (Silvadur 930 Flex class)",
    archetypeSource: {
      sdsUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/000464-00785-20170206.pdf",
      sdsDate: "2017-02-06",
      sdsSection: "Section 1 — Active Ingredient",
      valueAsPublished: "Silver Ion (Ag1+) 0.098%; Other Ingredients 99.902% (LANXESS Silvadur 930 Flex, EPA Reg 464-785; canonical Section 1 cross-referenced via Pomerix EPA mirror)",
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      notes: "Phase 19.5 correction: silver_ion archetype rawMaterials now reflect the as-sold concentration. Prior 0.45 assumption was a chemical-plant feedstock ratio mistakenly applied to the finished product — overstated by 459×. The CO2 breakdown stays anchored to Aurubis 158 kg/kg refinery-gate silver, scaled by the corrected Ag fraction.",
    },
    rawMaterials: [
      {
        name: "Silver ion in polymer dispersion (as Ag1+)",
        kgPerKgProduct: sourced(0.00098, {
          sdsUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/000464-00785-20170206.pdf",
          sdsDate: "2017-02-06",
          sdsSection: "Section 1 — Active Ingredient",
          valueAsPublished: "Silver Ion (Ag1+) 0.098%",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
          notes: "Was 0.45 — corrected 459× lower. EPA Reg 464-785 lists Ag1+ at 0.098% w/w. Other Ingredients (polymer carrier + water + stabilizers) make up 99.902%.",
        }),
        costPerKg: 750,
      },
      {
        name: "Organic polymer matrix (acrylic emulsion carrier)",
        kgPerKgProduct: 0.95,
        costPerKg: 8.50,
      },
    ],
    reactionChemicals: [
      { name: "Proprietary solvents", kgPerKgProduct: 0.04, costPerKg: 3.20 },
      { name: "Stabilizing agents", kgPerKgProduct: 0.01, costPerKg: 12 },
    ],
    facilityEnergyKwhPerKg: 35,
    facilityWaterLitersPerKg: 250,
    facilityWasteKgPerKg: 0.8,
    facilityVOCgPerKg: 22,
    facilityCO2PerKg: 3.5,
    co2Breakdown: {
      mining: 0.15,     // 0.00098 kg Ag × 158 kg CO2/kg Ag (Aurubis EFD 2024 ore-to-refinery)
      refining: 0.10,   // Included in the Aurubis 158 kg/kg figure; split for transparency
      synthesis: 3.25,  // Polymer compounding + solvent processing — IEA Chemicals Sector 2023 specialty synthesis avg
      source: "Aurubis EFD 2024 (158 kg/kg Ag refinery-gate) × 0.00098 kg Ag/kg product = 0.155 kg CO2 mining+refining attributable to Ag. Polymer + solvent synthesis dominates at this Ag fraction — IEA Chemicals Sector Report 2023 specialty synthesis benchmarks.",
    },
  },
  silver_nano: {
    processName: "Silver Nanoparticle Masterbatch (HeiQ AGS-20 class)",
    archetypeSource: {
      sdsUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/085249-00001-20160307.pdf",
      sdsDate: "2016-03-07",
      sdsSection: "Section 1 — Active Ingredient",
      valueAsPublished: "the product contains the active ingredient silver, which includes particles in the size range between 1 and 100 nm at 19.3% (EPA Reg 85249-1, confirmed via SourceWatch mirror and corroborated by multiple AGS-20 EPA label revisions 2011-2016)",
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      notes: "Was 0.63 (silver nitrate as feedstock). Corrected to 19.3% Ag per EPA Reg 85249-1 — this is the AGS-20 MASTERBATCH concentrate. Customers dilute heavily downstream (final textile loadings 0.001-0.01% Ag per EPA-mandated label use rates). HeiQ AGS-20 is the outlier in the silver competitor cluster.",
    },
    rawMaterials: [
      {
        name: "Silver nanoparticles (1-100 nm) in masterbatch",
        kgPerKgProduct: sourced(0.193, {
          sdsUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/085249-00001-20160307.pdf",
          sdsDate: "2016-03-07",
          sdsSection: "Section 1 — Active Ingredient",
          valueAsPublished: "Silver, 1-100 nm particles, 19.3%",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
          notes: "EPA Reg 85249-1 — HeiQ AGS-20 masterbatch concentrate. Downstream dilution to 0.001-0.01% in finished textile per EPA-mandated label use rates.",
        }),
        costPerKg: 850,
      },
      { name: "Silicon dioxide / polymer carrier matrix", kgPerKgProduct: 0.80, costPerKg: 1.80 },
    ],
    reactionChemicals: [
      { name: "Reducing agents (citrate/borohydride)", kgPerKgProduct: 0.005, costPerKg: 40 },
      { name: "Surfactants (stabilizers)", kgPerKgProduct: 0.003, costPerKg: 8 },
    ],
    facilityEnergyKwhPerKg: 80,
    facilityWaterLitersPerKg: 350,
    facilityWasteKgPerKg: 2.1,
    facilityVOCgPerKg: 25,
    facilityCO2PerKg: 45,
    co2Breakdown: {
      mining: 19.0,     // 0.193 kg Ag × 100 kg CO2/kg Ag (mining+refining portion of Aurubis 158 figure)
      refining: 11.5,
      synthesis: 14.5,  // Flame spray pyrolysis / chemical reduction at 19.3% Ag loading
      source: "Aurubis EFD 2024 (158 kg/kg Ag, mining+refining ~100) scaled by 0.193 kg Ag/kg product. Synthesis from NREL Manufacturing Energy Report (DOE 2023) nanoparticle production energy estimates × 0.193 active fraction.",
    },
  },
  qac_silane: {
    processName: "Organosilane Quaternary Ammonium (Aegis AEM 5772 / Microban CS5-A / BIOSAFE class)",
    archetypeSource: {
      sdsUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/042182-00028-20230331.pdf",
      sdsDate: "2023-03-31",
      sdsSection: "Section 1 — Active Ingredient",
      valueAsPublished: "3-(trihydroxysilyl)propyldimethyloctadecyl ammonium chloride 3.6%; INERT INGREDIENTS 96.4%; TOTAL 100.0% (Microban CS5-A, EPA Reg 42182-28 — chosen as the canonical ready-to-apply silane-QAC textile finish concentration)",
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      notes: "Silane-QAC ships in a wide range of concentrations: 72% master concentrate (Aegis AEM 5772 / EPA 64881-2), 5% aqueous textile finish (Gelest BIOSAFE HM4005), 3.6% ready-to-apply (Microban CS5-A). Audit picked the 3.6% RTU form as canonical because it's what a textile mill actually applies. Aegis AEM 5772 concentrate at 72% modeled separately if needed. Was 1.0 (silane + amine summed feedstock) — physically meaningless as a finished-product fraction.",
    },
    rawMaterials: [
      {
        name: "3-(trihydroxysilyl)propyldimethyloctadecyl ammonium chloride (CAS 199111-50-7)",
        kgPerKgProduct: sourced(0.036, {
          sdsUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/042182-00028-20230331.pdf",
          sdsDate: "2023-03-31",
          sdsSection: "Section 1 — Active Ingredient",
          valueAsPublished: "3-(trihydroxysilyl)propyldimethyloctadecyl ammonium chloride 3.6%",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
          notes: "Microban CS5-A EPA Reg 42182-28. Aegis AEM 5772-5 RTU EPA Reg 64881-7 also at 3.6%. Gelest BIOSAFE HM4005 / HE4005 at 5%. Aegis AEM 5772 concentrate EPA Reg 64881-2 at 72%.",
        }),
        costPerKg: 25,
      },
      { name: "Aqueous + methanol carrier (96.4% inert)", kgPerKgProduct: 0.96, costPerKg: 0.50 },
    ],
    reactionChemicals: [
      { name: "Methanol residual (VOC source)", kgPerKgProduct: 0.004, costPerKg: 0.50 },
    ],
    facilityEnergyKwhPerKg: 12,
    facilityWaterLitersPerKg: 60,
    facilityWasteKgPerKg: 0.2,
    facilityVOCgPerKg: 18,
    facilityCO2PerKg: 2.5,
    co2Breakdown: {
      mining: 0,
      refining: 0,
      synthesis: 2.5,   // Petrochemical synthesis of silane-quat + methanol, scaled to 3.6% loading
      source: "IEA Chemicals Sector Report 2023 specialty synthesis benchmarks, scaled to 3.6% silane-quat in the as-sold textile-finish RTU form. Methanol residual carries VOC penalty under EPA label warnings.",
    },
  },

  /**
   * Organic acid antimicrobial (Microban Additive GS class — 100% benzoic acid).
   * Audit found Microban Additive GS misclassified as qac_silane in
   * src/lib/competitors.ts. The product is actually 100% benzoic acid per
   * EPA Reg 42182-14. Adding this archetype so the misclassification fix
   * (deferred to a follow-up commit per spec ESCALATION rules) has somewhere
   * to land. Benzoic acid antimicrobial is a different chemistry class —
   * no metals, no silane, just an organic preservative.
   */
  organic_acid: {
    processName: "Benzoic Acid Antimicrobial Additive (Microban Additive GS class)",
    archetypeSource: {
      sdsUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/042182-00014-20230317.pdf",
      sdsDate: "2023-03-17",
      sdsSection: "Section 1 — Active Ingredient",
      valueAsPublished: "ACTIVE INGREDIENT: Benzoic Acid 100%",
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      notes: "Microban Additive GS EPA Reg 42182-14 — pure benzoic acid powder additive. Misclassified as qac_silane in competitors.ts; fix deferred to follow-up commit pending Andrew sign-off.",
    },
    rawMaterials: [
      {
        name: "Benzoic acid (CAS 65-85-0)",
        kgPerKgProduct: sourced(1.0, {
          sdsUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/042182-00014-20230317.pdf",
          sdsDate: "2023-03-17",
          sdsSection: "Section 1 — Active Ingredient",
          valueAsPublished: "Benzoic Acid 100%",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
        }),
        costPerKg: 2.20,
      },
    ],
    reactionChemicals: [],
    facilityEnergyKwhPerKg: 4,
    facilityWaterLitersPerKg: 18,
    facilityWasteKgPerKg: 0.05,
    facilityVOCgPerKg: 2,
    facilityCO2PerKg: 1.6,
    co2Breakdown: {
      mining: 0,
      refining: 0,
      synthesis: 1.6,   // Benzoic acid from toluene oxidation — well-characterized petrochemical
      source: "ecoinvent 3.10 benzoic acid market (toluene oxidation route, ~1.5-1.7 kg CO2/kg).",
    },
  },
  zinc_pyrithione: {
    processName: "Zinc Pyrithione Textile Finish (industry-average ZPT class)",
    archetypeSource: {
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      estimated: true,
      estimationBasis: "Commercial ZPT-based textile finishes are typically 0.5-2% active ZPT in aqueous formulation per peer-reviewed antimicrobial textile literature (Schramm et al.; ZPT supplier data from Lonza/Arch Chemicals). Conservative 2% used. NOTE: Three competitors previously assigned to this archetype were misclassified — see deliverables/Competitor_SDS_Audit_2026-05.md escalations.",
      notes: "Was 1.0 active (Zn + ZPT summed as feedstock) — physically meaningless as a finished-product fraction. Corrected to 2% active in textile-finish solution.",
    },
    rawMaterials: [
      {
        name: "Zinc pyrithione (Na-ZPT complex)",
        kgPerKgProduct: sourced(0.020, {
          sdsSection: "Industry-average ZPT textile finish concentration",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
          estimated: true,
          estimationBasis: "Lonza/Arch ZPT supplier data + Schramm et al. antimicrobial textile literature — ZPT textile finishes 0.5-2% w/w in solution. Polygiene and Sanitized do not publish % w/w on public surfaces.",
          notes: "Was 0.65 sodium pyrithione + 0.35 zinc oxide summed (1.0 active) — corrected to 2% as-sold textile-finish concentration.",
        }),
        costPerKg: 28,
      },
      { name: "Aqueous carrier + dispersant", kgPerKgProduct: 0.97, costPerKg: 0.10 },
    ],
    reactionChemicals: [
      { name: "Polyamine stabilizer", kgPerKgProduct: 0.005, costPerKg: 6.50 },
      { name: "Sulfuric acid (pH adjustment)", kgPerKgProduct: 0.005, costPerKg: 0.12 },
    ],
    facilityEnergyKwhPerKg: 18,
    facilityWaterLitersPerKg: 120,
    facilityWasteKgPerKg: 0.4,
    facilityVOCgPerKg: 12,
    facilityCO2PerKg: 1.8,
    co2Breakdown: {
      mining: 0.06,     // 0.020 × ~35% Zn fraction of ZPT × 3.1 kg CO2/kg Zn
      refining: 0.12,
      synthesis: 1.62,  // Pyrithione complexation at 2% loading + stabilizer chemistry
      source: "ecoinvent 3.10 zinc production (3.1 kg CO2/kg Zn) × 0.020 kg ZPT × 0.355 Zn fraction. Synthesis from organic chemistry specialty synthesis benchmarks.",
    },
  },

  /**
   * Pure zinc oxide as-sold antimicrobial (iFabric BioACTIV AM class).
   * Distinct from zinc_pyrithione: BioACTIV AM is 97% ZnO powder additive,
   * NOT a ZPT formulation. Different cost stack (no pyrithione synthesis,
   * no formaldehyde crosslinker, no polyamine carrier). Phase 19.5 audit
   * found the prior practice of routing iFabric through the zinc_pyrithione
   * archetype was assigning fictional crosslinker chemistry to a pure
   * ZnO powder. Fixed by adding this archetype.
   */
  zinc_oxide: {
    processName: "Zinc Oxide Powder Additive (iFabric BioACTIV AM class)",
    archetypeSource: {
      sdsUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/087246-00012-20221006.pdf",
      sdsDate: "2022-10-06",
      sdsSection: "Section 1 — Active Ingredient",
      valueAsPublished: "ACTIVE INGREDIENT: Zinc Oxide 97%; OTHER INGREDIENTS 3%; Total 100%",
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit (reconfirms Phase 16 verification)",
      notes: "iFabric BioACTIV AM — pure ZnO powder additive. No ZPT, no formaldehyde, no polyamine carrier.",
    },
    rawMaterials: [
      {
        name: "Zinc oxide (ZnO powder)",
        kgPerKgProduct: sourced(0.97, {
          sdsUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/087246-00012-20221006.pdf",
          sdsDate: "2022-10-06",
          sdsSection: "Section 1 — Active Ingredient",
          valueAsPublished: "Zinc Oxide 97%",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
          notes: "EPA Reg 87246-12 stamped Oct 06, 2022. Phase 16 verification reconfirmed.",
        }),
        costPerKg: 3.50,
      },
      { name: "Inert binder/anti-caking agent", kgPerKgProduct: 0.03, costPerKg: 1.20 },
    ],
    reactionChemicals: [],
    facilityEnergyKwhPerKg: 8,
    facilityWaterLitersPerKg: 25,
    facilityWasteKgPerKg: 0.05,
    facilityVOCgPerKg: 0,
    facilityCO2PerKg: 3.4,
    co2Breakdown: {
      mining: 1.8,      // 0.97 × ~80% Zn × 3.1 kg CO2/kg Zn (ecoinvent zinc ore extraction)
      refining: 1.4,    // Zinc smelting + ZnO calcination
      synthesis: 0.2,   // Powder grinding + anti-caking — minimal further processing
      source: "ecoinvent 3.10 zinc production (3.1 kg CO2/kg Zn) × 0.97 kg ZnO × 0.803 Zn fraction in ZnO. ZnO calcination from ore is well-characterized in IEA Industrial Energy benchmarks.",
    },
  },
  copper: {
    processName: "Cuprous Oxide Masterbatch Fiber (Cupron Classic PET class)",
    archetypeSource: {
      sdsUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7930948/",
      sdsSection: "Borkow et al. — Cupron-authored peer-reviewed paper",
      valueAsPublished: "\"cuprous oxide microparticles in a polyester master batch were added to the slurry of the polyester to a final concentration of 2.6% w/w\"",
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      notes: "Was 0.5 CuSO₄ + 0.8 polydopamine binder = 1.3 kg/kg (over 100% — structurally broken). Also wrong vehicle entirely — Cupron is masterbatch fiber extrusion (Palmer Holland 20%/40% PET masterbatch, let down to ~2.6% in final yarn), NOT a topical PDA finish. Corrected to 2.6% Cu₂O per Cupron's own peer-reviewed paper.",
    },
    rawMaterials: [
      {
        name: "Cuprous oxide (Cu₂O) in PET masterbatch",
        kgPerKgProduct: sourced(0.026, {
          sdsUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7930948/",
          sdsSection: "Borkow et al. Test Sample 1 (Cupron Classic PET 100% Cupron yarn)",
          valueAsPublished: "\"a final concentration of 2.6% w/w\"",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
          notes: "Cupron Classic PET 100% yarn at 2.6% Cu₂O. Palmer Holland masterbatch ships at 20% and is diluted to ~2.6% in final yarn at 13% let-down ratio. Blended-content garments (Test Sample 2) end up at 1.04% Cu₂O.",
        }),
        costPerKg: 12,
      },
      { name: "PET polymer matrix", kgPerKgProduct: 0.97, costPerKg: 1.20 },
    ],
    reactionChemicals: [],
    facilityEnergyKwhPerKg: 15,
    facilityWaterLitersPerKg: 35,
    facilityWasteKgPerKg: 0.1,
    facilityVOCgPerKg: 0,
    facilityCO2PerKg: 2.4,
    co2Breakdown: {
      mining: 0.05,     // 0.026 × ~89% Cu in Cu₂O × 3.5 kg CO2/kg Cu mining fraction
      refining: 0.04,
      synthesis: 2.31,  // PET masterbatch extrusion is the dominant CO2 contributor at 2.6% Cu₂O loading
      source: "ecoinvent 3.10 copper production (3.5 kg CO2/kg Cu); ICA Carbon Footprint of Copper 2022. Masterbatch extrusion energy from IEA Plastics Sector 2023 PET processing benchmarks, scaled by 0.026 Cu₂O fraction.",
    },
  },

  /**
   * Bio-based + EPA-exempt chemistries. These five archetypes were
   * missing from UPSTREAM_MANUFACTURING before Phase 19.5 — competitors
   * using them (NordShield CiTex / BioLayr / Crisp + chitosan textile
   * finishes) fell back to silver_chloride math by accident.
   */

  chitosan: {
    processName: "Chitosan Textile Finishing (EPA Section 25(b) minimum-risk exempt)",
    archetypeSource: {
      sdsUrl: "https://www.epa.gov/pesticides/epa-adds-chitosan-list-active-ingredients-eligible-minimum-risk-pesticide-exemption",
      sdsSection: "EPA chitosan minimum-risk exemption (FIFRA Section 25(b), 2022)",
      valueAsPublished: "Chitosan added to FIFRA Section 25(b) minimum-risk active ingredient list",
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      estimated: true,
      estimationBasis: "Industry-average commercial chitosan textile finishes 0.5-2% on-fabric per Ferrero & Periolatto, Carbohydrate Polymers 2012; midpoint 1% used.",
      notes: "EPA-EXEMPT under FIFRA Section 25(b) — better regulatory optics than EPA-registered silver/QAC competitors. Counter-narrative for FUZE: efficacy/dose — chitosan needs ~1% w/w on-fabric, FUZE F1 at 0.0001% w/w.",
    },
    rawMaterials: [
      {
        name: "Chitosan (deacetylated chitin, CAS 9012-76-4)",
        kgPerKgProduct: sourced(0.010, {
          sdsUrl: "https://www.sciencedirect.com/science/article/abs/pii/S0144861711010861",
          sdsSection: "Ferrero & Periolatto, Carbohydrate Polymers 2012",
          valueAsPublished: "fabrics impregnated with 2% w chitosan in aqueous acetic acid; ~1% on weight of fabric retained",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
          estimated: true,
          estimationBasis: "1% on-fabric is midpoint of industry-average 0.5-2% commercial chitosan textile finish range.",
        }),
        costPerKg: 18,
      },
      { name: "Acetic acid carrier", kgPerKgProduct: 0.02, costPerKg: 0.85 },
      { name: "Aqueous bath", kgPerKgProduct: 0.97, costPerKg: 0.002 },
    ],
    reactionChemicals: [
      { name: "Citric acid crosslinker", kgPerKgProduct: 0.005, costPerKg: 1.20 },
    ],
    facilityEnergyKwhPerKg: 6,
    facilityWaterLitersPerKg: 80,
    facilityWasteKgPerKg: 0.15,
    facilityVOCgPerKg: 3,
    facilityCO2PerKg: 1.2,
    co2Breakdown: {
      mining: 0,
      refining: 0,
      synthesis: 1.2,   // Crab/shrimp shell deacetylation — bio-based but energy-intensive deacetylation
      source: "Peer-reviewed chitosan LCA (Muñoz et al., J Cleaner Production 2018) ~120 kg CO2/kg chitosan production; scaled to 1% on-fabric loading.",
    },
  },

  citric_acid: {
    processName: "Citric Acid Crosslink Antimicrobial Finish (NordShield CiTex class)",
    archetypeSource: {
      sdsUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3046493/",
      sdsSection: "Schramm et al. — citric acid antimicrobial cotton",
      valueAsPublished: "\"samples were impregnated with 7% CA and 6.5% SHP solution with ~100% wet pickup\" → ~6.9% citric acid on fabric",
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      notes: "EPA-EXEMPT under FIFRA Section 25(b). competitors.ts current 8% claim within ±15% of peer-reviewed 6.9-7.0% — defensible. Acts as competitive narrative trap: high dose (~70 g/kg fabric) but regulatorily clean.",
    },
    rawMaterials: [
      {
        name: "Citric acid (CAS 77-92-9)",
        kgPerKgProduct: sourced(0.07, {
          sdsUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3046493/",
          sdsSection: "Schramm et al., antibacterial citric acid cotton textiles",
          valueAsPublished: "7% citric acid + 6.5% SHP in 100% pickup → ~6.9% on fabric",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
        }),
        costPerKg: 1.20,
      },
      { name: "Sodium hypophosphite (SHP catalyst)", kgPerKgProduct: 0.065, costPerKg: 8.0 },
      { name: "Aqueous bath", kgPerKgProduct: 0.86, costPerKg: 0.002 },
    ],
    reactionChemicals: [],
    facilityEnergyKwhPerKg: 12,
    facilityWaterLitersPerKg: 110,
    facilityWasteKgPerKg: 0.25,
    facilityVOCgPerKg: 5,
    facilityCO2PerKg: 0.9,
    co2Breakdown: {
      mining: 0,
      refining: 0,
      synthesis: 0.9,   // Citric acid is produced by Aspergillus niger fermentation — relatively low-carbon
      source: "ecoinvent 3.10 citric acid market (Aspergillus niger submerged fermentation, ~0.9 kg CO2/kg). High dose 7% but low carbon intensity per kg active.",
    },
  },

  resin_acid: {
    processName: "Coniferous Resin Acid Composition (NordShield BioLayr class)",
    archetypeSource: {
      sdsUrl: "https://patents.google.com/patent/US12054880B2/en",
      sdsSection: "Nordic BioTech Group US Patent 12,054,880 B2 examples",
      valueAsPublished: "\"the fabric treated with coniferous resin acid composition in an amount of 0.3-0.365 g/m² had sustained strong bactericidal activity\" → 0.2% w/w on 150 g/m² fabric",
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      notes: "ESCALATED to Andrew: competitors.ts entry assumes 1.5% (15000 mg/kg dosageTypical) — patent says 0.2%, a 7.5× overstatement. Corrected to 0.2% per manufacturer's own patent. Makes BioLayr a less dramatic comparison than we've been claiming.",
    },
    rawMaterials: [
      {
        name: "Coniferous resin acid composition (abietic-type diterpene acids from spruce/pine side streams)",
        kgPerKgProduct: sourced(0.002, {
          sdsUrl: "https://patents.google.com/patent/US12054880B2/en",
          sdsSection: "Nordic BioTech Group US 12,054,880 B2 Examples (0.30 g/m² / 150 g/m² activewear fabric)",
          valueAsPublished: "0.3-0.365 g/m² on fabric",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
          notes: "Bath is only 200 ppm (0.02%). On-fabric load 0.2% w/w. Plant-derived mixture; no single CAS.",
        }),
        costPerKg: 22,
      },
      { name: "Water-soluble carrier", kgPerKgProduct: 0.998, costPerKg: 0.002 },
    ],
    reactionChemicals: [],
    facilityEnergyKwhPerKg: 4,
    facilityWaterLitersPerKg: 45,
    facilityWasteKgPerKg: 0.05,
    facilityVOCgPerKg: 8,
    facilityCO2PerKg: 0.7,
    co2Breakdown: {
      mining: 0,
      refining: 0,
      synthesis: 0.7,   // Resin acid extraction from forestry side streams — bio-based, low energy
      source: "Forestry side-stream extraction LCAs (Stora Enso / UPM Biofore reports) ~70-80 kg CO2/kg purified resin acid; scaled to 0.2% on-fabric.",
    },
  },

  wood_extract: {
    processName: "Wood Extract Film-Former (NordShield Crisp class)",
    archetypeSource: {
      sdsUrl: "https://patents.google.com/patent/US12054880B2/en",
      sdsSection: "Same Nordic BioTech patent family (Crisp variant)",
      verifiedDate: "2026-05-26",
      verifiedBy: "Phase 19.5 audit",
      estimated: true,
      estimationBasis: "No Crisp-specific public TDS or quantitative source. Film-forming wood extractives on cellulose typically need 2-5× the resin-acid load (0.3-0.7% w/w on-fabric); midpoint 0.5% used.",
      notes: "Cellulose-substrate-only limitation is the more lethal competitive lever — Crisp cannot treat polyester/nylon/synthetic blends at all, killing it for the majority of the performance textile market.",
    },
    rawMaterials: [
      {
        name: "Wood-based bio-extract (film-forming wood extractives)",
        kgPerKgProduct: sourced(0.005, {
          sdsSection: "Industry-average wood-extractive film-former (Crisp-specific TDS not public)",
          verifiedDate: "2026-05-26",
          verifiedBy: "Phase 19.5 audit",
          estimated: true,
          estimationBasis: "0.5% midpoint of 0.3-0.7% film-former range on cellulose substrates per wood-extractive textile finishing literature.",
        }),
        costPerKg: 18,
      },
      { name: "Aqueous carrier + emulsifier", kgPerKgProduct: 0.995, costPerKg: 0.05 },
    ],
    reactionChemicals: [],
    facilityEnergyKwhPerKg: 5,
    facilityWaterLitersPerKg: 50,
    facilityWasteKgPerKg: 0.06,
    facilityVOCgPerKg: 10,
    facilityCO2PerKg: 0.9,
    co2Breakdown: {
      mining: 0,
      refining: 0,
      synthesis: 0.9,
      source: "Forestry side-stream extraction LCAs (Stora Enso / UPM Biofore); estimated similar carbon intensity to resin_acid archetype.",
    },
  },
  fuze: {
    processName: "Liquid Laser Ablation (30A, 1m² table, solar-capable)",
    rawMaterials: [
      { name: "Recycled electronics (e-waste feedstock)", kgPerKgProduct: 0.001, costPerKg: 0.50 },
      { name: "18 MΩ ultrapure DI water", kgPerKgProduct: 50, costPerKg: 0.003 },
    ],
    reactionChemicals: [],  // ZERO reaction chemicals
    facilityEnergyKwhPerKg: 3.6,   // 30A × 120V × 1hr = 3.6 kWh
    facilityWaterLitersPerKg: 50,   // only the DI water carrier — becomes the product
    facilityWasteKgPerKg: 0,        // ZERO waste
    facilityVOCgPerKg: 0,           // ZERO VOCs
    facilityCO2PerKg: 0.05,         // laser energy only on low-carbon grid
    co2Breakdown: {
      mining: 0,        // ZERO — feedstock is recycled electronics (e-waste), no mining
      refining: 0,      // ZERO — no smelting or chemical refining
      synthesis: 0.05,  // 30A laser ablation in DI water — 3.6 kWh/kg on US grid (0.014 kg CO2/kWh)
      source: "Direct measurement: 30A × 120V × 1hr = 3.6 kWh. US grid emission factor 0.014 kg CO2/kWh (solar-capable). MKS PAMP recycled silver benchmark: ~10 kg CO2/kg Ag (2024 PER).",
    },
  },
};

// ═══════════════════════════════════════════════════════
// WASTEWATER REMEDIATION COSTS AT TEXTILE FACTORY
// What the factory pays to clean up after applying
// the competitor's antimicrobial treatment
// ═══════════════════════════════════════════════════════

export type RemediationCost = {
  chemicals: { name: string; kgPerM3Wastewater: number; costPerKg: number }[];
  energyKwhPerM3: number;       // energy to run treatment (pumps, reactors, filtration)
  totalCostPerM3: number;       // total USD per cubic meter — GLOBAL AVERAGE (developing world textile hubs)
  totalCostPerM3US: number;     // total USD per cubic meter — US/EU (stricter EPA/REACH discharge limits)
  method: string;
  scope: string;                // what this cost covers (silver-specific, QAC-specific, etc.)
};

export const REMEDIATION_COSTS: Record<string, RemediationCost> = {
  silver: {
    chemicals: [
      { name: "Caustic soda (NaOH) — pH adjustment", kgPerM3Wastewater: 2.5, costPerKg: 0.45 },
      { name: "Aluminum polychloride (coagulant)", kgPerM3Wastewater: 0.8, costPerKg: 0.65 },
      { name: "Ferric chloride (flocculant)", kgPerM3Wastewater: 0.5, costPerKg: 0.40 },
      { name: "Lime Ca(OH)₂ (AgCl precipitation)", kgPerM3Wastewater: 1.2, costPerKg: 0.12 },
      { name: "Hydrochloric acid (silver precipitation)", kgPerM3Wastewater: 0.3, costPerKg: 0.35 },
    ],
    energyKwhPerM3: 2.5,
    totalCostPerM3: 3.85,       // Global avg — SE Asia, South Asia, Central America textile hubs
    totalCostPerM3US: 7.20,     // US/EU — EPA silver effluent limit 5 µg/L requires additional polishing
    method: "Chemical precipitation + coagulation-flocculation + microfiltration",
    scope: "Silver-specific removal from antimicrobial application wastewater. Chemicals target dissolved Ag⁺ ions via chloride precipitation (AgCl↓) and coagulation of colloidal silver. Does not include baseline dye/BOD treatment which the factory pays regardless.",
  },
  quat: {
    chemicals: [
      { name: "Caustic soda (NaOH) — pH control", kgPerM3Wastewater: 1.8, costPerKg: 0.45 },
      { name: "Polymer flocculants", kgPerM3Wastewater: 0.3, costPerKg: 4.50 },
      { name: "Activated carbon (adsorption)", kgPerM3Wastewater: 1.5, costPerKg: 1.20 },
      { name: "Biosorbents (MBBR media)", kgPerM3Wastewater: 0.05, costPerKg: 25 },
    ],
    energyKwhPerM3: 4.0,
    totalCostPerM3: 5.20,
    totalCostPerM3US: 9.40,     // US/EU — stricter QAC discharge limits, extended biodegradation
    method: "Moving Bed Biofilm Reactor (MBBR) + sorption + aerobic degradation",
    scope: "QAC-specific removal. Quaternary ammonium compounds resist biodegradation and are toxic to activated sludge — requires dedicated MBBR reactor and activated carbon polishing.",
  },
  copper: {
    chemicals: [
      { name: "Caustic soda (NaOH) — hydroxide precipitation", kgPerM3Wastewater: 3.0, costPerKg: 0.45 },
      { name: "Ferric sulfate (coagulant)", kgPerM3Wastewater: 1.0, costPerKg: 0.55 },
      { name: "Sodium sulfide (sulphide precipitation)", kgPerM3Wastewater: 0.4, costPerKg: 1.80 },
      { name: "Chelating agents (EDTA)", kgPerM3Wastewater: 0.2, costPerKg: 3.50 },
    ],
    energyKwhPerM3: 5.5,
    totalCostPerM3: 6.10,
    totalCostPerM3US: 11.50,    // US/EU — EPA copper freshwater limit 13 µg/L, very strict
    method: "Hydroxide/sulphide precipitation + adsorption + electrochemical + membrane filtration",
    scope: "Copper-specific removal. Cu²⁺ is highly toxic to aquatic organisms at low concentrations — requires dual precipitation (hydroxide + sulphide) plus membrane polishing to meet discharge limits.",
  },
  zinc: {
    chemicals: [
      { name: "Caustic soda (NaOH) — pH 8-9.5", kgPerM3Wastewater: 3.5, costPerKg: 0.45 },
      { name: "Sodium sulfide (93.75% Zn removal)", kgPerM3Wastewater: 0.8, costPerKg: 1.80 },
      { name: "Sodium trithiocarbonate", kgPerM3Wastewater: 0.3, costPerKg: 8.50 },
      { name: "SRB culture media (bioreactor)", kgPerM3Wastewater: 0.1, costPerKg: 15 },
    ],
    energyKwhPerM3: 6.0,
    totalCostPerM3: 7.45,
    totalCostPerM3US: 13.80,    // US/EU — EPA zinc freshwater limit 120 µg/L + pyrithione toxicity
    method: "SRB bioreactor + sulphide precipitation + electrocoagulation",
    scope: "Zinc pyrithione removal. ZPT is classified H330 (Fatal if inhaled) and H400 (Very toxic to aquatic life) — requires bioreactor degradation plus metal precipitation. Pyrithione ligand itself must be destroyed.",
  },
  fuze: {
    chemicals: [],  // ZERO chemicals needed
    energyKwhPerM3: 0,
    totalCostPerM3: 0,
    totalCostPerM3US: 0,
    method: "No treatment required — carrier is 18 MΩ ultrapure water",
    scope: "FUZE metamaterial bonds to fabric at ambient temperature. Carrier water (99.998% ultrapure DI) can be discharged or recycled with zero additional treatment.",
  },
};

export type SustainabilityScore = {
  // Per linear meter
  co2SavedPerMeter: number;           // kg CO2 saved vs competitor per linear meter
  waterSavedPerMeter: number;         // liters of contaminated water not created
  chemicalEliminatedPerMeter: number; // mg of toxic chemistry not used
  binderEliminatedPerMeter: number;   // grams of polymer binder not used
  energySavedPerMeter: number;        // kWh factory energy saved (no curing)

  // Upstream chemical plant costs (NEW)
  upstreamPlantCO2PerMeter: number;          // kg CO2 at chemical plant per meter
  upstreamPlantWasteKgPerMeter: number;      // kg chemical waste at plant per meter
  upstreamPlantVOCgPerMeter: number;         // grams VOC at plant per meter
  upstreamPlantWaterLitersPerMeter: number;  // liters process water at plant per meter
  upstreamRawMaterialCostPerMeter: number;   // USD raw material cost per meter

  // Wastewater remediation at textile factory (NEW)
  remediationCostPerMeter: number;           // USD wastewater treatment cost per meter (global avg)
  remediationCostPerMeterUS: number;         // USD wastewater treatment cost per meter (US/EU)
  remediationChemicalsKgPerMeter: number;    // kg of treatment chemicals per meter
  remediationEnergyKwhPerMeter: number;      // kWh for wastewater treatment per meter
  remediationScope: string;                  // what the remediation cost specifically covers

  // Stage 4: Consumer & Municipal (home laundering + municipal water treatment)
  consumerLeachedMetalMgPerWash: number;       // mg of active agent leached per wash cycle per garment
  consumerTotalLeachedMgLifetime: number;      // total mg leached over garment lifetime
  consumerWaterContaminatedLitersLifetime: number; // liters of home wash water contaminated
  municipalTreatmentCostPerGarment: number;    // USD municipal cost to treat leached metals
  municipalCO2PerGarmentLifetime: number;      // kg CO2 from municipal treatment of leached metals
  landfillLeachateCostPerGarment: number;      // USD end-of-life landfill leachate treatment
  consumerBioaccumulationFactor: number;       // 0-1 environmental persistence score
  consumerMicroplasticShedGPerWash: number;    // grams of binder microplastic shed per wash

  // Environmental grade (competitor gets D/F, FUZE always A)
  competitorEnvironmentalGrade: string;         // F, D, D+, C, C+, B based on environmental harm
  competitorRecyclable: boolean;                // false if binder/chemistry prevents textile recycling
  recyclabilityNote: string;                    // explanation of why recyclable or not

  // True total cost (antimicrobial + binder + curing energy + remediation + consumer)
  trueTotalCostPerMeter: number;             // competitor full cost per meter
  fuzeTrueCostPerMeter: number;              // FUZE full cost per meter (just the product)
  hiddenCostPerMeter: number;                // the costs competitors don't show you

  // Per 10,000 garments (the number brands think in)
  co2SavedPer10kGarments: number;
  waterSavedPer10kGarments: number;
  chemicalEliminated10kGarments: number;
  binderEliminated10kGarments: number;

  // Breakdowns
  co2Breakdown: {
    binderProduction: number;
    curingEnergy: number;
    chemistryProduction: number;
    wastewaterTreatment: number;
    retreatmentMultiplier: number;
    total: number;
  };

  // Recycled metal offset
  recycledMetalCO2Saved: number;      // kg CO2 saved by using recycled vs virgin metal

  // Score (0-100)
  sustainabilityScore: number;
  grade: string;
};

export function calcSustainabilityScore(
  competitor: Competitor,
  fabricWeightKg: number,       // kg per linear meter of fabric (GSM × width)
  targetWashes: number,
  metersPerGarment: number = 1.5,  // average meters of fabric per garment
): SustainabilityScore {
  const EF = EMISSION_FACTORS;

  // How many competitor applications needed for target washes
  const competitorApps = competitor.maxWashClaim > 0
    ? Math.ceil(targetWashes / competitor.maxWashClaim)
    : 1;

  // ── CO2 from binder production ──
  const binderPerAppG = competitor.binderRequired ? competitor.binderGPerKg * fabricWeightKg : 0;
  const totalBinderG = binderPerAppG * competitorApps;
  const binderProductionCO2 = (totalBinderG / 1000) * EF.binderProductionKgCO2PerKg;

  // ── CO2 from curing energy ──
  const curingCO2PerApp = competitor.curingRequired
    ? fabricWeightKg * EF.curingEnergyKwhPerKgFabric * EF.chinaGridEmission
    : 0;
  const curingEnergyCO2 = curingCO2PerApp * competitorApps;

  // ── CO2 from chemistry production ──
  const compChemKg = (competitor.dosageTypical * fabricWeightKg) / 1000000; // mg → kg
  const fuzeChemKg = (1.0 * fabricWeightKg) / 1000000; // FUZE at 1 mg/kg

  // Competitor uses virgin-mined metals; FUZE uses recycled
  let compChemCO2 = 0;
  if (competitor.chemistryType.includes("silver") || competitor.chemistryType === "silver_ion" || competitor.chemistryType === "silver_chloride") {
    compChemCO2 = compChemKg * competitorApps * EF.silverProductionKgCO2PerKg;
  } else if (competitor.chemistryType === "copper" || competitor.chemistryType === "silver_copper_zeolite") {
    compChemCO2 = compChemKg * competitorApps * ((EF.silverProductionKgCO2PerKg + EF.copperProductionKgCO2PerKg) / 2);
  } else if (competitor.chemistryType.includes("zinc")) {
    compChemCO2 = compChemKg * competitorApps * EF.zincProductionKgCO2PerKg;
  } else {
    // QAC/organic — estimate based on petrochemical synthesis
    compChemCO2 = compChemKg * competitorApps * 5.0; // generic petrochemical
  }

  // FUZE chemistry CO2 (recycled allotrope — much lower)
  const fuzeChemCO2 = fuzeChemKg * EF.silverRecycledKgCO2PerKg;
  const chemistryProductionCO2 = compChemCO2 - fuzeChemCO2;

  // ── CO2 from wastewater treatment ──
  const compWastewaterM3 = fabricWeightKg * EF.wastewaterVolumePerKgFabric * competitorApps;
  const wastewaterCO2 = compWastewaterM3 * EF.wastewaterTreatmentKgCO2PerM3;

  // ── Total CO2 saved per meter ──
  const co2SavedPerMeter = binderProductionCO2 + curingEnergyCO2 + chemistryProductionCO2 + wastewaterCO2;

  // ── Water saved ──
  // Competitor generates contaminated wastewater from: binder application, curing rinse, metal leaching
  const waterSavedPerMeter = compWastewaterM3 * 1000; // m3 → liters

  // ── Chemistry eliminated ──
  const compTotalChemMg = competitor.dosageTypical * fabricWeightKg * competitorApps;
  const fuzeTotalChemMg = 1.0 * fabricWeightKg;
  const chemicalEliminatedPerMeter = compTotalChemMg - fuzeTotalChemMg;

  // ── Binder eliminated ──
  const binderEliminatedPerMeter = totalBinderG;

  // ── Energy saved (factory) ──
  const energySavedPerMeter = curingCO2PerApp > 0
    ? fabricWeightKg * EF.curingEnergyKwhPerKgFabric * competitorApps
    : 0;

  // ── Per 10,000 garments ──
  const metersFor10k = 10000 * metersPerGarment;
  const co2SavedPer10kGarments = co2SavedPerMeter * metersFor10k;
  const waterSavedPer10kGarments = waterSavedPerMeter * metersFor10k;
  const chemicalEliminated10kGarments = chemicalEliminatedPerMeter * metersFor10k;
  const binderEliminated10kGarments = binderEliminatedPerMeter * metersFor10k;

  // ── Recycled metal offset ──
  const recycledMetalCO2Saved = fuzeChemKg * (EF.silverProductionKgCO2PerKg - EF.silverRecycledKgCO2PerKg);

  // ── Sustainability score (0-100) ──
  let score = 0;

  // No binder (20 pts)
  score += competitor.binderRequired ? 20 : 0;

  // No curing (15 pts)
  score += competitor.curingRequired ? 15 : 0;

  // No heavy metal leaching (20 pts)
  score += competitor.leachRatePerWash > 0 ? 20 : 0;

  // No formaldehyde (10 pts)
  score += competitor.binderFormaldehyde ? 10 : 0;

  // No VOC (10 pts)
  score += competitor.binderVOC ? 10 : 0;

  // Recycled metal source (10 pts — always true for FUZE)
  score += 10;

  // Wash durability advantage (15 pts)
  const washAdvantage = Math.max(0, targetWashes - competitor.maxWashClaim) / targetWashes;
  score += Math.min(15, Math.round(washAdvantage * 15) + (competitorApps > 1 ? 5 : 0));

  score = Math.min(100, score);

  const grade =
    score >= 95 ? "A+" :
    score >= 85 ? "A" :
    score >= 75 ? "B+" :
    score >= 65 ? "B" :
    score >= 50 ? "C" : "D";

  // ── Upstream chemical plant manufacturing ──
  const chemType = competitor.chemistryType;
  // Map chemistry type to upstream manufacturing data — check specific types BEFORE broad includes()
  const upstreamKey = chemType === "silver_ion" ? "silver_ion"
    : chemType === "silver_nano" ? "silver_nano"
    : chemType === "silver_chloride" ? "silver_chloride"
    : chemType.includes("silver") ? "silver_chloride"  // fallback for other silver variants
    : chemType === "qac_silane" ? "qac_silane"
    : chemType === "organic_acid" ? "organic_acid"
    : chemType.includes("zinc") ? "zinc_pyrithione"
    : chemType === "copper" ? "copper"
    : chemType === "chitosan" ? "chitosan"
    : chemType === "citric_acid" ? "citric_acid"
    : chemType === "resin_acid" ? "resin_acid"
    : chemType === "wood_extract" ? "wood_extract"
    : "silver_chloride"; // default fallback
  const compUpstream = UPSTREAM_MANUFACTURING[upstreamKey] || UPSTREAM_MANUFACTURING.silver_chloride;
  const fuzeUpstream = UPSTREAM_MANUFACTURING.fuze;

  // kg of antimicrobial product used per meter of fabric
  const compProductKgPerMeter = (competitor.dosageTypical * fabricWeightKg) / 1000000 * 1000; // mg/kg → g → scale
  const fuzeProductKgPerMeter = (1.0 * fabricWeightKg) / 1000000 * 1000;

  const upstreamPlantCO2PerMeter = (compProductKgPerMeter * valueOf(compUpstream.facilityCO2PerKg) * competitorApps) - (fuzeProductKgPerMeter * valueOf(fuzeUpstream.facilityCO2PerKg));
  const upstreamPlantWasteKgPerMeter = compProductKgPerMeter * valueOf(compUpstream.facilityWasteKgPerKg) * competitorApps;
  const upstreamPlantVOCgPerMeter = compProductKgPerMeter * valueOf(compUpstream.facilityVOCgPerKg) * competitorApps;
  const upstreamPlantWaterLitersPerMeter = compProductKgPerMeter * valueOf(compUpstream.facilityWaterLitersPerKg) * competitorApps;

  // Raw material cost at the chemical plant
  const compRawCostPerKg = compUpstream.rawMaterials.reduce((sum, m) => sum + valueOf(m.kgPerKgProduct) * m.costPerKg, 0)
    + compUpstream.reactionChemicals.reduce((sum, m) => sum + valueOf(m.kgPerKgProduct) * m.costPerKg, 0);
  const upstreamRawMaterialCostPerMeter = compProductKgPerMeter * compRawCostPerKg * competitorApps;

  // ── Wastewater remediation at textile factory ──
  const remKey = chemType.includes("silver") || chemType === "silver_ion" || chemType === "silver_nano" ? "silver"
    : chemType === "qac_silane" ? "quat"
    : chemType.includes("zinc") ? "zinc"
    : chemType === "copper" ? "copper"
    : "silver";
  const compRemediation = REMEDIATION_COSTS[remKey] || REMEDIATION_COSTS.silver;

  const remediationCostPerMeter = compWastewaterM3 * compRemediation.totalCostPerM3;
  const remediationCostPerMeterUS = compWastewaterM3 * compRemediation.totalCostPerM3US;
  const remediationChemicalsKgPerMeter = compRemediation.chemicals.reduce((sum, c) => sum + c.kgPerM3Wastewater, 0) * compWastewaterM3;
  const remediationEnergyKwhPerMeter = compRemediation.energyKwhPerM3 * compWastewaterM3;
  const remediationScope = compRemediation.scope;

  // ── Stage 4: Consumer & Municipal ──
  // How much active agent leaches during home laundering
  const garmentFabricKg = fabricWeightKg * metersPerGarment;
  const totalActiveOnGarmentMg = competitor.dosageTypical * garmentFabricKg; // mg on one garment
  const leachPerWashPct = competitor.leachRatePerWash / 100;  // convert % to decimal
  const leachFirst10Pct = competitor.leachRateFirst10Washes / 100;

  // Leached metal per wash: first 10 washes use accelerated rate, then steady-state
  const leachedFirst10Mg = totalActiveOnGarmentMg * leachFirst10Pct;
  const leachedPerWashAfter10Mg = totalActiveOnGarmentMg * leachPerWashPct;
  const washesAfterFirst10 = Math.max(0, targetWashes - 10);
  const consumerTotalLeachedMgLifetime = leachedFirst10Mg + (leachedPerWashAfter10Mg * washesAfterFirst10);
  const consumerLeachedMetalMgPerWash = consumerTotalLeachedMgLifetime / Math.max(1, targetWashes);

  // Contaminated wash water
  const consumerWaterContaminatedLitersLifetime = targetWashes * EF.homeWashWaterLiters;

  // Municipal water treatment burden
  const consumerWaterM3 = consumerWaterContaminatedLitersLifetime / 1000;
  const municipalTreatmentCostPerGarment = (consumerTotalLeachedMgLifetime * EF.municipalMetalRemovalCostPerMg)
    + (consumerWaterM3 * EF.municipalTreatmentCostPerM3 * 0.05); // 5% attributable to antimicrobial contamination
  const municipalCO2PerGarmentLifetime = consumerWaterM3 * EF.municipalWaterTreatmentKgCO2PerM3 * 0.05;

  // End-of-life landfill leachate
  const landfillLeachateCostPerGarment = garmentFabricKg * EF.landfillLeachateTreatmentCostPerKg;

  // Bioaccumulation factor
  const consumerBioaccumulationFactor =
    (chemType.includes("silver") || chemType === "silver_ion" || chemType === "silver_nano") ? EF.bioaccumulationFactorSilver
    : chemType === "copper" ? EF.bioaccumulationFactorCopper
    : chemType.includes("zinc") ? EF.bioaccumulationFactorZinc
    : EF.bioaccumulationFactorQAC;

  // Microplastic shedding from binder (if binder present)
  const consumerMicroplasticShedGPerWash = competitor.binderRequired
    ? (competitor.binderGPerKg * garmentFabricKg * (competitor.binderLeachPctLifetime / 100)) / targetWashes
    : 0;

  // ── Competitor Environmental Grade (inverted — measures environmental HARM) ──
  // Higher harm score = worse grade. FUZE always gets "A".
  let harmScore = 0;
  if (competitor.binderRequired) harmScore += 20;        // binders = petrochemical polymers
  if (competitor.curingRequired) harmScore += 15;        // curing ovens = energy + CO2
  if (competitor.leachRatePerWash > 0) harmScore += 20;  // leaches into water systems
  if (competitor.binderFormaldehyde) harmScore += 15;     // carcinogenic crosslinker
  if (competitor.binderVOC) harmScore += 10;              // volatile organic compounds at factory
  if (consumerBioaccumulationFactor > 0.5) harmScore += 10; // persists in environment
  if (consumerMicroplasticShedGPerWash > 0) harmScore += 10; // microplastic pollution

  const competitorEnvironmentalGrade =
    harmScore >= 80 ? "F" :
    harmScore >= 65 ? "D" :
    harmScore >= 50 ? "D+" :
    harmScore >= 35 ? "C" :
    harmScore >= 20 ? "C+" : "B";

  // ── Recyclability Assessment ──
  // Binders create cross-linked polymer coatings that contaminate fiber recycling streams.
  // Chemical treatments embedded in the fiber matrix prevent clean fiber recovery.
  // Relevant to California SB 707 (Responsible Textile Recovery Act).
  const competitorRecyclable = !competitor.binderRequired && !competitor.curingRequired;
  const recyclabilityNote = competitor.binderRequired
    ? `${competitor.binderType} binder creates cross-linked polymer coating that contaminates fiber recycling streams. Non-compliant with emerging textile circularity standards (CA SB 707).`
    : competitor.curingRequired
    ? `High-temperature curing alters fiber structure, reducing recyclability. Chemical residues may contaminate recycling streams.`
    : `Chemistry does not use binders or curing, but active agent residues may still affect recycling purity.`;

  // ── True total cost per meter ──
  // Competitor: antimicrobial product + binder + curing energy + wastewater remediation + consumer municipal
  const compProductCostPerMeter = competitor.estimatedCostPerMeterTypical * competitorApps;
  const curingEnergyCostPerMeter = energySavedPerMeter * 0.10; // $0.10/kWh avg industrial electricity
  const municipalCostPerMeter = municipalTreatmentCostPerGarment / metersPerGarment;
  const landfillCostPerMeter = landfillLeachateCostPerGarment / metersPerGarment;
  const trueTotalCostPerMeter = compProductCostPerMeter + remediationCostPerMeter + curingEnergyCostPerMeter + municipalCostPerMeter + landfillCostPerMeter;
  const fuzeTrueCostPerMeter = 0.27; // F1 typical at $36/L — matches calculator
  const hiddenCostPerMeter = trueTotalCostPerMeter - compProductCostPerMeter; // the costs they don't tell you about

  return {
    co2SavedPerMeter,
    waterSavedPerMeter,
    chemicalEliminatedPerMeter,
    binderEliminatedPerMeter,
    energySavedPerMeter,
    upstreamPlantCO2PerMeter,
    upstreamPlantWasteKgPerMeter,
    upstreamPlantVOCgPerMeter,
    upstreamPlantWaterLitersPerMeter,
    upstreamRawMaterialCostPerMeter,
    remediationCostPerMeter,
    remediationCostPerMeterUS,
    remediationChemicalsKgPerMeter,
    remediationEnergyKwhPerMeter,
    remediationScope,
    consumerLeachedMetalMgPerWash,
    consumerTotalLeachedMgLifetime,
    consumerWaterContaminatedLitersLifetime,
    municipalTreatmentCostPerGarment,
    municipalCO2PerGarmentLifetime,
    landfillLeachateCostPerGarment,
    consumerBioaccumulationFactor,
    consumerMicroplasticShedGPerWash,
    competitorEnvironmentalGrade,
    competitorRecyclable,
    recyclabilityNote,
    trueTotalCostPerMeter,
    fuzeTrueCostPerMeter,
    hiddenCostPerMeter,
    co2SavedPer10kGarments,
    waterSavedPer10kGarments,
    chemicalEliminated10kGarments,
    binderEliminated10kGarments,
    co2Breakdown: {
      binderProduction: binderProductionCO2,
      curingEnergy: curingEnergyCO2,
      chemistryProduction: chemistryProductionCO2,
      wastewaterTreatment: wastewaterCO2,
      retreatmentMultiplier: competitorApps,
      total: co2SavedPerMeter,
    },
    recycledMetalCO2Saved,
    sustainabilityScore: score,
    grade,
  };
}

// ═══════════════════════════════════════════════════════
// BRAND ESG MESSAGING GENERATOR
// ═══════════════════════════════════════════════════════

export type ESGClaim = {
  category: string;
  headline: string;
  detail: string;
  metric: string;
  icon: string;
};

export function generateESGClaims(
  score: SustainabilityScore,
  competitor: Competitor,
  annualMeters: number = 100000,  // typical brand annual production in meters
): ESGClaim[] {
  const claims: ESGClaim[] = [];

  // Carbon
  const annualCO2 = score.co2SavedPerMeter * annualMeters;
  claims.push({
    category: "Carbon Footprint",
    headline: "Reduced Carbon Emissions",
    detail: `Switching from ${competitor.product} to FUZE eliminates ${annualCO2.toFixed(0)} kg CO₂ annually from your antimicrobial supply chain — equivalent to ${(annualCO2 / 2.3).toFixed(0)} fewer car trips across America.`,
    metric: `${annualCO2.toFixed(0)} kg CO₂/year`,
    icon: "🌍",
  });

  // Water
  const annualWater = score.waterSavedPerMeter * annualMeters;
  claims.push({
    category: "Water Stewardship",
    headline: "Zero Contaminated Wastewater",
    detail: `FUZE creates zero industrial wastewater in production and application. Switching eliminates ${annualWater.toFixed(0)} liters of contaminated water annually from your supply chain.`,
    metric: `${annualWater.toFixed(0)} L saved/year`,
    icon: "💧",
  });

  // Chemical reduction
  const annualChemKg = (score.chemicalEliminatedPerMeter * annualMeters) / 1000000;
  claims.push({
    category: "Chemical Reduction",
    headline: `${(competitor.dosageTypical / 1.0).toFixed(0)}× Less Chemistry`,
    detail: `FUZE uses ${(competitor.dosageTypical / 1.0).toFixed(0)}× less active antimicrobial material than ${competitor.product}. That's ${annualChemKg.toFixed(2)} kg less toxic chemistry entering your supply chain annually.`,
    metric: `${annualChemKg.toFixed(2)} kg eliminated/year`,
    icon: "🧪",
  });

  // Binder elimination
  if (competitor.binderRequired) {
    const annualBinderKg = (score.binderEliminatedPerMeter * annualMeters) / 1000;
    claims.push({
      category: "Microplastic Prevention",
      headline: "Zero Polymer Binder",
      detail: `FUZE requires no petrochemical binder — eliminating ${annualBinderKg.toFixed(1)} kg of ${competitor.binderType.toLowerCase()} from your supply chain.${competitor.binderFormaldehyde ? " Also eliminates formaldehyde crosslinker exposure for factory workers." : ""}`,
      metric: `${annualBinderKg.toFixed(1)} kg binder eliminated/year`,
      icon: "🏭",
    });
  }

  // Recycled materials
  claims.push({
    category: "Circular Economy",
    headline: "Made from Recycled Electronics",
    detail: "FUZE's high density allotrope is synthesized from metals recovered from electronic waste streams — diverting e-waste from landfills and reducing virgin mining demand by 85%.",
    metric: `${(score.recycledMetalCO2Saved * annualMeters).toFixed(2)} kg CO₂ offset via recycling`,
    icon: "♻️",
  });

  // Zero leaching
  if (competitor.leachRatePerWash > 0) {
    claims.push({
      category: "Consumer Safety",
      headline: "Zero Leaching During Wear & Wash",
      detail: `${competitor.product} leaches ${competitor.leachRateFirst10Washes}% of its ${competitor.heavyMetalReleased.toLowerCase()} in the first 10 washes into your customer's home laundry. FUZE leaches zero — permanently bonded at the molecular level.`,
      metric: "0% leach rate",
      icon: "🛡️",
    });
  }

  return claims;
}
