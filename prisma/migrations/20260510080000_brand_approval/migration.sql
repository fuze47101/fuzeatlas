-- Brand approval workflow (Phase 7A — ROADMAP_v2)
-- Parallel approval columns on TestRun, FabricSubmission, FuzeOrder
-- + Brand.requiresApproval toggle (default ON).

-- TestRun
ALTER TABLE "TestRun" ADD COLUMN "brandApprovalStatus" TEXT;
ALTER TABLE "TestRun" ADD COLUMN "brandRejectionReason" TEXT;

-- FabricSubmission
ALTER TABLE "FabricSubmission" ADD COLUMN "brandApprovalStatus" TEXT;
ALTER TABLE "FabricSubmission" ADD COLUMN "brandApprovedById" TEXT;
ALTER TABLE "FabricSubmission" ADD COLUMN "brandApprovedAt" TIMESTAMP(3);
ALTER TABLE "FabricSubmission" ADD COLUMN "brandRejectionReason" TEXT;

CREATE INDEX "FabricSubmission_brandApprovalStatus_idx"
  ON "FabricSubmission"("brandApprovalStatus");

-- FuzeOrder
ALTER TABLE "FuzeOrder" ADD COLUMN "brandApprovalStatus" TEXT;
ALTER TABLE "FuzeOrder" ADD COLUMN "brandApprovedById" TEXT;
ALTER TABLE "FuzeOrder" ADD COLUMN "brandApprovedAt" TIMESTAMP(3);
ALTER TABLE "FuzeOrder" ADD COLUMN "brandRejectionReason" TEXT;

CREATE INDEX "FuzeOrder_brandApprovalStatus_idx"
  ON "FuzeOrder"("brandApprovalStatus");

-- Brand.requiresApproval (default ON; backfill existing rows to true)
ALTER TABLE "Brand"
  ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT true;
