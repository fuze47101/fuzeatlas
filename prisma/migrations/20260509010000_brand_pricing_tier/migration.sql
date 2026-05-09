-- Brand pricing tier ladder (KUIU promise May 2026)
-- Per-brand discount ladder. Once cumulative consumption across the
-- whole supply chain crosses thresholdLiters, the brand qualifies for
-- that row's discountPct on subsequent orders.

CREATE TABLE "BrandPricingTier" (
  "id"              TEXT NOT NULL,
  "brandId"         TEXT NOT NULL,
  "thresholdLiters" DOUBLE PRECISION NOT NULL,
  "discountPct"     DOUBLE PRECISION NOT NULL,
  "label"           TEXT,
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandPricingTier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrandPricingTier_brandId_thresholdLiters_idx"
  ON "BrandPricingTier"("brandId", "thresholdLiters");

ALTER TABLE "BrandPricingTier"
  ADD CONSTRAINT "BrandPricingTier_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
