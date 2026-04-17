-- CRM Task model for task-reminder system (#21)
-- Week-before / day-before reminders driven by /api/cron/task-reminders

CREATE TABLE IF NOT EXISTS "CrmTask" (
  "id"                  TEXT PRIMARY KEY,
  "title"               TEXT NOT NULL,
  "notes"               TEXT,
  "dueAt"               TIMESTAMP(3) NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'OPEN',
  "priority"            TEXT NOT NULL DEFAULT 'NORMAL',

  "ownerId"             TEXT NOT NULL,
  "createdById"         TEXT,
  "brandId"             TEXT,

  "completedAt"         TIMESTAMP(3),
  "weekReminderSentAt"  TIMESTAMP(3),
  "dayReminderSentAt"   TIMESTAMP(3),

  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Foreign keys (guarded so re-running is safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmTask_ownerId_fkey'
  ) THEN
    ALTER TABLE "CrmTask"
      ADD CONSTRAINT "CrmTask_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmTask_createdById_fkey'
  ) THEN
    ALTER TABLE "CrmTask"
      ADD CONSTRAINT "CrmTask_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmTask_brandId_fkey'
  ) THEN
    ALTER TABLE "CrmTask"
      ADD CONSTRAINT "CrmTask_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CrmTask_ownerId_status_dueAt_idx" ON "CrmTask"("ownerId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "CrmTask_brandId_idx" ON "CrmTask"("brandId");
CREATE INDEX IF NOT EXISTS "CrmTask_status_dueAt_idx" ON "CrmTask"("status", "dueAt");
