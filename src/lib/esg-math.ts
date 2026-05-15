/**
 * src/lib/esg-math.ts — NICE-6 ESG strip math.
 *
 * Light-touch CO₂-vs-PFAS calculation for the brand-portal at-a-glance
 * ESG strip ("Total liters used · kg fabric treated · CO₂ avoided").
 *
 * The deep per-meter sustainability calc lives in src/lib/sustainability.ts
 * — that one models binder production, curing energy, wastewater
 * remediation per fabric per competitor with literature-grade factors.
 * Here we want a SIMPLE strip-level number: "this brand has used N
 * liters of FUZE → that displaced X kg CO₂e vs the PFAS alternative".
 *
 * The per-liter factor is intentionally conservative (3 kg CO₂e per
 * liter of FUZE used) so brand marketing teams can quote it without
 * caveats. It captures the three primary CO₂ drivers eliminated by
 * choosing FUZE:
 *   - PFAS binder production (~1.2 kg CO₂e/kg binder × ~0.5 kg
 *     binder per liter dose-equivalent)
 *   - Curing oven energy (~0.4 kg CO₂e/kWh × ~3 kWh per liter
 *     dose-equivalent at typical 150–170 °C cure)
 *   - Wastewater remediation (~0.6 kg CO₂e per m³ × ~1 m³ effluent
 *     per liter dose-equivalent)
 *
 * Adjust CO2_AVOIDED_KG_PER_LITER here if Andrew approves a different
 * basis from the sustainability deep model.
 */

export const CO2_AVOIDED_KG_PER_LITER = 3.0;

/** Average GSM × 1 m² = kg per linear meter of fabric. Conservative
 *  fallback when FuzeConsumption.metersProcessed is the only signal
 *  we have and the underlying fabric weights aren't joined in. */
export const DEFAULT_GSM_FOR_KG_ESTIMATE = 180;

export interface BrandEsgInput {
  /** Sum of FuzeConsumption.litersUsed for this brand. */
  totalLitersUsed: number;
  /** Sum of FuzeConsumption.metersProcessed for this brand. May be 0
   *  if factories haven't logged meter counts. */
  totalMetersProcessed: number;
  /** Optional sum of explicit fabric mass (kg) when consumption rows
   *  joined to Fabric with weightGsm. Beats the GSM-based estimate. */
  totalKgFromFabricWeights?: number;
}

export interface BrandEsgOutput {
  totalLitersUsed: number;
  /** Best estimate of kg fabric treated — either from joined fabric
   *  weights or the default GSM × meters fallback. */
  kgFabricTreated: number;
  /** Kg CO₂e avoided vs PFAS alternative. */
  co2AvoidedKg: number;
  /** Equivalent gallons of gasoline burned (8.78 kg CO₂/gallon EPA). */
  co2AvoidedGasolineGallons: number;
  /** Method used to compute kg fabric — for the strip subtitle / tooltip. */
  kgEstimateBasis: "fabric-weights" | "gsm-fallback" | "none";
}

const EPA_KG_CO2_PER_GALLON_GASOLINE = 8.78;

export function computeBrandEsg(input: BrandEsgInput): BrandEsgOutput {
  const liters = Math.max(0, input.totalLitersUsed || 0);
  const meters = Math.max(0, input.totalMetersProcessed || 0);
  const kgFromWeights = Math.max(0, input.totalKgFromFabricWeights || 0);

  let kgFabricTreated: number;
  let basis: BrandEsgOutput["kgEstimateBasis"];
  if (kgFromWeights > 0) {
    kgFabricTreated = kgFromWeights;
    basis = "fabric-weights";
  } else if (meters > 0) {
    // gsm grams/m² × 1 m × meters = grams → ÷1000 = kg
    // (assumes 1 m wide-equivalent; close enough at strip level)
    kgFabricTreated = (DEFAULT_GSM_FOR_KG_ESTIMATE * meters) / 1000;
    basis = "gsm-fallback";
  } else {
    kgFabricTreated = 0;
    basis = "none";
  }

  const co2AvoidedKg = liters * CO2_AVOIDED_KG_PER_LITER;
  const co2AvoidedGasolineGallons = co2AvoidedKg / EPA_KG_CO2_PER_GALLON_GASOLINE;

  return {
    totalLitersUsed: liters,
    kgFabricTreated,
    co2AvoidedKg,
    co2AvoidedGasolineGallons,
    kgEstimateBasis: basis,
  };
}
