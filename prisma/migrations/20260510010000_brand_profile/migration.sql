-- BrandProfile (Phase 4B — ROADMAP_v2)
--
-- Customer-facing identity layered on top of the Brand CRM row.
-- 1:1 via unique brandId; cascades on Brand delete.

CREATE TABLE "BrandProfile" (
  "id"            TEXT NOT NULL,
  "brandId"       TEXT NOT NULL,
  "logoUrl"       TEXT,
  "primaryColor"  TEXT,
  "heroHeadline"  TEXT,
  "heroSubhead"   TEXT,
  "supportEmail"  TEXT,
  "supportPhone"  TEXT,
  "departments"   JSONB,
  "publicSlug"    TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrandProfile_brandId_key"
  ON "BrandProfile"("brandId");

CREATE UNIQUE INDEX "BrandProfile_publicSlug_key"
  ON "BrandProfile"("publicSlug");

ALTER TABLE "BrandProfile"
  ADD CONSTRAINT "BrandProfile_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
