// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-60-bundle
 *
 * Phase 60 — Kaylee 2026-06-05 fabric-tracking tickets. Adds three
 * nullable columns to FabricSubmission:
 *   - lotNumber       String?
 *   - washStatus      String? (PRE_WASHED | WASH_REQUESTED | UNKNOWN)
 *   - storageLocation String?
 *
 * Idempotent. Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const log: string[] = [];
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;`);
    log.push("ensured FabricSubmission.lotNumber");
    await prisma.$executeRawUnsafe(`ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "washStatus" TEXT;`);
    log.push("ensured FabricSubmission.washStatus");
    await prisma.$executeRawUnsafe(`ALTER TABLE "FabricSubmission" ADD COLUMN IF NOT EXISTS "storageLocation" TEXT;`);
    log.push("ensured FabricSubmission.storageLocation");
    return NextResponse.json({ ok: true, verdict: "Phase 60 migration applied", log });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message, log }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
