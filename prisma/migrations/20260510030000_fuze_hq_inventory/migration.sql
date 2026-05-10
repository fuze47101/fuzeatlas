-- FuzeHQInventory (Phase 4D — ROADMAP_v2)
--
-- Central FUZE HQ inventory at SLC. Drives /admin/inventory dashboard,
-- reorder alarms, and auto-decrement on direct shipments.

CREATE TABLE "FuzeHQInventory" (
  "id"               TEXT NOT NULL,
  "sku"              TEXT NOT NULL,
  "description"      TEXT NOT NULL,
  "onHandLiters"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reservedLiters"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reorderThreshold" DOUBLE PRECISION,
  "lastInventoryAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FuzeHQInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FuzeHQInventory_sku_key"
  ON "FuzeHQInventory"("sku");
