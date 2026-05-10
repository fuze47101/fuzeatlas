-- SupplyChainLink (Phase 4A — ROADMAP_v2 keystone)
--
-- Generalized polymorphic edge between BRAND / FACTORY / DISTRIBUTOR
-- / LAB / FUZE actors. Replaces several ad-hoc joins with a single
-- canonical source of truth that the brand, factory, distributor,
-- and lab portals all read.

CREATE TABLE "SupplyChainLink" (
  "id"        TEXT NOT NULL,
  "fromType"  TEXT NOT NULL,
  "fromId"    TEXT NOT NULL,
  "toType"    TEXT NOT NULL,
  "toId"      TEXT NOT NULL,
  "relation"  TEXT NOT NULL,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplyChainLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplyChainLink_fromType_fromId_toType_toId_relation_key"
  ON "SupplyChainLink"("fromType", "fromId", "toType", "toId", "relation");

CREATE INDEX "SupplyChainLink_fromType_fromId_idx"
  ON "SupplyChainLink"("fromType", "fromId");

CREATE INDEX "SupplyChainLink_toType_toId_idx"
  ON "SupplyChainLink"("toType", "toId");

CREATE INDEX "SupplyChainLink_relation_active_idx"
  ON "SupplyChainLink"("relation", "active");
