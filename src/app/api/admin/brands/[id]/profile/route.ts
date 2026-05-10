// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Admin counterpart to /api/brand-portal/profile (Phase 4B).
 *
 * Lets AMs and admins read or edit any brand's BrandProfile by
 * passing brandId in the URL path — the same shape AMs already use
 * for /admin/brands/[id]/spec and /admin/brands/[id]/pricing-tiers.
 *
 *   GET   /api/admin/brands/{id}/profile
 *   PATCH /api/admin/brands/{id}/profile
 */

const EDIT_ROLES = ["ADMIN", "EMPLOYEE", "BRAND_MANAGER", "SALES_MANAGER", "SALES_REP"];

const SELECT = {
  id: true,
  brandId: true,
  logoUrl: true,
  primaryColor: true,
  heroHeadline: true,
  heroSubhead: true,
  supportEmail: true,
  supportPhone: true,
  departments: true,
  publicSlug: true,
  createdAt: true,
  updatedAt: true,
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const { id } = await props.params;
  const profile = await prisma.brandProfile.findUnique({ where: { brandId: id }, select: SELECT });
  // Always return the brand's name + id so the admin editor can show
  // its header even when the profile row hasn't been created yet.
  const brand = await prisma.brand.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!brand) return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });

  return NextResponse.json({ ok: true, brand, profile });
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const { id } = await props.params;
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  for (const k of ["logoUrl", "primaryColor", "heroHeadline", "heroSubhead", "supportEmail", "supportPhone", "publicSlug"]) {
    if (body[k] !== undefined) data[k] = body[k] || null;
  }
  if (body.departments !== undefined) data.departments = body.departments;

  const profile = await prisma.brandProfile.upsert({
    where: { brandId: id },
    create: { brandId: id, ...data },
    update: data,
    select: SELECT,
  });
  return NextResponse.json({ ok: true, profile });
}
