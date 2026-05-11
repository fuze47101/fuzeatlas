// @ts-nocheck
/**
 * Phase 15 schema bundle. Idempotent.
 *
 * Adds:
 *   - BrandWorkspaceRequest (IMP-1)
 *   - RoleEscalationRequest (IMP-2)
 *   - UserOnboardingState (IMP-4)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const steps: { sql: string; ok: boolean; error?: string }[] = [];
  const run = async (label: string, sql: string) => {
    try {
      await prisma.$executeRawUnsafe(sql);
      steps.push({ sql: label, ok: true });
    } catch (e: any) {
      steps.push({ sql: label, ok: false, error: e?.message || String(e) });
    }
  };

  // IMP-1 — BrandWorkspaceRequest
  await run(
    "BrandWorkspaceRequest table",
    `CREATE TABLE IF NOT EXISTS "BrandWorkspaceRequest" (
       "id"                 TEXT PRIMARY KEY,
       "requestedByUserId"  TEXT NOT NULL,
       "suggestedBrandName" TEXT NOT NULL,
       "suggestedDomain"    TEXT,
       "status"             TEXT NOT NULL DEFAULT 'PENDING',
       "resolvedAt"         TIMESTAMP(3),
       "resolvedByUserId"   TEXT,
       "resolvedBrandId"    TEXT,
       "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "BrandWorkspaceRequest status idx",
    `CREATE INDEX IF NOT EXISTS "BrandWorkspaceRequest_status_createdAt_idx" ON "BrandWorkspaceRequest"("status","createdAt")`,
  );
  await run(
    "BrandWorkspaceRequest requester idx",
    `CREATE INDEX IF NOT EXISTS "BrandWorkspaceRequest_requestedByUserId_idx" ON "BrandWorkspaceRequest"("requestedByUserId")`,
  );

  // IMP-2 — RoleEscalationRequest
  await run(
    "RoleEscalationRequest table",
    `CREATE TABLE IF NOT EXISTS "RoleEscalationRequest" (
       "id"                TEXT PRIMARY KEY,
       "requestedByUserId" TEXT NOT NULL,
       "scope"             TEXT NOT NULL,
       "scopeId"           TEXT NOT NULL,
       "requestedRole"     TEXT NOT NULL,
       "reason"            TEXT,
       "status"            TEXT NOT NULL DEFAULT 'PENDING',
       "resolvedAt"        TIMESTAMP(3),
       "resolvedByUserId"  TEXT,
       "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "RoleEscalationRequest status idx",
    `CREATE INDEX IF NOT EXISTS "RoleEscalationRequest_status_createdAt_idx" ON "RoleEscalationRequest"("status","createdAt")`,
  );
  await run(
    "RoleEscalationRequest requester idx",
    `CREATE INDEX IF NOT EXISTS "RoleEscalationRequest_requestedByUserId_idx" ON "RoleEscalationRequest"("requestedByUserId")`,
  );
  await run(
    "RoleEscalationRequest scope idx",
    `CREATE INDEX IF NOT EXISTS "RoleEscalationRequest_scope_scopeId_idx" ON "RoleEscalationRequest"("scope","scopeId")`,
  );

  // IMP-4 — UserOnboardingState
  await run(
    "UserOnboardingState table",
    `CREATE TABLE IF NOT EXISTS "UserOnboardingState" (
       "id"             TEXT PRIMARY KEY,
       "userId"         TEXT NOT NULL,
       "surface"        TEXT NOT NULL,
       "completedItems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
       "dismissed"      BOOLEAN NOT NULL DEFAULT false,
       "dismissedAt"    TIMESTAMP(3),
       "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "UserOnboardingState unique",
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserOnboardingState_userId_surface_key" ON "UserOnboardingState"("userId","surface")`,
  );
  await run(
    "UserOnboardingState user idx",
    `CREATE INDEX IF NOT EXISTS "UserOnboardingState_userId_idx" ON "UserOnboardingState"("userId")`,
  );

  const failed = steps.filter((s) => !s.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    totalSteps: steps.length,
    failed: failed.length,
    steps,
  });
}
