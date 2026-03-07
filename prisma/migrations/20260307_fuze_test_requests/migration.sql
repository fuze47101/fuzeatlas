-- CreateTable FuzeTestRequest
CREATE TABLE "FuzeTestRequest" (
    "id" TEXT NOT NULL,
    "fabricId" TEXT NOT NULL,
    "factoryId" TEXT,
    "requestedBy" TEXT,
    "selectedTests" JSONB,
    "totalMoqMeters" DOUBLE PRECISION,
    "controlRequired" BOOLEAN NOT NULL DEFAULT false,
    "trackingNumber" TEXT,
    "shippedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuzeTestRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FuzeTestRequest_fabricId_idx" ON "FuzeTestRequest"("fabricId");

-- CreateIndex
CREATE INDEX "FuzeTestRequest_factoryId_idx" ON "FuzeTestRequest"("factoryId");

-- CreateIndex
CREATE INDEX "FuzeTestRequest_status_idx" ON "FuzeTestRequest"("status");

-- AddForeignKey
ALTER TABLE "FuzeTestRequest" ADD CONSTRAINT "FuzeTestRequest_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuzeTestRequest" ADD CONSTRAINT "FuzeTestRequest_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
