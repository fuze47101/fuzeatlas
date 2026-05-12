// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/distributor-portal/orders/defaults
 *
 * NEED-3 — distributor restock auto-fill. Suggests carboy / gaylord /
 * container size based on the median volume of this distributor's
 * last 3 PRODUCTION orders. New accounts (no order history) fall
 * back to GAYLORD x1 — the smallest international shipment unit.
 *
 * Also suggests the most recent shipping address so a distributor
 * with one warehouse doesn't re-type it every time.
 */

const UNIT_TIERS = [
  { unitType: "CARBOY", liters: 19 },
  { unitType: "GAYLORD", liters: 608 },
  { unitType: "CONTAINER_20", liters: 6080 },
  { unitType: "CONTAINER_40", liters: 12160 },
];

function suggestUnit(targetLiters: number): { unitType: string; unitQuantity: number } {
  if (targetLiters <= 0) return { unitType: "GAYLORD", unitQuantity: 1 };
  // Pick the largest unit that the target meets or exceeds.
  for (let i = UNIT_TIERS.length - 1; i >= 0; i--) {
    if (targetLiters >= UNIT_TIERS[i].liters) {
      const qty = Math.max(1, Math.round(targetLiters / UNIT_TIERS[i].liters));
      return { unitType: UNIT_TIERS[i].unitType, unitQuantity: qty };
    }
  }
  return { unitType: "CARBOY", unitQuantity: Math.max(1, Math.round(targetLiters / 19)) };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.distributorId) {
    return NextResponse.json({ ok: false, error: "Not a distributor user" }, { status: 403 });
  }

  const distributor = await prisma.distributor.findUnique({
    where: { id: user.distributorId },
    select: { id: true, name: true },
  });
  if (!distributor) {
    return NextResponse.json({ ok: false, error: "Distributor not found" }, { status: 404 });
  }

  const lastOrders = await prisma.fuzeOrder.findMany({
    where: {
      distributorId: distributor.id,
      orderType: "PRODUCTION",
      volumeLiters: { not: null },
    },
    select: {
      id: true,
      volumeLiters: true,
      fuzeTier: true,
      shippingAddress: true,
      shippingCity: true,
      shippingCountry: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const volumes = lastOrders.map((o) => o.volumeLiters || 0).filter((v) => v > 0);
  const medianVolume = median(volumes);
  const suggested = suggestUnit(medianVolume);
  const mostRecent = lastOrders[0];

  return NextResponse.json({
    ok: true,
    defaults: {
      distributorId: distributor.id,
      distributorName: distributor.name,
      hasHistory: lastOrders.length > 0,
      lastOrderCount: lastOrders.length,
      medianVolumeLiters: medianVolume,
      suggestedUnitType: suggested.unitType,
      suggestedUnitQuantity: suggested.unitQuantity,
      suggestedFuzeTier: mostRecent?.fuzeTier || "F1",
      suggestedShippingAddress: mostRecent?.shippingAddress || null,
      suggestedShippingCity: mostRecent?.shippingCity || null,
      suggestedShippingCountry: mostRecent?.shippingCountry || null,
    },
  });
}
