-- CreateEnum
CREATE TYPE "ComplianceCategory" AS ENUM ('SDS_MSDS', 'TDS', 'BLUESIGN', 'ZDHC', 'OEKO_TEX', 'GOTS', 'OTHER');

-- CreateTable
CREATE TABLE "ComplianceDocument" (
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

-- CreateIndex
CREATE INDEX "ComplianceDocument_category_idx" ON "ComplianceDocument"("category");

-- CreateIndex
CREATE INDEX "ComplianceDocument_uploadedById_idx" ON "ComplianceDocument"("uploadedById");

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
