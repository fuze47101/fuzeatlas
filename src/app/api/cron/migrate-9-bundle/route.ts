// @ts-nocheck
/**
 * Bearer-authed runtime migration endpoint — Phase 9 schema bundle.
 *
 * Adds:
 *   - OutreachMessage tracking columns (9A)
 *   - OutreachLinkClick table (9A)
 *   - BrandStageTransition table (9E)
 *   - BDPlaybook + UserPlaybookFavorite tables (9H)
 *   - Brand referral columns (9I)
 *
 * Why this exists: .env.local DSN points at a different Railway proxy
 * than the Vercel runtime DSN (logged in Phase 8E as a STOP). Until
 * Andrew reconciles, we apply schema changes via a bearer-authed
 * endpoint running on the Vercel runtime where the real prod DB is
 * reachable. Idempotent — every statement is IF NOT EXISTS / DO $$
 * pg_constraint check $$ guarded so re-runs are no-ops.
 *
 * Invoke once after deploy: `fzcron migrate-9-bundle`.
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

  // ─── 9A — OutreachMessage tracking columns ────────────────
  await run(
    "OutreachMessage.trackingToken",
    `ALTER TABLE "OutreachMessage" ADD COLUMN IF NOT EXISTS "trackingToken" TEXT`,
  );
  await run(
    "OutreachMessage.trackingToken unique index",
    `CREATE UNIQUE INDEX IF NOT EXISTS "OutreachMessage_trackingToken_key" ON "OutreachMessage"("trackingToken")`,
  );
  await run(
    "OutreachMessage.trackingToken btree index",
    `CREATE INDEX IF NOT EXISTS "OutreachMessage_trackingToken_idx" ON "OutreachMessage"("trackingToken")`,
  );
  for (const col of [
    "openedAt",
    "lastOpenedAt",
    "clickedAt",
    "lastClickedAt",
    "repliedAt",
    "bouncedAt",
  ]) {
    await run(
      `OutreachMessage.${col}`,
      `ALTER TABLE "OutreachMessage" ADD COLUMN IF NOT EXISTS "${col}" TIMESTAMP(3)`,
    );
  }
  for (const col of ["openCount", "clickCount"]) {
    await run(
      `OutreachMessage.${col}`,
      `ALTER TABLE "OutreachMessage" ADD COLUMN IF NOT EXISTS "${col}" INTEGER NOT NULL DEFAULT 0`,
    );
  }
  await run(
    "OutreachMessage.bounceReason",
    `ALTER TABLE "OutreachMessage" ADD COLUMN IF NOT EXISTS "bounceReason" TEXT`,
  );
  await run(
    "OutreachMessage.openedAt index",
    `CREATE INDEX IF NOT EXISTS "OutreachMessage_openedAt_idx" ON "OutreachMessage"("openedAt")`,
  );
  await run(
    "OutreachMessage.repliedAt index",
    `CREATE INDEX IF NOT EXISTS "OutreachMessage_repliedAt_idx" ON "OutreachMessage"("repliedAt")`,
  );

  // ─── 9A — OutreachLinkClick ───────────────────────────────
  await run(
    "OutreachLinkClick table",
    `CREATE TABLE IF NOT EXISTS "OutreachLinkClick" (
       "id"        TEXT PRIMARY KEY,
       "messageId" TEXT NOT NULL,
       "url"       TEXT NOT NULL,
       "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "userAgent" TEXT,
       "ipHash"    TEXT
     )`,
  );
  await run(
    "OutreachLinkClick FK",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutreachLinkClick_messageId_fkey') THEN
         ALTER TABLE "OutreachLinkClick"
           ADD CONSTRAINT "OutreachLinkClick_messageId_fkey"
           FOREIGN KEY ("messageId") REFERENCES "OutreachMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$;`,
  );
  await run(
    "OutreachLinkClick index",
    `CREATE INDEX IF NOT EXISTS "OutreachLinkClick_messageId_clickedAt_idx" ON "OutreachLinkClick"("messageId","clickedAt")`,
  );

  // ─── 9E — BrandStageTransition ────────────────────────────
  await run(
    "BrandStageTransition table",
    `CREATE TABLE IF NOT EXISTS "BrandStageTransition" (
       "id"               TEXT PRIMARY KEY,
       "brandId"          TEXT NOT NULL,
       "fromStage"        TEXT,
       "toStage"          TEXT NOT NULL,
       "transitionedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "transitionedById" TEXT
     )`,
  );
  await run(
    "BrandStageTransition brand idx",
    `CREATE INDEX IF NOT EXISTS "BrandStageTransition_brandId_transitionedAt_idx" ON "BrandStageTransition"("brandId","transitionedAt")`,
  );
  await run(
    "BrandStageTransition stage idx",
    `CREATE INDEX IF NOT EXISTS "BrandStageTransition_toStage_transitionedAt_idx" ON "BrandStageTransition"("toStage","transitionedAt")`,
  );

  // ─── 9H — BDPlaybook + UserPlaybookFavorite ───────────────
  await run(
    "BDPlaybook table",
    `CREATE TABLE IF NOT EXISTS "BDPlaybook" (
       "id"                          TEXT PRIMARY KEY,
       "name"                        TEXT NOT NULL UNIQUE,
       "textileCategory"             TEXT NOT NULL,
       "description"                 TEXT NOT NULL,
       "recommendedSequenceId"       TEXT,
       "recommendedEmailTemplateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
       "notes"                       TEXT,
       "activeBy"                    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
       "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "BDPlaybook textileCategory idx",
    `CREATE INDEX IF NOT EXISTS "BDPlaybook_textileCategory_idx" ON "BDPlaybook"("textileCategory")`,
  );
  await run(
    "UserPlaybookFavorite table",
    `CREATE TABLE IF NOT EXISTS "UserPlaybookFavorite" (
       "id"         TEXT PRIMARY KEY,
       "userId"     TEXT NOT NULL,
       "playbookId" TEXT NOT NULL,
       "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "UserPlaybookFavorite FK",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserPlaybookFavorite_playbookId_fkey') THEN
         ALTER TABLE "UserPlaybookFavorite"
           ADD CONSTRAINT "UserPlaybookFavorite_playbookId_fkey"
           FOREIGN KEY ("playbookId") REFERENCES "BDPlaybook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$;`,
  );
  await run(
    "UserPlaybookFavorite unique",
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserPlaybookFavorite_userId_playbookId_key" ON "UserPlaybookFavorite"("userId","playbookId")`,
  );
  await run(
    "UserPlaybookFavorite userId idx",
    `CREATE INDEX IF NOT EXISTS "UserPlaybookFavorite_userId_idx" ON "UserPlaybookFavorite"("userId")`,
  );

  // ─── 9I — Brand referral columns ──────────────────────────
  for (const col of [
    `"referredByBrandId" TEXT`,
    `"referredByContactId" TEXT`,
    `"referralNote" TEXT`,
    `"referralValue" DOUBLE PRECISION`,
  ]) {
    const name = col.match(/"([^"]+)"/)![1];
    await run(`Brand.${name}`, `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS ${col}`);
  }

  const failed = steps.filter((s) => !s.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    totalSteps: steps.length,
    failed: failed.length,
    steps,
  });
}
