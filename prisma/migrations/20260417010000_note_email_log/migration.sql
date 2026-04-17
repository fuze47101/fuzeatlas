-- Add email-log + contact fields to Note so outbound/inbound CRM emails
-- surface in the existing notes timeline (noteType = "EMAIL")

ALTER TABLE "Note" ADD COLUMN     "contactId" TEXT;
ALTER TABLE "Note" ADD COLUMN     "emailDirection" TEXT;
ALTER TABLE "Note" ADD COLUMN     "emailSubject" TEXT;
ALTER TABLE "Note" ADD COLUMN     "emailFrom" TEXT;
ALTER TABLE "Note" ADD COLUMN     "emailTo" TEXT;
ALTER TABLE "Note" ADD COLUMN     "emailCc" TEXT;
ALTER TABLE "Note" ADD COLUMN     "emailMessageId" TEXT;

-- FK: Note → Contact (ON DELETE SET NULL so deleting a contact doesn't wipe history)
ALTER TABLE "Note"
  ADD CONSTRAINT "Note_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Dedup: one Note per inbound message
CREATE UNIQUE INDEX "Note_emailMessageId_key" ON "Note"("emailMessageId");

-- Timeline lookups
CREATE INDEX "Note_contactId_idx" ON "Note"("contactId");
