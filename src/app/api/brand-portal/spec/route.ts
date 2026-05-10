// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Brand spec — the brand-stipulated FUZE specification that drives:
 *   - order-application validation (src/lib/order-validation.ts)
 *   - the daily ICP cadence cron (/api/cron/test-cadence)
 *   - the supply-chain dashboard's "in spec / overdue" status
 *
 * GET  /api/brand-portal/spec — current spec for the caller's brand
 * PATCH /api/brand-portal/spec — update spec (brand managers + admins)
 */

const ALLOWED_TIERS = ["F1", "F2", "F3", "F4"];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // Admin / EMPLOYEE / sales roles can view any brand's spec via ?brandId=.
  // Brand users always get their own brand.
  const url = new URL(req.url);
  const queryBrandId = url.searchParams.get("brandId") || undefined;
  const adminLikeRoles = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BRAND_MANAGER"];
  const brandId = adminLikeRoles.includes(user.role) ? queryBrandId || user.brandId : user.brandId;

  if (!brandId) {
    return NextResponse.json({ ok: false, error: "No brand associated" }, { status: 403 });
  }
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      requiredFuzeTier: true,
      icpCadenceEveryNBatches: true,
      icpCadenceEveryLitersConsumed: true,
      protocolDocUrl: true,
      brandSpecUpdatedAt: true,
    },
  });
  if (!brand) return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
  return NextResponse.json({ ok: true, brand });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // Only brand managers, admins, or sales reps can edit the spec.
  // Brand users (read-only viewers) shouldn't be able to flip the
  // cadence on their own account; that's a contractual change.
  const editAllowedRoles = ["ADMIN", "EMPLOYEE", "BRAND_MANAGER", "SALES_MANAGER", "SALES_REP"];
  if (!editAllowedRoles.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Read-only access" }, { status: 403 });
  }

  const brandId = user.brandId || (user.role === "ADMIN" || user.role === "EMPLOYEE" ? null : null);
  // Admins must pass brandId in body to act on a specific brand.
  const body = await req.json().catch(() => ({}));
  const targetBrandId = brandId || body.brandId;
  if (!targetBrandId) {
    return NextResponse.json({ ok: false, error: "brandId required" }, { status: 400 });
  }

  const data: any = { brandSpecUpdatedAt: new Date() };

  if (body.requiredFuzeTier !== undefined) {
    const tier = body.requiredFuzeTier;
    if (tier === null || tier === "") {
      data.requiredFuzeTier = null;
    } else if (!ALLOWED_TIERS.includes(String(tier))) {
      return NextResponse.json(
        { ok: false, error: `requiredFuzeTier must be one of ${ALLOWED_TIERS.join(", ")}` },
        { status: 400 },
      );
    } else {
      data.requiredFuzeTier = tier;
    }
  }

  if (body.icpCadenceEveryNBatches !== undefined) {
    const v = body.icpCadenceEveryNBatches;
    if (v === null || v === "") data.icpCadenceEveryNBatches = null;
    else {
      const n = Math.floor(Number(v));
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json(
          { ok: false, error: "icpCadenceEveryNBatches must be a positive integer" },
          { status: 400 },
        );
      }
      data.icpCadenceEveryNBatches = n;
    }
  }

  if (body.icpCadenceEveryLitersConsumed !== undefined) {
    const v = body.icpCadenceEveryLitersConsumed;
    if (v === null || v === "") data.icpCadenceEveryLitersConsumed = null;
    else {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json(
          { ok: false, error: "icpCadenceEveryLitersConsumed must be > 0" },
          { status: 400 },
        );
      }
      data.icpCadenceEveryLitersConsumed = n;
    }
  }

  if (body.protocolDocUrl !== undefined) {
    data.protocolDocUrl = body.protocolDocUrl ? String(body.protocolDocUrl) : null;
  }

  const brand = await prisma.brand.update({
    where: { id: targetBrandId },
    data,
    select: {
      id: true,
      name: true,
      requiredFuzeTier: true,
      icpCadenceEveryNBatches: true,
      icpCadenceEveryLitersConsumed: true,
      protocolDocUrl: true,
      brandSpecUpdatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, brand });
}
