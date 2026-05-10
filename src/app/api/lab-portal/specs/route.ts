// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/lab-portal/specs  (Phase 4F — DO+OVERSEE)
 *
 * Brand specs that affect tests this lab runs. Reads
 * SupplyChainLink (LAB-TESTS_FOR-FACTORY) to find factories this
 * lab handles, then resolves the brands those factories supply
 * (FACTORY-SUPPLIES-BRAND), and returns each brand's stipulated
 * spec — required FUZE tier, ICP cadence, protocol doc.
 *
 * Lab OVERSEE: see what each brand expects so test results are
 * scored against the right standard.
 */

const ROLES = ["ADMIN", "EMPLOYEE", "LAB_USER", "LAB_MANAGER"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ROLES.includes(user.role)) return forbidden();
  if (!user.labId && user.role !== "ADMIN" && user.role !== "EMPLOYEE") return forbidden();

  const labId = user.labId;
  if (!labId) {
    return NextResponse.json(
      { ok: false, error: "No lab associated with this account" },
      { status: 403 },
    );
  }

  // Step 1: factories this lab handles.
  const labFactoryLinks = await prisma.supplyChainLink.findMany({
    where: {
      fromType: "LAB",
      fromId: labId,
      toType: "FACTORY",
      relation: "TESTS_FOR",
      active: true,
    },
    select: { toId: true },
  });
  const factoryIds = labFactoryLinks.map((l: any) => l.toId);

  // Step 2: brands those factories supply.
  let brandIds: string[] = [];
  if (factoryIds.length > 0) {
    const brandLinks = await prisma.supplyChainLink.findMany({
      where: {
        fromType: "FACTORY",
        fromId: { in: factoryIds },
        toType: "BRAND",
        relation: "SUPPLIES",
        active: true,
      },
      select: { toId: true },
    });
    brandIds = Array.from(new Set(brandLinks.map((l: any) => l.toId)));
  }

  // Fallback: derive from TestRun.labId × submission.brandId for labs
  // that haven't been backfilled yet.
  if (brandIds.length === 0) {
    const fallback = (await prisma.$queryRawUnsafe(
      `
      SELECT DISTINCT s."brandId" AS "brandId"
      FROM "TestRun" t
      JOIN "FabricSubmission" s ON t."submissionId" = s."id"
      WHERE t."labId" = $1 AND s."brandId" IS NOT NULL
      `,
      labId,
    )) as Array<{ brandId: string }>;
    brandIds = fallback.map((r) => r.brandId);
  }

  const brands =
    brandIds.length > 0
      ? await prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: {
            id: true,
            name: true,
            requiredFuzeTier: true,
            icpCadenceEveryNBatches: true,
            icpCadenceEveryLitersConsumed: true,
            protocolDocUrl: true,
            brandSpecUpdatedAt: true,
          },
          orderBy: { name: "asc" },
        })
      : [];

  return NextResponse.json({ ok: true, brands });
}
