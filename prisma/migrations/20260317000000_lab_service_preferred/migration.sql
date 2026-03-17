-- AlterTable: Add preferred fields to LabService
ALTER TABLE "LabService" ADD COLUMN "preferred" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LabService" ADD COLUMN "preferredNote" TEXT;
