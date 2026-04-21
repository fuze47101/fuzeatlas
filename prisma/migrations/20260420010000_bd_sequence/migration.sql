-- BD Wizard Phase 3 — Long-funnel orchestration
--
-- Adds the multi-step sequence engine on top of the BD Wizard. A BDSequence
-- represents one rep's outbound campaign against one contact at one brand.
-- Steps tick into "ready" status as their scheduledFor passes; the rep then
-- approves and sends each one (no auto-send, per Andrew's locked decision
-- 2026-04-20: "Always queue for review").
--
-- Cadence (default, hardcoded in src/lib/bd-sequence.ts):
--   Step 0 — LinkedIn connect (D0,  manual)   skipped at creation
--   Step 1 — Email             (D2,  via wizard's first send) → marked sent
--   Step 2 — LinkedIn DM       (D5,  manual)
--   Step 3 — Email             (D9,  draft + queue for rep)
--   Step 4 — Paid retargeting  (D14, auto flag on Brand)
--   Step 5 — Tradeshow         (D30, manual at next show)
--
-- Sequences are created by /api/admin/bd/wizard/send after a successful
-- first-touch email. The cron at /api/cron/bd-sequence-tick runs hourly
-- and walks pending steps whose scheduledFor has passed, generating drafts
-- and creating CrmTasks on the rep's queue.

-- 1. New columns on Brand for the paid-retargeting step ─────────────────
ALTER TABLE "Brand"
  ADD COLUMN "paidAudienceTagged"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "paidAudienceTaggedAt" TIMESTAMP(3);

-- 2. BDSequence table ───────────────────────────────────────────────────
CREATE TABLE "BDSequence" (
  "id"           TEXT NOT NULL,
  "brandId"      TEXT NOT NULL,
  "contactId"    TEXT NOT NULL,
  "repId"        TEXT NOT NULL,
  "cadenceKey"   TEXT NOT NULL DEFAULT 'default',
  "status"       TEXT NOT NULL DEFAULT 'active',
  "exitReason"   TEXT,
  "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"  TIMESTAMP(3),
  "totalSteps"   INTEGER NOT NULL DEFAULT 0,
  "sentSteps"    INTEGER NOT NULL DEFAULT 0,
  "skippedSteps" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BDSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BDSequence_brandId_contactId_repId_status_key"
  ON "BDSequence"("brandId", "contactId", "repId", "status");
CREATE INDEX "BDSequence_repId_status_idx"  ON "BDSequence"("repId", "status");
CREATE INDEX "BDSequence_brandId_idx"       ON "BDSequence"("brandId");
CREATE INDEX "BDSequence_status_idx"        ON "BDSequence"("status");

ALTER TABLE "BDSequence"
  ADD CONSTRAINT "BDSequence_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BDSequence_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BDSequence_repId_fkey"
    FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. BDSequenceStep table ───────────────────────────────────────────────
CREATE TABLE "BDSequenceStep" (
  "id"               TEXT NOT NULL,
  "sequenceId"       TEXT NOT NULL,
  "stepIndex"        INTEGER NOT NULL,
  "channel"          TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "scheduledFor"     TIMESTAMP(3) NOT NULL,
  "readyAt"          TIMESTAMP(3),
  "sentAt"           TIMESTAMP(3),
  "skippedAt"        TIMESTAMP(3),
  "failedAt"         TIMESTAMP(3),
  "failReason"       TEXT,
  "draftSubject"     TEXT,
  "draftBody"        TEXT,
  "outreachMessageId" TEXT,
  "crmTaskId"        TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BDSequenceStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BDSequenceStep_status_scheduledFor_idx"
  ON "BDSequenceStep"("status", "scheduledFor");
CREATE INDEX "BDSequenceStep_sequenceId_stepIndex_idx"
  ON "BDSequenceStep"("sequenceId", "stepIndex");

ALTER TABLE "BDSequenceStep"
  ADD CONSTRAINT "BDSequenceStep_sequenceId_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "BDSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
