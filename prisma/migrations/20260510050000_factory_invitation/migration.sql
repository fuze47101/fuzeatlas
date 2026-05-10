-- FactoryInvitation (Phase 5B — ROADMAP_v2)
--
-- Brand-to-factory invitation flow. invToken powers a public
-- /factory-invitation/[token] landing page.

CREATE TABLE "FactoryInvitation" (
  "id"                  TEXT NOT NULL,
  "brandId"             TEXT NOT NULL,
  "invitedFactoryName"  TEXT NOT NULL,
  "invitedContactName"  TEXT,
  "invitedContactEmail" TEXT NOT NULL,
  "invitedContactPhone" TEXT,
  "invitedAddress"      TEXT,
  "invitedCountry"      TEXT,
  "notes"               TEXT,
  "status"              TEXT NOT NULL DEFAULT 'PENDING',
  "linkedFactoryId"     TEXT,
  "invitedById"         TEXT,
  "invitedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt"         TIMESTAMP(3),
  "inviteToken"         TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FactoryInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FactoryInvitation_inviteToken_key"
  ON "FactoryInvitation"("inviteToken");

CREATE INDEX "FactoryInvitation_brandId_status_idx"
  ON "FactoryInvitation"("brandId", "status");

CREATE INDEX "FactoryInvitation_invitedContactEmail_idx"
  ON "FactoryInvitation"("invitedContactEmail");

ALTER TABLE "FactoryInvitation"
  ADD CONSTRAINT "FactoryInvitation_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
