// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/brand-portal/supply-chain/map
 *
 * MB-2 — drives the geographic map at
 * /brand-portal/supply-chain/map. Returns every factory currently
 * linked to the caller's brand via SupplyChainLink (BRAND → FACTORY,
 * relation=SUPPLIES, active), plus the lifetime FUZE consumption
 * for each factory restricted to consumption rows tagged to this
 * brand. Pin size is driven by that figure.
 *
 * Pins without lat/lng land in a "Needs geocoding" list rather than
 * the map itself so admins can finish the geocode pass.
 */

const BRAND_ROLES = new Set(["BRAND_USER", "BRAND_MANAGER", "ADMIN", "EMPLOYEE"]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BRAND_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!user.brandId) {
    return NextResponse.json(
      { ok: false, error: "No brand associated with this user" },
      { status: 403 },
    );
  }

  const brand = await prisma.brand.findUnique({
    where: { id: user.brandId },
    select: { id: true, name: true, lat: true, lng: true },
  });
  if (!brand) {
    return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
  }

  // Linked factories.
  const links = await prisma.supplyChainLink.findMany({
    where: {
      fromType: "BRAND",
      fromId: brand.id,
      toType: "FACTORY",
      relation: "SUPPLIES",
      active: true,
    },
    select: { toId: true },
  });
  const factoryIds = links.map((l) => l.toId);
  if (factoryIds.length === 0) {
    return NextResponse.json({
      ok: true,
      brand: { id: brand.id, name: brand.name, lat: brand.lat, lng: brand.lng },
      pins: [],
      ungeocoded: [],
      totalLifetimeLiters: 0,
    });
  }

  const factories = await prisma.factory.findMany({
    where: { id: { in: factoryIds } },
    select: {
      id: true,
      name: true,
      city: true,
      country: true,
      lat: true,
      lng: true,
    },
  });

  // Lifetime FUZE consumption per factory FOR THIS BRAND.
  const consumptionByFactory = await prisma.fuzeConsumption.groupBy({
    by: ["factoryId"],
    where: {
      brandId: brand.id,
      factoryId: { in: factoryIds },
    },
    _sum: { litersUsed: true },
  });
  const litersMap = new Map<string, number>();
  for (const row of consumptionByFactory) {
    if (row.factoryId) litersMap.set(row.factoryId, row._sum?.litersUsed || 0);
  }

  const pins: any[] = [];
  const ungeocoded: any[] = [];
  let totalLifetimeLiters = 0;
  for (const f of factories) {
    const liters = litersMap.get(f.id) || 0;
    totalLifetimeLiters += liters;
    const entry = {
      id: f.id,
      name: f.name,
      city: f.city,
      country: f.country,
      lat: f.lat,
      lng: f.lng,
      lifetimeLiters: liters,
    };
    if (f.lat == null || f.lng == null) {
      ungeocoded.push(entry);
    } else {
      pins.push(entry);
    }
  }

  // Largest pins first so smaller dots render on top (clearer hovering).
  pins.sort((a, b) => b.lifetimeLiters - a.lifetimeLiters);

  return NextResponse.json({
    ok: true,
    brand: { id: brand.id, name: brand.name, lat: brand.lat, lng: brand.lng },
    pins,
    ungeocoded,
    totalLifetimeLiters,
  });
}
