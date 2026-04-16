// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/factory-portal/brand-fabric-lookup?brand=BRAND_NAME&fuzeNumber=1234
 *
 * Allows a factory user to look up a brand-registered fabric by brand name + FUZE#.
 * Returns limited fabric info (no sensitive brand data). Factory can then link
 * their own records to this fabric or add factory-specific information.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isFactory = user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER";
    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    if (!isFactory && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const brandSearch = url.searchParams.get("brand")?.trim() || "";
    const fuzeNumberStr = url.searchParams.get("fuzeNumber")?.trim() || "";

    if (!brandSearch && !fuzeNumberStr) {
      return NextResponse.json({ ok: false, error: "Please provide a brand name or FUZE number" }, { status: 400 });
    }

    const where: any = {};
    const conditions: any[] = [];

    // Filter by brand name (search across brand.companyName)
    if (brandSearch) {
      conditions.push({
        brand: {
          companyName: { contains: brandSearch, mode: "insensitive" },
        },
      });
    }

    // Filter by FUZE number
    if (fuzeNumberStr) {
      const fuzeNum = parseInt(fuzeNumberStr);
      if (!isNaN(fuzeNum)) {
        conditions.push({ fuzeNumber: fuzeNum });
      }
    }

    // Both conditions must match if both are provided
    if (conditions.length > 1) {
      where.AND = conditions;
    } else if (conditions.length === 1) {
      Object.assign(where, conditions[0]);
    }

    // Only find fabrics that belong to a brand (brandId is set)
    where.brandId = { not: null };

    const fabrics = await prisma.fabric.findMany({
      where,
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        construction: true,
        weightGsm: true,
        widthInches: true,
        yarnType: true,
        fiberContent: true,
        factoryId: true,
        createdAt: true,
        brand: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: { fuzeNumber: "desc" },
      take: 25,
    });

    return NextResponse.json({
      ok: true,
      fabrics: fabrics.map((f) => ({
        id: f.id,
        fuzeNumber: f.fuzeNumber,
        brandName: f.brand?.companyName || "Unknown",
        brandId: f.brand?.id,
        customerCode: f.customerCode,
        construction: f.construction,
        weightGsm: f.weightGsm,
        widthInches: f.widthInches,
        yarnType: f.yarnType,
        fiberContent: f.fiberContent,
        alreadyLinked: f.factoryId === user.factoryId,
        createdAt: f.createdAt,
      })),
    });
  } catch (e: any) {
    console.error("Brand fabric lookup error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/factory-portal/brand-fabric-lookup
 * Body: { fabricId: string }
 *
 * Links a brand fabric to the factory (sets factoryId on the fabric).
 * This allows the factory to see and manage the fabric going forward.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isFactory = user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER";
    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    if (!isFactory && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const factoryId = user.factoryId;
    if (!factoryId) {
      return NextResponse.json({ ok: false, error: "No factory assigned to your account" }, { status: 400 });
    }

    const body = await req.json();
    const { fabricId } = body;

    if (!fabricId) {
      return NextResponse.json({ ok: false, error: "fabricId is required" }, { status: 400 });
    }

    // Verify the fabric exists and belongs to a brand
    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
      select: { id: true, fuzeNumber: true, brandId: true, factoryId: true },
    });

    if (!fabric) {
      return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
    }

    if (fabric.factoryId === factoryId) {
      return NextResponse.json({ ok: true, message: "Already linked to your factory" });
    }

    // Link the fabric to this factory
    await prisma.fabric.update({
      where: { id: fabricId },
      data: { factoryId },
    });

    return NextResponse.json({ ok: true, message: `FUZE-${fabric.fuzeNumber} linked to your factory` });
  } catch (e: any) {
    console.error("Brand fabric link error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
