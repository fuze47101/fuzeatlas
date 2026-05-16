// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/narration-sample
 *
 * Bearer-authed read-only sampler for MB-3 narrations. Returns the
 * 5 most recently generated narrations + their test context so
 * Andrew can spot-check the brand voice. Uses $queryRaw because
 * the Prisma client on Vercel was built before the migration ran
 * and doesn't fully know the narration columns yet — raw SQL
 * sidesteps the schema mismatch.
 */
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        tr."id",
        tr."testType",
        tr."testMethodStd",
        tr."washCount",
        tr."testReportNumber",
        tr."aiNarration",
        tr."aiNarrationModel",
        tr."aiNarrationGeneratedAt",
        sub."fuzeTier" AS "submissionTier",
        br."name" AS "brandName",
        fac."name" AS "factoryName",
        fab."fuzeNumber" AS "fabricFuzeNumber"
      FROM "TestRun" tr
      LEFT JOIN "FabricSubmission" sub ON sub."id" = tr."submissionId"
      LEFT JOIN "Brand" br             ON br."id"  = sub."brandId"
      LEFT JOIN "Factory" fac          ON fac."id" = sub."factoryId"
      LEFT JOIN "Fabric" fab           ON fab."id" = sub."fabricId"
      WHERE tr."brandVisible" = true
        AND tr."aiNarration" IS NOT NULL
      ORDER BY tr."aiNarrationGeneratedAt" DESC NULLS LAST
      LIMIT 5
    `);
    return NextResponse.json({ ok: true, count: (rows as any[]).length, samples: rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}
