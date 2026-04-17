-- BD Portal — Phase 1 schema (#36)
--
-- 1. Add BD_REP to UserRole enum for independent commission reps
--    (Viktor, Barth, Hi-Goal distributor, etc.)
-- 2. Add User.canClaim flag gating who can grab unclaimed brands.
-- 3. Add Brand.lastActivityAt for the 90-day inactivity auto-release.
-- 4. Add Brand.handoffPending so post-PRESENTATION brands flag themselves
--    for Andrew/Scott/Tina triage without forcing the rep to release.
-- 5. Indexes to keep the daily cron fast.
--
-- Safe to re-run: every statement is IF NOT EXISTS / DO $$ guarded.

-- ─────────── UserRole enum: add BD_REP ───────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'BD_REP'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'BD_REP';
  END IF;
END$$;

-- ─────────── User.canClaim ───────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "canClaim" BOOLEAN NOT NULL DEFAULT false;

-- ─────────── Brand.lastActivityAt ───────────
ALTER TABLE "Brand"
  ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

-- Backfill: seed lastActivityAt with updatedAt so existing brands don't all
-- look 90+ days dormant on day one. The cron gives reps a 15-day runway
-- (warn at 75, release at 90) regardless.
UPDATE "Brand"
SET "lastActivityAt" = "updatedAt"
WHERE "lastActivityAt" IS NULL;

-- ─────────── Brand.handoffPending ───────────
ALTER TABLE "Brand"
  ADD COLUMN IF NOT EXISTS "handoffPending" BOOLEAN NOT NULL DEFAULT false;

-- ─────────── Brand.inactivityWarnedAt ───────────
-- Stamped by the 75-day inactivity warn cron so we don't re-warn the same
-- rep every night. Cleared when the claim is released.
ALTER TABLE "Brand"
  ADD COLUMN IF NOT EXISTS "inactivityWarnedAt" TIMESTAMP(3);

-- ─────────── Indexes ───────────
CREATE INDEX IF NOT EXISTS "Brand_salesRepId_lastActivityAt_idx"
  ON "Brand" ("salesRepId", "lastActivityAt");

CREATE INDEX IF NOT EXISTS "Brand_handoffPending_idx"
  ON "Brand" ("handoffPending");
