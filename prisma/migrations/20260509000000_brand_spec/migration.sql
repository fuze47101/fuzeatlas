-- Brand-stipulated FUZE specification (KUIU promise May 2026)
-- Adds five optional columns to Brand:
--   * requiredFuzeTier              String? — F1/F2/F3/F4 stipulated tier
--   * icpCadenceEveryNBatches       Int?    — ICP cadence by batch count
--   * icpCadenceEveryLitersConsumed Float?  — ICP cadence by volume
--   * protocolDocUrl                String? — brand protocol PDF link
--   * brandSpecUpdatedAt            DateTime? — when spec last touched
--
-- All nullable / additive. No backfill required. Order-application
-- validator (src/lib/order-validation.ts) and the upcoming cadence
-- cron (TBD) read these at runtime.
ALTER TABLE "Brand" ADD COLUMN "requiredFuzeTier" TEXT;
ALTER TABLE "Brand" ADD COLUMN "icpCadenceEveryNBatches" INTEGER;
ALTER TABLE "Brand" ADD COLUMN "icpCadenceEveryLitersConsumed" DOUBLE PRECISION;
ALTER TABLE "Brand" ADD COLUMN "protocolDocUrl" TEXT;
ALTER TABLE "Brand" ADD COLUMN "brandSpecUpdatedAt" TIMESTAMP(3);
