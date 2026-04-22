-- CRM: Saved email templates (ticket #24)
--
-- Reps repeatedly compose the same intro / follow-up / nudge / thank-you
-- emails. This adds a first-class EmailTemplate object, scoped three ways:
--   PRIVATE — only the owner sees it (default)
--   SHARED  — visible to all internal users; editable by owner + admin
--   GLOBAL  — admin-curated, visible to everyone, owner is null
--
-- Variable substitution (e.g. {firstName}, {company}) is applied client-side
-- at compose time by src/lib/email-template-vars.ts. Unknown tokens are left
-- as literals so reps spot the gaps before sending.
--
-- Soft-delete via archivedAt — keeps templateId references in
-- OutreachMessage stable if we ever decide to back-link them.

-- 1. Enum ────────────────────────────────────────────────────────────────
CREATE TYPE "EmailTemplateScope" AS ENUM ('PRIVATE', 'SHARED', 'GLOBAL');

-- 2. EmailTemplate table ────────────────────────────────────────────────
CREATE TABLE "EmailTemplate" (
  "id"         TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "subject"    TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "category"   TEXT,
  "scope"      "EmailTemplateScope" NOT NULL DEFAULT 'PRIVATE',
  "ownerId"    TEXT,
  "archivedAt" TIMESTAMP(3),
  "useCount"   INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes ────────────────────────────────────────────────────────────
-- Picker query is roughly:
--   WHERE archivedAt IS NULL
--     AND ( ownerId = $me OR scope IN ('SHARED','GLOBAL') )
--   ORDER BY useCount DESC
-- so (ownerId, scope) and (scope, archivedAt) cover the hot paths.
CREATE INDEX "EmailTemplate_ownerId_scope_idx"
  ON "EmailTemplate"("ownerId", "scope");
CREATE INDEX "EmailTemplate_scope_archivedAt_idx"
  ON "EmailTemplate"("scope", "archivedAt");
CREATE INDEX "EmailTemplate_category_idx"
  ON "EmailTemplate"("category");

-- 4. FK to User (SetNull so deleting a user demotes their PRIVATE
--    templates instead of dropping them — admin can promote/reassign).
ALTER TABLE "EmailTemplate"
  ADD CONSTRAINT "EmailTemplate_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
