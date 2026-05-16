/**
 * MB-4 — ML-lite predicted brand pipeline value.
 *
 * Pure scoring function (no DB calls). Given a brand's pipelineStage,
 * vertical, engagement score and fuze-relevance flag, returns a
 * predicted 12-month FUZE volume × stage-probability × $36/L price.
 *
 * Inputs we don't have on Brand today and therefore intentionally
 * skip: country-specific volume multipliers, companyRevenue /
 * company-size bands. Both are populated only on Contact today;
 * adding them to Brand is a separate cleanup.
 *
 * Multipliers / probabilities are reasonable starting defaults —
 * meant to be tuned by Andrew once enough actual-vs-predicted data
 * accumulates.
 */

export const DEFAULT_PRICE_PER_LITER_USD = 36;

/**
 * Base annual FUZE volume in liters by vertical. Pulls from the
 * Brand.textileCategory field (free-text but typically one of these
 * strings). Falls back to DEFAULT_VERTICAL_L when no match.
 *
 * Keys are lowercased + normalized.
 */
const VERTICAL_BASE_L: Record<string, number> = {
  hospitality: 12_000,
  hotels: 12_000,
  linen: 12_000,
  linens: 12_000,
  activewear: 8_000,
  performance: 8_000,
  athleisure: 8_000,
  workwear: 6_000,
  uniforms: 6_000,
  military: 6_000,
  intimates: 3_000,
  "next-to-skin": 3_000,
  underwear: 3_000,
  kids: 2_000,
  baby: 2_000,
  childrens: 2_000,
  medical: 4_000,
  healthcare: 4_000,
  scrubs: 4_000,
  home_textiles: 5_000,
  "home textiles": 5_000,
  bedding: 5_000,
  towels: 5_000,
  apparel: 4_000,
};

export const DEFAULT_VERTICAL_BASE_L = 2_500;

/**
 * Lookup table: probability the brand actually books production
 * volume given its current pipeline stage. CUSTOMER_WON is 100%
 * because they already booked; BRAND_EXPANSION is 95% because
 * they're scaling and a new SKU is highly likely.
 */
export const STAGE_PROBABILITY: Record<string, number> = {
  LEAD: 0.05,
  PRESENTATION: 0.15,
  BRAND_TESTING: 0.30,
  FACTORY_ONBOARDING: 0.50,
  FACTORY_TESTING: 0.65,
  PRODUCTION: 0.85,
  BRAND_EXPANSION: 0.95,
  CUSTOMER_WON: 1.00,
  // ARCHIVE is excluded — should never reach the predictor.
};

/**
 * Engagement score (0-100) → multiplier (0.7 - 1.5), linear:
 *   0   → 0.7×
 *   50  → 1.0×
 *   100 → 1.5×
 */
export function engagementMultiplier(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 1.0;
  const clamped = Math.max(0, Math.min(100, score));
  return 0.7 + (clamped / 100) * 0.8;
}

/**
 * fuzeRelevance flag → multiplier. Skews against low-relevance
 * brands so they don't drown out high-relevance ones in the
 * ranked queue.
 */
export function relevanceMultiplier(relevance: string | null | undefined): number {
  switch ((relevance || "").toLowerCase()) {
    case "high":
      return 1.15;
    case "medium":
      return 1.0;
    case "low":
      return 0.8;
    case "none":
      return 0.6;
    default:
      return 1.0;
  }
}

/**
 * Normalize the free-text textileCategory into a known key from
 * VERTICAL_BASE_L. Returns the matched key + base annual volume,
 * or { key: null, baseAnnualL: DEFAULT_VERTICAL_BASE_L } when the
 * vertical doesn't match anything we know about.
 */
function resolveVertical(textileCategory: string | null | undefined): {
  key: string | null;
  baseAnnualL: number;
} {
  if (!textileCategory) return { key: null, baseAnnualL: DEFAULT_VERTICAL_BASE_L };
  const norm = textileCategory.toLowerCase().trim();
  // Exact match first.
  if (norm in VERTICAL_BASE_L) {
    return { key: norm, baseAnnualL: VERTICAL_BASE_L[norm] };
  }
  // Substring scan for compound categories ("performance apparel",
  // "kids activewear", "hospitality linens"). Use the first hit;
  // VERTICAL_BASE_L keys are ordered roughly highest-volume first.
  for (const key of Object.keys(VERTICAL_BASE_L)) {
    if (norm.includes(key)) {
      return { key, baseAnnualL: VERTICAL_BASE_L[key] };
    }
  }
  return { key: null, baseAnnualL: DEFAULT_VERTICAL_BASE_L };
}

export interface BrandPredictionInput {
  pipelineStage: string | null | undefined;
  textileCategory?: string | null;
  fuzeRelevance?: string | null;
  engagementScore?: number | null;
  // Optional: lifetime FUZE volume from past orders. When > 0, we
  // anchor the base annual volume to (lifetime/N years) instead of
  // the vertical default. Caller passes a precomputed value to keep
  // this function pure.
  lifetimeFuzeLitersBooked?: number | null;
  // Years the brand has been booking FUZE (clamped >= 0.5 to avoid
  // dividing by zero on freshly-onboarded customers).
  yearsBookingFuze?: number | null;
}

export interface BrandPredictionResult {
  expectedAnnualVolumeL: number;
  stageProbability: number;
  predictedValueUSD: number;
  factors: {
    pipelineStage: string;
    matchedVertical: string | null;
    verticalBaseAnnualL: number;
    engagementMultiplier: number;
    relevanceMultiplier: number;
    actualsAnchor: boolean;
    pricePerLiterUSD: number;
  };
}

/**
 * Compute the prediction for one brand. Pure — no DB.
 */
export function predictBrandValue(b: BrandPredictionInput): BrandPredictionResult {
  const stage = (b.pipelineStage || "LEAD").toUpperCase();
  const stageProbability = STAGE_PROBABILITY[stage] ?? STAGE_PROBABILITY.LEAD;

  const { key: matchedVertical, baseAnnualL: verticalBase } = resolveVertical(
    b.textileCategory,
  );

  // Actuals anchor: if the brand has booked real FUZE and has been
  // around > half a year, average their booked volume per year and
  // use that as the base. This blends ML-lite with the actual signal
  // we already have.
  let actualsAnchor = false;
  let baseAnnualL = verticalBase;
  if (
    b.lifetimeFuzeLitersBooked != null &&
    b.lifetimeFuzeLitersBooked > 0 &&
    b.yearsBookingFuze != null &&
    b.yearsBookingFuze > 0
  ) {
    const years = Math.max(0.5, b.yearsBookingFuze);
    const annual = b.lifetimeFuzeLitersBooked / years;
    if (annual > 0) {
      baseAnnualL = annual;
      actualsAnchor = true;
    }
  }

  const engMult = engagementMultiplier(b.engagementScore);
  const relMult = relevanceMultiplier(b.fuzeRelevance);

  const expectedAnnualVolumeL = baseAnnualL * engMult * relMult;
  const predictedValueUSD =
    expectedAnnualVolumeL * DEFAULT_PRICE_PER_LITER_USD * stageProbability;

  return {
    expectedAnnualVolumeL: Number(expectedAnnualVolumeL.toFixed(2)),
    stageProbability,
    predictedValueUSD: Number(predictedValueUSD.toFixed(2)),
    factors: {
      pipelineStage: stage,
      matchedVertical,
      verticalBaseAnnualL: actualsAnchor ? Number(baseAnnualL.toFixed(2)) : verticalBase,
      engagementMultiplier: Number(engMult.toFixed(3)),
      relevanceMultiplier: Number(relMult.toFixed(3)),
      actualsAnchor,
      pricePerLiterUSD: DEFAULT_PRICE_PER_LITER_USD,
    },
  };
}
