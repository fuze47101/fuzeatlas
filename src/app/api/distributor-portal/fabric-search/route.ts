// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/distributor-portal/fabric-search?q=...
 *
 * Returns fabrics visible to this distributor — i.e. fabrics whose
 * factoryId is in distributor.factories OR whose brandId is on a
 * Project assigned to this distributor.
 *
 * Used by /distributor-portal/test-request for fabric pickers.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user.role);
    if (!isDistributor && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || "";

    let factoryIds: string[] = [];
    let brandIds: string[] = [];

    if (isDistributor) {
      const distributorId = user.distributorId;
      if (!distributorId) {
        return NextResponse.json({ ok: false, error: "No distributor assigned" }, { status: 400 });
      }
      const factories = await prisma.factory.findMany({
        where: { distributorId },
        select: { id: true },
      });
      factoryIds = factories.map((f) => f.id);

      const projects = await prisma.project.findMany({
        where: { distributorId, brandId: { not: null } },
        select: { brandId: true },
      });
      brandIds = Array.from(new Set(projects.map((p) => p.brandId).filter(Boolean) as string[]));
    }

    const where: any = {};
    const ands: any[] = [];

    if (!isAdmin) {
      const scopeOr: any[] = [];
      if (factoryIds.length > 0) scopeOr.push({ factoryId: { in: factoryIds } });
      if (brandIds.length > 0) scopeOr.push({ brandId: { in: brandIds } });
      // Also include the distributor's own portfolio fabrics — the
      // ones they're testing independently or in co-op programs.
      // Tagged with ownership: "distributor" in the response so the
      // test-request UI can surface the distinction.
      if (isDistributor) {
        const distributorId = (user as any).distributorId;
        if (distributorId) scopeOr.push({ distributorId });
      }
      if (scopeOr.length === 0) return NextResponse.json({ ok: true, fabrics: [] });
      ands.push({ OR: scopeOr });
    }

    if (q) {
      const fuzeNum = parseInt(q.replace(/[^0-9]/g, ""), 10);
      const orParts: any[] = [
        { customerCode: { contains: q, mode: "insensitive" } },
        { factoryCode: { contains: q, mode: "insensitive" } },
        { color: { contains: q, mode: "insensitive" } },
        { construction: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
        { factory: { name: { contains: q, mode: "insensitive" } } },
      ];
      if (!isNaN(fuzeNum)) orParts.push({ fuzeNumber: fuzeNum });
      ands.push({ OR: orParts });
    }

    if (ands.length > 0) where.AND = ands;

    const rawFabrics = await prisma.fabric.findMany({
      where,
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryCode: true,
        customerReference: true,
        fabricCategory: true,
        color: true,
        construction: true,
        weightGsm: true,
        brandId: true,
        factoryId: true,
        distributorId: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
      },
      orderBy: { fuzeNumber: "desc" },
      take: 50,
    });

    // Tag each row with an ownership label so the test-request UI
    // can render a "📒 Portfolio" badge next to distributor-owned
    // fabrics. Order: factory ownership first, then portfolio.
    const callerDistributorId = isDistributor ? (user as any).distributorId : null;
    const fabrics = rawFabrics
      .map((f) => ({
        ...f,
        ownership:
          f.factoryId
            ? ("factory" as const)
            : callerDistributorId && f.distributorId === callerDistributorId
              ? ("distributor" as const)
              : f.brandId
                ? ("brand" as const)
                : ("unknown" as const),
      }))
      // Distributor-owned fabrics float to the top — these are the
      // ones Tina is most likely to be testing right now.
      .sort((a, b) => {
        const score = (x: any) =>
          x.ownership === "distributor" ? 0 : x.ownership === "factory" ? 1 : 2;
        const sa = score(a);
        const sb = score(b);
        if (sa !== sb) return sa - sb;
        return (b.fuzeNumber || 0) - (a.fuzeNumber || 0);
      });

    return NextResponse.json({ ok: true, fabrics });
  } catch (e: any) {
    console.error("Distributor fabric search error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
