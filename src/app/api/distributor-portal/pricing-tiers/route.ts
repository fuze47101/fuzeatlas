// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * /api/distributor-portal/pricing-tiers
 *
 * Explicit 5-tier ladder editor. The underlying table is the same
 * DistributorPricing rows the older /pricing endpoint manages, but
 * this one only surfaces rows with tierIndex in 1..5 and forces
 * isDefault=false so the ladder is independent of the legacy
 * "single default row" pricing.
 *
 * Distributors assign each factory under them to a tier (via
 * Factory.distributorTierIndex on the factory record) and the quote
 * endpoint reads the pricePerLiter from the matching ladder rung.
 *
 * RBAC:
 *   GET    DISTRIBUTOR_USER (own) | ADMIN | EMPLOYEE | SALES_MANAGER
 *          | SALES_REP (any, with ?distributorId=...)
 *   POST / PATCH / DELETE
 *          DISTRIBUTOR_USER (own) | ADMIN | EMPLOYEE
 */

const INTERNAL = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"]);
const INTERNAL_WRITE = new Set(["ADMIN", "EMPLOYEE"]);

function clampTierIndex(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i >= 1 && i <= 5 ? i : null;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = INTERNAL.has(user.role);
    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const distributorId = isDistributor
      ? user.distributorId
      : url.searchParams.get("distributorId");

    if (!distributorId) {
      return NextResponse.json({
        ok: true,
        distributorId: null,
        ladder: [],
        distributor: null,
        unlinkedUser: isDistributor,
        message: isDistributor
          ? "Your user is not linked to a distributor — contact FUZE admin."
          : "Pass ?distributorId=...",
      });
    }

    const [rows, distributor] = await Promise.all([
      prisma.distributorPricing.findMany({
        where: { distributorId, tierIndex: { in: [1, 2, 3, 4, 5] } },
        orderBy: { tierIndex: "asc" },
      }),
      prisma.distributor.findUnique({
        where: { id: distributorId },
        select: { id: true, name: true, country: true, localCurrency: true },
      }),
    ]);

    // Hydrate a full 1..5 ladder so the UI can render empty rungs as
    // "+ Set tier" buttons instead of needing a separate "create" UX.
    const byIndex = new Map(rows.map((r) => [r.tierIndex, r]));
    const ladder = [1, 2, 3, 4, 5].map((i) => {
      const row = byIndex.get(i) || null;
      return {
        tierIndex: i,
        row,
      };
    });

    return NextResponse.json({ ok: true, distributorId, ladder, distributor });
  } catch (e: any) {
    console.error("[pricing-tiers] GET error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load pricing tiers" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const isDistributor = user.role === "DISTRIBUTOR_USER";
    if (!isDistributor && !INTERNAL_WRITE.has(user.role)) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const distributorId = isDistributor ? user.distributorId : body.distributorId;
    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor ID required" }, { status: 400 });
    }
    const tierIndex = clampTierIndex(body.tierIndex);
    if (!tierIndex) {
      return NextResponse.json({ ok: false, error: "tierIndex must be 1..5" }, { status: 400 });
    }
    const pricePerLiter = Number(body.pricePerLiter);
    if (!Number.isFinite(pricePerLiter) || pricePerLiter <= 0) {
      return NextResponse.json({ ok: false, error: "pricePerLiter must be > 0" }, { status: 400 });
    }

    // Upsert — at most one row per (distributorId, tierIndex).
    const existing = await prisma.distributorPricing.findFirst({
      where: { distributorId, tierIndex },
      select: { id: true },
    });

    const data: any = {
      distributorId,
      tierIndex,
      tierName: body.tierName || `Tier ${tierIndex}`,
      pricePerLiter,
      currency: body.currency || "USD",
      minOrderLiters: body.minVolumeLiters != null ? Number(body.minVolumeLiters) : null,
      active: body.active === false ? false : true,
      isDefault: false,
      notes: body.notes || null,
    };

    const row = existing
      ? await prisma.distributorPricing.update({ where: { id: existing.id }, data })
      : await prisma.distributorPricing.create({ data });

    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    console.error("[pricing-tiers] POST error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to save tier" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const isDistributor = user.role === "DISTRIBUTOR_USER";
    if (!isDistributor && !INTERNAL_WRITE.has(user.role)) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    if (isDistributor) {
      const row = await prisma.distributorPricing.findUnique({
        where: { id },
        select: { distributorId: true },
      });
      if (!row) {
        return NextResponse.json({ ok: false, error: "Tier not found" }, { status: 404 });
      }
      if (row.distributorId !== user.distributorId) {
        return NextResponse.json(
          { ok: false, error: "Cannot edit a tier owned by another distributor" },
          { status: 403 },
        );
      }
    }

    const data: any = {};
    if (updates.tierName !== undefined) data.tierName = updates.tierName || null;
    if (updates.pricePerLiter !== undefined) data.pricePerLiter = Number(updates.pricePerLiter);
    if (updates.currency !== undefined) data.currency = updates.currency;
    if (updates.minVolumeLiters !== undefined)
      data.minOrderLiters = updates.minVolumeLiters != null ? Number(updates.minVolumeLiters) : null;
    if (updates.active !== undefined) data.active = !!updates.active;
    if (updates.notes !== undefined) data.notes = updates.notes || null;

    const row = await prisma.distributorPricing.update({ where: { id }, data });
    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    console.error("[pricing-tiers] PATCH error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to update tier" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const isDistributor = user.role === "DISTRIBUTOR_USER";
    if (!isDistributor && !INTERNAL_WRITE.has(user.role)) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    if (isDistributor) {
      const row = await prisma.distributorPricing.findUnique({
        where: { id },
        select: { distributorId: true },
      });
      if (!row) return NextResponse.json({ ok: false, error: "Tier not found" }, { status: 404 });
      if (row.distributorId !== user.distributorId) {
        return NextResponse.json(
          { ok: false, error: "Cannot delete another distributor's tier" },
          { status: 403 },
        );
      }
    }

    await prisma.distributorPricing.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[pricing-tiers] DELETE error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to delete tier" },
      { status: 500 },
    );
  }
}
