-- ProductDocument category + audience extension (Phase 6A — ROADMAP_v2)

ALTER TABLE "ProductDocument"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'tds_sds';

ALTER TABLE "ProductDocument"
  ADD COLUMN "audience" TEXT[] NOT NULL DEFAULT ARRAY['BRAND','FACTORY','DISTRIBUTOR','LAB'];

ALTER TABLE "ProductDocument"
  ADD COLUMN "productLine" TEXT;

CREATE INDEX "ProductDocument_category_idx"
  ON "ProductDocument"("category");
