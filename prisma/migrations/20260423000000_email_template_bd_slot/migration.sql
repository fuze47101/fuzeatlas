-- Add per-user BD Wizard quick-pick slot to EmailTemplate (1-10).
-- See schema comment on EmailTemplate.bdSlot — Andrew 2026-04-22.
--
-- bdSlot is nullable so the vast majority of rows stay unaffected; only
-- templates a rep explicitly pins to a numbered slot get a value.
-- Uniqueness is scoped per-owner (ownerId, bdSlot) so two different BD
-- reps can each have their own slot-1 template without collision.
ALTER TABLE "EmailTemplate" ADD COLUMN "bdSlot" INTEGER;

-- Composite unique: owner + slot. Prisma will generate a matching
-- constraint on next `prisma generate`; the DB-side CREATE UNIQUE INDEX
-- is what actually enforces it at write time.
CREATE UNIQUE INDEX "EmailTemplate_ownerId_bdSlot_key" ON "EmailTemplate"("ownerId", "bdSlot");
