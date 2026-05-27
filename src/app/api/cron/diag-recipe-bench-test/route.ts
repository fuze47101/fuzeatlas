// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/diag-recipe-bench-test?id=<benchTestId>
 *
 * Bearer-authed read-only smoke check for the recipe-bench-test row +
 * its fabric ownership. Used to diagnose Kaylee Pace's 'antimicrobial
 * test request will not go through' bug — the icp-form page reads
 * this row and silently fails to load when the row is missing /
 * the fabric isn't reachable.
 *
 * Returns: { ok, found, row?, fabric?, possibleIssues: string[] }
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id query param required" }, { status: 400 });

  const row = await prisma.recipeBenchTest.findUnique({
    where: { id },
    include: {
      fabric: {
        select: {
          id: true,
          fuzeNumber: true,
          customerCode: true,
          brandId: true,
          factoryId: true,
          brand: { select: { id: true, name: true } },
          factory: { select: { id: true, name: true } },
        },
      },
    },
  });

  const issues: string[] = [];
  if (!row) issues.push("recipeBenchTest row not found");
  if (row && !row.fabric) issues.push("fabric relation null — fabricId may be missing on the bench test");
  if (row && row.fabric && !row.fabric.brandId && !row.fabric.factoryId) {
    issues.push("fabric has no brandId AND no factoryId — downstream submit endpoints that scope by brand/factory will fail");
  }
  if (row && !row.testedAtTier) issues.push("testedAtTier null — icp submit handler doesn't require this but the recipe-calculator UI may");
  if (row && row.icpSubmittedAt) issues.push("icp already marked submitted — re-submission is allowed but UI state may show 'submitted'");

  return NextResponse.json({
    ok: true,
    found: !!row,
    row: row
      ? {
          id: row.id,
          testNumber: row.testNumber,
          testDate: row.testDate,
          fabricId: row.fabricId,
          testedAtTier: row.testedAtTier,
          testBathVolumeL: row.testBathVolumeL,
          icpLab: row.icpLab,
          icpSampleId: row.icpSampleId,
          icpSubmittedAt: row.icpSubmittedAt,
          icpExpectedPpm: row.icpExpectedPpm,
          icpMeasuredPpm: row.icpMeasuredPpm,
        }
      : null,
    fabric: row?.fabric || null,
    possibleIssues: issues,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
