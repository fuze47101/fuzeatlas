// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Admin-side CRUD for the per-brand pricing tier ladder.
 *
 * GET    /api/admin/brand-pricing-tiers?brandId=…  — list rungs
 * POST   /api/admin/brand-pricing-tiers            — add a rung
 * PATCH  /api/admin/brand-pricing-tiers            — edit a rung
 * DELETE /api/admin/brand-pricing-tiers?id=…       — remove a rung
 *
 * Only ADMIN / EMPLOYEE / SALES_MANAGER can edit. Brand managers can
 * GET (so they can see their own ladder via the brand portal) but
 * not write — pricing changes are a contract change and route
 * through the AM.
 */

const ALLOWED_EDIT_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brandId");
  if (!brandId) {
    return NextResponse.json({ ok: false, error: "brandId required" }, { status: 400 });
  }
  const tiers = await prisma.brandPricingTier.findMany({
    where: { brandId },
    orderBy: { thresholdLiters: "asc" },
  });
  return NextResponse.json({ ok: true, tiers });
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!ALLOWED_EDIT_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { brandId, thresholdLiters, discountPct, label, active } = body;
  if (!brandId || thresholdLiters == null || discountPct == null) {
    return NextResponse.json(
      { ok: false, error: "brandId, thresholdLiters, discountPct required" },
      { status: 400 },
    );
  }
  const t = Number(thresholdLiters);
  const d = Number(discountPct);
  if (!Number.isFinite(t) || t < 0) {
    return NextResponse.json({ ok: false, error: "thresholdLiters must be ≥ 0" }, { status: 400 });
  }
  if (!Number.isFinite(d) || d < 0 || d > 100) {
    return NextResponse.json({ ok: false, error: "discountPct must be 0–100" }, { status: 400 });
  }
  const tier = await prisma.brandPricingTier.create({
    data: {
      brandId,
      thresholdLiters: t,
      discountPct: d,
      label: label ? String(label) : null,
      active: active === undefined ? true : Boolean(active),
    },
  });
  return NextResponse.json({ ok: true, tier });
}

export async function PATCH(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!ALLOWED_EDIT_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { id, thresholdLiters, discountPct, label, active } = body;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }
  const data: any = {};
  if (thresholdLiters !== undefined) {
    const t = Number(thresholdLiters);
    if (!Number.isFinite(t) || t < 0) {
      return NextResponse.json({ ok: false, error: "thresholdLiters must be ≥ 0" }, { status: 400 });
    }
    data.thresholdLiters = t;
  }
  if (discountPct !== undefined) {
    const d = Number(discountPct);
    if (!Number.isFinite(d) || d < 0 || d > 100) {
      return NextResponse.json({ ok: false, error: "discountPct must be 0–100" }, { status: 400 });
    }
    data.discountPct = d;
  }
  if (label !== undefined) data.label = label ? String(label) : null;
  if (active !== undefined) data.active = Boolean(active);
  const tier = await prisma.brandPricingTier.update({ where: { id }, data });
  return NextResponse.json({ ok: true, tier });
}

export async function DELETE(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!ALLOWED_EDIT_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }
  await prisma.brandPricingTier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
