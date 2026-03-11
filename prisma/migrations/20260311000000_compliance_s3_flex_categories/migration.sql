-- AlterTable: Add s3Key column for S3-based file storage
ALTER TABLE "ComplianceDocument" ADD COLUMN "s3Key" TEXT;

-- AlterTable: Convert category from ComplianceCategory enum to plain text (String)
-- Step 1: Add a temporary text column
ALTER TABLE "ComplianceDocument" ADD COLUMN "category_text" TEXT;

-- Step 2: Copy enum values as text
UPDATE "ComplianceDocument" SET "category_text" = "category"::TEXT;

-- Step 3: Drop the old enum column
ALTER TABLE "ComplianceDocument" DROP COLUMN "category";

-- Step 4: Rename the text column
ALTER TABLE "ComplianceDocument" RENAME COLUMN "category_text" TO "category";

-- Step 5: Set default and NOT NULL
ALTER TABLE "ComplianceDocument" ALTER COLUMN "category" SET DEFAULT 'OTHER';
ALTER TABLE "ComplianceDocument" ALTER COLUMN "category" SET NOT NULL;

-- Step 6: Drop the enum type (no longer used)
DROP TYPE IF EXISTS "ComplianceCategory";

-- Recreate index on category
CREATE INDEX IF NOT EXISTS "ComplianceDocument_category_idx" ON "ComplianceDocument"("category");
