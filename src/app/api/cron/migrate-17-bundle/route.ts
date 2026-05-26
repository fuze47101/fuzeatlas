// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-17-bundle
 *
 * Phase 17 — bearer-authed idempotent runtime migration for the
 * real-time test tracking schema:
 *   - TestTrackingEvent
 *   - TestTrackingToken
 *   - TestTrackingSubscription
 *   - TestRequest.trackingState / trackingUpdatedAt columns + index
 */

const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TestTrackingEvent" (
        "id" TEXT NOT NULL,
        "testRequestId" TEXT NOT NULL,
        "state" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "occurredById" TEXT,
        "metadata" JSONB,
        "isPublic" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TestTrackingEvent_pkey" PRIMARY KEY ("id")
      );
    `);
    log.push("ensured TestTrackingEvent");

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TestTrackingEvent_testRequestId_occurredAt_idx"
      ON "TestTrackingEvent"("testRequestId", "occurredAt");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TestTrackingEvent_state_idx"
      ON "TestTrackingEvent"("state");
    `);
    log.push("indexed TestTrackingEvent");

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TestTrackingToken" (
        "id" TEXT NOT NULL,
        "testRequestId" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3),
        "viewCount" INTEGER NOT NULL DEFAULT 0,
        "lastViewedAt" TIMESTAMP(3),
        CONSTRAINT "TestTrackingToken_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "TestTrackingToken_testRequestId_key"
      ON "TestTrackingToken"("testRequestId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "TestTrackingToken_token_key"
      ON "TestTrackingToken"("token");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TestTrackingToken_token_idx"
      ON "TestTrackingToken"("token");
    `);
    log.push("ensured TestTrackingToken + indexes");

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TestTrackingSubscription" (
        "id" TEXT NOT NULL,
        "testRequestId" TEXT NOT NULL,
        "userId" TEXT,
        "email" TEXT,
        "webPushEndpoint" TEXT,
        "webPushKeys" JSONB,
        "channels" TEXT NOT NULL DEFAULT 'EMAIL,IN_APP',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "unsubscribedAt" TIMESTAMP(3),
        CONSTRAINT "TestTrackingSubscription_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TestTrackingSubscription_testRequestId_userId_idx"
      ON "TestTrackingSubscription"("testRequestId", "userId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TestTrackingSubscription_testRequestId_email_idx"
      ON "TestTrackingSubscription"("testRequestId", "email");
    `);
    log.push("ensured TestTrackingSubscription + indexes");

    // Extend TestRequest with denormalized state + index for fast list queries.
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TestRequest"
      ADD COLUMN IF NOT EXISTS "trackingState" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TestRequest"
      ADD COLUMN IF NOT EXISTS "trackingUpdatedAt" TIMESTAMP(3);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TestRequest_trackingState_idx"
      ON "TestRequest"("trackingState");
    `);
    log.push("extended TestRequest with trackingState/trackingUpdatedAt + index");

    // Foreign keys (best-effort; skip if already attached).
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TestTrackingEvent"
        ADD CONSTRAINT "TestTrackingEvent_testRequestId_fkey"
        FOREIGN KEY ("testRequestId") REFERENCES "TestRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      log.push("attached TestTrackingEvent FK");
    } catch (e: any) {
      if (!String(e?.message).includes("already exists")) log.push(`event-fk: ${e?.message}`);
    }
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TestTrackingToken"
        ADD CONSTRAINT "TestTrackingToken_testRequestId_fkey"
        FOREIGN KEY ("testRequestId") REFERENCES "TestRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      log.push("attached TestTrackingToken FK");
    } catch (e: any) {
      if (!String(e?.message).includes("already exists")) log.push(`token-fk: ${e?.message}`);
    }
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TestTrackingSubscription"
        ADD CONSTRAINT "TestTrackingSubscription_testRequestId_fkey"
        FOREIGN KEY ("testRequestId") REFERENCES "TestRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      log.push("attached TestTrackingSubscription FK");
    } catch (e: any) {
      if (!String(e?.message).includes("already exists")) log.push(`sub-fk: ${e?.message}`);
    }

    return NextResponse.json({
      ok: true,
      verdict: "Phase 17 migration bundle applied.",
      log,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e?.message || "migration failed",
      log,
    }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
