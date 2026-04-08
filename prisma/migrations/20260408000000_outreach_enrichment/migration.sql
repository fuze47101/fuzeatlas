-- Add enrichment fields to Contact
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "personalEmail" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "seniority" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "emailStatus" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "enrichedAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "enrichmentSource" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "apolloId" TEXT;

-- Add outreach tracking fields to Contact
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "outreachStatus" TEXT DEFAULT 'not_contacted';
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "lastContactedAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "lastResponseAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "outreachCount" INTEGER NOT NULL DEFAULT 0;

-- Add categorization fields to Contact
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "vertical" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "decisionMaker" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "companyRevenue" TEXT;

-- Contact indexes for outreach/enrichment
CREATE INDEX IF NOT EXISTS "Contact_outreachStatus_idx" ON "Contact"("outreachStatus");
CREATE INDEX IF NOT EXISTS "Contact_emailStatus_idx" ON "Contact"("emailStatus");
CREATE INDEX IF NOT EXISTS "Contact_vertical_idx" ON "Contact"("vertical");

-- Create OutreachMessage table
CREATE TABLE IF NOT EXISTS "OutreachMessage" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "failReason" TEXT,
    "externalId" TEXT,
    "sentBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachMessage_pkey" PRIMARY KEY ("id")
);

-- OutreachMessage indexes
CREATE INDEX IF NOT EXISTS "OutreachMessage_contactId_idx" ON "OutreachMessage"("contactId");
CREATE INDEX IF NOT EXISTS "OutreachMessage_channel_idx" ON "OutreachMessage"("channel");
CREATE INDEX IF NOT EXISTS "OutreachMessage_sentAt_idx" ON "OutreachMessage"("sentAt");

-- OutreachMessage foreign key
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
