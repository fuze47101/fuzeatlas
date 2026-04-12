-- AlterTable: Make labId optional on TestRequest
-- Factory-initiated test requests don't have a lab assigned until admin approval
ALTER TABLE "TestRequest" ALTER COLUMN "labId" DROP NOT NULL;
