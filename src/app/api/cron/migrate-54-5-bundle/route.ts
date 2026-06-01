// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-54-5-bundle
 *
 * Phase 54.5 idempotent runtime migration:
 *   - Project.priority      String?
 *   - Project.weeklyStatus  String?
 *   - Project.lastUpdatedAt Timestamp
 *   - Project.closedAt      Timestamp
 *   - Project.closedById    String?  (FK → User)
 *   - Project.closingNotes  String?
 *   - Brand.subtype         String?  (OEM/middleman tag)
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const log: string[] = [];
  try {
    const stmts: Array<[string, string]> = [
      ["Project.priority", `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "priority" TEXT;`],
      ["Project.weeklyStatus", `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "weeklyStatus" TEXT;`],
      ["Project.lastUpdatedAt", `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "lastUpdatedAt" TIMESTAMP(3);`],
      ["Project.closedAt", `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);`],
      ["Project.closedById", `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "closedById" TEXT;`],
      ["Project.closingNotes", `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "closingNotes" TEXT;`],
      ["Brand.subtype", `ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "subtype" TEXT;`],
      ["Project_priority_idx", `CREATE INDEX IF NOT EXISTS "Project_priority_idx" ON "Project"("priority");`],
      ["Project_lastUpdatedAt_idx", `CREATE INDEX IF NOT EXISTS "Project_lastUpdatedAt_idx" ON "Project"("lastUpdatedAt");`],
      ["Project_closedAt_idx", `CREATE INDEX IF NOT EXISTS "Project_closedAt_idx" ON "Project"("closedAt");`],
    ];
    for (const [label, sql] of stmts) {
      try { await prisma.$executeRawUnsafe(sql); log.push(`✓ ${label}`); }
      catch (e: any) { log.push(`✗ ${label}: ${e?.message || e}`); }
    }

    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Project" ADD CONSTRAINT "Project_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
      );
      log.push(`✓ FK Project.closedById → User`);
    } catch (e: any) {
      if (!String(e?.message).includes("already exists")) log.push(`✗ FK: ${e?.message}`);
    }

    return NextResponse.json({ ok: true, verdict: "Phase 54.5 migration applied.", log });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message, log }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 120;
