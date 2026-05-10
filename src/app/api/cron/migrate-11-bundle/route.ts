// @ts-nocheck
/**
 * Bearer-authed runtime migration — Phase 11 schema bundle.
 *
 * Adds:
 *   - CoachFeedback (11B)
 *   - Brand.churnRiskScore / churnRiskUpdatedAt / churnRiskReasoning (11C)
 *   - CompetitorSnapshot (11D)
 *   - Distributor.autoReorderEnabled (11F)
 *
 * Idempotent. Safe to re-run.
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

  // 11B — CoachFeedback
  await run(
    "CoachFeedback table",
    `CREATE TABLE IF NOT EXISTS "CoachFeedback" (
       "id"           TEXT PRIMARY KEY,
       "userId"       TEXT NOT NULL,
       "suggestionId" TEXT NOT NULL,
       "kind"         TEXT NOT NULL,
       "applied"      BOOLEAN NOT NULL,
       "feedback"     TEXT,
       "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "CoachFeedback userId idx",
    `CREATE INDEX IF NOT EXISTS "CoachFeedback_userId_createdAt_idx" ON "CoachFeedback"("userId","createdAt")`,
  );
  await run(
    "CoachFeedback kind idx",
    `CREATE INDEX IF NOT EXISTS "CoachFeedback_kind_idx" ON "CoachFeedback"("kind")`,
  );

  // 11C — Brand churn risk
  for (const col of [
    `"churnRiskScore" DOUBLE PRECISION`,
    `"churnRiskUpdatedAt" TIMESTAMP(3)`,
    `"churnRiskReasoning" TEXT`,
  ]) {
    const name = col.match(/"([^"]+)"/)![1];
    await run(`Brand.${name}`, `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS ${col}`);
  }

  // 11D — CompetitorSnapshot
  await run(
    "CompetitorSnapshot table",
    `CREATE TABLE IF NOT EXISTS "CompetitorSnapshot" (
       "id"           TEXT PRIMARY KEY,
       "competitor"   TEXT NOT NULL,
       "url"          TEXT NOT NULL,
       "fetchedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "contentHash"  TEXT NOT NULL,
       "extracted"    JSONB NOT NULL,
       "diffFromPrev" JSONB
     )`,
  );
  await run(
    "CompetitorSnapshot competitor idx",
    `CREATE INDEX IF NOT EXISTS "CompetitorSnapshot_competitor_fetchedAt_idx" ON "CompetitorSnapshot"("competitor","fetchedAt")`,
  );
  await run(
    "CompetitorSnapshot url idx",
    `CREATE INDEX IF NOT EXISTS "CompetitorSnapshot_url_fetchedAt_idx" ON "CompetitorSnapshot"("url","fetchedAt")`,
  );

  // 11F — Distributor.autoReorderEnabled
  await run(
    "Distributor.autoReorderEnabled",
    `ALTER TABLE "Distributor" ADD COLUMN IF NOT EXISTS "autoReorderEnabled" BOOLEAN NOT NULL DEFAULT false`,
  );

  const failed = steps.filter((s) => !s.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    totalSteps: steps.length,
    failed: failed.length,
    steps,
  });
}
