-- AddColumn requestType to AccessRequest
ALTER TABLE "AccessRequest" ADD COLUMN "requestType" TEXT NOT NULL DEFAULT 'BRAND';

-- AddColumn factory-specific fields to AccessRequest
ALTER TABLE "AccessRequest" ADD COLUMN "factoryLocation" TEXT;
ALTER TABLE "AccessRequest" ADD COLUMN "capabilities" TEXT;
ALTER TABLE "AccessRequest" ADD COLUMN "certifications" TEXT;
ALTER TABLE "AccessRequest" ADD COLUMN "productTypes" TEXT;
ALTER TABLE "AccessRequest" ADD COLUMN "monthlyCapacity" TEXT;
ALTER TABLE "AccessRequest" ADD COLUMN "fuzeApplicationMethod" TEXT;

-- AddColumn factoryId to AccessRequest
ALTER TABLE "AccessRequest" ADD COLUMN "factoryId" TEXT;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccessRequest_requestType_idx" ON "AccessRequest"("requestType");
