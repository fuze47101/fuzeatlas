/**
 * Shared bath-recipe math.
 *
 * Phase 15 NEED-FB-2 (Tina ticket cmp2158ge) — mills work bath-volume-
 * first: they fill the padder trough with N liters, then need to know
 * how many mL of FUZE concentrate vs DI water to dose. The existing
 * /pricing/calculator computed in the other direction (fabric weight
 * → bath volume → FUZE volume), which mismatches the mill workflow.
 *
 * Same formula is used on /admin/recipe-calculator and the bench-test
 * wizard so the numbers don't drift between surfaces.
 *
 * Canonical FUZE constants:
 *   - Stock concentration: 30 mg Ag / L (delivered FUZE bottle)
 *   - Tier doses (mg Ag / kg fabric):
 *       F1 = 1.0   F2 = 0.75   F3 = 0.5   F4 = 0.25
 */

export const STOCK_MG_PER_L = 30;

export type FuzeTierId = "F1" | "F2" | "F3" | "F4";

export const TIER_DOSE_MG_PER_KG: Record<FuzeTierId, number> = {
  F1: 1.0,
  F2: 0.75,
  F3: 0.5,
  F4: 0.25,
};

export interface BathFromVolumeInputs {
  /** Bath volume in liters (the trough fill the mill is working with). */
  bathVolumeL: number;
  /** Target tier dose in mg Ag per kg fabric. */
  tierMgPerKg: number;
  /** Wet pickup percent — fraction of fabric weight picked up as solution. */
  pickupPct: number;
  /** Stock concentration in mg/L. Defaults to STOCK_MG_PER_L. */
  stockMgPerL?: number;
}

export interface BathFromVolumeOutputs {
  /** Concentration the bath needs to be at to deliver tierMgPerKg via pickup. */
  bathConcentrationMgL: number;
  /** Total mg Ag needed in the bath. */
  fuzeNeededMg: number;
  /** mL of FUZE concentrate to add to the trough. */
  mlFuze: number;
  /** mL of DI water to add to the trough (bath - FUZE). */
  mlDi: number;
  /** FUZE as a % of total bath volume (Tina's "3.3% at F1 100% pickup" check). */
  fuzePctOfBath: number;
}

/**
 * Bath-volume-first calculator.
 *
 *   bathConcentration_mgL = tierMgPerKg / (pickupPct / 100)
 *   fuzeNeeded_mg         = bathConcentration_mgL × bathVolumeL
 *   mlFuze                = fuzeNeeded_mg / stockMgPerL × 1000 / 1000
 *                         = (bathVolumeL × tierMgPerKg / (pickupPct/100) / stockMgPerL) × 1000
 *   mlDi                  = bathVolumeL × 1000 − mlFuze
 *
 * Spot-check from Tina: F1 (1.0 mg/kg) at 100% pickup should land at
 * 3.33% FUZE of bath. F1 / (100/100) = 1.0 mg/L. 1 mg/L / 30 mg/L =
 * 1/30 = 3.33%. ✓
 */
export function calcBathFromVolume(inputs: BathFromVolumeInputs): BathFromVolumeOutputs {
  const { bathVolumeL, tierMgPerKg, pickupPct } = inputs;
  const stockMgPerL = inputs.stockMgPerL ?? STOCK_MG_PER_L;

  if (!Number.isFinite(bathVolumeL) || bathVolumeL <= 0) {
    return { bathConcentrationMgL: 0, fuzeNeededMg: 0, mlFuze: 0, mlDi: 0, fuzePctOfBath: 0 };
  }
  if (!Number.isFinite(pickupPct) || pickupPct <= 0) {
    return { bathConcentrationMgL: 0, fuzeNeededMg: 0, mlFuze: 0, mlDi: 0, fuzePctOfBath: 0 };
  }

  const pickupDecimal = pickupPct / 100;
  const bathConcentrationMgL = tierMgPerKg / pickupDecimal;
  const fuzeNeededMg = bathConcentrationMgL * bathVolumeL;
  const fuzeVolumeL = fuzeNeededMg / stockMgPerL;
  const mlFuze = fuzeVolumeL * 1000;
  const mlDi = Math.max(0, bathVolumeL * 1000 - mlFuze);
  const fuzePctOfBath = (fuzeVolumeL / bathVolumeL) * 100;

  return {
    bathConcentrationMgL,
    fuzeNeededMg,
    mlFuze,
    mlDi,
    fuzePctOfBath,
  };
}
