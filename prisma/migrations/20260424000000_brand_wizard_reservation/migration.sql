-- BD Wizard concurrency hardening — Andrew 2026-04-23.
--
-- Soft-reservation lock on Brand so Ryan, Barth, and Andrew can't all
-- land on the same brand when they kick off the wizard in the same
-- 30-second window. The permanent "who owns this brand" flip still lives
-- on Brand.salesRepId (stamped by /api/admin/bd/wizard/send). This
-- reservation layer is temporary — 30 min TTL — and gets released either
-- by the rep clicking Next or by the TTL expiring.
--
-- Design: reservedBy + reservedUntil are both NULL by default. The pick
-- endpoint (next-brand) conditionally sets them via updateMany where
-- (reservedUntil IS NULL OR reservedUntil < NOW() OR reservedBy = :me).
-- First writer wins; the others' updateMany returns count=0 and the
-- loop advances to the #2 candidate.
ALTER TABLE "Brand" ADD COLUMN "reservedBy" TEXT;
ALTER TABLE "Brand" ADD COLUMN "reservedUntil" TIMESTAMP(3);

-- Index lets next-brand's WHERE clause filter stale reservations without
-- a full scan. We don't bother with a composite (reservedBy, reservedUntil)
-- because queue scans only ever care about "is anyone still holding this"
-- and look up by time, not by owner.
CREATE INDEX "Brand_reservedUntil_idx" ON "Brand"("reservedUntil");
