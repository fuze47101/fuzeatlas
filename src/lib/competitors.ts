// Competitor antimicrobial product registry
// Data sourced from EPA filings, published research, and manufacturer documentation

export type ChemistryType =
  | "silver_ion" | "silver_chloride" | "silver_allotrope" | "silver_zeolite"
  | "silver_copper_zeolite" | "silver_nano" | "silver_nano_zinc"
  | "qac_silane" | "zinc_pyrithione" | "zinc_nano"
  | "copper" | "chitosan" | "triclosan";

export type Competitor = {
  id: string;
  company: string;
  product: string;
  chemistryType: ChemistryType;
  chemistryLabel: string;
  activeAgent: string;

  // EPA Registration
  epaRegNumber: string;       // e.g. "464-785" or "N/A" if not EPA-registered
  epaRegYear: number | null;  // year first registered (null if unknown)
  epaRegNote: string;         // notes about registration vintage, standards at the time
  epaLabelUrl: string;        // direct link to EPA label PDF or product page

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
  binderType: string;   // acrylic, polyurethane, silicone, etc.
  binderPricePerKg: number; // estimated binder cost USD/kg of binder chemical
  binderLeachPctLifetime: number; // % of binder that washes off over garment lifetime
  binderVOC: boolean;       // does curing release volatile organic compounds?
  binderFormaldehyde: boolean; // does binder contain formaldehyde crosslinker?
  curingRequired: boolean;
  curingTempC: number;  // curing temperature °C (0 if none)

  // Leaching data (% of active agent lost)
  leachRateFirst10Washes: number; // percentage lost in first 10 washes
  leachRatePerWash: number;       // estimated % per wash cycle

  // Environmental
  heavyMetalReleased: string;
  aquaticToxicityNote: string;
  endOfLifeNote: string;

  // Cost data for comparison
  // Distributor pricing (best estimates — override from admin when espionage data available)
  chemicalPricePerKg: number;        // USD/kg of antimicrobial solution as purchased from distributor
  chemicalPriceSource: string;       // where the estimate came from
  estimatedCostPerMeterLow: number;  // low-dose all-in application cost per linear meter
  estimatedCostPerMeterHigh: number; // high-dose all-in application cost per linear meter
  estimatedCostPerMeterTypical: number; // typical all-in application cost per linear meter
  retreatmentPossible: boolean;
  retreatmentCostMultiplier: number;
};

export const COMPETITORS: Competitor[] = [
  // ══════════════════════════════════════════════════
  // SILVER ION PRODUCTS
  // ══════════════════════════════════════════════════
  {
    id: "silvadur-930",
    company: "LANXESS (formerly Dow)",
    product: "Silvadur 930 Flex",
    chemistryType: "silver_ion",
    chemistryLabel: "Silver Ion / Polymer Matrix",
    activeAgent: "Silver ions in organic polymer",
    epaRegNumber: "464-785",
    epaRegYear: 2013,
    epaRegNote: "Registered May 2013. Became inactive in California Dec 2020. 99%+ ingredients undisclosed on EPA label.",
    epaLabelUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/000464-00785-20170206.pdf",
    dosageLow: 30,
    dosageHigh: 700,
    dosageTypical: 100,
    maxWashClaim: 50,
    washClaimNote: "40-50 washes at 30 ppm odor dose",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic co-polymer with crosslinker",
    binderPricePerKg: 3.50,
    binderLeachPctLifetime: 12,
    binderVOC: true,
    binderFormaldehyde: true,
    curingRequired: true,
    curingTempC: 160,
    leachRateFirst10Washes: 35,
    leachRatePerWash: 3.5,
    heavyMetalReleased: "Silver",
    aquaticToxicityNote: "Silver continues leaching in landfill conditions post-disposal",
    endOfLifeNote: "99%+ ingredients undisclosed on EPA label",
    chemicalPricePerKg: 65,
    chemicalPriceSource: "Estimate: LANXESS premium silver ion, branded distribution (China ≈$55-75/kg)",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.07,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.3,
  },

  // ══════════════════════════════════════════════════
  // SILVER CHLORIDE PRODUCTS
  // ══════════════════════════════════════════════════
  {
    id: "polygiene-stayfresh",
    company: "Polygiene (Sweden)",
    product: "Polygiene StayFresh",
    chemistryType: "silver_chloride",
    chemistryLabel: "Silver Chloride (AgCl)",
    activeAgent: "Silver chloride salt",
    epaRegNumber: "EPA approved (specific # undisclosed)",
    epaRegYear: null,
    epaRegNote: "EPA approved, BPR, REACH, bluesign certified. Polygiene does not publicly disclose specific EPA registration number.",
    epaLabelUrl: "https://polygiene.com/stayfresh/",
    dosageLow: 50,
    dosageHigh: 200,
    dosageTypical: 100,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes typical",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic emulsion binder",
    binderPricePerKg: 3.00,
    binderLeachPctLifetime: 15,
    binderVOC: true,
    binderFormaldehyde: true,
    curingRequired: true,
    curingTempC: 150,
    leachRateFirst10Washes: 71,
    leachRatePerWash: 7.1,
    heavyMetalReleased: "Silver",
    aquaticToxicityNote: "31-90% silver lost in first 10 washes (median 71%). Swedish Water Association disputes safety claims.",
    endOfLifeNote: "Silver accumulates in lake/sea sediments, threatening bottom-dwelling organisms",
    chemicalPricePerKg: 50,
    chemicalPriceSource: "Estimate: AgCl salt-based, mid-tier Swedish brand (China ≈$40-60/kg)",
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
    chemistryType: "zinc_pyrithione",
    chemistryLabel: "Zinc Pyrithione",
    activeAgent: "Zinc pyrithione antiviral compound",
    epaRegNumber: "Uses EPA PC Code 92344 (ZPT)",
    epaRegYear: null,
    epaRegNote: "Active ingredient zinc pyrithione is EPA-registered. ViralOff antiviral claims tested under ISO 18184.",
    epaLabelUrl: "https://polygiene.com/viraloff/",
    dosageLow: 50,
    dosageHigh: 200,
    dosageTypical: 100,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic emulsion + liposome carrier",
    binderPricePerKg: 4.00,
    binderLeachPctLifetime: 18,
    binderVOC: true,
    binderFormaldehyde: true,
    curingRequired: true,
    curingTempC: 150,
    leachRateFirst10Washes: 71,
    leachRatePerWash: 7.1,
    heavyMetalReleased: "Zinc",
    aquaticToxicityNote: "Zinc pyrithione highly toxic to aquatic organisms. EU classified as H400/H410.",
    endOfLifeNote: "ZPT degrades to zinc compounds; zinc bioaccumulates in aquatic sediments",
    chemicalPricePerKg: 60,
    chemicalPriceSource: "Estimate: ZPT + liposome vesicles, premium antiviral variant (China ≈$50-70/kg)",
    estimatedCostPerMeterLow: 0.05,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.07,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.4,
  },

  // ══════════════════════════════════════════════════
  // ORGANOSILANE / SILANE QUAT PRODUCTS
  // ══════════════════════════════════════════════════
  {
    id: "aegis-microbe-shield",
    company: "Microban (formerly Aegis)",
    product: "Aegis Microbe Shield",
    chemistryType: "qac_silane",
    chemistryLabel: "Organosilane QAC (SiQAC)",
    activeAgent: "3-(Trimethoxysilyl)propyldimethyloctadecyl ammonium chloride (42%)",
    epaRegNumber: "64881-1",
    epaRegYear: 1976,
    epaRegNote: "Original EPA registration 1976 — predates modern efficacy/toxicity requirements by decades. One of the oldest antimicrobial registrations still in use.",
    epaLabelUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/064881-00001-20110817.pdf",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 25,
    washClaimNote: "25 washes standard",
    binderRequired: true,
    binderGPerKg: 20,
    binderType: "Polyurethane crosslinked binder",
    binderPricePerKg: 5.00,
    binderLeachPctLifetime: 10,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 170,
    leachRateFirst10Washes: 68,
    leachRatePerWash: 6.8,
    heavyMetalReleased: "None (QAC organic compound)",
    aquaticToxicityNote: "QAC toxic to Daphnia magna at 5.8 μg/L. Classified as 'chemical class of emerging concern' (ES&T 2023).",
    endOfLifeNote: "Disrupts biological wastewater treatment. 51% of regions face high risk with direct sewage discharge.",
    chemicalPricePerKg: 28,
    chemicalPriceSource: "Estimate: Organosilane QAC commodity, Microban OEM distribution (China ≈$22-35/kg)",
    estimatedCostPerMeterLow: 0.03,
    estimatedCostPerMeterHigh: 0.10,
    estimatedCostPerMeterTypical: 0.05,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.5,
  },
  {
    id: "microban-additive-gs",
    company: "Microban International",
    product: "Microban Additive GS",
    chemistryType: "qac_silane",
    chemistryLabel: "Organosilane QAC (textile grade)",
    activeAgent: "3-(Trihydroxysilyl)propyldimethyloctadecyl ammonium chloride",
    epaRegNumber: "42182-14",
    epaRegYear: null,
    epaRegNote: "Successor to Thomson Research Associates products. Designed for natural and synthetic textile pad/exhaust application.",
    epaLabelUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/042182-00014-20230317.pdf",
    dosageLow: 100,
    dosageHigh: 400,
    dosageTypical: 200,
    maxWashClaim: 25,
    washClaimNote: "25 washes standard",
    binderRequired: true,
    binderGPerKg: 18,
    binderType: "Polyurethane crosslinked binder",
    binderPricePerKg: 4.50,
    binderLeachPctLifetime: 10,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 165,
    leachRateFirst10Washes: 60,
    leachRatePerWash: 6.0,
    heavyMetalReleased: "None (QAC organic compound)",
    aquaticToxicityNote: "Same QAC class as Aegis. Emerging contaminant of concern in wastewater.",
    endOfLifeNote: "QAC compounds disrupt biological wastewater treatment processes.",
    chemicalPricePerKg: 25,
    chemicalPriceSource: "Estimate: OEM silane quat for textile mills, Microban bulk (China ≈$20-30/kg)",
    estimatedCostPerMeterLow: 0.03,
    estimatedCostPerMeterHigh: 0.09,
    estimatedCostPerMeterTypical: 0.05,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.5,
  },
  {
    id: "microban-cs5a",
    company: "Microban International",
    product: "Microban CS5-A",
    chemistryType: "qac_silane",
    chemistryLabel: "Low-dose Organosilane QAC (3.6%)",
    activeAgent: "3-(Trihydroxysilyl)propyldimethyloctadecyl ammonium chloride (3.6%)",
    epaRegNumber: "42182-28",
    epaRegYear: null,
    epaRegNote: "Low-concentration variant for consumer-facing products. Ready-to-use formulation.",
    epaLabelUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/042182-00028-20230331.pdf",
    dosageLow: 50,
    dosageHigh: 200,
    dosageTypical: 100,
    maxWashClaim: 15,
    washClaimNote: "10-15 washes (lower dose = less durability)",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic emulsion binder",
    binderPricePerKg: 3.50,
    binderLeachPctLifetime: 12,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 155,
    leachRateFirst10Washes: 65,
    leachRatePerWash: 6.5,
    heavyMetalReleased: "None (QAC organic compound)",
    aquaticToxicityNote: "Lower concentration but same QAC toxicity class.",
    endOfLifeNote: "QAC environmental profile unchanged by lower application rate.",
    chemicalPricePerKg: 22,
    chemicalPriceSource: "Estimate: Dilute RTU silane quat (China ≈$18-26/kg)",
    estimatedCostPerMeterLow: 0.02,
    estimatedCostPerMeterHigh: 0.07,
    estimatedCostPerMeterTypical: 0.04,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.5,
  },
  {
    id: "biosafe-organosilane",
    company: "Gelest / BIOSAFE",
    product: "BIOSAFE Organosilane Antimicrobial",
    chemistryType: "qac_silane",
    chemistryLabel: "Patented Siloxane Polymer",
    activeAgent: "Patented siloxane polymer with QAC functionality",
    epaRegNumber: "83019-1 / 83019-2 / 83019-3",
    epaRegYear: 1976,
    epaRegNote: "Registered mid-1970s — one of the earliest EPA-registered organosilane products. 35+ years of use under pre-modern standards with no modern efficacy re-evaluation required.",
    epaLabelUrl: "https://technical.gelest.com/brochures/biosafe/biosafe-organosilane-antimicrobials/",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 20,
    washClaimNote: "15-20 washes typical",
    binderRequired: true,
    binderGPerKg: 18,
    binderType: "Silicone-based crosslinked binder",
    binderPricePerKg: 5.00,
    binderLeachPctLifetime: 12,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 170,
    leachRateFirst10Washes: 60,
    leachRatePerWash: 6.0,
    heavyMetalReleased: "None (organic siloxane)",
    aquaticToxicityNote: "QAC functionality poses aquatic toxicity risk similar to other silane quats.",
    endOfLifeNote: "Siloxane polymers persist in environment; breakdown products poorly studied.",
    chemicalPricePerKg: 30,
    chemicalPriceSource: "Estimate: Gelest specialty organosilane (China ≈$24-36/kg)",
    estimatedCostPerMeterLow: 0.03,
    estimatedCostPerMeterHigh: 0.10,
    estimatedCostPerMeterTypical: 0.06,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.5,
  },
  {
    id: "sanitized-puretec",
    company: "Sanitized AG (Switzerland)",
    product: "Sanitized Puretec (SilanQuat)",
    chemistryType: "qac_silane",
    chemistryLabel: "Silane QAC + Polymer",
    activeAgent: "Silane quaternary ammonium with polymer science",
    epaRegNumber: "EPA approved (via Sanitized AG)",
    epaRegYear: null,
    epaRegNote: "EPA approved, OEKO-TEX Classes I-IV. Swiss brand distributed via Rudolf Group.",
    epaLabelUrl: "https://www.sanitized.com/en/technologies/sanitized-puretec/",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes",
    binderRequired: true,
    binderGPerKg: 20,
    binderType: "Silicone-modified acrylic binder",
    binderPricePerKg: 4.50,
    binderLeachPctLifetime: 14,
    binderVOC: true,
    binderFormaldehyde: true,
    curingRequired: true,
    curingTempC: 160,
    leachRateFirst10Washes: 65,
    leachRatePerWash: 6.5,
    heavyMetalReleased: "None (QAC organic compound)",
    aquaticToxicityNote: "QAC emerging contaminant. Leaching rates 55-81% into laundry wastewater.",
    endOfLifeNote: "Dual environmental exposure from QAC + polymer chemistry",
    chemicalPricePerKg: 30,
    chemicalPriceSource: "Estimate: SilanQuat + polymer system, Swiss brand via Rudolf (China ≈$25-38/kg)",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.06,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.5,
  },
  {
    id: "ultrafresh-dw56",
    company: "Thomson Research / Ultra-Fresh",
    product: "Ultra-Fresh DW-56",
    chemistryType: "qac_silane",
    chemistryLabel: "Broad-spectrum Organosilane",
    activeAgent: "Organosilane antimicrobial (broad spectrum)",
    epaRegNumber: "10466-46",
    epaRegYear: null,
    epaRegNote: "EPA registered, BPR compliant, Oeko-Tex listed. Used in wearing apparel, workwear, sportswear, household textiles.",
    epaLabelUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/010466-00046-20150121.pdf",
    dosageLow: 100,
    dosageHigh: 400,
    dosageTypical: 200,
    maxWashClaim: 25,
    washClaimNote: "20-25 washes",
    binderRequired: true,
    binderGPerKg: 18,
    binderType: "Acrylic co-polymer binder",
    binderPricePerKg: 3.50,
    binderLeachPctLifetime: 12,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 160,
    leachRateFirst10Washes: 55,
    leachRatePerWash: 5.5,
    heavyMetalReleased: "None (organic compound)",
    aquaticToxicityNote: "Organosilane QAC class — same aquatic toxicity concerns as all silane quats.",
    endOfLifeNote: "Organosilane persists in environment; limited biodegradability.",
    chemicalPricePerKg: 26,
    chemicalPriceSource: "Estimate: Thomson/Ultra-Fresh OEM organosilane (China ≈$20-32/kg)",
    estimatedCostPerMeterLow: 0.03,
    estimatedCostPerMeterHigh: 0.09,
    estimatedCostPerMeterTypical: 0.05,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.5,
  },

  // ══════════════════════════════════════════════════
  // SILVER ZEOLITE PRODUCTS
  // ══════════════════════════════════════════════════
  {
    id: "agion-silver-zeolite",
    company: "Sciessent LLC",
    product: "Agion Silver Antimicrobial (Type AG/AL/AD)",
    chemistryType: "silver_zeolite",
    chemistryLabel: "Silver Zeolite Ceramic",
    activeAgent: "Silver ions exchanged into zeolite ceramic carrier",
    epaRegNumber: "88165-1 / 88165-2 / 88165-5",
    epaRegYear: null,
    epaRegNote: "Multiple EPA registrations. Type AG (88165-5), Type AL (88165-2), Type AD (88165-1). Zeolite-based slow-release silver.",
    epaLabelUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/088165-00005-20231116.pdf",
    dosageLow: 50,
    dosageHigh: 300,
    dosageTypical: 150,
    maxWashClaim: 30,
    washClaimNote: "25-30 washes",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic co-polymer binder",
    binderPricePerKg: 3.50,
    binderLeachPctLifetime: 12,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 155,
    leachRateFirst10Washes: 40,
    leachRatePerWash: 4.0,
    heavyMetalReleased: "Silver",
    aquaticToxicityNote: "Silver ion slow release from zeolite matrix. Lower burst release than soluble silver but cumulative.",
    endOfLifeNote: "Zeolite carrier not biodegradable; silver persists in wastewater sludge.",
    chemicalPricePerKg: 45,
    chemicalPriceSource: "Estimate: Sciessent silver zeolite, specialty ingredient (China ≈$35-55/kg)",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.11,
    estimatedCostPerMeterTypical: 0.06,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.3,
  },
  {
    id: "zeomic-silver",
    company: "Sinanen Zeomic (Japan)",
    product: "Zeomic Silver Zeolite (AJ/AW series)",
    chemistryType: "silver_zeolite",
    chemistryLabel: "Silver Zeolite (Japanese)",
    activeAgent: "Silver ions in synthetic zeolite matrix",
    epaRegNumber: "71227-1 / 71227-5",
    epaRegYear: 2004,
    epaRegNote: "Zeomic Type AC (silver+copper) registered April 2004. Type AW registered 2009. Type AJ registered 2010. Japanese origin.",
    epaLabelUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/071227-00001-20100615.pdf",
    dosageLow: 50,
    dosageHigh: 250,
    dosageTypical: 120,
    maxWashClaim: 30,
    washClaimNote: "25-30 washes",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic co-polymer binder",
    binderPricePerKg: 3.50,
    binderLeachPctLifetime: 10,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 150,
    leachRateFirst10Washes: 35,
    leachRatePerWash: 3.5,
    heavyMetalReleased: "Silver (+ Copper in AC variant)",
    aquaticToxicityNote: "Zeolite slow-release mechanism reduces burst but does not eliminate cumulative silver discharge.",
    endOfLifeNote: "Inorganic zeolite carrier persists indefinitely; silver in wastewater sludge.",
    chemicalPricePerKg: 50,
    chemicalPriceSource: "Estimate: Japanese specialty silver zeolite, Sinanen distribution (China ≈$40-60/kg)",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.10,
    estimatedCostPerMeterTypical: 0.06,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.3,
  },
  {
    id: "sanitized-silver",
    company: "Sanitized AG (Switzerland)",
    product: "Sanitized Silver",
    chemistryType: "silver_ion",
    chemistryLabel: "Silver Ions in Carrier",
    activeAgent: "Silver ions in proprietary carrier system",
    epaRegNumber: "EPA approved (via Sanitized AG)",
    epaRegYear: null,
    epaRegNote: "EPA approved and BPR compliant. Swiss brand with distribution through Rudolf Group globally.",
    epaLabelUrl: "https://www.sanitized.com/en/technologies/sanitized-silver/",
    dosageLow: 50,
    dosageHigh: 300,
    dosageTypical: 150,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes typical",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic co-polymer binder",
    binderPricePerKg: 3.50,
    binderLeachPctLifetime: 12,
    binderVOC: true,
    binderFormaldehyde: true,
    curingRequired: true,
    curingTempC: 155,
    leachRateFirst10Washes: 50,
    leachRatePerWash: 5.0,
    heavyMetalReleased: "Silver",
    aquaticToxicityNote: "Silver ion leaching profile similar to other carrier-based systems",
    endOfLifeNote: "Silver persists in wastewater sludge used as agricultural fertilizer",
    chemicalPricePerKg: 55,
    chemicalPriceSource: "Estimate: Swiss silver ion carrier system, Rudolf/Sanitized distribution (China ≈$45-65/kg)",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.06,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.3,
  },
  {
    id: "vesta-silver-copper",
    company: "Vestagen Technology",
    product: "Vesta (Silver/Copper Zeolite)",
    chemistryType: "silver_copper_zeolite",
    chemistryLabel: "Silver + Copper Zeolite Blend",
    activeAgent: "Silver and copper ions in zeolite carrier",
    epaRegNumber: "Uses EPA PC Code 129057",
    epaRegYear: null,
    epaRegNote: "Silver copper zeolite combination. May operate under treated article exemption for some claims.",
    epaLabelUrl: "",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 50,
    washClaimNote: "Up to 50 washes claimed",
    binderRequired: true,
    binderGPerKg: 20,
    binderType: "Polyurethane crosslinked binder",
    binderPricePerKg: 5.00,
    binderLeachPctLifetime: 10,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 170,
    leachRateFirst10Washes: 55,
    leachRatePerWash: 5.5,
    heavyMetalReleased: "Silver + Copper (dual metal)",
    aquaticToxicityNote: "Dual metal release — copper is particularly toxic to aquatic invertebrates.",
    endOfLifeNote: "Both silver and copper persist; copper especially toxic to aquatic ecosystems.",
    chemicalPricePerKg: 35,
    chemicalPriceSource: "Estimate: Vestagen silver/copper zeolite blend (China ≈$28-42/kg)",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.07,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.5,
  },

  // ══════════════════════════════════════════════════
  // NANOSILVER PRODUCTS
  // ══════════════════════════════════════════════════
  {
    id: "heiq-ags20",
    company: "HeiQ (Switzerland)",
    product: "HeiQ AGS-20 (Nanosilver)",
    chemistryType: "silver_nano",
    chemistryLabel: "Nanosilver on SiO₂ Substrate",
    activeAgent: "Silver nanoparticles (1-50nm, avg 10nm) on amorphous silicon dioxide",
    epaRegNumber: "Conditional registration (Dec 2011)",
    epaRegYear: 2011,
    epaRegNote: "Conditional EPA registration Dec 2011 after 3-year review. SAP panel review 2009. Additional data requirements mandated. First nanosilver textile product to receive conditional EPA registration.",
    epaLabelUrl: "https://archive.epa.gov/pesticides/news/web/html/nanosilver-2.html",
    dosageLow: 50,
    dosageHigh: 300,
    dosageTypical: 150,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic co-polymer binder",
    binderPricePerKg: 3.50,
    binderLeachPctLifetime: 15,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 150,
    leachRateFirst10Washes: 50,
    leachRatePerWash: 5.0,
    heavyMetalReleased: "Silver (nanoparticle form)",
    aquaticToxicityNote: "Nanosilver poses unique bioavailability risks vs bulk silver. Can penetrate cell membranes.",
    endOfLifeNote: "Nanosilver environmental fate poorly understood; may be more bioavailable than ionic silver.",
    chemicalPricePerKg: 55,
    chemicalPriceSource: "Estimate: HeiQ nanosilver/SiO2 composite, premium Swiss brand (China ≈$45-65/kg)",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.12,
    estimatedCostPerMeterTypical: 0.07,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.4,
  },

  // ══════════════════════════════════════════════════
  // ZINC / ZINC NANO PRODUCTS
  // ══════════════════════════════════════════════════
  {
    id: "heiq-hyprotecht",
    company: "HeiQ (Switzerland)",
    product: "HeiQ HyProTecht",
    chemistryType: "zinc_nano",
    chemistryLabel: "Zinc Nanoparticles (Crescoating)",
    activeAgent: "Zinc nanoparticles grown in-situ via Crescoating",
    epaRegNumber: "EPA compliant (active ingredient registered)",
    epaRegYear: null,
    epaRegNote: "Main ingredient EPA-registered. Specific product registration number not publicly disclosed by HeiQ.",
    epaLabelUrl: "https://www.heiq.com/products/textile-technologies/heiq-hyprotecht/",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic co-polymer (Crescoating process)",
    binderPricePerKg: 3.50,
    binderLeachPctLifetime: 10,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 150,
    leachRateFirst10Washes: 45,
    leachRatePerWash: 4.5,
    heavyMetalReleased: "Zinc",
    aquaticToxicityNote: "ZnO nanoparticles show potential for bioaccumulation in aquatic food chains",
    endOfLifeNote: "Zinc nanoparticles can disrupt biological wastewater treatment",
    chemicalPricePerKg: 40,
    chemicalPriceSource: "Estimate: ZnO nano in-situ grown, Swiss HeiQ brand (China ≈$32-48/kg)",
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
    epaRegNumber: "EPA compliant (active ingredient registered)",
    epaRegYear: null,
    epaRegNote: "EPA-registered active ingredients. INCI registered, EU REACH compliant. Dual-metal + vesicle system.",
    epaLabelUrl: "https://www.heiq.com/products/textile-technologies/heiq-viroblock/",
    dosageLow: 100,
    dosageHigh: 500,
    dosageTypical: 250,
    maxWashClaim: 30,
    washClaimNote: "15-30 washes",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic + liposome vesicle carrier",
    binderPricePerKg: 5.00,
    binderLeachPctLifetime: 20,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 140,
    leachRateFirst10Washes: 80,
    leachRatePerWash: 8.0,
    heavyMetalReleased: "Silver + Zinc (dual metal)",
    aquaticToxicityNote: "Up to 80% silver released in first wash. Dual metal system doubles heavy metal load per garment.",
    endOfLifeNote: "Both silver and zinc persist in environment; silver in sludge, zinc bioaccumulates",
    chemicalPricePerKg: 48,
    chemicalPriceSource: "Estimate: Dual Ag+Zn+liposome system, premium Swiss brand (China ≈$38-58/kg)",
    estimatedCostPerMeterLow: 0.05,
    estimatedCostPerMeterHigh: 0.14,
    estimatedCostPerMeterTypical: 0.08,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.4,
  },
  {
    id: "sanitized-zinc-pyrithione",
    company: "Sanitized AG (Switzerland)",
    product: "Sanitized T 99-19 (Zinc Pyrithione)",
    chemistryType: "zinc_pyrithione",
    chemistryLabel: "Zinc Pyrithione (ZPT)",
    activeAgent: "Zinc pyrithione antimicrobial compound",
    epaRegNumber: "Uses EPA PC Code 92344",
    epaRegYear: null,
    epaRegNote: "Active ingredient ZPT is EPA-registered under PC Code 92344. OEKO-TEX Classes I-IV. Swiss brand.",
    epaLabelUrl: "https://www3.epa.gov/pesticides/chem_search/ppls/092344-00001-20181115.pdf",
    dosageLow: 100,
    dosageHigh: 400,
    dosageTypical: 200,
    maxWashClaim: 30,
    washClaimNote: "20-30 washes",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic emulsion binder",
    binderPricePerKg: 3.50,
    binderLeachPctLifetime: 14,
    binderVOC: true,
    binderFormaldehyde: true,
    curingRequired: true,
    curingTempC: 155,
    leachRateFirst10Washes: 55,
    leachRatePerWash: 5.5,
    heavyMetalReleased: "Zinc",
    aquaticToxicityNote: "Zinc pyrithione classified H400/H410 — very toxic to aquatic life with lasting effects.",
    endOfLifeNote: "ZPT degrades but zinc accumulates in aquatic sediments.",
    chemicalPricePerKg: 28,
    chemicalPriceSource: "Estimate: ZPT compound, Sanitized Swiss brand (China ≈$22-34/kg)",
    estimatedCostPerMeterLow: 0.03,
    estimatedCostPerMeterHigh: 0.10,
    estimatedCostPerMeterTypical: 0.05,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.4,
  },

  // ══════════════════════════════════════════════════
  // COPPER PRODUCTS
  // ══════════════════════════════════════════════════
  {
    id: "cupron-copper",
    company: "Cupron Inc.",
    product: "Cupron Copper-Infused Technology",
    chemistryType: "copper",
    chemistryLabel: "Copper Oxide Particles",
    activeAgent: "Copper oxide particles embedded in fiber or applied as finish",
    epaRegNumber: "EPA registered (copper alloy/oxide)",
    epaRegYear: 2008,
    epaRegNote: "Antimicrobial copper first EPA-registered in 2008 for hard surfaces. Textile applications use copper oxide embedded in fibers.",
    epaLabelUrl: "https://www.copper.org/about/pressreleases/2008/pr2008_Mar_25.html",
    dosageLow: 200,
    dosageHigh: 1000,
    dosageTypical: 500,
    maxWashClaim: 50,
    washClaimNote: "Up to 50 washes when fiber-embedded; less when topical",
    binderRequired: true,
    binderGPerKg: 15,
    binderType: "Acrylic co-polymer binder (topical application)",
    binderPricePerKg: 3.50,
    binderLeachPctLifetime: 12,
    binderVOC: true,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 155,
    leachRateFirst10Washes: 30,
    leachRatePerWash: 3.0,
    heavyMetalReleased: "Copper",
    aquaticToxicityNote: "Copper extremely toxic to aquatic invertebrates (LC50 < 1 mg/L for Daphnia).",
    endOfLifeNote: "Copper persists in soil and water; accumulates in agricultural land via sludge spreading.",
    chemicalPricePerKg: 20,
    chemicalPriceSource: "Estimate: Copper oxide particles, lower cost than silver (China ≈$15-25/kg)",
    estimatedCostPerMeterLow: 0.03,
    estimatedCostPerMeterHigh: 0.10,
    estimatedCostPerMeterTypical: 0.05,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.3,
  },

  // ══════════════════════════════════════════════════
  // CHITOSAN PRODUCTS
  // ══════════════════════════════════════════════════
  {
    id: "chitosan-generic",
    company: "Various (Generic)",
    product: "Chitosan Antimicrobial Finish",
    chemistryType: "chitosan",
    chemistryLabel: "Chitosan Biopolymer",
    activeAgent: "Chitosan (deacetylated chitin) antimicrobial biopolymer",
    epaRegNumber: "Exempt (minimum risk pesticide since 2022)",
    epaRegYear: 2022,
    epaRegNote: "Chitosan removed from FIFRA registration requirement in 2022 — added to minimum risk pesticide exemption list. Previously required registration. Limited efficacy vs FUZE.",
    epaLabelUrl: "https://www.epa.gov/pesticides/epa-adds-chitosan-list-active-ingredients-eligible-minimum-risk-pesticide-exemption",
    dosageLow: 500,
    dosageHigh: 5000,
    dosageTypical: 2000,
    maxWashClaim: 10,
    washClaimNote: "5-10 washes — very poor wash durability",
    binderRequired: true,
    binderGPerKg: 20,
    binderType: "Citric acid crosslinker or acrylic binder",
    binderPricePerKg: 2.50,
    binderLeachPctLifetime: 25,
    binderVOC: false,
    binderFormaldehyde: false,
    curingRequired: true,
    curingTempC: 140,
    leachRateFirst10Washes: 70,
    leachRatePerWash: 7.0,
    heavyMetalReleased: "None (biopolymer)",
    aquaticToxicityNote: "Low aquatic toxicity — chitosan is biodegradable. However, very high dose required and poor durability.",
    endOfLifeNote: "Biodegradable. Environmentally benign but functionally limited.",
    chemicalPricePerKg: 15,
    chemicalPriceSource: "Estimate: Chitosan commodity biopolymer (China ≈$10-20/kg for textile grade)",
    estimatedCostPerMeterLow: 0.04,
    estimatedCostPerMeterHigh: 0.15,
    estimatedCostPerMeterTypical: 0.08,
    retreatmentPossible: true,
    retreatmentCostMultiplier: 1.2,
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
  competitorTotalLeachMg: number;       // active agent leached to water
  competitorBinderLeachG: number;       // binder leached to water (microplastics / polymer)
  competitorTotalDischargeToWaterMg: number; // everything: active agent + binder combined
  competitorBinderCostTotal: number;    // total binder cost across all applications
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

  // Leaching: each application cycle leaches its active agent over the wash range
  const washesPerCycle = competitor.maxWashClaim;
  let competitorTotalLeachMg = 0;
  for (let i = 0; i < competitorApplicationsNeeded; i++) {
    const washesThisCycle = Math.min(washesPerCycle, targetWashes - i * washesPerCycle);
    const leachFraction = Math.min(1, (competitor.leachRatePerWash / 100) * washesThisCycle);
    competitorTotalLeachMg += compChemPerApp * leachFraction;
  }

  // Binder leaching: binder also washes off over garment lifetime (microplastic / polymer discharge)
  const binderPerApplicationG = competitor.binderRequired ? competitor.binderGPerKg * fabricWeightKg : 0;
  const totalBinderAppliedG = binderPerApplicationG * competitorApplicationsNeeded;
  const competitorBinderLeachG = totalBinderAppliedG * (competitor.binderLeachPctLifetime / 100);

  // Total discharge to water: active agent (mg) + binder (g→mg)
  const competitorTotalDischargeToWaterMg = competitorTotalLeachMg + (competitorBinderLeachG * 1000);

  // Binder cost
  const competitorBinderCostTotal = totalBinderAppliedG * (competitor.binderPricePerKg / 1000); // g * $/g

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
    competitorTotalBinderG: totalBinderAppliedG,
    competitorTotalLeachMg,
    competitorBinderLeachG,
    competitorTotalDischargeToWaterMg,
    competitorBinderCostTotal,
    fuzeChemistryMg,
    fuzeBinderG: 0,
    fuzeLeachMg: 0,
  };
}

// ─── Apply admin price overrides ─────────────
// Takes the static COMPETITORS array and merges in any admin-entered overrides
export type PriceOverride = {
  competitorId: string;
  chemicalPricePerKg?: number | null;
  chemicalPriceSource?: string | null;
  binderPricePerKg?: number | null;
  estimatedCostPerMeterLow?: number | null;
  estimatedCostPerMeterHigh?: number | null;
  estimatedCostPerMeterTypical?: number | null;
  retreatmentCostMultiplier?: number | null;
};

export function applyOverrides(
  competitors: Competitor[],
  overrides: PriceOverride[],
): Competitor[] {
  const overrideMap = new Map(overrides.map((o) => [o.competitorId, o]));
  return competitors.map((comp) => {
    const ov = overrideMap.get(comp.id);
    if (!ov) return comp;
    return {
      ...comp,
      chemicalPricePerKg: ov.chemicalPricePerKg ?? comp.chemicalPricePerKg,
      chemicalPriceSource: ov.chemicalPriceSource ?? comp.chemicalPriceSource,
      binderPricePerKg: ov.binderPricePerKg ?? comp.binderPricePerKg,
      estimatedCostPerMeterLow: ov.estimatedCostPerMeterLow ?? comp.estimatedCostPerMeterLow,
      estimatedCostPerMeterHigh: ov.estimatedCostPerMeterHigh ?? comp.estimatedCostPerMeterHigh,
      estimatedCostPerMeterTypical: ov.estimatedCostPerMeterTypical ?? comp.estimatedCostPerMeterTypical,
      retreatmentCostMultiplier: ov.retreatmentCostMultiplier ?? comp.retreatmentCostMultiplier,
    };
  });
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
