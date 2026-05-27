// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-doc-soft-delete-bundle
 *
 * Adds Document.deletedAt + index. Idempotent. Bearer-authed.
 * Powers the Replace + Delete UI on fabric documents (Jany Lu /
 * Charming Industry — wrong Application Report PDF).
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const log: string[] = [];
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);`,
    );
    log.push("ensured Document.deletedAt");
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Document_deletedAt_idx" ON "Document"("deletedAt");`,
    );
    log.push("indexed Document.deletedAt");
    return NextResponse.json({ ok: true, verdict: "Doc soft-delete bundle applied.", log });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "migration failed", log }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
