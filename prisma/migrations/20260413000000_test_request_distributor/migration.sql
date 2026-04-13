-- Add distributor assignment and pricing tier to TestRequest
ALTER TABLE "TestRequest" ADD COLUMN "distributorId" TEXT;
ALTER TABLE "TestRequest" ADD COLUMN "pricingTier" TEXT;

-- Add foreign key
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index
CREATE INDEX "TestRequest_distributorId_idx" ON "TestRequest"("distributorId");
