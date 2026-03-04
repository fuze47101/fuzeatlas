// FUZE Sustainability & Carbon Footprint Scoring Engine
// Calculates per-garment and per-meter environmental impact savings when switching to FUZE

import type { Competitor } from "./competitors";

// ═══════════════════════════════════════════════════════
// FUZE PRODUCTION FACTS
// ═══════════════════════════════════════════════════════

export const FUZE_SUSTAINABILITY = {
  // Production
  productComposition: "99.98% deionized water + recycled silver/gold nanoparticles",
  energySource: "30 amp laser — sole energy input for nanoparticle synthesis",
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
};

export type SustainabilityScore = {
  // Per linear meter
  co2SavedPerMeter: number;           // kg CO2 saved vs competitor per linear meter
  waterSavedPerMeter: number;         // liters of contaminated water not created
  chemicalEliminatedPerMeter: number; // mg of toxic chemistry not used
  binderEliminatedPerMeter: number;   // grams of polymer binder not used
  energySavedPerMeter: number;        // kWh factory energy saved (no curing)

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

  // FUZE chemistry CO2 (recycled silver — much lower)
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

  return {
    co2SavedPerMeter,
    waterSavedPerMeter,
    chemicalEliminatedPerMeter,
    binderEliminatedPerMeter,
    energySavedPerMeter,
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
    detail: "FUZE's silver nanoparticles are synthesized from metals recovered from electronic waste streams — diverting e-waste from landfills and reducing virgin mining demand by 85%.",
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
