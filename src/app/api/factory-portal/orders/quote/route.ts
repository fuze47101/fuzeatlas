// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  STOCK_MG_PER_L,
  DEFAULT_WASTAGE_PCT,
} from "@/lib/order-validation";

/**
 * /api/factory-portal/orders/quote
 *
 * POST — auto-compute FUZE volume + quote price for a factory order.
 *
 * Input JSON:
 *   {
 *     fabricId: string,
 *     fabricMassKg: number,
 *     fuzeTier: "F1" | "F2" | "F3" | "F4",
 *     wastageFactorPct?: number,   // default 10
 *     overrideTierIndex?: number   // admin override only
 *   }
 *
 * Output:
 *   {
 *     ok: true,
 *     fabric: { id, fuzeNumber, customerCode, brandId, brand },
 *     factory: { id, name, distributorId, distributorTierIndex },
 *     distributor: { id, name, localCurrency },
 *     tier: {
 *       tierIndex, tierName, pricePerLiter, currency, source
 *     },
 *     volume: {
 *       baseLiters, wastagePct, totalLiters, bottles
 *     },
 *     quote: {
 *       pricePerLiter, currency, totalPrice
 *     },
 *     warnings: string[]
 *   }
 *
 * RBAC: FACTORY_USER / FACTORY_MANAGER (own factory) + ADMIN /
 * EMPLOYEE for any factory via ?factoryId=...
 */

const TIER_MG_PER_KG: Record<string, number> = {
  F1: 1.0,
  F2: 0.75,
  F3: 0.5,
  F4: 0.25,
};

const FACTORY_ROLES = new Set(["FACTORY_USER", "FACTORY_MANAGER"]);
const INTERNAL = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"]);

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isFactory = FACTORY_ROLES.has(user.role);
    const isInternal = INTERNAL.has(user.role);
    if (!isFactory && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const fabricId = body.fabricId;
    const fabricMassKg = Number(body.fabricMassKg);
    const fuzeTier = (body.fuzeTier || "").toString().toUpperCase();
    const wastagePct =
      body.wastageFactorPct != null ? Number(body.wastageFactorPct) : DEFAULT_WASTAGE_PCT;

    if (!fabricId) {
      return NextResponse.json({ ok: false, error: "fabricId required" }, { status: 400 });
    }
    if (!Number.isFinite(fabricMassKg) || fabricMassKg <= 0) {
      return NextResponse.json(
        { ok: false, error: "fabricMassKg must be > 0" },
        { status: 400 },
      );
    }
    if (!TIER_MG_PER_KG[fuzeTier]) {
      return NextResponse.json(
        { ok: false, error: "fuzeTier must be one of F1/F2/F3/F4" },
        { status: 400 },
      );
    }

    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryId: true,
        brandId: true,
        brand: { select: { id: true, name: true, requiredFuzeTier: true } },
        factory: {
          select: {
            id: true,
            name: true,
            distributorId: true,
            distributorTierIndex: true,
            country: true,
            distributor: {
              select: { id: true, name: true, localCurrency: true },
            },
          },
        },
      },
    });
    if (!fabric) {
      return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
    }

    if (isFactory) {
      if (!user.factoryId) {
        return NextResponse.json(
          { ok: false, error: "Your user is not linked to a factory." },
          { status: 400 },
        );
      }
      if (fabric.factoryId && fabric.factoryId !== user.factoryId) {
        return NextResponse.json(
          { ok: false, error: "This fabric belongs to another factory." },
          { status: 403 },
        );
      }
    }

    const factory = fabric.factory;
    const warnings: string[] = [];

    // ── Volume math (canonical) ───────────────────────────────────
    const tierMgPerKg = TIER_MG_PER_KG[fuzeTier];
    const baseLiters = (tierMgPerKg * fabricMassKg) / STOCK_MG_PER_L;
    const totalLiters = baseLiters * (1 + wastagePct / 100);
    const bottles = Math.ceil(totalLiters / 19);

    // ── Tier resolution ───────────────────────────────────────────
    let tierIndex: number | null = factory?.distributorTierIndex || null;
    let tierSource = "factory.distributorTierIndex";
    if (isInternal && body.overrideTierIndex != null) {
      tierIndex = Number(body.overrideTierIndex);
      tierSource = "overrideTierIndex (admin)";
    }
    if (!tierIndex) {
      warnings.push(
        "This factory has no distributor tier assigned. Quote will use the distributor's default tier if present, or FUZE direct pricing otherwise.",
      );
    }

    const distributorId = factory?.distributorId || null;
    let pricingRow: any = null;
    if (distributorId) {
      pricingRow = tierIndex
        ? await prisma.distributorPricing.findFirst({
            where: { distributorId, tierIndex, active: true },
          })
        : null;
      if (!pricingRow) {
        pricingRow = await prisma.distributorPricing.findFirst({
          where: { distributorId, isDefault: true, active: true },
        });
        if (pricingRow) tierSource = "distributor default row";
      }
    }

    // Direct-from-FUZE fallback — fabric.factory has no distributor.
    // We still let the quote compute volume; pricePerLiter will be
    // null and the caller decides how to surface that.
    const pricePerLiter = pricingRow?.pricePerLiter ?? null;
    const currency =
      pricingRow?.currency || factory?.distributor?.localCurrency || "USD";
    const totalPrice = pricePerLiter != null ? totalLiters * pricePerLiter : null;

    if (pricePerLiter == null) {
      warnings.push(
        "No pricing tier matched for this factory. The order can still be placed but the distributor needs to confirm a price before approval.",
      );
    }

    // Brand tier mismatch warning — the brand may stipulate a
    // required tier (F1 / F2 / F3 / F4); flag if the picked tier is
    // weaker than required.
    const required = fabric.brand?.requiredFuzeTier;
    if (required && required !== fuzeTier) {
      warnings.push(
        `Brand ${fabric.brand?.name} stipulates ${required}; this quote is ${fuzeTier}. Brand approval may be required.`,
      );
    }

    return NextResponse.json({
      ok: true,
      fabric: {
        id: fabric.id,
        fuzeNumber: fabric.fuzeNumber,
        customerCode: fabric.customerCode,
        brandId: fabric.brandId,
        brand: fabric.brand,
      },
      factory: {
        id: factory?.id,
        name: factory?.name,
        country: factory?.country,
        distributorId: factory?.distributorId,
        distributorTierIndex: factory?.distributorTierIndex,
      },
      distributor: factory?.distributor || null,
      tier: {
        tierIndex,
        tierName: pricingRow?.tierName || (tierIndex ? `Tier ${tierIndex}` : null),
        pricePerLiter,
        currency,
        source: tierSource,
      },
      volume: {
        baseLiters: Number(baseLiters.toFixed(2)),
        wastagePct,
        totalLiters: Number(totalLiters.toFixed(2)),
        bottles,
      },
      quote: {
        pricePerLiter,
        currency,
        totalPrice: totalPrice != null ? Number(totalPrice.toFixed(2)) : null,
      },
      warnings,
    });
  } catch (e: any) {
    console.error("[orders/quote] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Quote failed" },
      { status: 500 },
    );
  }
}
