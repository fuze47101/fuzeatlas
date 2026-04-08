// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/reassign-user
 * Reassign a user's role and link them to a distributor, factory, brand, or lab.
 *
 * Body: { userId, role, distributorId?, factoryId?, brandId?, labId? }
 *
 * Example — assign Danny as a distributor user:
 * fetch('/api/admin/reassign-user', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ userId: '...', role: 'DISTRIBUTOR_USER', distributorId: '...' })
 * }).then(r => r.json()).then(console.log)
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, role, distributorId, factoryId, brandId, labId } = body;

    if (!userId || !role) {
      return NextResponse.json({ ok: false, error: "userId and role required" }, { status: 400 });
    }

    const validRoles = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "FACTORY_MANAGER", "FACTORY_USER", "BRAND_USER", "DISTRIBUTOR_USER", "LAB_USER", "PUBLIC"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ ok: false, error: `Invalid role. Valid: ${validRoles.join(", ")}` }, { status: 400 });
    }

    // Validate the target entity exists
    if (distributorId) {
      const dist = await prisma.distributor.findUnique({ where: { id: distributorId } });
      if (!dist) return NextResponse.json({ ok: false, error: "Distributor not found" }, { status: 404 });
    }
    if (factoryId) {
      const fac = await prisma.factory.findUnique({ where: { id: factoryId } });
      if (!fac) return NextResponse.json({ ok: false, error: "Factory not found" }, { status: 404 });
    }
    if (brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        distributorId: distributorId || null,
        factoryId: factoryId || null,
        brandId: brandId || null,
        labId: labId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        distributorId: true,
        factoryId: true,
        brandId: true,
        labId: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (e: any) {
    console.error("Reassign user error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to reassign user" }, { status: 500 });
  }
}

/**
 * GET /api/admin/reassign-user
 * Helper: list all users with their current role assignments + all distributors
 * for easy lookup.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        distributorId: true,
        distributor: { select: { name: true } },
        factoryId: true,
        factory: { select: { name: true } },
        brandId: true,
        brand: { select: { name: true } },
        labId: true,
        lab: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const distributors = await prisma.distributor.findMany({
      select: { id: true, name: true, country: true, active: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, users, distributors });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
