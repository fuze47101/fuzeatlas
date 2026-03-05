-- Create TestRequest table for test approval workflow with auto PO generation
CREATE TABLE IF NOT EXISTS "TestRequest" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "poDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brandId" TEXT,
    "fabricId" TEXT,
    "submissionId" TEXT,
    "projectId" TEXT,
    "sowId" TEXT,
    "labId" TEXT NOT NULL,
    "labCustomerNumber" TEXT,
    "labAccountRef" TEXT,
    "fuzeFabricNumber" TEXT,
    "customerFabricCode" TEXT,
    "factoryFabricCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requestedCompletionDate" TIMESTAMP(3),
    "actualCompletionDate" TIMESTAMP(3),
    "specialInstructions" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRequest_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on PO number
CREATE UNIQUE INDEX IF NOT EXISTS "TestRequest_poNumber_key" ON "TestRequest"("poNumber");

-- Indexes
CREATE INDEX IF NOT EXISTS "TestRequest_status_idx" ON "TestRequest"("status");
CREATE INDEX IF NOT EXISTS "TestRequest_brandId_idx" ON "TestRequest"("brandId");
CREATE INDEX IF NOT EXISTS "TestRequest_labId_idx" ON "TestRequest"("labId");
CREATE INDEX IF NOT EXISTS "TestRequest_fabricId_idx" ON "TestRequest"("fabricId");
CREATE INDEX IF NOT EXISTS "TestRequest_projectId_idx" ON "TestRequest"("projectId");
CREATE INDEX IF NOT EXISTS "TestRequest_requestedById_idx" ON "TestRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "TestRequest_approvedById_idx" ON "TestRequest"("approvedById");
CREATE INDEX IF NOT EXISTS "TestRequest_poDate_idx" ON "TestRequest"("poDate");
CREATE INDEX IF NOT EXISTS "TestRequest_priority_idx" ON "TestRequest"("priority");

-- Foreign keys
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FabricSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "SOW"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create TestRequestLine table for individual test line items
CREATE TABLE IF NOT EXISTS "TestRequestLine" (
    "id" TEXT NOT NULL,
    "testRequestId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "testMethod" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION,
    "totalPrice" DOUBLE PRECISION,
    "rush" BOOLEAN NOT NULL DEFAULT false,
    "rushPrice" DOUBLE PRECISION,
    "estimatedDays" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "testRunId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRequestLine_pkey" PRIMARY KEY ("id")
);

-- Indexes for TestRequestLine
CREATE INDEX IF NOT EXISTS "TestRequestLine_testRequestId_idx" ON "TestRequestLine"("testRequestId");
CREATE INDEX IF NOT EXISTS "TestRequestLine_testRunId_idx" ON "TestRequestLine"("testRunId");
CREATE INDEX IF NOT EXISTS "TestRequestLine_status_idx" ON "TestRequestLine"("status");

-- Foreign keys for TestRequestLine
ALTER TABLE "TestRequestLine" ADD CONSTRAINT "TestRequestLine_testRequestId_fkey" FOREIGN KEY ("testRequestId") REFERENCES "TestRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestRequestLine" ADD CONSTRAINT "TestRequestLine_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
