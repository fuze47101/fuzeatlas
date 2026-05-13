// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { listPortalActivity } from "@/lib/audit";

/**
 * GET /api/brand-portal/activity-log
 *
 * NEED-4 — surfaces the audit trail scoped to the caller's brand.
 * Primary: rows where entity=Brand AND entityId=user.brandId.
 * Auxiliary: BrandPricingTier rows for this brand (audit row carries
 * the BrandPricingTier id, not the brand id, so we resolve them by
 * brandId here).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.brandId)
    return NextResponse.json({ ok: false, error: "Not a brand user" }, { status: 403 });

  const tiers = await prisma.brandPricingTier.findMany({
    where: { brandId: user.brandId },
    select: { id: true },
  });

  const rows = await listPortalActivity({
    entity: "Brand",
    entityId: user.brandId,
    alsoEntities: tiers.map((t) => ({ entity: "BrandPricingTier", entityId: t.id })),
    take: 200,
  });
  return NextResponse.json({ ok: true, rows });
}
