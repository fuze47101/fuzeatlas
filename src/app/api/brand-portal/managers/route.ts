// @ts-nocheck
/**
 * GET /api/brand-portal/managers — Phase 15 IMP-2 helper.
 *
 * Returns the caller's brand's teammates with BRAND_MANAGER role.
 * Drives the "Teammates with that role" panel on RestrictedSurface.
 * Auth-gated; returns [] when the caller has no brandId.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, managers: [] }, { status: 401 });
  if (!user.brandId) return NextResponse.json({ ok: true, managers: [] });

  const managers = await prisma.user.findMany({
    where: {
      brandId: user.brandId,
      role: "BRAND_MANAGER",
      status: "ACTIVE",
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
    take: 10,
  });
  return NextResponse.json({ ok: true, managers });
}
