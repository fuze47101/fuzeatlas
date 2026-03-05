-- Add customer number to Lab
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "customerNumber" TEXT;

-- Add LAB_FORM to DocKind enum
ALTER TYPE "DocKind" ADD VALUE IF NOT EXISTS 'LAB_FORM';

-- Add labId to Document
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "labId" TEXT;
ALTER TABLE "Document" ADD CONSTRAINT "Document_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create LabService table
CREATE TABLE IF NOT EXISTS "LabService" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "testMethod" TEXT,
    "description" TEXT,
    "priceUSD" DOUBLE PRECISION,
    "listPriceUSD" DOUBLE PRECISION,
    "turnaroundDays" INTEGER,
    "rushPriceUSD" DOUBLE PRECISION,
    "rushDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabService_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "LabService_labId_testType_testMethod_key" ON "LabService"("labId", "testType", "testMethod");
CREATE INDEX IF NOT EXISTS "LabService_labId_idx" ON "LabService"("labId");

-- Add foreign key
ALTER TABLE "LabService" ADD CONSTRAINT "LabService_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
