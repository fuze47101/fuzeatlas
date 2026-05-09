// @ts-nocheck
/**
 * Order → application-amount validation.
 *
 * KUIU promise (Andrew → Joseph, May 7 2026): "we can confirm from the
 * order that it matches the required application amount." This is the
 * helper that performs that check.
 *
 * Pure function — no DB writes. Wire it into order create paths;
 * surface the result via notification + admin review. No schema
 * changes; the existing FuzeOrder fields cover everything we need.
 *
 * The math (FUZE Atlas canonical):
 *   tier_mg_per_kg × fabric_mass_kg / stock_mg_per_L = base_liters
 *   final_liters = base_liters × (1 + wastageFactorPct / 100)
 *
 * Tier mg/kg:   F1=1.0, F2=0.75, F3=0.5, F4=0.25
 * Stock mg/L:   30 (FUZE stock concentration, never changes)
 */

const TIER_MG_PER_KG: Record<string, number> = {
  F1: 1.0,
  F2: 0.75,
  F3: 0.5,
  F4: 0.25,
};

export const STOCK_MG_PER_L = 30;
export const DEFAULT_WASTAGE_PCT = 10;

export type ValidationSeverity = "info" | "warn" | "error";

export interface ValidationFinding {
  code:
    | "missing_brand"
    | "missing_tier"
    | "missing_mass"
    | "tier_mismatch"
    | "volume_mismatch"
    | "ok";
  severity: ValidationSeverity;
  message: string;
  expectedLiters?: number;
  actualLiters?: number;
  deviationPct?: number;
}

export interface OrderValidationResult {
  ok: boolean;
  findings: ValidationFinding[];
  expectedLiters: number | null;
  actualLiters: number | null;
  brandRequiredTier?: string | null;
  orderTier?: string | null;
}

interface OrderInput {
  volumeLiters?: number | null;
  fuzeTier?: string | null;
  fabricMassKg?: number | null;
  baseFuzeLiters?: number | null;
  wastageFactorPct?: number | null;
  brandId?: string | null;
  orderType?: string | null;
}

interface BrandInput {
  // Brand has no requiredFuzeTier column yet — when one is added later
  // we can pass it in here. For now this is null and the validator
  // skips the tier-vs-brand-spec check.
  requiredFuzeTier?: string | null;
}

/**
 * Validate a FuzeOrder against the FUZE-Atlas application-amount
 * spec. Returns a result object the caller can persist as a
 * notification body, an admin review row, or just a console.log.
 *
 * Severity rules:
 *   info  — informational, surfaces but doesn't escalate
 *   warn  — order should still proceed, but brand + admins notified
 *   error — order should be blocked / require manual review (we
 *           don't actually block here; that's the caller's call)
 */
export function validateOrderApplication(
  order: OrderInput,
  brand?: BrandInput | null,
): OrderValidationResult {
  const findings: ValidationFinding[] = [];

  // HANGTAG orders aren't FUZE liquid — skip volume math entirely.
  if (order.orderType === "HANGTAG") {
    findings.push({
      code: "ok",
      severity: "info",
      message: "Hangtag order — no FUZE volume validation needed.",
    });
    return { ok: true, findings, expectedLiters: null, actualLiters: null };
  }

  // No brand on the order — can't check brand-spec match. Still run
  // the volume sanity check below.
  if (!order.brandId) {
    findings.push({
      code: "missing_brand",
      severity: "info",
      message: "Order has no brand attached — skipping brand-spec match.",
    });
  }

  const tier = order.fuzeTier;
  if (!tier || !TIER_MG_PER_KG[tier]) {
    findings.push({
      code: "missing_tier",
      severity: "warn",
      message: tier
        ? `Unknown FUZE tier "${tier}" — expected F1, F2, F3, or F4.`
        : "Order has no fuzeTier set — can't validate against application spec.",
    });
    return {
      ok: false,
      findings,
      expectedLiters: null,
      actualLiters: order.volumeLiters ?? null,
      brandRequiredTier: brand?.requiredFuzeTier ?? null,
      orderTier: tier ?? null,
    };
  }

  // Tier vs brand-required tier check — only fires if the brand has
  // explicitly stipulated a tier. Most brands don't yet; that's part
  // of task #40 (BrandTestCadence + brand spec setup).
  if (brand?.requiredFuzeTier && tier !== brand.requiredFuzeTier) {
    findings.push({
      code: "tier_mismatch",
      severity: "error",
      message: `Order is tier ${tier}, but the brand spec requires ${brand.requiredFuzeTier}. Confirm with the brand before fulfilling.`,
    });
  }

  const mass = order.fabricMassKg;
  if (mass == null || mass <= 0) {
    findings.push({
      code: "missing_mass",
      severity: "warn",
      message:
        "Fabric mass (kg) wasn't recorded on the order — can't compute expected FUZE volume. Ask the factory to fill in fabricMassKg.",
    });
    return {
      ok: false,
      findings,
      expectedLiters: null,
      actualLiters: order.volumeLiters ?? null,
      brandRequiredTier: brand?.requiredFuzeTier ?? null,
      orderTier: tier,
    };
  }

  const tierMgPerKg = TIER_MG_PER_KG[tier];
  const baseExpected =
    order.baseFuzeLiters && order.baseFuzeLiters > 0
      ? order.baseFuzeLiters
      : (tierMgPerKg * mass) / STOCK_MG_PER_L;
  const wastagePct =
    order.wastageFactorPct == null ? DEFAULT_WASTAGE_PCT : order.wastageFactorPct;
  const expectedLiters = baseExpected * (1 + wastagePct / 100);

  const actualLiters = order.volumeLiters ?? 0;
  const deviationPct =
    expectedLiters > 0 ? ((actualLiters - expectedLiters) / expectedLiters) * 100 : 0;

  // Tolerance bands: ±10% is fine, ±10–25% is a warn (over- or
  // under-ordering by a margin), ±25%+ is an error. Symmetric — over-
  // ordering signals "factory is treating fabric for someone else
  // with this FUZE", under-ordering signals "factory will run out
  // before they finish their committed run."
  const absDev = Math.abs(deviationPct);
  if (absDev <= 10) {
    findings.push({
      code: "ok",
      severity: "info",
      message: `Order volume ${actualLiters.toFixed(1)} L is within ${absDev.toFixed(1)}% of expected ${expectedLiters.toFixed(1)} L for ${mass.toFixed(0)} kg of fabric at tier ${tier}.`,
      expectedLiters,
      actualLiters,
      deviationPct,
    });
  } else if (absDev <= 25) {
    findings.push({
      code: "volume_mismatch",
      severity: "warn",
      message: `Order volume ${actualLiters.toFixed(1)} L is ${deviationPct > 0 ? "over" : "under"} expected by ${absDev.toFixed(1)}% (expected ${expectedLiters.toFixed(1)} L for ${mass.toFixed(0)} kg at ${tier}). Confirm fabric mass + tier with the factory.`,
      expectedLiters,
      actualLiters,
      deviationPct,
    });
  } else {
    findings.push({
      code: "volume_mismatch",
      severity: "error",
      message: `Order volume ${actualLiters.toFixed(1)} L is ${deviationPct > 0 ? "over" : "under"} expected by ${absDev.toFixed(1)}% (expected ${expectedLiters.toFixed(1)} L for ${mass.toFixed(0)} kg at ${tier}). Significant deviation — manual review required.`,
      expectedLiters,
      actualLiters,
      deviationPct,
    });
  }

  const hasError = findings.some((f) => f.severity === "error");
  const hasWarn = findings.some((f) => f.severity === "warn");
  return {
    ok: !hasError && !hasWarn,
    findings,
    expectedLiters,
    actualLiters,
    brandRequiredTier: brand?.requiredFuzeTier ?? null,
    orderTier: tier,
  };
}

/**
 * Convenience: pull the highest-severity finding's message for the
 * notification body. Returns "" if everything's clean.
 */
export function summariseValidation(result: OrderValidationResult): string {
  const order: ValidationSeverity[] = ["error", "warn", "info"];
  for (const sev of order) {
    const hit = result.findings.find((f) => f.severity === sev);
    if (hit && hit.code !== "ok") return hit.message;
  }
  return "";
}
