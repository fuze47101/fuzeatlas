-- CreateEnum: PipelineStage
DO $$ BEGIN
 CREATE TYPE "PipelineStage" AS ENUM ('LEAD', 'PRESENTATION', 'BRAND_TESTING', 'FACTORY_ONBOARDING', 'FACTORY_TESTING', 'PRODUCTION', 'BRAND_EXPANSION', 'ARCHIVE', 'CUSTOMER_WON');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: TestStatus
DO $$ BEGIN
 CREATE TYPE "TestStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'RETEST', 'PASSED_COMPLETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: ComplianceCategory
DO $$ BEGIN
 CREATE TYPE "ComplianceCategory" AS ENUM ('SDS_MSDS', 'TDS', 'BLUESIGN', 'ZDHC', 'OEKO_TEX', 'GOTS', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: SOWStatus
DO $$ BEGIN
 CREATE TYPE "SOWStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'ACTIVE', 'COMPLETE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: UserRole
DO $$ BEGIN
 CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYEE', 'SALES_MANAGER', 'SALES_REP', 'FABRIC_MANAGER', 'TESTING_MANAGER', 'FACTORY_MANAGER', 'FACTORY_USER', 'BRAND_USER', 'DISTRIBUTOR_USER', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: UserStatus
DO $$ BEGIN
 CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Update TestType enum to add missing values
ALTER TYPE "TestType" ADD VALUE IF NOT EXISTS 'UV';
ALTER TYPE "TestType" ADD VALUE IF NOT EXISTS 'MICROFIBER';

-- Update DocKind enum to add LAB_FORM
ALTER TYPE "DocKind" ADD VALUE IF NOT EXISTS 'SOW_DOC';
ALTER TYPE "DocKind" ADD VALUE IF NOT EXISTS 'LAB_FORM';

-- CreateTable: User (must come first as other tables reference it)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PUBLIC',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "salesManagerId" TEXT,
    "brandId" TEXT,
    "factoryId" TEXT,
    "distributorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BrandFactory
CREATE TABLE IF NOT EXISTS "BrandFactory" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandFactory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompetitorPriceOverride
CREATE TABLE IF NOT EXISTS "CompetitorPriceOverride" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "chemicalPricePerKg" DOUBLE PRECISION,
    "chemicalPriceSource" TEXT,
    "chemicalPriceDate" TIMESTAMP(3),
    "binderPricePerKg" DOUBLE PRECISION,
    "estimatedCostPerMeterLow" DOUBLE PRECISION,
    "estimatedCostPerMeterHigh" DOUBLE PRECISION,
    "estimatedCostPerMeterTypical" DOUBLE PRECISION,
    "retreatmentCostMultiplier" DOUBLE PRECISION,
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorPriceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FungalResult
CREATE TABLE IF NOT EXISTS "FungalResult" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "writtenResult" TEXT,
    "pass" BOOLEAN,
    "raw" TEXT,

    CONSTRAINT "FungalResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OdorResult
CREATE TABLE IF NOT EXISTS "OdorResult" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "testedOdor" TEXT,
    "result" TEXT,
    "pass" BOOLEAN,

    CONSTRAINT "OdorResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MaterialAlias
CREATE TABLE IF NOT EXISTS "MaterialAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,

    CONSTRAINT "MaterialAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Note
CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "content" TEXT NOT NULL,
    "noteType" TEXT,
    "brandId" TEXT,
    "userId" TEXT,
    "contactName" TEXT,
    "taskStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Product
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productType" TEXT,
    "sku" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Project
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" TEXT,
    "description" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'DEVELOPMENT',
    "projectedValue" DOUBLE PRECISION,
    "actualValue" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "probability" INTEGER NOT NULL DEFAULT 50,
    "fuzeTier" TEXT,
    "annualVolumeMeters" DOUBLE PRECISION,
    "annualFuzeLiters" DOUBLE PRECISION,
    "factoryId" TEXT,
    "distributorId" TEXT,
    "expectedProductionDate" TIMESTAMP(3),
    "actualProductionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Invoice
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "notes" TEXT,
    "distributorId" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "brandId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SOW
CREATE TABLE IF NOT EXISTS "SOW" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT,
    "expectations" TEXT,
    "performanceCriteria" TEXT,
    "pricingTerms" TEXT,
    "costControls" TEXT,
    "signatory" TEXT,
    "signatoryTitle" TEXT,
    "signatoryEmail" TEXT,
    "status" "SOWStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOW_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SOWMilestone
CREATE TABLE IF NOT EXISTS "SOWMilestone" (
    "id" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SOWMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SOWProduct
CREATE TABLE IF NOT EXISTS "SOWProduct" (
    "id" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SOWProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccessRequest
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
    "requestType" TEXT NOT NULL DEFAULT 'BRAND',
    "factoryLocation" TEXT,
    "capabilities" TEXT,
    "certifications" TEXT,
    "productTypes" TEXT,
    "monthlyCapacity" TEXT,
    "fuzeApplicationMethod" TEXT,
    "factoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TestRequest
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TestRequestLine
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LabService
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabService_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SampleShipment
CREATE TABLE IF NOT EXISTS "SampleShipment" (
    "id" TEXT NOT NULL,
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
    "shipDate" TIMESTAMP(3),
    "estimatedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "sampleCount" INTEGER NOT NULL DEFAULT 1,
    "sampleType" TEXT,
    "sampleCondition" TEXT,
    "weight" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ShipmentEvent
CREATE TABLE IF NOT EXISTS "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "location" TEXT,
    "handler" TEXT,
    "notes" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FabricRecipe
CREATE TABLE IF NOT EXISTS "FabricRecipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fabricType" TEXT,
    "fiberContent" TEXT,
    "gsmMin" DOUBLE PRECISION,
    "gsmMax" DOUBLE PRECISION,
    "yarnType" TEXT,
    "fuzeTier" TEXT,
    "applicationMethod" TEXT,
    "padPickupPercent" DOUBLE PRECISION,
    "bathConcentration" DOUBLE PRECISION,
    "squeezePressure" DOUBLE PRECISION,
    "dryingTemp" DOUBLE PRECISION,
    "dryingTime" DOUBLE PRECISION,
    "curingTemp" DOUBLE PRECISION,
    "curingTime" DOUBLE PRECISION,
    "phRange" TEXT,
    "avgIcpAg" DOUBLE PRECISION,
    "avgReduction" DOUBLE PRECISION,
    "testMethod" TEXT,
    "passRate" DOUBLE PRECISION,
    "validatedTestCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ExchangeRate
CREATE TABLE IF NOT EXISTS "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BrandEngagement
CREATE TABLE IF NOT EXISTS "BrandEngagement" (
    "id" TEXT NOT NULL,
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
    "avgInvoicePayDays" DOUBLE PRECISION,
    "overdueInvoices" INTEGER NOT NULL DEFAULT 0,
    "stageChanges90Days" INTEGER NOT NULL DEFAULT 0,
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Meeting
CREATE TABLE IF NOT EXISTS "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meetingType" TEXT NOT NULL DEFAULT 'INTERNAL',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei',
    "location" TEXT,
    "teamsLink" TEXT,
    "calendarUrl" TEXT,
    "brandId" TEXT,
    "projectId" TEXT,
    "pipelineStage" TEXT,
    "autoScheduled" BOOLEAN NOT NULL DEFAULT false,
    "organizerId" TEXT,
    "attendees" JSONB,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PasswordResetToken
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FuzeTestRequest
CREATE TABLE IF NOT EXISTS "FuzeTestRequest" (
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

-- CreateTable: ComplianceDocument
CREATE TABLE IF NOT EXISTS "ComplianceDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ComplianceCategory" NOT NULL DEFAULT 'OTHER',
    "version" TEXT,
    "filename" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "url" TEXT,
    "data" TEXT,
    "visibleTo" JSONB NOT NULL DEFAULT '["ADMIN","EMPLOYEE","BRAND_USER","FACTORY_USER","FACTORY_MANAGER"]',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AvailabilityConfig
CREATE TABLE IF NOT EXISTS "AvailabilityConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "availableDays" JSONB NOT NULL DEFAULT '[2,4]',
    "startHour" INTEGER NOT NULL DEFAULT 9,
    "endHour" INTEGER NOT NULL DEFAULT 17,
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei',
    "blockedDates" JSONB NOT NULL DEFAULT '[]',
    "maxBookingsPerDay" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityConfig_pkey" PRIMARY KEY ("id")
);

-- Update Brand table to add missing columns
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "knackId" TEXT UNIQUE;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "pipelineStage" "PipelineStage" DEFAULT 'LEAD';
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "leadReferralSource" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "dateOfInitialContact" TIMESTAMP(3);
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "linkedInProfile" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "backgroundInfo" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "researchData" JSONB;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "researchDate" TIMESTAMP(3);
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "projectType" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "projectDescription" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "presentationDate" TIMESTAMP(3);
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "forecast" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "deliverables" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "salesRepId" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "engagementId" TEXT;

-- Update Factory table to add missing columns
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "knackId" TEXT UNIQUE;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "purchasing" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "secondaryCountry" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "development" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "presentationComplete" BOOLEAN;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "customerType" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "brandNominated" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "productTypes" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "capabilities" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "certifications" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "fabricTypes" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "moqMeters" INTEGER;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "capacityMtMonth" INTEGER;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "yearEstablished" INTEGER;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "employeeCount" INTEGER;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "fuzeEnabled" BOOLEAN;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "fuzeApplications" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "profileComplete" BOOLEAN DEFAULT false;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "distributorId" TEXT;
ALTER TABLE "Factory" ADD COLUMN IF NOT EXISTS "salesRepId" TEXT;

-- Update Distributor table to add missing columns
ALTER TABLE "Distributor" ADD COLUMN IF NOT EXISTS "knackId" TEXT UNIQUE;
ALTER TABLE "Distributor" ADD COLUMN IF NOT EXISTS "country" TEXT;

-- Update Lab table to add missing columns
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "knackId" TEXT UNIQUE;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "accreditations" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "capabilities" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "icpApproved" BOOLEAN DEFAULT false;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "abApproved" BOOLEAN DEFAULT false;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "fungalApproved" BOOLEAN DEFAULT false;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "odorApproved" BOOLEAN DEFAULT false;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "uvApproved" BOOLEAN DEFAULT false;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT true;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "customerNumber" TEXT;

-- Update Contact table to add missing columns
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "address" TEXT;

-- Update Fabric table to add missing columns
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "fuzeNumber" INTEGER UNIQUE;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "customerCode" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "factoryCode" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "yarnType" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "finishNote" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "brandId" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "factoryId" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "endUse" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "targetFuzeTier" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "annualVolume" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "quantityType" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "quantityUnit" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "batchLotNumber" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "thickness" DOUBLE PRECISION;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "shrinkageLength" DOUBLE PRECISION;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "shrinkageWidth" DOUBLE PRECISION;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "fabricCategory" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "knitStitchType" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "weavePattern" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "gauge" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "threadCountWarp" INTEGER;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "threadCountWeft" INTEGER;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "pretreatment" JSONB;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "fabricPh" DOUBLE PRECISION;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "dyeApplied" BOOLEAN;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "dyeStage" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "dyeClass" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "dyeDetails" JSONB;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "finishSoftener" JSONB;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "finishRepellent" JSONB;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "finishWicking" JSONB;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "finishWrinkleFree" JSONB;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "finishOther" JSONB;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "intakeFormId" TEXT;
ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "intakeParsedAt" TIMESTAMP(3);

-- Update FabricContent table
ALTER TABLE "FabricContent" ADD COLUMN IF NOT EXISTS "material" TEXT;
ALTER TABLE "FabricContent" ADD COLUMN IF NOT EXISTS "percent" DOUBLE PRECISION;
ALTER TABLE "FabricContent" ADD COLUMN IF NOT EXISTS "rawText" TEXT;

-- Update FabricSubmission table to add missing columns
ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "developmentStage" TEXT;
ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "testStatus" TEXT;
ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "progressPercent" DOUBLE PRECISION;

-- Update TestRun table to add missing columns
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "testNumber" INTEGER;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "fuzeInternalReportNumber" TEXT;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "postWashReportNumber" TEXT;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "agSerialNumber" TEXT;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "auSerialNumber" TEXT;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "fungalSerialNumber" TEXT;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "testNumberInReport" INTEGER;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "aiReviewData" JSONB;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "aiReviewDate" TIMESTAMP(3);
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "aiReviewNotes" TEXT;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "brandVisible" BOOLEAN DEFAULT false;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "brandApprovedById" TEXT;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "brandApprovedAt" TIMESTAMP(3);
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- Update AntibacterialResult table to add missing columns
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "organism" TEXT;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "strainNumber" TEXT;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "testMethodStd" TEXT;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "brothMedia" TEXT;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "surfactant" TEXT;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "sterilization" TEXT;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "contactTime" TEXT;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "incubationTemp" TEXT;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "agarMedium" TEXT;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "inoculumCFU" DOUBLE PRECISION;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "controlCFU" DOUBLE PRECISION;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "treatedCFU" DOUBLE PRECISION;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "percentReduction" DOUBLE PRECISION;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "growthValue" DOUBLE PRECISION;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "activityValue" DOUBLE PRECISION;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "methodPass" BOOLEAN;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "methodPassReason" TEXT;
ALTER TABLE "AntibacterialResult" ADD COLUMN IF NOT EXISTS "rawExtracted" JSONB;

-- Update Document table to add missing columns
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "labId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sowId" TEXT;

-- Update SourceRecord table to add missing column
ALTER TABLE "SourceRecord" ADD COLUMN IF NOT EXISTS "distributorId" TEXT;

-- Now create all indexes in proper order

-- User indexes
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- BrandFactory indexes
CREATE UNIQUE INDEX IF NOT EXISTS "BrandFactory_brandId_factoryId_key" ON "BrandFactory"("brandId", "factoryId");
CREATE INDEX IF NOT EXISTS "BrandFactory_brandId_idx" ON "BrandFactory"("brandId");
CREATE INDEX IF NOT EXISTS "BrandFactory_factoryId_idx" ON "BrandFactory"("factoryId");

-- CompetitorPriceOverride indexes
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorPriceOverride_competitorId_key" ON "CompetitorPriceOverride"("competitorId");
CREATE INDEX IF NOT EXISTS "CompetitorPriceOverride_competitorId_idx" ON "CompetitorPriceOverride"("competitorId");

-- FungalResult indexes
CREATE UNIQUE INDEX IF NOT EXISTS "FungalResult_testRunId_key" ON "FungalResult"("testRunId");

-- OdorResult indexes
CREATE UNIQUE INDEX IF NOT EXISTS "OdorResult_testRunId_key" ON "OdorResult"("testRunId");

-- MaterialAlias indexes
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialAlias_alias_key" ON "MaterialAlias"("alias");
CREATE INDEX IF NOT EXISTS "MaterialAlias_canonicalName_idx" ON "MaterialAlias"("canonicalName");

-- Note indexes
CREATE INDEX IF NOT EXISTS "Note_brandId_idx" ON "Note"("brandId");
CREATE INDEX IF NOT EXISTS "Note_date_idx" ON "Note"("date");

-- Product indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Product_brandId_name_key" ON "Product"("brandId", "name");
CREATE INDEX IF NOT EXISTS "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX IF NOT EXISTS "Product_sku_idx" ON "Product"("sku");

-- Project indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Project_name_brandId_key" ON "Project"("name", "brandId");
CREATE INDEX IF NOT EXISTS "Project_brandId_idx" ON "Project"("brandId");
CREATE INDEX IF NOT EXISTS "Project_name_idx" ON "Project"("name");
CREATE INDEX IF NOT EXISTS "Project_stage_idx" ON "Project"("stage");
CREATE INDEX IF NOT EXISTS "Project_factoryId_idx" ON "Project"("factoryId");
CREATE INDEX IF NOT EXISTS "Project_distributorId_idx" ON "Project"("distributorId");

-- Invoice indexes
CREATE INDEX IF NOT EXISTS "Invoice_distributorId_idx" ON "Invoice"("distributorId");
CREATE INDEX IF NOT EXISTS "Invoice_factoryId_idx" ON "Invoice"("factoryId");
CREATE INDEX IF NOT EXISTS "Invoice_brandId_idx" ON "Invoice"("brandId");
CREATE INDEX IF NOT EXISTS "Invoice_projectId_idx" ON "Invoice"("projectId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");

-- SOW indexes
CREATE INDEX IF NOT EXISTS "SOW_brandId_idx" ON "SOW"("brandId");
CREATE INDEX IF NOT EXISTS "SOW_status_idx" ON "SOW"("status");

-- SOWMilestone indexes
CREATE INDEX IF NOT EXISTS "SOWMilestone_sowId_idx" ON "SOWMilestone"("sowId");

-- SOWProduct indexes
CREATE UNIQUE INDEX IF NOT EXISTS "SOWProduct_sowId_productId_key" ON "SOWProduct"("sowId", "productId");
CREATE INDEX IF NOT EXISTS "SOWProduct_sowId_idx" ON "SOWProduct"("sowId");
CREATE INDEX IF NOT EXISTS "SOWProduct_productId_idx" ON "SOWProduct"("productId");

-- AccessRequest indexes
CREATE UNIQUE INDEX IF NOT EXISTS "AccessRequest_userId_key" ON "AccessRequest"("userId");
CREATE INDEX IF NOT EXISTS "AccessRequest_status_idx" ON "AccessRequest"("status");
CREATE INDEX IF NOT EXISTS "AccessRequest_email_idx" ON "AccessRequest"("email");
CREATE INDEX IF NOT EXISTS "AccessRequest_company_idx" ON "AccessRequest"("company");
CREATE INDEX IF NOT EXISTS "AccessRequest_requestType_idx" ON "AccessRequest"("requestType");

-- TestRequest indexes
CREATE UNIQUE INDEX IF NOT EXISTS "TestRequest_poNumber_key" ON "TestRequest"("poNumber");
CREATE INDEX IF NOT EXISTS "TestRequest_status_idx" ON "TestRequest"("status");
CREATE INDEX IF NOT EXISTS "TestRequest_brandId_idx" ON "TestRequest"("brandId");
CREATE INDEX IF NOT EXISTS "TestRequest_labId_idx" ON "TestRequest"("labId");
CREATE INDEX IF NOT EXISTS "TestRequest_fabricId_idx" ON "TestRequest"("fabricId");
CREATE INDEX IF NOT EXISTS "TestRequest_projectId_idx" ON "TestRequest"("projectId");
CREATE INDEX IF NOT EXISTS "TestRequest_requestedById_idx" ON "TestRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "TestRequest_approvedById_idx" ON "TestRequest"("approvedById");
CREATE INDEX IF NOT EXISTS "TestRequest_poDate_idx" ON "TestRequest"("poDate");
CREATE INDEX IF NOT EXISTS "TestRequest_priority_idx" ON "TestRequest"("priority");

-- TestRequestLine indexes
CREATE INDEX IF NOT EXISTS "TestRequestLine_testRequestId_idx" ON "TestRequestLine"("testRequestId");
CREATE INDEX IF NOT EXISTS "TestRequestLine_testRunId_idx" ON "TestRequestLine"("testRunId");
CREATE INDEX IF NOT EXISTS "TestRequestLine_status_idx" ON "TestRequestLine"("status");

-- LabService indexes
CREATE UNIQUE INDEX IF NOT EXISTS "LabService_labId_testType_testMethod_key" ON "LabService"("labId", "testType", "testMethod");
CREATE INDEX IF NOT EXISTS "LabService_labId_idx" ON "LabService"("labId");

-- SampleShipment indexes
CREATE INDEX IF NOT EXISTS "SampleShipment_status_idx" ON "SampleShipment"("status");
CREATE INDEX IF NOT EXISTS "SampleShipment_trackingNumber_idx" ON "SampleShipment"("trackingNumber");
CREATE INDEX IF NOT EXISTS "SampleShipment_fabricId_idx" ON "SampleShipment"("fabricId");
CREATE INDEX IF NOT EXISTS "SampleShipment_labId_idx" ON "SampleShipment"("labId");
CREATE INDEX IF NOT EXISTS "SampleShipment_testRequestId_idx" ON "SampleShipment"("testRequestId");

-- ShipmentEvent indexes
CREATE INDEX IF NOT EXISTS "ShipmentEvent_shipmentId_idx" ON "ShipmentEvent"("shipmentId");
CREATE INDEX IF NOT EXISTS "ShipmentEvent_createdAt_idx" ON "ShipmentEvent"("createdAt");

-- FabricRecipe indexes
CREATE INDEX IF NOT EXISTS "FabricRecipe_fabricType_idx" ON "FabricRecipe"("fabricType");
CREATE INDEX IF NOT EXISTS "FabricRecipe_fiberContent_idx" ON "FabricRecipe"("fiberContent");
CREATE INDEX IF NOT EXISTS "FabricRecipe_fuzeTier_idx" ON "FabricRecipe"("fuzeTier");
CREATE INDEX IF NOT EXISTS "FabricRecipe_applicationMethod_idx" ON "FabricRecipe"("applicationMethod");

-- ExchangeRate indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ExchangeRate_fromCurrency_toCurrency_effectiveDate_key" ON "ExchangeRate"("fromCurrency", "toCurrency", "effectiveDate");
CREATE INDEX IF NOT EXISTS "ExchangeRate_fromCurrency_toCurrency_idx" ON "ExchangeRate"("fromCurrency", "toCurrency");
CREATE INDEX IF NOT EXISTS "ExchangeRate_effectiveDate_idx" ON "ExchangeRate"("effectiveDate");

-- BrandEngagement indexes
CREATE UNIQUE INDEX IF NOT EXISTS "BrandEngagement_brandId_key" ON "BrandEngagement"("brandId");
CREATE INDEX IF NOT EXISTS "BrandEngagement_overallScore_idx" ON "BrandEngagement"("overallScore");
CREATE INDEX IF NOT EXISTS "BrandEngagement_engagementTrend_idx" ON "BrandEngagement"("engagementTrend");

-- Meeting indexes
CREATE INDEX IF NOT EXISTS "Meeting_startTime_idx" ON "Meeting"("startTime");
CREATE INDEX IF NOT EXISTS "Meeting_brandId_idx" ON "Meeting"("brandId");
CREATE INDEX IF NOT EXISTS "Meeting_projectId_idx" ON "Meeting"("projectId");
CREATE INDEX IF NOT EXISTS "Meeting_status_idx" ON "Meeting"("status");
CREATE INDEX IF NOT EXISTS "Meeting_meetingType_idx" ON "Meeting"("meetingType");

-- Notification indexes
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_type_idx" ON "Notification"("type");

-- AuditLog indexes
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- PasswordResetToken indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- FuzeTestRequest indexes
CREATE INDEX IF NOT EXISTS "FuzeTestRequest_fabricId_idx" ON "FuzeTestRequest"("fabricId");
CREATE INDEX IF NOT EXISTS "FuzeTestRequest_factoryId_idx" ON "FuzeTestRequest"("factoryId");
CREATE INDEX IF NOT EXISTS "FuzeTestRequest_status_idx" ON "FuzeTestRequest"("status");

-- ComplianceDocument indexes
CREATE INDEX IF NOT EXISTS "ComplianceDocument_category_idx" ON "ComplianceDocument"("category");
CREATE INDEX IF NOT EXISTS "ComplianceDocument_uploadedById_idx" ON "ComplianceDocument"("uploadedById");

-- Fabric indexes
CREATE INDEX IF NOT EXISTS "Fabric_fuzeNumber_idx" ON "Fabric"("fuzeNumber");
CREATE INDEX IF NOT EXISTS "Fabric_customerCode_idx" ON "Fabric"("customerCode");
CREATE INDEX IF NOT EXISTS "Fabric_factoryCode_idx" ON "Fabric"("factoryCode");
CREATE INDEX IF NOT EXISTS "Fabric_brandId_idx" ON "Fabric"("brandId");
CREATE INDEX IF NOT EXISTS "Fabric_factoryId_idx" ON "Fabric"("factoryId");

-- FabricContent indexes
CREATE INDEX IF NOT EXISTS "FabricContent_fabricId_idx" ON "FabricContent"("fabricId");
CREATE INDEX IF NOT EXISTS "FabricContent_material_idx" ON "FabricContent"("material");

-- FabricSubmission indexes
CREATE INDEX IF NOT EXISTS "FabricSubmission_fuzeFabricNumber_idx" ON "FabricSubmission"("fuzeFabricNumber");
CREATE INDEX IF NOT EXISTS "FabricSubmission_customerFabricCode_idx" ON "FabricSubmission"("customerFabricCode");
CREATE INDEX IF NOT EXISTS "FabricSubmission_factoryFabricCode_idx" ON "FabricSubmission"("factoryFabricCode");
CREATE INDEX IF NOT EXISTS "FabricSubmission_status_idx" ON "FabricSubmission"("status");
CREATE INDEX IF NOT EXISTS "FabricSubmission_testStatus_idx" ON "FabricSubmission"("testStatus");

-- TestRun indexes
CREATE INDEX IF NOT EXISTS "TestRun_testType_idx" ON "TestRun"("testType");
CREATE INDEX IF NOT EXISTS "TestRun_testMethodStd_idx" ON "TestRun"("testMethodStd");
CREATE INDEX IF NOT EXISTS "TestRun_washCount_idx" ON "TestRun"("washCount");
CREATE INDEX IF NOT EXISTS "TestRun_testDate_idx" ON "TestRun"("testDate");
CREATE INDEX IF NOT EXISTS "TestRun_submissionId_idx" ON "TestRun"("submissionId");
CREATE INDEX IF NOT EXISTS "TestRun_projectId_idx" ON "TestRun"("projectId");

-- Document indexes
CREATE INDEX IF NOT EXISTS "Document_submissionId_idx" ON "Document"("submissionId");
CREATE INDEX IF NOT EXISTS "Document_testRunId_idx" ON "Document"("testRunId");
CREATE INDEX IF NOT EXISTS "Document_sowId_idx" ON "Document"("sowId");

-- Contact indexes
CREATE INDEX IF NOT EXISTS "Contact_email_idx" ON "Contact"("email");
CREATE INDEX IF NOT EXISTS "Contact_last_idx" ON "Contact"("lastName");
CREATE INDEX IF NOT EXISTS "Contact_brandId_idx" ON "Contact"("brandId");
CREATE INDEX IF NOT EXISTS "Contact_factoryId_idx" ON "Contact"("factoryId");

-- Lab indexes
CREATE INDEX IF NOT EXISTS "Lab_country_idx" ON "Lab"("country");
CREATE INDEX IF NOT EXISTS "Lab_icpApproved_idx" ON "Lab"("icpApproved");

-- Brand indexes
CREATE INDEX IF NOT EXISTS "Brand_pipelineStage_idx" ON "Brand"("pipelineStage");

-- Factory indexes
CREATE INDEX IF NOT EXISTS "Factory_country_idx" ON "Factory"("country");
CREATE INDEX IF NOT EXISTS "Factory_profileComplete_idx" ON "Factory"("profileComplete");
CREATE INDEX IF NOT EXISTS "Factory_distributorId_idx" ON "Factory"("distributorId");

-- Distributor indexes
CREATE INDEX IF NOT EXISTS "Distributor_name_idx" ON "Distributor"("name");

-- SourceRecord indexes
CREATE INDEX IF NOT EXISTS "SourceRecord_sourceTable_idx" ON "SourceRecord"("sourceTable");
CREATE INDEX IF NOT EXISTS "SourceRecord_sourceRecordId_idx" ON "SourceRecord"("sourceRecordId");
CREATE INDEX IF NOT EXISTS "SourceRecord_distributorId_idx" ON "SourceRecord"("distributorId");

-- Now add all foreign keys at the end (in proper dependency order)

-- User foreign keys (self-referential must come first)
ALTER TABLE "User" ADD CONSTRAINT "User_salesManagerId_fkey" FOREIGN KEY ("salesManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Brand foreign keys
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "BrandEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Factory foreign keys
ALTER TABLE "Factory" ADD CONSTRAINT "Factory_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Factory" ADD CONSTRAINT "Factory_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BrandFactory foreign keys
ALTER TABLE "BrandFactory" ADD CONSTRAINT "BrandFactory_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BrandFactory" ADD CONSTRAINT "BrandFactory_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contact foreign keys
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fabric foreign keys
ALTER TABLE "Fabric" ADD CONSTRAINT "Fabric_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Fabric" ADD CONSTRAINT "Fabric_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FabricContent foreign keys
ALTER TABLE "FabricContent" ADD CONSTRAINT "FabricContent_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FabricSubmission foreign keys
ALTER TABLE "FabricSubmission" ADD CONSTRAINT "FabricSubmission_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FabricSubmission" ADD CONSTRAINT "FabricSubmission_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FabricSubmission" ADD CONSTRAINT "FabricSubmission_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Note foreign keys
ALTER TABLE "Note" ADD CONSTRAINT "Note_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Product foreign keys
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Project foreign keys
ALTER TABLE "Project" ADD CONSTRAINT "Project_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invoice foreign keys
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SOW foreign keys
ALTER TABLE "SOW" ADD CONSTRAINT "SOW_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SOWMilestone foreign keys
ALTER TABLE "SOWMilestone" ADD CONSTRAINT "SOWMilestone_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "SOW"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SOWProduct foreign keys
ALTER TABLE "SOWProduct" ADD CONSTRAINT "SOWProduct_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "SOW"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SOWProduct" ADD CONSTRAINT "SOWProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AccessRequest foreign keys
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "SOW"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TestRun foreign keys
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FabricSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_brandApprovedById_fkey" FOREIGN KEY ("brandApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- IcpResult foreign keys
ALTER TABLE "IcpResult" ADD CONSTRAINT "IcpResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AntibacterialResult foreign keys
ALTER TABLE "AntibacterialResult" ADD CONSTRAINT "AntibacterialResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FungalResult foreign keys
ALTER TABLE "FungalResult" ADD CONSTRAINT "FungalResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OdorResult foreign keys
ALTER TABLE "OdorResult" ADD CONSTRAINT "OdorResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Document foreign keys
ALTER TABLE "Document" ADD CONSTRAINT "Document_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FabricSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "SOW"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SourceRecord foreign keys
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FabricSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TestRequest foreign keys
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FabricSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "SOW"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TestRequestLine foreign keys
ALTER TABLE "TestRequestLine" ADD CONSTRAINT "TestRequestLine_testRequestId_fkey" FOREIGN KEY ("testRequestId") REFERENCES "TestRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestRequestLine" ADD CONSTRAINT "TestRequestLine_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LabService foreign keys
ALTER TABLE "LabService" ADD CONSTRAINT "LabService_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SampleShipment foreign keys
ALTER TABLE "SampleShipment" ADD CONSTRAINT "SampleShipment_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SampleShipment" ADD CONSTRAINT "SampleShipment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FabricSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SampleShipment" ADD CONSTRAINT "SampleShipment_testRequestId_fkey" FOREIGN KEY ("testRequestId") REFERENCES "TestRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SampleShipment" ADD CONSTRAINT "SampleShipment_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ShipmentEvent foreign keys
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SampleShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FuzeTestRequest foreign keys
ALTER TABLE "FuzeTestRequest" ADD CONSTRAINT "FuzeTestRequest_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuzeTestRequest" ADD CONSTRAINT "FuzeTestRequest_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BrandEngagement foreign keys
ALTER TABLE "BrandEngagement" ADD CONSTRAINT "BrandEngagement_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Meeting foreign keys
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notification foreign keys
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AuditLog foreign keys
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PasswordResetToken foreign keys
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ComplianceDocument foreign keys
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
