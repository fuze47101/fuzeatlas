-- AlterTable
ALTER TABLE "User" ADD COLUMN "notifications" TEXT[],
ADD COLUMN "auditLogs" TEXT[],
ADD COLUMN "passwordResets" TEXT[];

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN "engagementId" TEXT;

-- AlterTable
ALTER TABLE "Fabric" ADD COLUMN "shipmentsId" TEXT[];

-- AlterTable
ALTER TABLE "FabricSubmission" ADD COLUMN "shipmentsId" TEXT[];

-- AlterTable
ALTER TABLE "Lab" ADD COLUMN "shipmentsId" TEXT[];

-- AlterTable
ALTER TABLE "TestRequest" ADD COLUMN "shipmentsId" TEXT[];

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "metadata" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "changes" JSON,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SampleShipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fabricId" TEXT,
    "submissionId" TEXT,
    "testRequestId" TEXT,
    "originName" TEXT,
    "originAddress" TEXT,
    "destinationName" TEXT,
    "destinationAddress" TEXT,
    "labId" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "shipDate" DATETIME,
    "estimatedArrival" DATETIME,
    "actualArrival" DATETIME,
    "sampleCount" INTEGER NOT NULL DEFAULT 1,
    "sampleType" TEXT,
    "sampleCondition" TEXT,
    "weight" REAL,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SampleShipment_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SampleShipment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FabricSubmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SampleShipment_testRequestId_fkey" FOREIGN KEY ("testRequestId") REFERENCES "TestRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SampleShipment_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "location" TEXT,
    "handler" TEXT,
    "notes" TEXT,
    "photoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SampleShipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FabricRecipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fabricType" TEXT,
    "fiberContent" TEXT,
    "gsmMin" REAL,
    "gsmMax" REAL,
    "yarnType" TEXT,
    "fuzeTier" TEXT,
    "applicationMethod" TEXT,
    "padPickupPercent" REAL,
    "bathConcentration" REAL,
    "squeezePressure" REAL,
    "dryingTemp" REAL,
    "dryingTime" REAL,
    "curingTemp" REAL,
    "curingTime" REAL,
    "phRange" TEXT,
    "avgIcpAg" REAL,
    "avgReduction" REAL,
    "testMethod" TEXT,
    "passRate" REAL,
    "validatedTestCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "source" TEXT,
    "effectiveDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BrandEngagement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL DEFAULT 50,
    "communicationScore" INTEGER NOT NULL DEFAULT 50,
    "testingVelocity" INTEGER NOT NULL DEFAULT 50,
    "pipelineVelocity" INTEGER NOT NULL DEFAULT 50,
    "paymentScore" INTEGER NOT NULL DEFAULT 50,
    "engagementTrend" TEXT NOT NULL DEFAULT 'STABLE',
    "daysSinceLastContact" INTEGER,
    "testsLast30Days" INTEGER NOT NULL DEFAULT 0,
    "testsLast90Days" INTEGER NOT NULL DEFAULT 0,
    "avgInvoicePayDays" REAL,
    "overdueInvoices" INTEGER NOT NULL DEFAULT 0,
    "stageChanges90Days" INTEGER NOT NULL DEFAULT 0,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrandEngagement_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "SampleShipment_status_idx" ON "SampleShipment"("status");

-- CreateIndex
CREATE INDEX "SampleShipment_trackingNumber_idx" ON "SampleShipment"("trackingNumber");

-- CreateIndex
CREATE INDEX "SampleShipment_fabricId_idx" ON "SampleShipment"("fabricId");

-- CreateIndex
CREATE INDEX "SampleShipment_labId_idx" ON "SampleShipment"("labId");

-- CreateIndex
CREATE INDEX "SampleShipment_testRequestId_idx" ON "SampleShipment"("testRequestId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_idx" ON "ShipmentEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_createdAt_idx" ON "ShipmentEvent"("createdAt");

-- CreateIndex
CREATE INDEX "FabricRecipe_fabricType_idx" ON "FabricRecipe"("fabricType");

-- CreateIndex
CREATE INDEX "FabricRecipe_fiberContent_idx" ON "FabricRecipe"("fiberContent");

-- CreateIndex
CREATE INDEX "FabricRecipe_fuzeTier_idx" ON "FabricRecipe"("fuzeTier");

-- CreateIndex
CREATE INDEX "FabricRecipe_applicationMethod_idx" ON "FabricRecipe"("applicationMethod");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_fromCurrency_toCurrency_effectiveDate_key" ON "ExchangeRate"("fromCurrency", "toCurrency", "effectiveDate");

-- CreateIndex
CREATE INDEX "ExchangeRate_fromCurrency_toCurrency_idx" ON "ExchangeRate"("fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "ExchangeRate_effectiveDate_idx" ON "ExchangeRate"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "BrandEngagement_brandId_key" ON "BrandEngagement"("brandId");

-- CreateIndex
CREATE INDEX "BrandEngagement_overallScore_idx" ON "BrandEngagement"("overallScore");

-- CreateIndex
CREATE INDEX "BrandEngagement_engagementTrend_idx" ON "BrandEngagement"("engagementTrend");
