-- Create AccessRequest table for brand portal self-service onboarding
CREATE TABLE IF NOT EXISTS "AccessRequest" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "jobTitle" TEXT,
    "company" TEXT NOT NULL,
    "website" TEXT,
    "fabricTypes" TEXT,
    "annualVolume" TEXT,
    "timeline" TEXT,
    "currentAntimicrobial" TEXT,
    "notes" TEXT,
    "sowId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "deniedReason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on userId
CREATE UNIQUE INDEX IF NOT EXISTS "AccessRequest_userId_key" ON "AccessRequest"("userId");

-- Indexes
CREATE INDEX IF NOT EXISTS "AccessRequest_status_idx" ON "AccessRequest"("status");
CREATE INDEX IF NOT EXISTS "AccessRequest_email_idx" ON "AccessRequest"("email");
CREATE INDEX IF NOT EXISTS "AccessRequest_company_idx" ON "AccessRequest"("company");

-- Foreign keys
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "SOW"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
