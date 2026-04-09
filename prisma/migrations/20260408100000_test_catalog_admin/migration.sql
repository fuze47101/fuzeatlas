-- Create TestCatalogItem table for admin-managed test pricing
CREATE TABLE IF NOT EXISTS "TestCatalogItem" (
    "id" TEXT NOT NULL,
    "testKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'performance',
    "moqMeters" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "controlRequired" BOOLEAN NOT NULL DEFAULT false,
    "controlNote" TEXT,
    "turnaroundDays" INTEGER NOT NULL DEFAULT 7,
    "estimatedCostUsd" DOUBLE PRECISION,
    "methods" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TestCatalogItem_testKey_key" ON "TestCatalogItem"("testKey");
CREATE INDEX IF NOT EXISTS "TestCatalogItem_active_idx" ON "TestCatalogItem"("active");

-- Seed default test catalog items
INSERT INTO "TestCatalogItem" ("id", "testKey", "name", "description", "category", "moqMeters", "controlRequired", "controlNote", "turnaroundDays", "estimatedCostUsd", "methods", "active", "sortOrder", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'recipe-build', 'FUZE Recipe Build', 'Full format build including wet-to-wet and dry-to-wet application levels across multiple FUZE tiers (F1-F4). Determines optimal treatment recipe for the fabric.', 'recipe_build', 1, true, 'CRITICAL: If the sample has ANY prior FUZE treatment (exhaust, spray, or other method), you MUST supply an equal yardage of UNTREATED control fabric from the same lot/batch. Without a matching control, results cannot be validated.', 10, 800, ARRAY['Pad application', 'Exhaust application', 'Spray application', 'Multi-tier evaluation (F1-F4)'], true, 1, NOW()),
  (gen_random_uuid()::text, 'antibacterial-screen', 'Antibacterial Screening', 'Quick antibacterial efficacy screening using AATCC 100 or ASTM E2149 to verify antimicrobial activity.', 'performance', 0.5, true, 'Supply matching untreated control fabric.', 7, 450, ARRAY['AATCC 100', 'ASTM E2149'], true, 2, NOW()),
  (gen_random_uuid()::text, 'icp-analysis', 'ICP Metal Content Analysis', 'Inductively Coupled Plasma analysis to measure allotrope metal content (Ag/Au) in treated fabric.', 'quality', 0.25, false, NULL, 5, 250, ARRAY['ICP-OES', 'ICP-MS'], true, 3, NOW()),
  (gen_random_uuid()::text, 'wash-durability', 'Wash Durability Testing', 'Test antimicrobial efficacy retention after multiple wash cycles (10, 25, 50 washes). Validates treatment permanence.', 'performance', 2, true, 'Supply matching untreated control fabric.', 14, 1200, ARRAY['AATCC 100 post-wash', 'ICP post-wash'], true, 4, NOW()),
  (gen_random_uuid()::text, 'full-certification', 'Full Certification Package', 'Complete test suite for brand compliance: ICP, Antibacterial (AATCC 100 + ASTM E2149), Fungal, and wash durability. Generates Certificate of Compliance.', 'certification', 3, true, 'Supply matching untreated control fabric of equal yardage.', 21, 2500, ARRAY['ICP-OES', 'AATCC 100', 'ASTM E2149', 'ASTM G21 (Fungal)', 'Wash durability (50 cycles)'], true, 5, NOW()),
  (gen_random_uuid()::text, 'fungal-test', 'Antifungal Testing', 'ASTM G21 or AATCC 30 antifungal efficacy testing against common mold and mildew organisms.', 'performance', 0.5, true, 'Supply matching untreated control fabric.', 14, 500, ARRAY['ASTM G21', 'AATCC 30'], true, 6, NOW()),
  (gen_random_uuid()::text, 'odor-test', 'Odor Resistance Testing', 'Evaluates fabric''s resistance to odor-causing bacteria after treatment.', 'performance', 0.5, true, 'Supply matching untreated control fabric.', 10, 400, ARRAY['Modified AATCC 100 (odor panel)'], true, 7, NOW())
ON CONFLICT ("testKey") DO NOTHING;
