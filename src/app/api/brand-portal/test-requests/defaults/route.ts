// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/brand-portal/test-requests/defaults
 *
 * NEED-3 — brand test-request auto-fill. Pre-fills:
 *   - requiredFuzeTier  from Brand.requiredFuzeTier (their spec)
 *   - protocolDocUrl    from Brand.protocolDocUrl
 *   - lastLabId         from the most recent TestRequest for this brand
 *
 * If the brand has no spec yet, suggestedFuzeTier is null and the new
 * test-request page falls back to "let lab choose".
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.brandId) {
    return NextResponse.json({ ok: false, error: "Not a brand user" }, { status: 403 });
  }

  const brand = await prisma.brand.findUnique({
    where: { id: user.brandId },
    select: {
      id: true,
      name: true,
      requiredFuzeTier: true,
      protocolDocUrl: true,
      requiresApproval: true,
      icpCadenceEveryNBatches: true,
    },
  });
  if (!brand) {
    return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
  }

  const lastRequest = await prisma.testRequest.findFirst({
    where: { brandId: brand.id },
    select: {
      id: true,
      labId: true,
      priority: true,
      createdAt: true,
      lab: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    defaults: {
      brandId: brand.id,
      brandName: brand.name,
      requiredFuzeTier: brand.requiredFuzeTier,
      protocolDocUrl: brand.protocolDocUrl,
      requiresApproval: !!brand.requiresApproval,
      icpCadenceEveryNBatches: brand.icpCadenceEveryNBatches,
      suggestedLab: lastRequest?.lab || null,
      suggestedPriority: lastRequest?.priority || "NORMAL",
      lastRequestAt: lastRequest?.createdAt?.toISOString() || null,
    },
  });
}
