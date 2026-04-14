// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Order Lifecycle Events
 *
 * GET  /api/orders/[id]/events — list events for an order (timeline)
 * POST /api/orders/[id]/events — log a new event (factory/distributor/admin actions)
 *
 * Event types:
 *   ORDER_PLACED, QUOTE_ACCEPTED, APPROVED,
 *   SHIPPED_FROM_FUZE, SHIPPED_FROM_DISTRIBUTOR, IN_TRANSIT, CUSTOMS,
 *   RECEIVED_AT_FACTORY, TREATMENT_APPLIED, ICP_SAMPLE_SUBMITTED,
 *   ICP_CERTIFIED, BRAND_NOTIFIED, CANCELLED, NOTE
 *
 * Side-effects on POST:
 *   - RECEIVED_AT_FACTORY → updates order.deliveredDate, advances status to DELIVERED
 *   - TREATMENT_APPLIED   → creates a FuzeConsumption record
 *   - SHIPPED_FROM_* → sets order.shippedDate + status SHIPPED
 */

async function loadOrder(id: string) {
  return prisma.fuzeOrder.findUnique({
    where: { id },
    select: {
      id: true, orderNumber: true, factoryId: true, distributorId: true,
      status: true, volumeLiters: true, fuzeTier: true, brandId: true,
      fabricId: true, wastageFactorPct: true, baseFuzeLiters: true,
      factory: { select: { name: true } },
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const events = await prisma.orderLifecycleEvent.findMany({
      where: { orderId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ ok: true, events });
  } catch (e: any) {
    console.error("Events GET error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const order = await loadOrder(id);
    if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    // Permission check
    const isFactoryOnOrder = ["FACTORY_USER", "FACTORY_MANAGER"].includes(user.role)
      && user.factoryId === order.factoryId;
    const isDistributorOnOrder = user.role === "DISTRIBUTOR_USER"
      && user.distributorId === order.distributorId;
    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isFactoryOnOrder && !isDistributorOnOrder && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const {
      eventType, title, description, location,
      data, photoUrl, documentUrl, isPublic = true,
    } = body;

    if (!eventType || !title) {
      return NextResponse.json({ ok: false, error: "eventType and title required" }, { status: 400 });
    }

    const event = await prisma.orderLifecycleEvent.create({
      data: {
        orderId: id,
        eventType,
        title,
        description: description || null,
        location: location || null,
        actorId: user.id,
        actorName: user.name || user.email,
        data: data || null,
        photoUrl: photoUrl || null,
        documentUrl: documentUrl || null,
        isPublic,
      },
    });

    // ── Side-effects based on event type ──
    try {
      if (eventType === "SHIPPED_FROM_FUZE" || eventType === "SHIPPED_FROM_DISTRIBUTOR") {
        await prisma.fuzeOrder.update({
          where: { id },
          data: {
            status: "SHIPPED",
            shippedDate: new Date(),
            trackingNumber: data?.trackingNumber || undefined,
            carrier: data?.carrier || undefined,
          },
        });
      } else if (eventType === "RECEIVED_AT_FACTORY") {
        await prisma.fuzeOrder.update({
          where: { id },
          data: {
            status: "DELIVERED",
            deliveredDate: new Date(),
          },
        });
      } else if (eventType === "TREATMENT_APPLIED" && data) {
        // Record consumption
        await prisma.fuzeConsumption.create({
          data: {
            factoryId: order.factoryId,
            orderId: order.id,
            litersUsed: Number(data.litersUsed) || 0,
            metersProcessed: data.metersProcessed ? Number(data.metersProcessed) : null,
            applicationMethod: data.method || null,
            fuzeTier: data.fuzeTier || order.fuzeTier || null,
            brandId: data.brandId || order.brandId || null,
            fabricId: data.fabricId || order.fabricId || null,
            productionRunId: data.productionRunId || null,
            reportedById: user.id,
            notes: description || null,
          },
        });
      }
    } catch (sideErr) {
      console.error("Lifecycle side-effect error (non-blocking):", sideErr);
    }

    // Notify admins + account manager for significant events
    try {
      const significant = ["RECEIVED_AT_FACTORY", "TREATMENT_APPLIED", "ICP_SAMPLE_SUBMITTED", "ICP_CERTIFIED"];
      if (significant.includes(eventType)) {
        const admins = await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "EMPLOYEE"] }, status: "ACTIVE" },
          select: { id: true },
        });
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: "PO_STATUS",
            title: `${order.orderNumber}: ${title}`,
            message: `${order.factory?.name} — ${title}${description ? " · " + description.slice(0, 100) : ""}`,
            link: `/factories/${order.factoryId}`,
          })),
        });
      }
    } catch {}

    return NextResponse.json({ ok: true, event });
  } catch (e: any) {
    console.error("Events POST error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
