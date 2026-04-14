// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/distributor-portal/inventory
 * Returns distributor's inventory levels
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);

    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const distributorId = isDistributor ? user.distributorId : url.searchParams.get("distributorId");

    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor ID required" }, { status: 400 });
    }

    let inventory = await prisma.distributorInventory.findUnique({
      where: { distributorId },
    });

    // Create default inventory record if none exists
    if (!inventory) {
      inventory = await prisma.distributorInventory.create({
        data: {
          distributorId,
          fuzeStockLiters: 0,
          fuzeStockBottles: 0,
          hangtagStock: 0,
          reorderPointLiters: 100,
          lastStockUpdate: new Date(),
        },
      });
    }

    // Get recent orders to calculate incoming stock
    const pendingOrders = await prisma.fuzeOrder.findMany({
      where: {
        distributorId,
        status: { in: ["APPROVED", "PROCESSING", "SHIPPED"] },
      },
      select: {
        id: true,
        orderNumber: true,
        volumeLiters: true,
        bottles: true,
        hangtagQty: true,
        status: true,
        factory: { select: { name: true } },
      },
    });

    return NextResponse.json({ ok: true, inventory, pendingOrders });
  } catch (e: any) {
    console.error("Distributor inventory GET error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load inventory" }, { status: 500 });
  }
}

/**
 * PATCH /api/distributor-portal/inventory
 * Update inventory levels
 */
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = ["ADMIN", "EMPLOYEE"].includes(user.role);

    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const distributorId = isDistributor ? user.distributorId : body.distributorId;

    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor ID required" }, { status: 400 });
    }

    const updateData: any = { lastStockUpdate: new Date() };

    if (body.fuzeStockLiters !== undefined) updateData.fuzeStockLiters = Number(body.fuzeStockLiters);
    if (body.fuzeStockBottles !== undefined) updateData.fuzeStockBottles = Number(body.fuzeStockBottles);
    if (body.hangtagStock !== undefined) updateData.hangtagStock = Number(body.hangtagStock);
    if (body.reorderPointLiters !== undefined) updateData.reorderPointLiters = Number(body.reorderPointLiters);

    const inventory = await prisma.distributorInventory.upsert({
      where: { distributorId },
      update: updateData,
      create: {
        distributorId,
        fuzeStockLiters: updateData.fuzeStockLiters || 0,
        fuzeStockBottles: updateData.fuzeStockBottles || 0,
        hangtagStock: updateData.hangtagStock || 0,
        reorderPointLiters: updateData.reorderPointLiters || 100,
        lastStockUpdate: new Date(),
      },
    });

    return NextResponse.json({ ok: true, inventory });
  } catch (e: any) {
    console.error("Distributor inventory PATCH error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to update inventory" }, { status: 500 });
  }
}
