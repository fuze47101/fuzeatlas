// @ts-nocheck
/**
 * GET /api/admin/globe — Phase 11A.
 *
 * Returns geocoded factories / brands / labs / distributors plus
 * a sample of recent shipments (FuzeOrder rows where origin and
 * destination both have coordinates) for the supply-chain globe.
 *
 * Cache-Control: 60s.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const VIEW_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "TESTING_MANAGER"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!VIEW_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000);

  const [factories, brands, labs, distributors] = await Promise.all([
    prisma.factory.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      select: { id: true, name: true, city: true, country: true, lat: true, lng: true },
    }),
    prisma.brand.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      // Brand schema has no `country` column (unlike Factory/Lab/Distributor).
      // Selecting it threw "Unknown field" → 500 → globe page rendered the
      // empty error state Tina + Jett both reported May 13. Dropped from
      // select; brand pins on the globe just won't have a country chip in
      // the tooltip until country is added to the Brand model.
      select: { id: true, name: true, lat: true, lng: true, pipelineStage: true },
    }),
    prisma.lab.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      select: { id: true, name: true, country: true, lat: true, lng: true, isFuzeOwned: true },
    }),
    prisma.distributor.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      select: { id: true, name: true, country: true, lat: true, lng: true },
    }),
  ]);

  // Recent activity — used to pulse the node. Submission per factory
  // in the last 30 days.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);
  const recentActivity = await prisma.fabricSubmission.findMany({
    where: { createdAt: { gte: thirtyDaysAgo }, factoryId: { not: null } },
    select: { factoryId: true },
  });
  const activeFactoryIds = new Set(recentActivity.map((r) => r.factoryId).filter(Boolean));

  // Shipments — FuzeOrder rows tied to a factoryId where the factory
  // and (origin: brand or distributor) both have coords.
  const recentOrders = await prisma.fuzeOrder.findMany({
    where: {
      shippedDate: { gte: ninetyDaysAgo, not: null },
      factoryId: { not: null },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderType: true,
      shippedDate: true,
      factoryId: true,
      brandId: true,
      distributorId: true,
    },
    orderBy: { shippedDate: "desc" },
    take: 200,
  });

  const factoryMap = new Map(factories.map((f) => [f.id, f]));
  const brandMap = new Map(brands.map((b) => [b.id, b]));
  const distributorMap = new Map(distributors.map((d) => [d.id, d]));

  const shipments = recentOrders
    .map((o) => {
      const to = factoryMap.get(o.factoryId);
      // Prefer distributor as origin (real shipping origin); fall back to brand HQ.
      const from =
        (o.distributorId && distributorMap.get(o.distributorId)) ||
        (o.brandId && brandMap.get(o.brandId)) ||
        null;
      if (!from || !to) return null;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        orderType: o.orderType,
        from: { lat: from.lat, lng: from.lng, name: from.name },
        to: { lat: to.lat, lng: to.lng, name: to.name },
      };
    })
    .filter(Boolean);

  return NextResponse.json(
    {
      ok: true,
      factories: factories.map((f) => ({
        ...f,
        active: activeFactoryIds.has(f.id),
      })),
      brands,
      labs,
      distributors,
      shipments,
      counts: {
        factories: factories.length,
        brands: brands.length,
        labs: labs.length,
        distributors: distributors.length,
        shipments: shipments.length,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
