/**
 * FUZE Pickup & Application Calculator
 * Calculates bath concentration for exhaust and spray parameters for spray application.
 *
 * Constants:
 * - Stock concentration: 30 mg Ag per liter (as delivered)
 * - Standard bottle: 19 liters
 * - FUZE Tiers: F1=1.0, F2=0.75, F3=0.5, F4=0.25 mg/kg residual on fabric
 */

// ─── Types ─────────────────────────────────────
export interface ExhaustInputs {
  gsm: number;              // Fabric weight g/m²
  widthInches: number;      // Fabric width in inches
  lengthMeters: number;     // Batch length in meters
  targetDoseMgKg: number;   // Target residual: 1.0, 0.75, 0.5, or 0.25 mg/kg
  liquorRatio: number;      // e.g. 8 means 1:8 (8L per kg fabric)
  exhaustionPct: number;    // Expected exhaustion % (e.g. 85 = 85%)
  pickupPct: number;        // Wet pickup % (for pad methods)
  method: "exhaust" | "pad-dry-cure";  // Application method
}

export interface ExhaustOutputs {
  fabricWeightKg: number;
  fabricWeightLbs: number;
  bathVolumeLiters: number;
  fuzeNeededMg: number;
  fuzeVolumeLiters: number;
  fuzeVolumeML: number;
  fuzePctOfBath: number;
  bathConcentrationMgL: number;
  bottlesNeeded: number;
  bottlesNeededRounded: number;
  // Pad-specific
  padSolutionVolumeLiters?: number;
  padConcentrationMgL?: number;
}

export interface SprayInputs {
  gsm: number;
  widthInches: number;
  targetDoseMgKg: number;
  pumpRateMLMin: number;       // Per spray head, mL/min
  fabricSpeedMMin: number;     // Fabric speed m/min (default 15)
  concentrationFactor: number; // 1.0 = full strength, 0.5 = diluted 50%, etc.
}

export interface SprayOutputs {
  sprayHeadsTop: number;
  sprayHeadsBottom: number;
  totalSprayHeads: number;
  totalSprayRateMLMin: number;
  volumePerMeterML: number;
  volumePerMeterL: number;
  fabricWeightPerMeterKg: number;
  mgDeliveredPerMeter: number;
  mgNeededPerMeter: number;
  concentrationNeededMgL: number;
  dilutionRatio: string;       // e.g. "1:5" (1 part stock to 5 parts water)
  stockVolumePerMeterML: number;
  // Per batch
  metersPerBottle: number;
}

// ─── Constants ─────────────────────────────────
export const STOCK_MG_PER_L = 30;     // 30 mg Ag per liter
export const BOTTLE_LITERS = 19;       // Standard bottle size
export const INCHES_TO_METERS = 0.0254;
export const DEFAULT_SPRAY_SPEED = 15; // m/min
export const DEFAULT_PUMP_RATE = 50;   // mL/min per head

export const FUZE_TIERS = [
  { id: "F1", dose: 1.0, label: "Full Spectrum", washes: 100 },
  { id: "F2", dose: 0.75, label: "Advanced", washes: 75 },
  { id: "F3", dose: 0.5, label: "Core", washes: 50 },
  { id: "F4", dose: 0.25, label: "Foundation", washes: 25 },
] as const;

// ─── Exhaust Calculator ────────────────────────
export function calcExhaust(inputs: ExhaustInputs): ExhaustOutputs {
  const { gsm, widthInches, lengthMeters, targetDoseMgKg, liquorRatio, exhaustionPct, pickupPct, method } = inputs;

  // Fabric weight
  const widthMeters = widthInches * INCHES_TO_METERS;
  const fabricAreaM2 = widthMeters * lengthMeters;
  const fabricWeightKg = (gsm * fabricAreaM2) / 1000;
  const fabricWeightLbs = fabricWeightKg * 2.20462;

  // How much Ag needs to end up on the fabric
  const targetMgOnFabric = fabricWeightKg * targetDoseMgKg;

  // Account for exhaustion rate (not all Ag transfers from bath to fabric)
  const exhaustionDecimal = exhaustionPct / 100;
  const fuzeNeededMg = targetMgOnFabric / exhaustionDecimal;

  // Volume of FUZE concentrate needed
  const fuzeVolumeLiters = fuzeNeededMg / STOCK_MG_PER_L;
  const fuzeVolumeML = fuzeVolumeLiters * 1000;

  if (method === "pad-dry-cure") {
    // Pad method: fabric passes through trough, picks up X% of its weight in solution
    const pickupDecimal = pickupPct / 100;
    const padSolutionPickupKg = fabricWeightKg * pickupDecimal; // kg of solution picked up
    const padSolutionVolumeLiters = padSolutionPickupKg; // 1 kg water ≈ 1 L
    // Concentration in the pad bath so that the pickup delivers the target
    const padConcentrationMgL = targetMgOnFabric / padSolutionVolumeLiters;

    // Trough sizing: mills typically mix ~3× the per-pass pickup volume so
    // the trough stays full as fabric runs through. Note that scaling the
    // bath VOLUME up does NOT change the concentration — you also have to
    // scale stock up by the same factor. Both bath concentration (mg/L)
    // and stock-fraction (% by volume) are independent of trough size.
    //
    // Tina caught this May 13: previously line 115 divided stock by 3×
    // bath volume (without scaling stock), and line 116 divided
    // padConcentrationMgL by 3, both of which under-reported by 3×.
    // Net effect on production: any mill following the calculator was
    // dosing 1/3 of the FUZE they should have been — antimicrobial
    // efficacy tests would fail for unexplained reasons. Fix below
    // matches the bench-test Recipe Report math (which has always been
    // correct).
    const totalTroughBathL = padSolutionVolumeLiters * 3;
    const totalStockNeededL = fuzeVolumeLiters * 3;
    return {
      fabricWeightKg: round(fabricWeightKg, 3),
      fabricWeightLbs: round(fabricWeightLbs, 2),
      bathVolumeLiters: round(totalTroughBathL, 2),
      fuzeNeededMg: round(fuzeNeededMg, 2),
      // Now reflects total stock for the trough (3× pickup-only stock),
      // matching the trough volume above.
      fuzeVolumeLiters: round(totalStockNeededL, 4),
      fuzeVolumeML: round(totalStockNeededL * 1000, 1),
      // % stock by volume in the bath = stock / bath. Independent of trough
      // size because both scale together.
      fuzePctOfBath: round((fuzeVolumeLiters / padSolutionVolumeLiters) * 100, 4),
      // Bath concentration (mg/L) is the same whether you mix 1L or 100L —
      // it's set by the dose target and pickup, not by trough size.
      bathConcentrationMgL: round(padConcentrationMgL, 4),
      bottlesNeeded: round(totalStockNeededL / BOTTLE_LITERS, 3),
      bottlesNeededRounded: Math.ceil(totalStockNeededL / BOTTLE_LITERS),
      padSolutionVolumeLiters: round(padSolutionVolumeLiters, 2),
      padConcentrationMgL: round(padConcentrationMgL, 4),
    };
  }

  // Exhaust method
  const bathVolumeLiters = fabricWeightKg * liquorRatio;
  const fuzePctOfBath = (fuzeVolumeLiters / bathVolumeLiters) * 100;
  const bathConcentrationMgL = fuzeNeededMg / bathVolumeLiters;

  return {
    fabricWeightKg: round(fabricWeightKg, 3),
    fabricWeightLbs: round(fabricWeightLbs, 2),
    bathVolumeLiters: round(bathVolumeLiters, 2),
    fuzeNeededMg: round(fuzeNeededMg, 2),
    fuzeVolumeLiters: round(fuzeVolumeLiters, 4),
    fuzeVolumeML: round(fuzeVolumeML, 1),
    fuzePctOfBath: round(fuzePctOfBath, 4),
    bathConcentrationMgL: round(bathConcentrationMgL, 4),
    bottlesNeeded: round(fuzeVolumeLiters / BOTTLE_LITERS, 3),
    bottlesNeededRounded: Math.ceil(fuzeVolumeLiters / BOTTLE_LITERS),
  };
}

// ─── Spray Calculator ──────────────────────────
export function calcSpray(inputs: SprayInputs): SprayOutputs {
  const { gsm, widthInches, targetDoseMgKg, pumpRateMLMin, fabricSpeedMMin, concentrationFactor } = inputs;

  const widthMeters = widthInches * INCHES_TO_METERS;

  // Spray heads: 1 per 6 inches, top and bottom
  const sprayHeadsTop = Math.ceil(widthInches / 6);
  const sprayHeadsBottom = Math.ceil(widthInches / 6);
  const totalSprayHeads = sprayHeadsTop + sprayHeadsBottom;

  // Total spray rate
  const totalSprayRateMLMin = totalSprayHeads * pumpRateMLMin;

  // Volume sprayed per meter of fabric
  // Time for 1 meter = 1 / fabricSpeedMMin (minutes)
  const timePerMeter = 1 / fabricSpeedMMin; // minutes
  const volumePerMeterML = totalSprayRateMLMin * timePerMeter;
  const volumePerMeterL = volumePerMeterML / 1000;

  // Fabric weight per linear meter
  const fabricWeightPerMeterKg = (gsm * widthMeters * 1) / 1000; // 1 meter length

  // How much Ag needs to be on 1 meter of fabric
  const mgNeededPerMeter = fabricWeightPerMeterKg * targetDoseMgKg;

  // Concentration of spray solution needed
  // We need mgNeededPerMeter mg of Ag delivered in volumePerMeterML of spray
  const concentrationNeededMgL = (mgNeededPerMeter / volumePerMeterML) * 1000; // convert mL to L

  // How does this relate to stock (30 mg/L)?
  const dilutionFromStock = STOCK_MG_PER_L / concentrationNeededMgL;
  const dilutionRatio = dilutionFromStock >= 1
    ? `1:${round(dilutionFromStock - 1, 1)} (stock:water)`
    : `Use full strength (${round(concentrationNeededMgL, 2)} mg/L needed, stock is ${STOCK_MG_PER_L} mg/L)`;

  // Stock volume needed per meter
  const stockVolumePerMeterML = (mgNeededPerMeter / STOCK_MG_PER_L) * 1000;

  // Meters per bottle
  const mgPerBottle = BOTTLE_LITERS * STOCK_MG_PER_L; // total Ag in one bottle
  const metersPerBottle = mgPerBottle / mgNeededPerMeter;

  // Actual delivery with concentration factor
  const mgDeliveredPerMeter = (volumePerMeterML / 1000) * (STOCK_MG_PER_L * concentrationFactor);

  return {
    sprayHeadsTop,
    sprayHeadsBottom,
    totalSprayHeads,
    totalSprayRateMLMin: round(totalSprayRateMLMin, 1),
    volumePerMeterML: round(volumePerMeterML, 2),
    volumePerMeterL: round(volumePerMeterL, 4),
    fabricWeightPerMeterKg: round(fabricWeightPerMeterKg, 4),
    mgDeliveredPerMeter: round(mgDeliveredPerMeter, 4),
    mgNeededPerMeter: round(mgNeededPerMeter, 4),
    concentrationNeededMgL: round(concentrationNeededMgL, 4),
    dilutionRatio,
    stockVolumePerMeterML: round(stockVolumePerMeterML, 2),
    metersPerBottle: round(metersPerBottle, 1),
  };
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
