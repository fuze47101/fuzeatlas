-- Add optional preferred lab reference to FuzeTestRequest
-- Factory users select which lab should perform the test at submission time.
-- Nullable so legacy requests (pre-dropdown) remain valid.

ALTER TABLE "FuzeTestRequest"
  ADD COLUMN IF NOT EXISTS "labId" TEXT;

-- Foreign key to Lab — SET NULL on delete so deactivating a lab doesn't
-- orphan historical test requests.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'FuzeTestRequest_labId_fkey'
  ) THEN
    ALTER TABLE "FuzeTestRequest"
      ADD CONSTRAINT "FuzeTestRequest_labId_fkey"
      FOREIGN KEY ("labId") REFERENCES "Lab"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Index for lookups by lab (lab capacity dashboards, etc.)
CREATE INDEX IF NOT EXISTS "FuzeTestRequest_labId_idx" ON "FuzeTestRequest"("labId");
