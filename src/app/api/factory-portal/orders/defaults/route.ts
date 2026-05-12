// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/factory-portal/orders/defaults
 *
 * NEED-3 — workflow auto-fill. Returns the inference bundle that
 * /factory-portal/orders pre-fills the new-order form with. Cuts
 * the form down from ~15 fields to ~2 (volume + tier confirmation)
 * for the common case.
 *
 * Cross-table inference:
 *   - factoryAddress       → factory.address/city/country
 *   - distributor          → factory.distributorId resolved
 *   - activeBrands         → SupplyChainLink where toType=FACTORY,
 *                            toId=factory.id, relation=SUPPLIES.
 *                            One row per brand currently supplying
 *                            FUZE through this factory.
 *   - lastOrderShape       → factory's most recent FuzeOrder so we
 *                            can pre-fill orderType + treatmentMethod
 *                            + wastageFactorPct on a "do it again"
 *                            basis.
 *   - suggestedBrand       → activeBrands[0] OR the brand on
 *                            lastOrder, whichever exists first.
 *   - suggestedFuzeTier    → that brand's requiredFuzeTier, OR the
 *                            tier on lastOrder.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.factoryId) {
    return NextResponse.json({ ok: false, error: "Not a factory user" }, { status: 403 });
  }

  const factory = await prisma.factory.findUnique({
    where: { id: user.factoryId },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      country: true,
      distributorId: true,
      distributor: { select: { id: true, name: true } },
    },
  });
  if (!factory) {
    return NextResponse.json({ ok: false, error: "Factory not found" }, { status: 404 });
  }

  // Active brand supply links — brands currently supplied by this factory.
  const links = await prisma.supplyChainLink.findMany({
    where: {
      toType: "FACTORY",
      toId: factory.id,
      relation: "SUPPLIES",
      active: true,
    },
    select: { fromType: true, fromId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const brandIds = links
    .filter((l) => l.fromType === "BRAND")
    .map((l) => l.fromId);
  const brandsRaw = brandIds.length
    ? await prisma.brand.findMany({
        where: { id: { in: brandIds } },
        select: {
          id: true,
          name: true,
          requiredFuzeTier: true,
          requiresApproval: true,
          protocolDocUrl: true,
        },
      })
    : [];
  // Preserve recency ordering from the link query.
  const byId = new Map(brandsRaw.map((b) => [b.id, b]));
  const activeBrands = brandIds
    .map((id) => byId.get(id))
    .filter(Boolean);

  // Most recent order for this factory — drives orderType / method /
  // wastage defaults so the form mirrors how this factory actually
  // works rather than the global defaults.
  const lastOrder = await prisma.fuzeOrder.findFirst({
    where: { factoryId: factory.id },
    select: {
      id: true,
      orderType: true,
      fuzeTier: true,
      treatmentMethod: true,
      wastageFactorPct: true,
      brandId: true,
      volumeLiters: true,
      shippingAddress: true,
      shippingCity: true,
      shippingCountry: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Pick suggested brand: the first active link wins, else the brand
  // on the last order, else null.
  const suggestedBrand =
    activeBrands[0] ||
    (lastOrder?.brandId
      ? await prisma.brand.findUnique({
          where: { id: lastOrder.brandId },
          select: { id: true, name: true, requiredFuzeTier: true, requiresApproval: true, protocolDocUrl: true },
        })
      : null);

  // Suggested tier: brand spec wins, else last order's tier, else null.
  const suggestedFuzeTier =
    suggestedBrand?.requiredFuzeTier || lastOrder?.fuzeTier || null;

  const defaults = {
    factoryId: factory.id,
    factoryName: factory.name,
    distributor: factory.distributor || null,
    activeBrands: activeBrands.map((b: any) => ({
      id: b.id,
      name: b.name,
      requiredFuzeTier: b.requiredFuzeTier,
      requiresApproval: !!b.requiresApproval,
      protocolDocUrl: b.protocolDocUrl,
    })),
    suggestedBrand: suggestedBrand
      ? {
          id: suggestedBrand.id,
          name: suggestedBrand.name,
          requiredFuzeTier: suggestedBrand.requiredFuzeTier,
          requiresApproval: !!suggestedBrand.requiresApproval,
          protocolDocUrl: suggestedBrand.protocolDocUrl,
        }
      : null,
    suggestedFuzeTier,
    suggestedShippingAddress: lastOrder?.shippingAddress || factory.address || null,
    suggestedShippingCity: lastOrder?.shippingCity || factory.city || null,
    suggestedShippingCountry: lastOrder?.shippingCountry || factory.country || null,
    lastOrder: lastOrder
      ? {
          id: lastOrder.id,
          orderType: lastOrder.orderType,
          fuzeTier: lastOrder.fuzeTier,
          treatmentMethod: lastOrder.treatmentMethod,
          wastageFactorPct: lastOrder.wastageFactorPct,
          volumeLiters: lastOrder.volumeLiters,
          createdAt: lastOrder.createdAt.toISOString(),
        }
      : null,
  };

  return NextResponse.json({ ok: true, defaults });
}
