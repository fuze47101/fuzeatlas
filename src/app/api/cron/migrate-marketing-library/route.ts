// @ts-nocheck
/**
 * migrate-marketing-library — adds ComplianceDocument.libraryType.
 *
 * GET/POST /api/cron/migrate-marketing-library, Bearer $CRON_SECRET.
 * Idempotent: ADD COLUMN IF NOT EXISTS + backfill NULLs to 'COMPLIANCE'.
 * Runs on Vercel (reaches caboose via the internal Railway network), so it
 * works even when the public proxy is unreachable for a local `prisma db
 * push`. /api/cron/* is already exempt in middleware PUBLIC_PATHS.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ComplianceDocument" ADD COLUMN IF NOT EXISTS "libraryType" TEXT DEFAULT 'COMPLIANCE'`,
    );
    const backfilled = await prisma.$executeRawUnsafe(
      `UPDATE "ComplianceDocument" SET "libraryType" = 'COMPLIANCE' WHERE "libraryType" IS NULL`,
    );
    // Best-effort supporting index (ignore if it already exists).
    await prisma
      .$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ComplianceDocument_libraryType_category_idx" ON "ComplianceDocument" ("libraryType", "category")`,
      )
      .catch(() => {});

    const counts = await prisma.complianceDocument.groupBy({
      by: ["libraryType"],
      _count: { _all: true },
    });

    return NextResponse.json({
      ok: true,
      column: "libraryType added (or already present)",
      backfilledNulls: backfilled,
      byLibraryType: Object.fromEntries(counts.map((c) => [c.libraryType, c._count._all])),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e), code: e?.code || null },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}
