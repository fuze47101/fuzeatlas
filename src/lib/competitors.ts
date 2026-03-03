// Competitor antimicrobial product registry
// Data sourced from EPA filings, published research, and manufacturer documentation

export type ChemistryType = "silver_ion" | "silver_chloride" | "silver_allotrope" | "qac_silane" | "zinc_nano" | "silver_nano_zinc";

export type Competitor = {
  id: string;
  company: string;
  product: string;
  chemistryType: ChemistryType;
  chemistryLabel: string;
  activeAgent: string;

  // Dosage (ppm = mg/kg)
  dosageLow: number;
  dosageHigh: number;
  dosageTypical: number;

  // Wash durability
  maxWashClaim: number;
  washClaimNote: string;

  // Binder required
  binderRequired: boolean;
  binderGPerKg: number; // typical binder usage g/kg fabric
  curingRequired: boolean;

  // Leaching data (% of active agent lost)
  leachRateFirst10Washes: number; // percentage lost in first 10 washes
  leachRatePerWash: number;       // estimated % per wash cycle

  // Environmental
  heavyMetalReleased: string;
  aquaticToxicityNote: string;
  endOfLifeNote: string;

  // Cost data for comparison
  // Estimated treatment cost per linear meter (USD, for a ~150gsm / 60in fabric)
  estimatedCostPerMeterLow: number;   // low-dose application
  estimatedCostPerMeterHigh: number;  // high-dose application
  estimatedCostPerMeterTypical: number; // typical application
  retreatmentPossible: boolean;       // can the fabric be re-treated?
  retreatmentCostMultiplier: number;  // cost multiplier for re-treatment (usually > 1.0 due to stripping etc.)
};

export const COMPETITORS: Competitor[] = [
  {
    id: "silvadur-930",
    company: "LANXESS (formerly Dow)",
    product: "Silvadur 930 Flex",
    chemistryType: "silver_ion",
    chemistryLabel: "Silver Ion / Polymer Matrix",
    activeAgent: "Silver ions in organic polymer",
    dosageLow: 30,
    dosageHigh: 700,
    dosageTypical: 100,
    maxWashClaim: 50,
    washClaimNote: "40-50 washes at 30 ppm odor dose",
    binderRequired: true,
    binderGPerKg: 15,
    curingRequired: true,
    leachRateFirst10Washes: 35,
    leachRatePerWash: 3.5,
    heavyMetalReleased: "Silver",
    aquaticToxicityNote: "Silver continues leaching in landfill conditions post-disposal",
    endOfLifeNote: "99%+ ingredients undisclosed on EPA label",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.07,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.3,
  },
  {
    id: "polygiene-stayfresh",
    company: "Polygiene (Sweden)",
    product: "Polygiene StayFresh",
    chemistryType: "silver_chloride",
    chemistryLabel: "Silver Chloride (AgCl)",
    activeAgent: "Silver chloride salt",
    dosageLow: 50,
    dosageHigh: 200,
    dosageTypical: 100,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes typical",
    binderRequired: true,
    binderGPerKg: 15,
    curingRequired: true,
    leachRateFirst10Washes: 71,
    leachRatePerWash: 7.1,
    heavyMetalReleased: "Silver",
    aquaticToxicityNote: "31-90% silver lost in first 10 washes (median 71%). Swedish Water Association disputes safety claims.",
    endOfLifeNote: "Silver accumulates in lake/sea sediments, threatening bottom-dwelling organisms",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.10,
    estimatedCostPerMeterTypical: 0.06,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.4,
  },
  {
    id: "polygiene-viraloff",
    company: "Polygiene (Sweden)",
    product: "Polygiene ViralOff",
    chemistryType: "silver_chloride",
    chemistryLabel: "Silver Chloride + Vesicles",
    activeAgent: "Silver chloride with liposome vesicles",
    dosageLow: 50,
    dosageHigh: 200,
    dosageTypical: 100,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes",
    binderRequired: true,
    binderGPerKg: 15,
    curingRequired: true,
    leachRateFirst10Washes: 71,
    leachRatePerWash: 7.1,
    heavyMetalReleased: "Silver",
    aquaticToxicityNote: "Same silver chloride base as StayFresh with added vesicle compounds",
    endOfLifeNote: "Silver + organic vesicle compounds enter waterways",
    estimatedCostPerMeterLow: 0.05,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.07,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.4,
  },
  {
    id: "aegis-microbe-shield",
    company: "Microban (Aegis)",
    product: "Aegis Microbe Shield",
    chemistryType: "qac_silane",
    chemistryLabel: "Organosilane QAC (SiQAC)",
    activeAgent: "Quaternary ammonium silane compound",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 25,
    washClaimNote: "25 washes standard",
    binderRequired: true,
    binderGPerKg: 20,
    curingRequired: true,
    leachRateFirst10Washes: 68,
    leachRatePerWash: 6.8,
    heavyMetalReleased: "None (QAC organic compound)",
    aquaticToxicityNote: "QAC toxic to Daphnia magna at 5.8 μg/L. Classified as 'chemical class of emerging concern' (ES&T 2023).",
    endOfLifeNote: "Disrupts biological wastewater treatment. 51% of regions face high risk with direct sewage discharge.",
    estimatedCostPerMeterLow: 0.03,
    estimatedCostPerMeterHigh: 0.10,
    estimatedCostPerMeterTypical: 0.05,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.5,
  },
  {
    id: "aegis-vesta",
    company: "Microban (Aegis)",
    product: "Aegis Vesta",
    chemistryType: "qac_silane",
    chemistryLabel: "Enhanced Organosilane QAC",
    activeAgent: "Enhanced quaternary ammonium silane",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 50,
    washClaimNote: "Up to 50 washes claimed",
    binderRequired: true,
    binderGPerKg: 20,
    curingRequired: true,
    leachRateFirst10Washes: 55,
    leachRatePerWash: 5.5,
    heavyMetalReleased: "None (QAC organic compound)",
    aquaticToxicityNote: "Same QAC toxicity profile as standard Aegis. Suspected reproductive toxicity in mammals.",
    endOfLifeNote: "Decomposes to CO2, nitrous oxide, silicon dioxide over ~5 years in landfill",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.07,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.5,
  },
  {
    id: "sanitized-silver",
    company: "Sanitized AG (Switzerland)",
    product: "Sanitized Silver",
    chemistryType: "silver_ion",
    chemistryLabel: "Silver Ions in Carrier",
    activeAgent: "Silver ions in proprietary carrier system",
    dosageLow: 50,
    dosageHigh: 300,
    dosageTypical: 150,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes typical",
    binderRequired: true,
    binderGPerKg: 15,
    curingRequired: true,
    leachRateFirst10Washes: 50,
    leachRatePerWash: 5.0,
    heavyMetalReleased: "Silver",
    aquaticToxicityNote: "Silver ion leaching profile similar to other carrier-based systems",
    endOfLifeNote: "Silver persists in wastewater sludge used as agricultural fertilizer",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.06,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.3,
  },
  {
    id: "sanitized-puretec",
    company: "Sanitized AG (Switzerland)",
    product: "Sanitized Puretec (SilanQuat)",
    chemistryType: "qac_silane",
    chemistryLabel: "Silane QAC + Polymer",
    activeAgent: "Silane quaternary ammonium with polymer science",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes",
    binderRequired: true,
    binderGPerKg: 20,
    curingRequired: true,
    leachRateFirst10Washes: 65,
    leachRatePerWash: 6.5,
    heavyMetalReleased: "None (QAC organic compound)",
    aquaticToxicityNote: "QAC emerging contaminant. Leaching rates 55-81% into laundry wastewater.",
    endOfLifeNote: "Dual environmental exposure from QAC + polymer chemistry",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.06,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.5,
  },
  {
    id: "heiq-hyprotecht",
    company: "HeiQ (Switzerland)",
    product: "HeiQ HyProTecht",
    chemistryType: "zinc_nano",
    chemistryLabel: "Zinc Nanoparticles (Crescoating)",
    activeAgent: "Zinc nanoparticles grown in-situ via Crescoating",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes",
    binderRequired: true,
    binderGPerKg: 15,
    curingRequired: true,
    leachRateFirst10Washes: 45,
    leachRatePerWash: 4.5,
    heavyMetalReleased: "Zinc",
    aquaticToxicityNote: "ZnO nanoparticles show potential for bioaccumulation in aquatic food chains",
    endOfLifeNote: "Zinc nanoparticles can disrupt biological wastewater treatment",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.06,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.4,
  },
  {
    id: "heiq-viroblock",
    company: "HeiQ (Switzerland)",
    product: "HeiQ Viroblock",
    chemistryType: "silver_nano_zinc",
    chemistryLabel: "Silver + Zinc + Liposomes",
    activeAgent: "Recycled silver nanoparticles + zinc + fatty liposome vesicles",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes",
    binderRequired: true,
    binderGPerKg: 15,
    curingRequired: true,
    leachRateFirst10Washes: 80,
    leachRatePerWash: 8.0,
    heavyMetalReleased: "Silver + Zinc (dual metal)",
    aquaticToxicityNote: "Up to 80% silver released in first wash. Dual metal system doubles heavy metal load per garment.",
    endOfLifeNote: "Both silver and zinc persist in environment; silver in sludge, zinc bioaccumulates",
    estimatedCostPerMeterLow: 0.05,
    estimatedCostPerMeterHigh: 0.14,
    estimatedCostPerMeterTypical: 0.08,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.4,
  },
];

// FUZE reference data
export const FUZE = {
  dosageMgPerKg: 1.0,
  stockPpm: 30,        // mg/L
  bottleSize: 19,      // liters
  defaultPricePerLiter: 36, // USD
  maxWashClaim: "Lifetime (100+)",
  epaLifetimeApproval: true,
  binderRequired: false,
  curingRequired: false,
  leachRate: 0,
  heavyMetalReleased: "None",
};

// ─── Apples-to-apples cost comparison ──────────
// Calculates what a competitor would actually cost to reach a given wash target
// If they can only do 25 washes and you need 100, they need 4 treatments (at increasing cost)
export type CostComparison = {
  fuzeTierLabel: string;
  fuzeDose: number;
  targetWashes: number;
  fuzeCostPerMeter: number;          // single application, lifetime
  fuzeApplications: number;          // always 1
  competitorCostPerApplication: number;
  competitorApplicationsNeeded: number;
  competitorTotalCostPerMeter: number;
  competitorCostMultiple: string;    // "3.2×" etc.
  fuzeSavingsPerMeter: number;
  fuzeSavingsPct: number;
  // Environmental multipliers (re-treatment = more chemistry, more binder, more leaching)
  competitorTotalChemistryMg: number;
  competitorTotalBinderG: number;
  competitorTotalLeachMg: number;
  fuzeChemistryMg: number;
  fuzeBinderG: number;
  fuzeLeachMg: number;
};

export function calcCostComparison(
  competitor: Competitor,
  fuzeCostPerMeter: number,
  fuzeDose: number,
  targetWashes: number,
  fabricWeightKg: number,
): CostComparison {
  // How many applications does the competitor need to cover targetWashes?
  const competitorApplicationsNeeded = competitor.maxWashClaim > 0
    ? Math.ceil(targetWashes / competitor.maxWashClaim)
    : 1;

  // Competitor cost: first application at typical cost, re-treatments at multiplier
  const firstAppCost = competitor.estimatedCostPerMeterTypical;
  const retreatCost = firstAppCost * competitor.retreatmentCostMultiplier;
  const competitorTotalCostPerMeter = competitorApplicationsNeeded <= 1
    ? firstAppCost
    : firstAppCost + (competitorApplicationsNeeded - 1) * retreatCost;

  const competitorCostMultiple = fuzeCostPerMeter > 0
    ? (competitorTotalCostPerMeter / fuzeCostPerMeter).toFixed(1) + "×"
    : "∞×";

  const fuzeSavingsPerMeter = competitorTotalCostPerMeter - fuzeCostPerMeter;
  const fuzeSavingsPct = competitorTotalCostPerMeter > 0
    ? ((fuzeSavingsPerMeter / competitorTotalCostPerMeter) * 100)
    : 0;

  // Environmental impact multiplied by re-treatments
  const compChemPerApp = competitor.dosageTypical * fabricWeightKg;
  const competitorTotalChemistryMg = compChemPerApp * competitorApplicationsNeeded;
  const competitorTotalBinderG = competitor.binderRequired
    ? competitor.binderGPerKg * fabricWeightKg * competitorApplicationsNeeded
    : 0;

  // Leaching: each application cycle leaches over its wash range
  const washesPerCycle = competitor.maxWashClaim;
  let competitorTotalLeachMg = 0;
  for (let i = 0; i < competitorApplicationsNeeded; i++) {
    const washesThisCycle = Math.min(washesPerCycle, targetWashes - i * washesPerCycle);
    const leachFraction = Math.min(1, (competitor.leachRatePerWash / 100) * washesThisCycle);
    competitorTotalLeachMg += compChemPerApp * leachFraction;
  }

  const fuzeChemistryMg = fuzeDose * fabricWeightKg;

  // Tier label
  const tiers: Record<number, string> = { 1.0: "F1", 0.75: "F2", 0.5: "F3", 0.25: "F4" };
  const fuzeTierLabel = tiers[fuzeDose] || "Custom";

  return {
    fuzeTierLabel,
    fuzeDose,
    targetWashes,
    fuzeCostPerMeter: fuzeCostPerMeter,
    fuzeApplications: 1,
    competitorCostPerApplication: firstAppCost,
    competitorApplicationsNeeded,
    competitorTotalCostPerMeter,
    competitorCostMultiple,
    fuzeSavingsPerMeter,
    fuzeSavingsPct,
    competitorTotalChemistryMg,
    competitorTotalBinderG,
    competitorTotalLeachMg,
    fuzeChemistryMg,
    fuzeBinderG: 0,
    fuzeLeachMg: 0,
  };
}

// Environmental score calculation
export type EnvScore = {
  chemistrySavedMg: number;
  binderSavedG: number;
  metalToWaterMg: number;    // metal/toxin kept from water over wash lifetime
  unprotectedWashes: number; // washes where competitor fails but customer needs protection
  carbonReductionKg: number; // estimated CO2 saved
  compositeGrade: string;    // A-F
  compositeScore: number;    // 0-100
};

export function calcEnvironmentalScore(
  competitor: Competitor,
  fabricWeightKg: number,
  targetWashes: number,
): EnvScore {
  // Chemistry saved: competitor dosage vs FUZE dosage per kg of fabric
  const competitorChemMg = competitor.dosageTypical * fabricWeightKg;
  const fuzeChemMg = FUZE.dosageMgPerKg * fabricWeightKg;
  const chemistrySavedMg = competitorChemMg - fuzeChemMg;

  // Binder saved (competitor needs binder, FUZE doesn't)
  const binderSavedG = competitor.binderRequired
    ? competitor.binderGPerKg * fabricWeightKg
    : 0;

  // Metal/toxin kept from water
  // Over the wash lifetime, competitor leaches its active agent
  const totalCompetitorAgentMg = competitor.dosageTypical * fabricWeightKg;
  const leachFraction = Math.min(1, (competitor.leachRatePerWash / 100) * targetWashes);
  const metalToWaterMg = totalCompetitorAgentMg * leachFraction;

  // Unprotected washes
  const unprotectedWashes = Math.max(0, targetWashes - competitor.maxWashClaim);

  // Carbon reduction estimate
  // Binder production: ~2 kg CO2 per kg of binder (petrochemical polymer)
  // Curing energy: ~0.5 kg CO2 per kg fabric (heat treatment)
  // Chemistry production: ~5 kg CO2 per kg of silver/metal produced
  const binderCarbonKg = (binderSavedG / 1000) * 2.0;
  const curingCarbonKg = competitor.curingRequired ? fabricWeightKg * 0.5 : 0;
  const chemProductionCarbonKg = (chemistrySavedMg / 1000000) * 5.0;
  const carbonReductionKg = binderCarbonKg + curingCarbonKg + chemProductionCarbonKg;

  // Composite score (0-100)
  let score = 0;

  // Chemistry reduction (25 pts) - how much less chemistry used
  const chemReductionPct = competitorChemMg > 0 ? (chemistrySavedMg / competitorChemMg) * 100 : 0;
  score += Math.min(25, (chemReductionPct / 100) * 25);

  // Leach elimination (30 pts) - biggest environmental factor
  score += Math.min(30, (metalToWaterMg > 0 ? 30 : 0));

  // Wash durability advantage (25 pts)
  const washAdvantage = unprotectedWashes / Math.max(1, targetWashes);
  score += Math.min(25, washAdvantage * 25 + (targetWashes > competitor.maxWashClaim ? 10 : 0));

  // Binder + curing elimination (20 pts)
  score += competitor.binderRequired ? 10 : 0;
  score += competitor.curingRequired ? 10 : 0;

  score = Math.min(100, Math.round(score));

  const compositeGrade =
    score >= 90 ? "A+" :
    score >= 80 ? "A" :
    score >= 70 ? "B+" :
    score >= 60 ? "B" :
    score >= 50 ? "C" :
    score >= 40 ? "D" : "F";

  return {
    chemistrySavedMg,
    binderSavedG,
    metalToWaterMg,
    unprotectedWashes,
    carbonReductionKg,
    compositeGrade,
    compositeScore: score,
  };
}
