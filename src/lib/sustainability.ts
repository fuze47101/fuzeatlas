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
const EMISSION_FACTORS = {
  // Binder production: petrochemical polymer synthesis
  binderProductionKgCO2PerKg: 2.5,       // kg CO2 per kg of acrylic/PU binder produced

  // Curing oven energy: natural gas or electric stenter frame
  curingEnergyKwhPerKgFabric: 0.8,       // kWh per kg fabric for 150-170°C curing
  gridEmissionFactor: 0.5,                // kg CO2 per kWh (global average grid)
  chinaGridEmission: 0.58,               // kg CO2 per kWh (China grid — where most textiles are made)

  // Chemical production
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
// UPSTREAM CHEMICAL PLANT MANUFACTURING COSTS
// What happens at the chemical facility BEFORE the
// antimicrobial reaches the textile factory
// ═══════════════════════════════════════════════════════

export type UpstreamManufacturing = {
  processName: string;
  rawMaterials: { name: string; kgPerKgProduct: number; costPerKg: number }[];
  reactionChemicals: { name: string; kgPerKgProduct: number; costPerKg: number }[];
  facilityEnergyKwhPerKg: number;    // kWh to produce 1 kg of antimicrobial product
  facilityWaterLitersPerKg: number;  // liters of process water per kg product
  facilityWasteKgPerKg: number;      // kg chemical waste per kg product
  facilityVOCgPerKg: number;         // grams VOC emitted per kg product at plant
  facilityCO2PerKg: number;          // total kg CO2 to manufacture 1 kg at the chemical plant
};

export const UPSTREAM_MANUFACTURING: Record<string, UpstreamManufacturing> = {
  silver_chloride: {
    processName: "Ion Exchange / Chemical Reduction",
    rawMaterials: [
      { name: "Silver nitrate (AgNO₃)", kgPerKgProduct: 0.63, costPerKg: 850 },
      { name: "Zeolite powder (aluminosilicate)", kgPerKgProduct: 3.0, costPerKg: 2.50 },
    ],
    reactionChemicals: [
      { name: "Sodium borohydride (reducing agent)", kgPerKgProduct: 0.15, costPerKg: 45 },
      { name: "Hydrochloric acid (wash/purification)", kgPerKgProduct: 0.5, costPerKg: 0.35 },
      { name: "Deionized water (reaction medium)", kgPerKgProduct: 200, costPerKg: 0.002 },
    ],
    facilityEnergyKwhPerKg: 85,
    facilityWaterLitersPerKg: 500,
    facilityWasteKgPerKg: 4.2,
    facilityVOCgPerKg: 12,
    facilityCO2PerKg: 120,
  },
  silver_ion: {
    processName: "Polymeric Silver Ion Delivery System",
    rawMaterials: [
      { name: "Silver salt precursor", kgPerKgProduct: 0.45, costPerKg: 750 },
      { name: "Organic polymer matrix", kgPerKgProduct: 2.0, costPerKg: 8.50 },
    ],
    reactionChemicals: [
      { name: "Proprietary solvents", kgPerKgProduct: 1.5, costPerKg: 3.20 },
      { name: "Stabilizing agents", kgPerKgProduct: 0.3, costPerKg: 12 },
    ],
    facilityEnergyKwhPerKg: 65,
    facilityWaterLitersPerKg: 350,
    facilityWasteKgPerKg: 3.1,
    facilityVOCgPerKg: 45,
    facilityCO2PerKg: 95,
  },
  silver_nano: {
    processName: "Flame Spray Pyrolysis / Chemical Reduction",
    rawMaterials: [
      { name: "Silver nitrate (AgNO₃)", kgPerKgProduct: 0.63, costPerKg: 850 },
      { name: "Silicon dioxide (silica carrier)", kgPerKgProduct: 5.0, costPerKg: 1.80 },
    ],
    reactionChemicals: [
      { name: "Reducing agents (citrate/borohydride)", kgPerKgProduct: 0.2, costPerKg: 40 },
      { name: "Surfactants (stabilizers)", kgPerKgProduct: 0.3, costPerKg: 8 },
      { name: "Acetone/ethanol (wash solvent)", kgPerKgProduct: 2.0, costPerKg: 1.50 },
    ],
    facilityEnergyKwhPerKg: 120,
    facilityWaterLitersPerKg: 400,
    facilityWasteKgPerKg: 5.8,
    facilityVOCgPerKg: 85,
    facilityCO2PerKg: 145,
  },
  qac_silane: {
    processName: "Organosilane Quaternary Ammonium Synthesis",
    rawMaterials: [
      { name: "Trimethoxysilylpropyl chloride", kgPerKgProduct: 0.6, costPerKg: 25 },
      { name: "Octadecyldimethylamine", kgPerKgProduct: 0.4, costPerKg: 18 },
    ],
    reactionChemicals: [
      { name: "Methanol (solvent — VOC source)", kgPerKgProduct: 2.5, costPerKg: 0.50 },
      { name: "Hydrochloric acid", kgPerKgProduct: 0.3, costPerKg: 0.35 },
      { name: "Polyvinyl alcohol (binder precursor)", kgPerKgProduct: 1.0, costPerKg: 2.80 },
      { name: "Acrylate ester polymers", kgPerKgProduct: 0.8, costPerKg: 3.50 },
      { name: "Paraffin/microcrystalline wax", kgPerKgProduct: 0.5, costPerKg: 1.20 },
    ],
    facilityEnergyKwhPerKg: 45,
    facilityWaterLitersPerKg: 200,
    facilityWasteKgPerKg: 3.8,
    facilityVOCgPerKg: 180,    // methanol + solvent off-gassing
    facilityCO2PerKg: 55,
  },
  zinc_pyrithione: {
    processName: "Zinc Salt + Pyrithione Complexation",
    rawMaterials: [
      { name: "Zinc oxide/sulfate", kgPerKgProduct: 0.35, costPerKg: 3.50 },
      { name: "Sodium pyrithione", kgPerKgProduct: 0.65, costPerKg: 28 },
    ],
    reactionChemicals: [
      { name: "Sulfuric acid (pH adjustment)", kgPerKgProduct: 0.3, costPerKg: 0.12 },
      { name: "Polyamine carrier system", kgPerKgProduct: 1.2, costPerKg: 6.50 },
      { name: "Urea formaldehyde crosslinker", kgPerKgProduct: 0.4, costPerKg: 1.80 },
    ],
    facilityEnergyKwhPerKg: 35,
    facilityWaterLitersPerKg: 180,
    facilityWasteKgPerKg: 2.5,
    facilityVOCgPerKg: 65,
    facilityCO2PerKg: 42,
  },
  copper: {
    processName: "Copper Oxide Nanoparticle Synthesis",
    rawMaterials: [
      { name: "Copper sulfate/acetate", kgPerKgProduct: 0.5, costPerKg: 5.50 },
      { name: "Polydopamine binder", kgPerKgProduct: 0.8, costPerKg: 45 },
    ],
    reactionChemicals: [
      { name: "Sodium hypophosphite (reducing agent)", kgPerKgProduct: 0.3, costPerKg: 8 },
      { name: "Ascorbic acid (alt. reducer)", kgPerKgProduct: 0.2, costPerKg: 12 },
      { name: "CTAB surfactant (stabilizer)", kgPerKgProduct: 0.15, costPerKg: 35 },
    ],
    facilityEnergyKwhPerKg: 55,
    facilityWaterLitersPerKg: 300,
    facilityWasteKgPerKg: 3.5,
    facilityVOCgPerKg: 25,
    facilityCO2PerKg: 65,
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
  totalCostPerM3: number;       // total USD per cubic meter of wastewater treated
  method: string;
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
    totalCostPerM3: 3.85,
    method: "Chemical precipitation + coagulation-flocculation + microfiltration",
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
    method: "Moving Bed Biofilm Reactor (MBBR) + sorption + aerobic degradation",
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
    method: "Hydroxide/sulphide precipitation + adsorption + electrochemical + membrane filtration",
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
    method: "SRB bioreactor + sulphide precipitation + electrocoagulation",
  },
  fuze: {
    chemicals: [],  // ZERO chemicals needed
    energyKwhPerM3: 0,
    totalCostPerM3: 0,
    method: "No treatment required — carrier is 18 MΩ ultrapure water",
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
  remediationCostPerMeter: number;           // USD wastewater treatment cost per meter
  remediationChemicalsKgPerMeter: number;    // kg of treatment chemicals per meter
  remediationEnergyKwhPerMeter: number;      // kWh for wastewater treatment per meter

  // Stage 4: Consumer & Municipal (home laundering + municipal water treatment)
  consumerLeachedMetalMgPerWash: number;       // mg of active agent leached per wash cycle per garment
  consumerTotalLeachedMgLifetime: number;      // total mg leached over garment lifetime
  consumerWaterContaminatedLitersLifetime: number; // liters of home wash water contaminated
  municipalTreatmentCostPerGarment: number;    // USD municipal cost to treat leached metals
  municipalCO2PerGarmentLifetime: number;      // kg CO2 from municipal treatment of leached metals
  landfillLeachateCostPerGarment: number;      // USD end-of-life landfill leachate treatment
  consumerBioaccumulationFactor: number;       // 0-1 environmental persistence score
  consumerMicroplasticShedGPerWash: number;    // grams of binder microplastic shed per wash

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
  const upstreamKey = chemType.includes("silver") || chemType === "silver_ion" ? "silver_chloride"
    : chemType === "qac_silane" ? "qac_silane"
    : chemType.includes("zinc") ? "zinc_pyrithione"
    : chemType === "copper" ? "copper"
    : chemType === "silver_nano" ? "silver_nano"
    : "silver_chloride"; // default fallback
  const compUpstream = UPSTREAM_MANUFACTURING[upstreamKey] || UPSTREAM_MANUFACTURING.silver_chloride;
  const fuzeUpstream = UPSTREAM_MANUFACTURING.fuze;

  // kg of antimicrobial product used per meter of fabric
  const compProductKgPerMeter = (competitor.dosageTypical * fabricWeightKg) / 1000000 * 1000; // mg/kg → g → scale
  const fuzeProductKgPerMeter = (1.0 * fabricWeightKg) / 1000000 * 1000;

  const upstreamPlantCO2PerMeter = (compProductKgPerMeter * compUpstream.facilityCO2PerKg * competitorApps) - (fuzeProductKgPerMeter * fuzeUpstream.facilityCO2PerKg);
  const upstreamPlantWasteKgPerMeter = compProductKgPerMeter * compUpstream.facilityWasteKgPerKg * competitorApps;
  const upstreamPlantVOCgPerMeter = compProductKgPerMeter * compUpstream.facilityVOCgPerKg * competitorApps;
  const upstreamPlantWaterLitersPerMeter = compProductKgPerMeter * compUpstream.facilityWaterLitersPerKg * competitorApps;

  // Raw material cost at the chemical plant
  const compRawCostPerKg = compUpstream.rawMaterials.reduce((sum, m) => sum + m.kgPerKgProduct * m.costPerKg, 0)
    + compUpstream.reactionChemicals.reduce((sum, m) => sum + m.kgPerKgProduct * m.costPerKg, 0);
  const upstreamRawMaterialCostPerMeter = compProductKgPerMeter * compRawCostPerKg * competitorApps;

  // ── Wastewater remediation at textile factory ──
  const remKey = chemType.includes("silver") || chemType === "silver_ion" || chemType === "silver_nano" ? "silver"
    : chemType === "qac_silane" ? "quat"
    : chemType.includes("zinc") ? "zinc"
    : chemType === "copper" ? "copper"
    : "silver";
  const compRemediation = REMEDIATION_COSTS[remKey] || REMEDIATION_COSTS.silver;

  const remediationCostPerMeter = compWastewaterM3 * compRemediation.totalCostPerM3;
  const remediationChemicalsKgPerMeter = compRemediation.chemicals.reduce((sum, c) => sum + c.kgPerM3Wastewater, 0) * compWastewaterM3;
  const remediationEnergyKwhPerMeter = compRemediation.energyKwhPerM3 * compWastewaterM3;

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
    remediationChemicalsKgPerMeter,
    remediationEnergyKwhPerMeter,
    consumerLeachedMetalMgPerWash,
    consumerTotalLeachedMgLifetime,
    consumerWaterContaminatedLitersLifetime,
    municipalTreatmentCostPerGarment,
    municipalCO2PerGarmentLifetime,
    landfillLeachateCostPerGarment,
    consumerBioaccumulationFactor,
    consumerMicroplasticShedGPerWash,
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
