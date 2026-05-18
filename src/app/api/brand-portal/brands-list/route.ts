// @ts-nocheck
/**
 * GET /api/brand-portal/brands-list
 *
 * Slim brand directory for the factory order multi-brand allocation
 * picker. Returns every Brand the caller's factory has any
 * SupplyChainLink to (so a factory can allocate an order to ANY of
 * their connected brands, not just brands they happen to have
 * loaded fabric for).
 *
 * Audit caught May 16: /factory-portal/orders/new was calling this
 * endpoint and 404'ing on every load. A .catch() fallback distilled
 * brands from the loaded fabric list, which worked but missed brands
 * the factory is connected to but hasn't submitted fabric for yet.
 *
 * Scope:
 *   - FACTORY_USER / FACTORY_MANAGER → brands linked to caller's factory
 *     via SupplyChainLink (fromType=BRAND, toType=FACTORY) OR brands
 *     with at least one Fabric stamped to caller's factoryId
 *   - DISTRIBUTOR_USER → brands whose linked factories belong to caller's
 *     distributor
 *   - ADMIN/EMPLOYEE → all active brands
 *
 * Response: { ok, brands: [{ id, name, website }] }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const internalRoles = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];
    const isFactory = user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER";
    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = internalRoles.includes(user.role);

    let brands: { id: string; name: string; website: string | null }[] = [];

    if (isInternal) {
      brands = await prisma.brand.findMany({
        select: { id: true, name: true, website: true },
        orderBy: { name: "asc" },
      });
    } else if (isFactory && user.factoryId) {
      // Two paths to find brands connected to this factory:
      //  1. SupplyChainLink rows (the canonical model going forward)
      //  2. Direct Fabric.factoryId match (legacy fallback while
      //     SupplyChainLink data is still being backfilled)
      const [linkRows, fabricRows] = await Promise.all([
        prisma.supplyChainLink.findMany({
          where: {
            active: true,
            fromType: "BRAND",
            toType: "FACTORY",
            toId: user.factoryId,
          },
          select: { fromId: true },
        }),
        prisma.fabric.findMany({
          where: { factoryId: user.factoryId, brandId: { not: null } },
          select: { brandId: true },
          distinct: ["brandId"],
        }),
      ]);
      const brandIds = new Set<string>();
      for (const r of linkRows) brandIds.add(r.fromId);
      for (const r of fabricRows) if (r.brandId) brandIds.add(r.brandId);
      if (brandIds.size > 0) {
        brands = await prisma.brand.findMany({
          where: { id: { in: Array.from(brandIds) } },
          select: { id: true, name: true, website: true },
          orderBy: { name: "asc" },
        });
      }
    } else if (isDistributor && user.distributorId) {
      // Brands connected to any factory under this distributor.
      const factories = await prisma.factory.findMany({
        where: { distributorId: user.distributorId },
        select: { id: true },
      });
      const factoryIds = factories.map((f) => f.id);
      if (factoryIds.length > 0) {
        const fabrics = await prisma.fabric.findMany({
          where: { factoryId: { in: factoryIds }, brandId: { not: null } },
          select: { brandId: true },
          distinct: ["brandId"],
        });
        const brandIds = fabrics.map((f) => f.brandId).filter(Boolean) as string[];
        if (brandIds.length > 0) {
          brands = await prisma.brand.findMany({
            where: { id: { in: brandIds } },
            select: { id: true, name: true, website: true },
            orderBy: { name: "asc" },
          });
        }
      }
    } else {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, brands });
  } catch (e: any) {
    console.error("[brand-portal/brands-list] failed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
