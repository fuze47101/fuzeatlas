// @ts-nocheck
/**
 * Phase 16 schema bundle. Idempotent. Bearer-authed.
 *
 * Adds the columns / tables / indexes introduced by the phase 16
 * spec so prod-DB sync can run against the bearer endpoint (we
 * don't have a working local Prisma connection for db push).
 *
 * Tracks:
 *   T5  — DistributorFactory junction
 *   T7  — FeedbackReport.notificationCount
 *   T8  — User.emailVerifiedAt + emailBounceCount
 *   T10 — Notification.archivedAt + index
 *   T13 — LocaleReviewStatus
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

  // T5 — DistributorFactory junction
  await run(
    "DistributorFactory table",
    `CREATE TABLE IF NOT EXISTS "DistributorFactory" (
       "id"            TEXT PRIMARY KEY,
       "distributorId" TEXT NOT NULL,
       "factoryId"     TEXT NOT NULL,
       "note"          TEXT,
       "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT "DistributorFactory_distributor_factory_unique" UNIQUE ("distributorId","factoryId")
     )`,
  );
  await run(
    "DistributorFactory distributor idx",
    `CREATE INDEX IF NOT EXISTS "DistributorFactory_distributorId_idx" ON "DistributorFactory"("distributorId")`,
  );
  await run(
    "DistributorFactory factory idx",
    `CREATE INDEX IF NOT EXISTS "DistributorFactory_factoryId_idx" ON "DistributorFactory"("factoryId")`,
  );

  // T7 — FeedbackReport.notificationCount
  await run(
    "FeedbackReport.notificationCount",
    `ALTER TABLE "FeedbackReport" ADD COLUMN IF NOT EXISTS "notificationCount" INTEGER NOT NULL DEFAULT 0`,
  );

  // T8 — User.emailVerifiedAt + emailBounceCount
  await run(
    "User.emailVerifiedAt",
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3)`,
  );
  await run(
    "User.emailBounceCount",
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailBounceCount" INTEGER NOT NULL DEFAULT 0`,
  );

  // T10 — Notification.archivedAt + index
  await run(
    "Notification.archivedAt",
    `ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`,
  );
  await run(
    "Notification archivedAt idx",
    `CREATE INDEX IF NOT EXISTS "Notification_archivedAt_idx" ON "Notification"("archivedAt")`,
  );

  // T13 — LocaleReviewStatus
  await run(
    "LocaleReviewStatus table",
    `CREATE TABLE IF NOT EXISTS "LocaleReviewStatus" (
       "id"                TEXT PRIMARY KEY,
       "locale"            TEXT NOT NULL UNIQUE,
       "reviewerId"        TEXT,
       "reviewerEmail"     TEXT,
       "reviewerName"      TEXT,
       "lastTranslatedAt"  TIMESTAMP(3),
       "lastReviewedAt"    TIMESTAMP(3),
       "notes"             TEXT,
       "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  await run(
    "LocaleReviewStatus reviewer idx",
    `CREATE INDEX IF NOT EXISTS "LocaleReviewStatus_reviewerId_idx" ON "LocaleReviewStatus"("reviewerId")`,
  );

  const failed = steps.filter((s) => !s.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    summary: `${steps.length - failed.length}/${steps.length} steps ok`,
    steps,
  });
}
