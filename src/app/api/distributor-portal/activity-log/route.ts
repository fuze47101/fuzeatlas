// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { listPortalActivity } from "@/lib/audit";

/**
 * GET /api/distributor-portal/activity-log
 *
 * NEED-4 — audit trail scoped to caller's distributor. Includes
 * DistributorPricing rows for tier ladder edits.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.distributorId)
    return NextResponse.json({ ok: false, error: "Not a distributor user" }, { status: 403 });

  let pricingIds: { id: string }[] = [];
  try {
    pricingIds = await prisma.distributorPricing.findMany({
      where: { distributorId: user.distributorId },
      select: { id: true },
    });
  } catch {
    /* DistributorPricing may not exist; non-fatal */
  }

  const rows = await listPortalActivity({
    entity: "Distributor",
    entityId: user.distributorId,
    alsoEntities: pricingIds.map((p) => ({ entity: "DistributorPricing", entityId: p.id })),
    take: 200,
  });
  return NextResponse.json({ ok: true, rows });
}
