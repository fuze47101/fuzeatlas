-- LabFormTemplate (Phase 4E — ROADMAP_v2)
--
-- Configurable lab intake / result / shipping forms. Replaces the
-- per-lab hardcoded forms with a JSON-driven schema the ICP sample-
-- prep wizard renders dynamically.

CREATE TABLE "LabFormTemplate" (
  "id"        TEXT NOT NULL,
  "labId"     TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "fields"    JSONB NOT NULL,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabFormTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LabFormTemplate_labId_active_idx"
  ON "LabFormTemplate"("labId", "active");

ALTER TABLE "LabFormTemplate"
  ADD CONSTRAINT "LabFormTemplate_labId_fkey"
  FOREIGN KEY ("labId") REFERENCES "Lab"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
