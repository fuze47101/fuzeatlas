// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyPricingTierChange } from "@/lib/notify";
import { recordChange } from "@/lib/audit";

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
  // Phase 15 IMP-6 — fan out to brand users.
  notifyPricingTierChange({
    brandId,
    changeSummary: `New tier "${tier.label || "rung"}" — ${tier.discountPct}% discount at ${tier.thresholdLiters}L`,
  }).catch((e) => console.warn("[pricing-tier-create] notify failed:", e));
  // Phase 15 NEED-4 — log create. Stamp under both BrandPricingTier
  // and the parent Brand so the brand portal's activity log surfaces it.
  recordChange({
    actorUserId: user.id,
    entity: "BrandPricingTier",
    entityId: tier.id,
    description: `Created pricing tier "${tier.label || "rung"}" (${tier.discountPct}% @ ${tier.thresholdLiters}L)`,
    before: null,
    after: {
      brandId: tier.brandId,
      thresholdLiters: tier.thresholdLiters,
      discountPct: tier.discountPct,
      label: tier.label,
      active: tier.active,
    },
  }).catch((e) => console.warn("[pricing-tier-create] audit failed:", e));
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
  const beforeTier = await prisma.brandPricingTier.findUnique({
    where: { id },
    select: {
      brandId: true,
      thresholdLiters: true,
      discountPct: true,
      label: true,
      active: true,
    },
  });
  const tier = await prisma.brandPricingTier.update({ where: { id }, data });
  // Phase 15 IMP-6 — fan out to brand users.
  notifyPricingTierChange({
    brandId: tier.brandId,
    changeSummary: `Tier "${tier.label || "rung"}" updated — ${tier.discountPct}% discount at ${tier.thresholdLiters}L`,
  }).catch((e) => console.warn("[pricing-tier-update] notify failed:", e));
  // Phase 15 NEED-4 — audit log.
  recordChange({
    actorUserId: user.id,
    entity: "BrandPricingTier",
    entityId: tier.id,
    description: `Updated pricing tier "${tier.label || "rung"}"`,
    before: beforeTier,
    after: {
      brandId: tier.brandId,
      thresholdLiters: tier.thresholdLiters,
      discountPct: tier.discountPct,
      label: tier.label,
      active: tier.active,
    },
  }).catch((e) => console.warn("[pricing-tier-update] audit failed:", e));
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
  const beforeTier = await prisma.brandPricingTier.findUnique({
    where: { id },
    select: {
      brandId: true,
      thresholdLiters: true,
      discountPct: true,
      label: true,
      active: true,
    },
  });
  await prisma.brandPricingTier.delete({ where: { id } });
  // Phase 15 NEED-4 — audit log.
  recordChange({
    actorUserId: user.id,
    entity: "BrandPricingTier",
    entityId: id,
    description: `Deleted pricing tier "${beforeTier?.label || "rung"}"`,
    before: beforeTier,
    after: null,
  }).catch((e) => console.warn("[pricing-tier-delete] audit failed:", e));
  return NextResponse.json({ ok: true });
}
