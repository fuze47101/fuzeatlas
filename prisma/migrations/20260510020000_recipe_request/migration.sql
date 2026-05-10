-- RecipeRequest (Phase 4C — ROADMAP_v2)
--
-- Brand-to-factory recipe handoff as a first-class request.

CREATE TABLE "RecipeRequest" (
  "id"                TEXT NOT NULL,
  "brandId"           TEXT NOT NULL,
  "factoryId"         TEXT NOT NULL,
  "fabricId"          TEXT,
  "requestedTier"     TEXT,
  "notes"             TEXT,
  "status"            TEXT NOT NULL DEFAULT 'OPEN',
  "requestedById"     TEXT,
  "requestedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fulfilledRecipeId" TEXT,
  "fulfilledAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecipeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecipeRequest_brandId_status_idx"
  ON "RecipeRequest"("brandId", "status");

CREATE INDEX "RecipeRequest_factoryId_status_idx"
  ON "RecipeRequest"("factoryId", "status");

CREATE INDEX "RecipeRequest_fabricId_idx"
  ON "RecipeRequest"("fabricId");

ALTER TABLE "RecipeRequest"
  ADD CONSTRAINT "RecipeRequest_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecipeRequest"
  ADD CONSTRAINT "RecipeRequest_factoryId_fkey"
  FOREIGN KEY ("factoryId") REFERENCES "Factory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
