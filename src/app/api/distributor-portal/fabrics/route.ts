// @ts-nocheck
/**
 * Distributor fabric portfolio.
 *
 * GET    /api/distributor-portal/fabrics       — list distributor-owned fabrics
 * POST   /api/distributor-portal/fabrics       — create one in their portfolio
 * DELETE /api/distributor-portal/fabrics?id=…  — delete a portfolio fabric
 *
 * Distributors maintain a portfolio of fabrics they're testing
 * independently or in co-op programs (multi-brand pilots they
 * sponsor). These fabrics carry distributorId only — no factoryId
 * or brandId required at creation. Once a brand or factory adopts
 * the spec, the distributor can edit it to add those links.
 *
 * Admins can pass ?distributorId=xxx to scope to any distributor.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

async function resolveScope(req: Request, user: any) {
  const isDistributor = user.role === "DISTRIBUTOR_USER";
  const isInternal = ["ADMIN", "EMPLOYEE"].includes(user.role);
  if (!isDistributor && !isInternal) {
    return { error: "Access denied", status: 403 as const };
  }
  const url = new URL(req.url);
  const distributorId = isDistributor
    ? user.distributorId
    : url.searchParams.get("distributorId");
  if (!distributorId) {
    return {
      error: isDistributor
        ? "No distributor assigned to your account"
        : "distributorId required for admin scope",
      status: 400 as const,
    };
  }
  return { distributorId, isInternal, isDistributor };
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const scope = await resolveScope(req, user);
    if ("error" in scope) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || "";

    const where: any = { distributorId: scope.distributorId };
    if (q) {
      const fuzeNum = parseInt(q.replace(/[^0-9]/g, ""), 10);
      const orParts: any[] = [
        { customerCode: { contains: q, mode: "insensitive" } },
        { factoryCode: { contains: q, mode: "insensitive" } },
        { customerReference: { contains: q, mode: "insensitive" } },
        { color: { contains: q, mode: "insensitive" } },
        { construction: { contains: q, mode: "insensitive" } },
        { note: { contains: q, mode: "insensitive" } },
      ];
      if (!isNaN(fuzeNum)) orParts.push({ fuzeNumber: fuzeNum });
      where.OR = orParts;
    }

    const fabrics = await prisma.fabric.findMany({
      where,
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryCode: true,
        customerReference: true,
        construction: true,
        color: true,
        weightGsm: true,
        widthInches: true,
        yarnType: true,
        finishNote: true,
        note: true,
        endUse: true,
        targetFuzeTier: true,
        fabricCategory: true,
        labStatus: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true, country: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({ ok: true, fabrics });
  } catch (e: any) {
    console.error("[distributor-portal.fabrics] GET error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const scope = await resolveScope(req, user);
    if ("error" in scope) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const body = await req.json().catch(() => ({}));
    const {
      customerReference,
      customerCode,
      factoryCode,
      construction,
      color,
      weightGsm,
      widthInches,
      yarnType,
      finishNote,
      note,
      endUse,
      targetFuzeTier,
      fabricCategory,
      brandId,
      factoryId,
    } = body;

    // At minimum, give us SOMETHING to identify the fabric — either
    // a customer reference, a customer code, or a factory code. A
    // blank fabric row is just noise in the portfolio.
    if (!customerReference && !customerCode && !factoryCode && !color && !construction) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Provide at least one of: customer reference, customer code, factory code, color, or construction.",
        },
        { status: 400 },
      );
    }

    const data: any = {
      distributorId: scope.distributorId,
    };
    if (customerReference) data.customerReference = String(customerReference).trim();
    if (customerCode) data.customerCode = String(customerCode).trim();
    if (factoryCode) data.factoryCode = String(factoryCode).trim();
    if (construction) data.construction = String(construction).trim();
    if (color) data.color = String(color).trim();
    if (weightGsm) data.weightGsm = Number(weightGsm);
    if (widthInches) data.widthInches = Number(widthInches);
    if (yarnType) data.yarnType = String(yarnType).trim();
    if (finishNote) data.finishNote = String(finishNote).trim();
    if (note) data.note = String(note).trim();
    if (endUse) data.endUse = String(endUse).trim();
    if (targetFuzeTier) data.targetFuzeTier = String(targetFuzeTier).trim();
    if (fabricCategory) data.fabricCategory = String(fabricCategory).trim();
    if (brandId) data.brandId = String(brandId);
    if (factoryId) data.factoryId = String(factoryId);

    const fabric = await prisma.fabric.create({ data });

    // Phase 15 NEED-FB-4 — when a distributor onboards a fabric on
    // behalf of a mill (factoryId provided), stamp a FabricSubmission
    // row keyed to that same fabric so the mill's portfolio + supply
    // chain pipeline picks it up. Stays a no-op when the distributor
    // is just maintaining their own portfolio (no factoryId).
    let submission: any = null;
    if (data.factoryId) {
      try {
        submission = await prisma.fabricSubmission.create({
          data: {
            fabricId: fabric.id,
            factoryId: data.factoryId,
            brandId: data.brandId || null,
            fuzeFabricNumber: fabric.fuzeNumber ?? null,
            customerFabricCode: fabric.customerCode || null,
            factoryFabricCode: fabric.factoryCode || null,
            status: "Submitted",
            testStatus: "PENDING",
            progressPercent: 5,
            category: "DISTRIBUTOR_ONBOARDED",
          },
        });
      } catch (e) {
        console.warn("[distributor-portal.fabrics POST] submission create failed:", e);
      }
    }

    return NextResponse.json({ ok: true, fabric, submission });
  } catch (e: any) {
    console.error("[distributor-portal.fabrics] POST error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const scope = await resolveScope(req, user);
    if ("error" in scope) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    // Scope check — distributors can only delete their own fabrics.
    const fabric = await prisma.fabric.findUnique({
      where: { id },
      select: { id: true, distributorId: true, fuzeNumber: true },
    });
    if (!fabric) {
      return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
    }
    if (
      scope.isDistributor &&
      fabric.distributorId !== scope.distributorId
    ) {
      return NextResponse.json(
        { ok: false, error: "Cannot delete a fabric not in your portfolio" },
        { status: 403 },
      );
    }
    // Refuse to delete a fabric that has test history attached —
    // those rows would orphan. Distributor should archive it
    // instead by clearing distributorId.
    const counts = await prisma.fabric.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            submissions: true,
            testRequests: true,
            recipeBenchTests: true,
            sampleApplications: true,
            fuzeOrders: true,
          },
        },
      },
    });
    const totalAttached =
      (counts?._count.submissions || 0) +
      (counts?._count.testRequests || 0) +
      (counts?._count.recipeBenchTests || 0) +
      (counts?._count.sampleApplications || 0) +
      (counts?._count.fuzeOrders || 0);
    if (totalAttached > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Fabric has ${totalAttached} attached records (submissions, tests, orders). Archive instead of delete.`,
        },
        { status: 409 },
      );
    }

    await prisma.fabric.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[distributor-portal.fabrics] DELETE error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
