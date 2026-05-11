// @ts-nocheck
/**
 * Phase 14 schema bundle. Idempotent.
 *
 * Adds:
 *   - ProductDocument.restrictedTo{Brand,Factory,Distributor,Lab}Id (14B)
 *   - User.onboardingCompletedAt + User.onboardingState (14E)
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

  // 14B — per-entity restriction columns on ProductDocument
  for (const col of [
    "restrictedToBrandId",
    "restrictedToFactoryId",
    "restrictedToDistributorId",
    "restrictedToLabId",
  ]) {
    await run(
      `ProductDocument.${col}`,
      `ALTER TABLE "ProductDocument" ADD COLUMN IF NOT EXISTS "${col}" TEXT`,
    );
  }

  // 14E — onboarding state columns on User
  await run(
    "User.onboardingCompletedAt",
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3)`,
  );
  await run(
    "User.onboardingState",
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingState" JSONB`,
  );

  const failed = steps.filter((s) => !s.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    totalSteps: steps.length,
    failed: failed.length,
    steps,
  });
}
