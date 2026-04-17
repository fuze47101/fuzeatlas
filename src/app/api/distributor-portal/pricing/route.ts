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
    const distributorId = isDistributor
      ? user.distributorId
      : url.searchParams.get("distributorId");

    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor ID required" }, { status: 400 });
    }

    const [pricing, distributor] = await Promise.all([
      prisma.distributorPricing.findMany({
        where: { distributorId },
        include: {
          factory: { select: { id: true, name: true, country: true } },
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      }),
      prisma.distributor.findUnique({
        where: { id: distributorId },
        select: {
          id: true,
          name: true,
          country: true,
          region: true,
          coverageCountries: true,
          localCurrency: true,
        },
      }),
    ]);

    // Parse coverageCountries ("India, Bangladesh" | JSON array | null)
    const coverage = parseCoverage(distributor?.coverageCountries);

    // Get factories for dropdown — bucket by assignment, then by coverage, then rest
    const allFactories = await prisma.factory.findMany({
      where: { active: true },
      select: { id: true, name: true, country: true, distributorId: true },
      orderBy: { name: "asc" },
    });

    const factories = allFactories
      .map((f) => {
        const inCoverage =
          f.country && coverage.some((c) => c.toLowerCase() === f.country!.toLowerCase());
        return {
          id: f.id,
          name: f.name,
          country: f.country,
          assigned: f.distributorId === distributorId,
          inCoverage: Boolean(inCoverage && f.distributorId !== distributorId),
        };
      })
      .sort((a, b) => {
        const rank = (x: any) => (x.assigned ? 0 : x.inCoverage ? 1 : 2);
        const d = rank(a) - rank(b);
        return d !== 0 ? d : a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      ok: true,
      pricing,
      factories,
      distributor,
      coverage,
    });
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
        minOrderLiters: body.minOrderLiters ? Number(body.minOrderLiters) : null,
        hangtagPricePerUnit: body.hangtagPricePerUnit ? Number(body.hangtagPricePerUnit) : null,
        hangtagMinOrder: body.hangtagMinOrder ? Number(body.hangtagMinOrder) : null,
        volumeDiscounts: body.volumeDiscounts || null,
        leadTimeDays: body.leadTimeDays ? Number(body.leadTimeDays) : null,
        isDefault: body.isDefault || false,
        active: true,
        notes: body.notes || null,
      },
      include: {
        factory: { select: { id: true, name: true, country: true } },
      },
    });

    return NextResponse.json({ ok: true, tier });
  } catch (e: any) {
    console.error("Distributor pricing POST error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Failed to create pricing tier" },
      { status: 500 },
    );
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
    // Scope updates (only admin can change scope)
    if (isInternal && updates.factoryId !== undefined) data.factoryId = updates.factoryId || null;
    if (isInternal && updates.country !== undefined) data.country = updates.country || null;
    if (isInternal && updates.region !== undefined) data.region = updates.region || null;

    if (updates.pricePerLiter !== undefined) data.pricePerLiter = Number(updates.pricePerLiter);
    if (updates.currency !== undefined) data.currency = updates.currency;
    if (updates.minOrderLiters !== undefined)
      data.minOrderLiters = updates.minOrderLiters ? Number(updates.minOrderLiters) : null;
    if (updates.hangtagPricePerUnit !== undefined)
      data.hangtagPricePerUnit = updates.hangtagPricePerUnit
        ? Number(updates.hangtagPricePerUnit)
        : null;
    if (updates.hangtagMinOrder !== undefined)
      data.hangtagMinOrder = updates.hangtagMinOrder ? Number(updates.hangtagMinOrder) : null;
    if (updates.volumeDiscounts !== undefined) data.volumeDiscounts = updates.volumeDiscounts;
    if (updates.leadTimeDays !== undefined)
      data.leadTimeDays = updates.leadTimeDays ? Number(updates.leadTimeDays) : null;
    if (updates.active !== undefined) data.active = updates.active;
    if (updates.isDefault !== undefined) data.isDefault = updates.isDefault;
    if (updates.notes !== undefined) data.notes = updates.notes || null;

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
    return NextResponse.json(
      { ok: false, error: e.message || "Failed to update pricing" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/distributor-portal/pricing?tierId=...
 * Soft-delete a pricing tier (sets active=false). Admin/Employee only.
 */
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const tierId = url.searchParams.get("tierId");
    if (!tierId) {
      return NextResponse.json({ ok: false, error: "Tier ID required" }, { status: 400 });
    }

    // Hard delete — the data is fully owned by the distributor record and
    // carries no downstream foreign-key dependencies.
    await prisma.distributorPricing.delete({ where: { id: tierId } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Distributor pricing DELETE error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Failed to delete pricing" },
      { status: 500 },
    );
  }
}

/**
 * Parse coverageCountries into a string array.
 * Accepts: JSON array, comma-separated string, null.
 */
function parseCoverage(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  const s = String(v).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
    } catch {}
  }
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
