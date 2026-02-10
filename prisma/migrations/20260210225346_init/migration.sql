-- CreateEnum
CREATE TYPE "SourceSystem" AS ENUM ('KNACK', 'CSV', 'MANUAL', 'API');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('ICP', 'ANTIBACTERIAL', 'FUNGAL', 'ODOR', 'OTHER');

-- CreateEnum
CREATE TYPE "DocKind" AS ENUM ('REPORT', 'IMAGE', 'SUBMISSION_DOC', 'OTHER');

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL,
    "sourceSystem" "SourceSystem" NOT NULL DEFAULT 'CSV',
    "sourceTable" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "sourceKey" TEXT,
    "raw" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brandId" TEXT,
    "factoryId" TEXT,
    "labId" TEXT,
    "submissionId" TEXT,
    "testRunId" TEXT,

    CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerType" TEXT,
    "status" TEXT,
    "leadSource" TEXT,
    "initialContactDate" TIMESTAMP(3),
    "addressRaw" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chineseName" TEXT,
    "millType" TEXT,
    "specialty" TEXT,
    "annualSales" TEXT,
    "leadSource" TEXT,
    "initialContactDate" TIMESTAMP(3),
    "addressRaw" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chineseName" TEXT,
    "specialty" TEXT,
    "agentForFuze" TEXT,
    "annualSales" TEXT,
    "addressRaw" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "first" TEXT,
    "middle" TEXT,
    "last" TEXT,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressRaw" TEXT,
    "raw" JSONB,
    "brandId" TEXT,
    "factoryId" TEXT,
    "distributorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fabric" (
    "id" TEXT NOT NULL,
    "construction" TEXT,
    "color" TEXT,
    "widthInches" DOUBLE PRECISION,
    "weightGsm" DOUBLE PRECISION,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fabric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricContent" (
    "id" TEXT NOT NULL,
    "fabricId" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "percent" DOUBLE PRECISION,
    "rawText" TEXT,

    CONSTRAINT "FabricContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricSubmission" (
    "id" TEXT NOT NULL,
    "brandId" TEXT,
    "factoryId" TEXT,
    "fabricId" TEXT,
    "fuzeFabricNumber" INTEGER,
    "customerFabricCode" TEXT,
    "factoryFabricCode" TEXT,
    "applicationMethod" TEXT,
    "applicationRecipeRaw" TEXT,
    "padRecipeRaw" TEXT,
    "treatmentLocation" TEXT,
    "applicationDate" TIMESTAMP(3),
    "washTarget" INTEGER,
    "icpSent" BOOLEAN,
    "icpReceived" BOOLEAN,
    "icpPassed" BOOLEAN,
    "abSent" BOOLEAN,
    "abReceived" BOOLEAN,
    "abPassed" BOOLEAN,
    "category" TEXT,
    "programName" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT,
    "labId" TEXT,
    "testType" "TestType" NOT NULL,
    "testMethodRaw" TEXT,
    "testMethodStd" TEXT,
    "testReportNumber" TEXT,
    "testDate" TIMESTAMP(3),
    "postWashDate" TIMESTAMP(3),
    "washCount" INTEGER,
    "washLabelRaw" TEXT,
    "machineType" TEXT,
    "testedMetal" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcpResult" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "agValue" DOUBLE PRECISION,
    "auValue" DOUBLE PRECISION,
    "agRaw" TEXT,
    "auRaw" TEXT,
    "unit" TEXT,

    CONSTRAINT "IcpResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntibacterialResult" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "organism1" TEXT,
    "organism2" TEXT,
    "result1" DOUBLE PRECISION,
    "result2" DOUBLE PRECISION,
    "organism1Raw" TEXT,
    "organism2Raw" TEXT,
    "result1Raw" TEXT,
    "result2Raw" TEXT,
    "pass" BOOLEAN,

    CONSTRAINT "AntibacterialResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "kind" "DocKind" NOT NULL DEFAULT 'REPORT',
    "filename" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "bucket" TEXT,
    "key" TEXT,
    "url" TEXT,
    "submissionId" TEXT,
    "testRunId" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceRecord_sourceTable_idx" ON "SourceRecord"("sourceTable");

-- CreateIndex
CREATE INDEX "SourceRecord_sourceRecordId_idx" ON "SourceRecord"("sourceRecordId");

-- CreateIndex
CREATE INDEX "SourceRecord_brandId_idx" ON "SourceRecord"("brandId");

-- CreateIndex
CREATE INDEX "SourceRecord_factoryId_idx" ON "SourceRecord"("factoryId");

-- CreateIndex
CREATE INDEX "SourceRecord_labId_idx" ON "SourceRecord"("labId");

-- CreateIndex
CREATE INDEX "SourceRecord_submissionId_idx" ON "SourceRecord"("submissionId");

-- CreateIndex
CREATE INDEX "SourceRecord_testRunId_idx" ON "SourceRecord"("testRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Factory_name_idx" ON "Factory"("name");

-- CreateIndex
CREATE INDEX "Distributor_name_idx" ON "Distributor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_name_key" ON "Lab"("name");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_last_idx" ON "Contact"("last");

-- CreateIndex
CREATE INDEX "FabricContent_fabricId_idx" ON "FabricContent"("fabricId");

-- CreateIndex
CREATE INDEX "FabricSubmission_fuzeFabricNumber_idx" ON "FabricSubmission"("fuzeFabricNumber");

-- CreateIndex
CREATE INDEX "FabricSubmission_customerFabricCode_idx" ON "FabricSubmission"("customerFabricCode");

-- CreateIndex
CREATE INDEX "FabricSubmission_factoryFabricCode_idx" ON "FabricSubmission"("factoryFabricCode");

-- CreateIndex
CREATE INDEX "TestRun_testType_idx" ON "TestRun"("testType");

-- CreateIndex
CREATE INDEX "TestRun_testMethodStd_idx" ON "TestRun"("testMethodStd");

-- CreateIndex
CREATE INDEX "TestRun_washCount_idx" ON "TestRun"("washCount");

-- CreateIndex
CREATE INDEX "TestRun_testDate_idx" ON "TestRun"("testDate");

-- CreateIndex
CREATE UNIQUE INDEX "IcpResult_testRunId_key" ON "IcpResult"("testRunId");

-- CreateIndex
CREATE UNIQUE INDEX "AntibacterialResult_testRunId_key" ON "AntibacterialResult"("testRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_key_key" ON "Document"("key");

-- CreateIndex
CREATE INDEX "Document_submissionId_idx" ON "Document"("submissionId");

-- CreateIndex
CREATE INDEX "Document_testRunId_idx" ON "Document"("testRunId");

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FabricSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricContent" ADD CONSTRAINT "FabricContent_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricSubmission" ADD CONSTRAINT "FabricSubmission_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricSubmission" ADD CONSTRAINT "FabricSubmission_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricSubmission" ADD CONSTRAINT "FabricSubmission_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FabricSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IcpResult" ADD CONSTRAINT "IcpResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntibacterialResult" ADD CONSTRAINT "AntibacterialResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FabricSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
