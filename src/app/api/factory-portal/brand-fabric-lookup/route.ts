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
      return NextResponse.json(
        { ok: false, error: "Please provide a brand name or FUZE number" },
        { status: 400 },
      );
    }

    const where: any = {};
    const conditions: any[] = [];

    // Filter by brand name (search across brand.companyName)
    if (brandSearch) {
      conditions.push({
        brand: {
          name: { contains: brandSearch, mode: "insensitive" },
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
        factoryCode: true,
        construction: true,
        weightGsm: true,
        widthInches: true,
        yarnType: true,
        fabricCategory: true,
        color: true,
        createdAt: true,
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { fuzeNumber: "desc" },
      take: 25,
    });

    // Compute "already linked to my factory" via FabricSubmission, not the
    // Fabric.factoryId column. The Fabric.factoryId column represents the
    // ORIGINAL registering factory (often null when the brand registered
    // the fabric directly). A factory "claims" a brand fabric by getting
    // a row in FabricSubmission, and the same fabric can be linked to
    // multiple factories over time.
    const myFactoryId = user.factoryId || null;
    const linkedSet = new Set<string>();
    if (myFactoryId && fabrics.length > 0) {
      const subs = await prisma.fabricSubmission.findMany({
        where: {
          factoryId: myFactoryId,
          fabricId: { in: fabrics.map((f) => f.id) },
        },
        select: { fabricId: true },
      });
      for (const s of subs) if (s.fabricId) linkedSet.add(s.fabricId);
    }

    return NextResponse.json({
      ok: true,
      fabrics: fabrics.map((f) => ({
        id: f.id,
        fuzeNumber: f.fuzeNumber,
        brandName: f.brand?.name || "Unknown",
        brandId: f.brand?.id,
        customerCode: f.customerCode,
        factoryCode: f.factoryCode,
        construction: f.construction,
        weightGsm: f.weightGsm,
        widthInches: f.widthInches,
        yarnType: f.yarnType,
        fabricCategory: f.fabricCategory,
        color: f.color,
        alreadyLinked: linkedSet.has(f.id),
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
 * Claims a brand-registered fabric for the calling user's factory.
 *
 * Earlier versions of this route overwrote `Fabric.factoryId` directly,
 * which yanked ownership away from any other factory that had the same
 * fabric registered. The data model already has `FabricSubmission` —
 * the join table representing one (brand, factory, fabric) submission —
 * so we now create/upsert a FabricSubmission row instead of mutating
 * the Fabric. The mill can see and manage the fabric going forward
 * via /factory-portal/submissions, and other factories that registered
 * the same brand fabric are not affected.
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
      return NextResponse.json(
        { ok: false, error: "No factory assigned to your account" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { fabricId } = body;

    if (!fabricId) {
      return NextResponse.json({ ok: false, error: "fabricId is required" }, { status: 400 });
    }

    // Verify the fabric exists and belongs to a brand
    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
      select: {
        id: true,
        fuzeNumber: true,
        brandId: true,
        customerCode: true,
        factoryCode: true,
      },
    });

    if (!fabric) {
      return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
    }

    if (!fabric.brandId) {
      return NextResponse.json(
        { ok: false, error: "Fabric is not registered to a brand" },
        { status: 400 },
      );
    }

    // Idempotent: if a FabricSubmission already pairs this fabric with
    // this factory (regardless of brand), just report it as linked.
    const existing = await prisma.fabricSubmission.findFirst({
      where: { fabricId, factoryId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        message: `FUZE-${fabric.fuzeNumber} is already linked to your factory`,
        submissionId: existing.id,
      });
    }

    const submission = await prisma.fabricSubmission.create({
      data: {
        fabricId,
        factoryId,
        brandId: fabric.brandId,
        fuzeFabricNumber: fabric.fuzeNumber ?? undefined,
        customerFabricCode: fabric.customerCode ?? undefined,
        factoryFabricCode: fabric.factoryCode ?? undefined,
        status: "FACTORY_CLAIMED",
        category: "BRAND_REGISTERED_FABRIC",
      },
      select: { id: true },
    });

    return NextResponse.json({
      ok: true,
      message: `FUZE-${fabric.fuzeNumber} linked to your factory`,
      submissionId: submission.id,
    });
  } catch (e: any) {
    console.error("Brand fabric link error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
