// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/distributor-portal/restock/[id]/confirm-receipt
 * Distributor confirms they received a restock shipment.
 * Automatically increments their DistributorInventory stock.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const order = await prisma.distributorRestockOrder.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = ["ADMIN", "EMPLOYEE"].includes(user.role);
    if (isDistributor && user.distributorId !== order.distributorId) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }
    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    if (order.receivedConfirmedAt) {
      return NextResponse.json({ ok: false, error: "Already confirmed received" }, { status: 400 });
    }

    // Update order
    const updated = await prisma.distributorRestockOrder.update({
      where: { id },
      data: {
        receivedConfirmedAt: new Date(),
        deliveredDate: order.deliveredDate || new Date(),
        status: "RECEIVED",
      },
    });

    // Increment distributor inventory
    let inventory = await prisma.distributorInventory.findUnique({
      where: { distributorId: order.distributorId },
    });
    if (!inventory) {
      inventory = await prisma.distributorInventory.create({
        data: {
          distributorId: order.distributorId,
          fuzeStockLiters: order.totalLiters,
          fuzeStockBottles: Math.floor(order.totalLiters / 19),
          lastStockUpdate: new Date(),
        },
      });
    } else {
      await prisma.distributorInventory.update({
        where: { distributorId: order.distributorId },
        data: {
          fuzeStockLiters: (inventory.fuzeStockLiters || 0) + order.totalLiters,
          fuzeStockBottles: (inventory.fuzeStockBottles || 0) + Math.floor(order.totalLiters / 19),
          lastStockUpdate: new Date(),
        },
      });
    }

    // Notify admins
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "EMPLOYEE"] }, status: "ACTIVE" },
        select: { id: true },
      });
      const distributor = await prisma.distributor.findUnique({
        where: { id: order.distributorId },
        select: { name: true },
      });
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "PO_STATUS",
          title: "Restock Order Received",
          message: `${distributor?.name} confirmed receipt of ${order.orderNumber} (${order.totalLiters}L)`,
          link: `/admin/distributor-restock/${order.id}`,
        })),
      });
    } catch (e) {
      console.error("Notify failed:", e);
    }

    return NextResponse.json({ ok: true, order: updated });
  } catch (e: any) {
    console.error("Confirm receipt error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
