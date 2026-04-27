// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Admin: Manage distributor restock orders + FUZE→distributor pricing + stock editing.
 *
 * GET  /api/admin/distributor-restock
 *   Returns all active distributors with: current pricing, inventory, pending restock orders
 *
 * PATCH /api/admin/distributor-restock
 *   body: { distributorId, action }
 *   actions:
 *     - "update-pricing": { fuzeRestockPricePerLiter, fuzeRestockCurrency, fuzeRestockNotes }
 *     - "update-inventory": { fuzeStockLiters, fuzeStockBottles, reorderPointLiters }
 *     - "update-order-status": { orderId, status, trackingNumber?, carrier?, estimatedDelivery?, adminNotes? }
 */

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const distributors = await prisma.distributor.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        localCurrency: true,
        fuzeRestockPricePerLiter: true,
        fuzeRestockCurrency: true,
        fuzeRestockNotes: true,
        inventory: {
          select: {
            fuzeStockLiters: true,
            fuzeStockBottles: true,
            reorderPointLiters: true,
            lastStockUpdate: true,
          },
        },
        restockOrders: {
          where: { status: { notIn: ["RECEIVED", "CANCELLED"] } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            unitType: true,
            unitQuantity: true,
            totalLiters: true,
            totalPrice: true,
            currency: true,
            status: true,
            createdAt: true,
            trackingNumber: true,
            carrier: true,
            estimatedDelivery: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, distributors });
  } catch (e: any) {
    console.error("Admin restock GET error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { action, distributorId } = body;

    if (action === "update-pricing") {
      const updated = await prisma.distributor.update({
        where: { id: distributorId },
        data: {
          fuzeRestockPricePerLiter: body.fuzeRestockPricePerLiter ? parseFloat(body.fuzeRestockPricePerLiter) : null,
          fuzeRestockCurrency: body.fuzeRestockCurrency || "USD",
          fuzeRestockNotes: body.fuzeRestockNotes || null,
        },
      });
      return NextResponse.json({ ok: true, distributor: updated });
    }

    if (action === "update-inventory") {
      const existing = await prisma.distributorInventory.findUnique({
        where: { distributorId },
      });
      const data = {
        fuzeStockLiters: parseFloat(body.fuzeStockLiters) || 0,
        fuzeStockBottles: parseInt(body.fuzeStockBottles) || 0,
        reorderPointLiters: body.reorderPointLiters ? parseFloat(body.reorderPointLiters) : null,
        lastStockUpdate: new Date(),
        updatedById: user.id,
      };
      const inventory = existing
        ? await prisma.distributorInventory.update({ where: { distributorId }, data })
        : await prisma.distributorInventory.create({ data: { distributorId, ...data } });
      return NextResponse.json({ ok: true, inventory });
    }

    if (action === "update-order-status") {
      const { orderId, status, trackingNumber, carrier, estimatedDelivery, adminNotes } = body;
      const updateData: any = { status };
      if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
      if (carrier !== undefined) updateData.carrier = carrier;
      if (estimatedDelivery) updateData.estimatedDelivery = new Date(estimatedDelivery);
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      if (status === "APPROVED") {
        updateData.approvedAt = new Date();
        updateData.approvedById = user.id;
      }
      if (status === "SHIPPED" && !updateData.shippedDate) {
        updateData.shippedDate = new Date();
      }
      const order = await prisma.distributorRestockOrder.update({
        where: { id: orderId },
        data: updateData,
      });

      // ─── Notify the distributor's users on status change ───────
      // Tina's #P1 review: distributors weren't pinged when their
      // restock from FUZE shipped. Fires only on meaningful status
      // transitions (APPROVED, SHIPPED, DELIVERED) — silent on
      // intermediate edits like adminNotes-only changes.
      if (["APPROVED", "SHIPPED", "DELIVERED"].includes(status)) {
        try {
          const distUsers = await prisma.user.findMany({
            where: {
              role: "DISTRIBUTOR_USER",
              distributorId: order.distributorId,
              status: "ACTIVE",
            },
            select: { id: true },
          });
          if (distUsers.length > 0) {
            const titleByStatus: Record<string, string> = {
              APPROVED: `Restock approved — ${order.orderNumber}`,
              SHIPPED: `Restock shipped — ${order.orderNumber}`,
              DELIVERED: `Restock delivered — ${order.orderNumber}`,
            };
            const messageByStatus: Record<string, string> = {
              APPROVED: `${order.totalLiters}L approved by FUZE HQ. Tracking will follow when it ships.`,
              SHIPPED: `${order.totalLiters}L on the way${trackingNumber ? ` · tracking ${trackingNumber}${carrier ? ` (${carrier})` : ""}` : ""}.`,
              DELIVERED: `${order.totalLiters}L marked delivered. Confirm receipt to update your inventory.`,
            };
            await prisma.notification.createMany({
              data: distUsers.map((u: any) => ({
                userId: u.id,
                type: "PO_STATUS",
                title: titleByStatus[status] || `Restock ${status.toLowerCase()}`,
                message: messageByStatus[status] || "",
                link: "/distributor-portal/restock",
              })),
            });
          }
        } catch (e) {
          console.error("[restock] notify failed (non-blocking):", e);
        }
      }

      return NextResponse.json({ ok: true, order });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    console.error("Admin restock PATCH error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
