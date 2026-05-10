// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/factory-portal/specs  (Phase 4F — DO+OVERSEE)
 *
 * Brand specs that apply to the caller's factory. Reads
 * SupplyChainLink (FACTORY-SUPPLIES-BRAND) to find every brand that
 * sources from this factory, then surfaces each brand's stipulated
 * spec: requiredFuzeTier, ICP cadence (by N orders or X liters), and
 * the protocol document URL when present.
 *
 * Factory OVERSEE: see all brand specs that apply.
 */

const ACK_ROLES = ["ADMIN", "EMPLOYEE", "FACTORY_USER", "FACTORY_MANAGER"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ACK_ROLES.includes(user.role)) return forbidden();
  if (!user.factoryId) return forbidden();

  const factoryId = user.factoryId;

  // Resolve brand set via SupplyChainLink first; fall back to fabric-
  // based brand discovery if no links exist.
  const links = await prisma.supplyChainLink.findMany({
    where: {
      fromType: "FACTORY",
      fromId: factoryId,
      toType: "BRAND",
      relation: "SUPPLIES",
      active: true,
    },
    select: { toId: true },
  });

  const brandIds =
    links.length > 0
      ? links.map((l: any) => l.toId)
      : (
          await prisma.fabric.findMany({
            where: { factoryId, brandId: { not: null } },
            select: { brandId: true },
            distinct: ["brandId"],
          })
        ).map((f: any) => f.brandId).filter(Boolean);

  const brands = await prisma.brand.findMany({
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
  });

  return NextResponse.json({ ok: true, brands });
}
