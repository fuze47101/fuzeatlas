// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Brand-portal profile endpoint (Phase 4B).
 *
 * GET — returns the BrandProfile for the caller's brand. If none
 *       exists, returns ok:true with profile:null so the brand
 *       portal landing falls back to the bare Brand.name greeting
 *       without erroring.
 *
 * PATCH — upserts the BrandProfile. Brand managers + sales reps +
 *         admins can edit; plain BRAND_USER is read-only (same
 *         pattern as /api/brand-portal/spec).
 *
 * Admins acting on behalf of a specific brand should hit
 * /api/admin/brands/[id]/profile instead — that route accepts an
 * explicit brandId path param.
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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!user.brandId) {
    return NextResponse.json(
      { ok: false, error: "No brand associated with this account" },
      { status: 403 },
    );
  }
  const profile = await prisma.brandProfile.findUnique({
    where: { brandId: user.brandId },
    select: SELECT,
  });
  return NextResponse.json({ ok: true, profile });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Read-only access" }, { status: 403 });
  }
  if (!user.brandId) {
    return NextResponse.json({ ok: false, error: "No brand associated" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  for (const k of ["logoUrl", "primaryColor", "heroHeadline", "heroSubhead", "supportEmail", "supportPhone", "publicSlug"]) {
    if (body[k] !== undefined) data[k] = body[k] || null;
  }
  if (body.departments !== undefined) data.departments = body.departments;

  const profile = await prisma.brandProfile.upsert({
    where: { brandId: user.brandId },
    create: { brandId: user.brandId, ...data },
    update: data,
    select: SELECT,
  });
  return NextResponse.json({ ok: true, profile });
}
