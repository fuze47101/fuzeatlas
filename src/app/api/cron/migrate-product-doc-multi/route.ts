// @ts-nocheck
/**
 * migrate-product-doc-multi — allow many ProductDocument per docType.
 *
 * GET/POST /api/cron/migrate-product-doc-multi, Bearer $CRON_SECRET.
 * Idempotent: adds language, backfills productLine, drops the old docType
 * unique, adds the composite (docType, productLine, language) unique. Runs
 * on Vercel (internal Railway network) so it works even if the public proxy
 * is down for a local `prisma db push`. /api/cron/* is PUBLIC_PATHS-exempt.
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
      `ALTER TABLE "ProductDocument" ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT 'EN'`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "ProductDocument" SET "language" = 'EN' WHERE "language" IS NULL`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "ProductDocument" SET "productLine" = 'DEFAULT' WHERE "productLine" IS NULL`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ProductDocument" ALTER COLUMN "productLine" SET DEFAULT 'DEFAULT'`,
    );
    // Drop the old single-column unique (constraint and/or index form).
    await prisma
      .$executeRawUnsafe(`ALTER TABLE "ProductDocument" DROP CONSTRAINT IF EXISTS "ProductDocument_docType_key"`)
      .catch(() => {});
    await prisma
      .$executeRawUnsafe(`DROP INDEX IF EXISTS "ProductDocument_docType_key"`)
      .catch(() => {});
    // Add the composite unique.
    await prisma
      .$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "ProductDocument_docType_productLine_language_key" ON "ProductDocument" ("docType", "productLine", "language")`,
      )
      .catch(() => {});

    const total = await prisma.productDocument.count();
    const byType = await prisma.productDocument.groupBy({
      by: ["docType"],
      _count: { _all: true },
    });

    return NextResponse.json({
      ok: true,
      applied: "language added; productLine backfilled + default set; docType unique → composite unique",
      total,
      byDocType: Object.fromEntries(byType.map((r) => [r.docType, r._count._all])),
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
