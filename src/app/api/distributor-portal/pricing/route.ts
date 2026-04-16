// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/distributor-portal/pricing
 * Returns distributor's pricing tiers
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);

    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const distributorId = isDistributor ? user.distributorId : url.searchParams.get("distributorId");

    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor ID required" }, { status: 400 });
    }

    const pricing = await prisma.distributorPricing.findMany({
      where: { distributorId },
      include: {
        factory: { select: { id: true, name: true, country: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    // Get factories for dropdown — assigned factories first, then all others
    const allFactories = await prisma.factory.findMany({
      where: { active: true },
      select: { id: true, name: true, country: true, distributorId: true },
      orderBy: { name: "asc" },
    });

    // Sort: assigned to this distributor first, then others
    const factories = allFactories
      .map((f) => ({
        id: f.id,
        name: f.name,
        country: f.country,
        assigned: f.distributorId === distributorId,
      }))
      .sort((a, b) => {
        if (a.assigned && !b.assigned) return -1;
        if (!a.assigned && b.assigned) return 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ ok: true, pricing, factories });
  } catch (e: any) {
    console.error("Distributor pricing GET error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load pricing" }, { status: 500 });
  }
}

/**
 * POST /api/distributor-portal/pricing
 * Create a new pricing tier
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = ["ADMIN", "EMPLOYEE"].includes(user.role);

    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const distributorId = isDistributor ? user.distributorId : body.distributorId;

    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor ID required" }, { status: 400 });
    }

    const tier = await prisma.distributorPricing.create({
      data: {
        distributorId,
        factoryId: body.factoryId || null,
        country: body.country || null,
        region: body.region || null,
        pricePerLiter: Number(body.pricePerLiter),
        currency: body.currency || "USD",
        hangtagPricePerUnit: body.hangtagPricePerUnit ? Number(body.hangtagPricePerUnit) : null,
        volumeDiscounts: body.volumeDiscounts || null,
        leadTimeDays: body.leadTimeDays ? Number(body.leadTimeDays) : null,
        isDefault: body.isDefault || false,
        active: true,
      },
      include: {
        factory: { select: { id: true, name: true, country: true } },
      },
    });

    return NextResponse.json({ ok: true, tier });
  } catch (e: any) {
    console.error("Distributor pricing POST error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to create pricing tier" }, { status: 500 });
  }
}

/**
 * PATCH /api/distributor-portal/pricing
 * Update a pricing tier
 */
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = ["ADMIN", "EMPLOYEE"].includes(user.role);

    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { tierId, ...updates } = body;

    if (!tierId) {
      return NextResponse.json({ ok: false, error: "Tier ID required" }, { status: 400 });
    }

    const data: any = {};
    if (updates.pricePerLiter !== undefined) data.pricePerLiter = Number(updates.pricePerLiter);
    if (updates.currency !== undefined) data.currency = updates.currency;
    if (updates.hangtagPricePerUnit !== undefined) data.hangtagPricePerUnit = Number(updates.hangtagPricePerUnit);
    if (updates.volumeDiscounts !== undefined) data.volumeDiscounts = updates.volumeDiscounts;
    if (updates.leadTimeDays !== undefined) data.leadTimeDays = Number(updates.leadTimeDays);
    if (updates.active !== undefined) data.active = updates.active;
    if (updates.isDefault !== undefined) data.isDefault = updates.isDefault;

    const tier = await prisma.distributorPricing.update({
      where: { id: tierId },
      data,
      include: {
        factory: { select: { id: true, name: true, country: true } },
      },
    });

    return NextResponse.json({ ok: true, tier });
  } catch (e: any) {
    console.error("Distributor pricing PATCH error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to update pricing" }, { status: 500 });
  }
}
