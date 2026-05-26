// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST/GET /api/cron/migrate-16-6-bundle
 *
 * Phase 16.6 — bearer-authed runtime migration:
 *   SimilarEmailIgnore (T4 — admin-side flag so a known false-positive
 *   user↔contact pair stops surfacing on /admin/users/suspect-email-typos)
 *
 * Idempotent. Safe to re-run.
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
      CREATE TABLE IF NOT EXISTS "SimilarEmailIgnore" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "contactEmail" TEXT NOT NULL,
        "ignoredById" TEXT NOT NULL,
        "ignoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "reason" TEXT,
        CONSTRAINT "SimilarEmailIgnore_pkey" PRIMARY KEY ("id")
      );
    `);
    log.push("ensured SimilarEmailIgnore table");

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "SimilarEmailIgnore_userId_contactEmail_key"
      ON "SimilarEmailIgnore"("userId", "contactEmail");
    `);
    log.push("ensured unique index on (userId, contactEmail)");

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SimilarEmailIgnore_userId_idx"
      ON "SimilarEmailIgnore"("userId");
    `);
    log.push("ensured index on userId");

    return NextResponse.json({
      ok: true,
      verdict: "P16.6 migration bundle applied (SimilarEmailIgnore).",
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
