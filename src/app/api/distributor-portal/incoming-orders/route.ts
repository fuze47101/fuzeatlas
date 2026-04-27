// @ts-nocheck
/**
 * GET /api/distributor-portal/incoming-orders
 *
 * For master distributors: returns DistributorRestockOrder rows that
 * sub-distributors have placed against them (i.e. targetDistributorId
 * = this dist). The master fulfills these from their own warehouse.
 *
 * For internal users: ?distributorId=… can act on behalf of any master.
 *
 * Returns:
 *   { ok, orders: [...], subDistributors: [...], summary: { ... } }
 *
 * PATCH /api/distributor-portal/incoming-orders
 *   Body: { orderId, status, trackingNumber?, carrier?, estimatedDelivery? }
 *   Master updates the status of a sub's order. Notifies the sub's
 *   users on APPROVED / SHIPPED / DELIVERED transitions.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(
      user.role,
    );
    const isDistributor = user.role === "DISTRIBUTOR_USER";
    if (!isInternal && !isDistributor) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const masterId = isDistributor
      ? user.distributorId
      : url.searchParams.get("distributorId");
    if (!masterId) {
      return NextResponse.json(
        { ok: false, error: "No distributor linked to this account" },
        { status: 400 },
      );
    }

    const [orders, subDistributors] = await Promise.all([
      prisma.distributorRestockOrder.findMany({
        where: { targetDistributorId: masterId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          distributor: {
            select: { id: true, name: true, country: true, localCurrency: true },
          },
        },
      }),
      prisma.distributor.findMany({
        where: { parentDistributorId: masterId, active: true },
        select: {
          id: true,
          name: true,
          country: true,
          localCurrency: true,
          inventory: { select: { fuzeStockLiters: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const summary = {
      totalOrders: orders.length,
      pendingApproval: orders.filter((o: any) => o.status === "PENDING_APPROVAL").length,
      shipped: orders.filter((o: any) => o.status === "SHIPPED").length,
      delivered: orders.filter((o: any) =>
        ["DELIVERED", "RECEIVED"].includes(o.status),
      ).length,
      totalLitersOpen: orders
        .filter((o: any) =>
          ["PENDING_APPROVAL", "APPROVED", "PROCESSING", "SHIPPED"].includes(o.status),
        )
        .reduce((s: number, o: any) => s + (o.totalLiters || 0), 0),
    };

    return NextResponse.json({ ok: true, orders, subDistributors, summary });
  } catch (e: any) {
    console.error("[incoming-orders.GET] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const isInternal = ["ADMIN", "EMPLOYEE"].includes(user.role);
    const isDistributor = user.role === "DISTRIBUTOR_USER";
    if (!isInternal && !isDistributor) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { orderId, status, trackingNumber, carrier, estimatedDelivery, adminNotes } =
      body;
    if (!orderId || !status) {
      return NextResponse.json(
        { ok: false, error: "orderId and status required" },
        { status: 400 },
      );
    }

    const existing = await prisma.distributorRestockOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        distributorId: true,
        targetDistributorId: true,
        orderNumber: true,
        totalLiters: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 },
      );
    }
    // Authorization: only the master can update sub orders, except for
    // internal admins.
    if (
      !isInternal &&
      existing.targetDistributorId !== user.distributorId
    ) {
      return NextResponse.json(
        { ok: false, error: "You don't fulfill this order" },
        { status: 403 },
      );
    }

    const updateData: any = { status };
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (carrier !== undefined) updateData.carrier = carrier;
    if (estimatedDelivery)
      updateData.estimatedDelivery = new Date(estimatedDelivery);
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (status === "APPROVED" && !existing) updateData.approvedAt = new Date();
    if (status === "APPROVED") {
      updateData.approvedAt = new Date();
      updateData.approvedById = user.id;
    }
    if (status === "SHIPPED") updateData.shippedDate = new Date();
    if (status === "DELIVERED") updateData.deliveredDate = new Date();

    const order = await prisma.distributorRestockOrder.update({
      where: { id: orderId },
      data: updateData,
    });

    // Notify the sub's users on meaningful transitions.
    if (["APPROVED", "SHIPPED", "DELIVERED"].includes(status)) {
      try {
        const subUsers = await prisma.user.findMany({
          where: {
            role: "DISTRIBUTOR_USER",
            distributorId: existing.distributorId,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (subUsers.length > 0) {
          const titleByStatus: Record<string, string> = {
            APPROVED: `Master approved restock — ${order.orderNumber}`,
            SHIPPED: `Restock from master shipped — ${order.orderNumber}`,
            DELIVERED: `Restock from master delivered — ${order.orderNumber}`,
          };
          const messageByStatus: Record<string, string> = {
            APPROVED: `${order.totalLiters}L approved by your master distributor.`,
            SHIPPED: `${order.totalLiters}L shipped${trackingNumber ? ` · tracking ${trackingNumber}${carrier ? ` (${carrier})` : ""}` : ""}.`,
            DELIVERED: `${order.totalLiters}L marked delivered. Confirm receipt to update inventory.`,
          };
          await prisma.notification.createMany({
            data: subUsers.map((u: any) => ({
              userId: u.id,
              type: "PO_STATUS",
              title: titleByStatus[status] || `Restock ${status.toLowerCase()}`,
              message: messageByStatus[status] || "",
              link: "/distributor-portal/restock",
            })),
          });
        }
      } catch (e) {
        console.error("[incoming-orders] notify failed (non-blocking):", e);
      }
    }

    return NextResponse.json({ ok: true, order });
  } catch (e: any) {
    console.error("[incoming-orders.PATCH] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
