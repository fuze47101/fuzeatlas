// @ts-nocheck
/**
 * Bearer-authed runtime migration — Phase 10 schema bundle.
 *
 * Adds:
 *   - Lab self-service profile columns (10A)
 *   - LabTest catalog table (10B / 10I)
 *   - LabCredit ledger (10F)
 *   - AiTestReview (10G)
 *   - User.timezone column (10K)
 *   - NotificationDelivery table (10K)
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

  // ─── 10A — Lab profile columns ──────────────────────────────
  for (const col of [
    `"opsContactName" TEXT`,
    `"opsContactEmail" TEXT`,
    `"opsContactPhone" TEXT`,
    `"timezone" TEXT`,
    `"certifications" JSONB`,
    `"accreditationsJson" JSONB`,
    `"websiteUrl" TEXT`,
    `"instrumentList" JSONB`,
    `"servicesOffered" JSONB`,
    `"defaultLanguage" TEXT NOT NULL DEFAULT 'en'`,
  ]) {
    const name = col.match(/"([^"]+)"/)![1];
    await run(`Lab.${name}`, `ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS ${col}`);
  }
  await run(
    "Lab.isFuzeOwned",
    `ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "isFuzeOwned" BOOLEAN NOT NULL DEFAULT false`,
  );

  // ─── 10K — User.timezone ────────────────────────────────────
  await run(
    "User.timezone",
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT`,
  );

  // ─── 10B / 10I — LabTest ────────────────────────────────────
  await run(
    "LabTest table",
    `CREATE TABLE IF NOT EXISTS "LabTest" (
       "id"                TEXT PRIMARY KEY,
       "labId"             TEXT NOT NULL,
       "testType"          TEXT NOT NULL,
       "protocolName"      TEXT NOT NULL,
       "fuzeCostUsd"       DOUBLE PRECISION,
       "publishedPriceUsd" DOUBLE PRECISION,
       "slaDays"           INTEGER,
       "notes"             TEXT,
       "protocolJson"      JSONB,
       "active"            BOOLEAN NOT NULL DEFAULT true,
       "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "LabTest FK",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabTest_labId_fkey') THEN
         ALTER TABLE "LabTest"
           ADD CONSTRAINT "LabTest_labId_fkey"
           FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$;`,
  );
  await run(
    "LabTest unique",
    `CREATE UNIQUE INDEX IF NOT EXISTS "LabTest_labId_testType_protocolName_key" ON "LabTest"("labId","testType","protocolName")`,
  );
  await run(
    "LabTest labId active idx",
    `CREATE INDEX IF NOT EXISTS "LabTest_labId_active_idx" ON "LabTest"("labId","active")`,
  );
  await run(
    "LabTest testType idx",
    `CREATE INDEX IF NOT EXISTS "LabTest_testType_idx" ON "LabTest"("testType")`,
  );

  // ─── 10F — LabCredit ────────────────────────────────────────
  await run(
    "LabCredit table",
    `CREATE TABLE IF NOT EXISTS "LabCredit" (
       "id"               TEXT PRIMARY KEY,
       "labId"            TEXT NOT NULL,
       "amountUsd"        DOUBLE PRECISION NOT NULL,
       "sourceType"       TEXT NOT NULL,
       "sourceNote"       TEXT,
       "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "spentOnTestRunId" TEXT,
       "spentAt"          TIMESTAMP(3),
       "spentNote"        TEXT
     )`,
  );
  await run(
    "LabCredit FK",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabCredit_labId_fkey') THEN
         ALTER TABLE "LabCredit"
           ADD CONSTRAINT "LabCredit_labId_fkey"
           FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$;`,
  );
  await run(
    "LabCredit lab/spentAt idx",
    `CREATE INDEX IF NOT EXISTS "LabCredit_labId_spentAt_idx" ON "LabCredit"("labId","spentAt")`,
  );

  // ─── 10G — AiTestReview ─────────────────────────────────────
  await run(
    "AiTestReview table",
    `CREATE TABLE IF NOT EXISTS "AiTestReview" (
       "id"                TEXT PRIMARY KEY,
       "testRunId"         TEXT NOT NULL UNIQUE,
       "reviewedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "modelUsed"         TEXT NOT NULL,
       "flags"             JSONB NOT NULL,
       "recommendedAction" TEXT,
       "reviewedNotes"     TEXT
     )`,
  );
  await run(
    "AiTestReview action idx",
    `CREATE INDEX IF NOT EXISTS "AiTestReview_recommendedAction_idx" ON "AiTestReview"("recommendedAction")`,
  );

  // ─── 10K — NotificationDelivery ─────────────────────────────
  await run(
    "NotificationDelivery table",
    `CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
       "id"             TEXT PRIMARY KEY,
       "notificationId" TEXT NOT NULL,
       "scheduledFor"   TIMESTAMP(3) NOT NULL,
       "deliveredAt"    TIMESTAMP(3),
       "channel"        TEXT NOT NULL,
       "attempts"       INTEGER NOT NULL DEFAULT 0,
       "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "NotificationDelivery FK",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationDelivery_notificationId_fkey') THEN
         ALTER TABLE "NotificationDelivery"
           ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
           FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$;`,
  );
  await run(
    "NotificationDelivery scheduledFor idx",
    `CREATE INDEX IF NOT EXISTS "NotificationDelivery_scheduledFor_deliveredAt_idx" ON "NotificationDelivery"("scheduledFor","deliveredAt")`,
  );
  await run(
    "NotificationDelivery notif idx",
    `CREATE INDEX IF NOT EXISTS "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId")`,
  );

  const failed = steps.filter((s) => !s.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    totalSteps: steps.length,
    failed: failed.length,
    steps,
  });
}
