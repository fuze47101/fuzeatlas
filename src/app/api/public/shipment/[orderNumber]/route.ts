// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PUBLIC endpoint — no auth required.
 * GET /api/public/shipment/[orderNumber]
 *
 * Target of QR codes printed on FUZE shipments. Returns sanitized
 * order info, status timeline, and links to public SDS / COA / cert
 * documents.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;

    const order = await prisma.fuzeOrder.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        volumeLiters: true,
        bottles: true,
        fuzeTier: true,
        baseFuzeLiters: true,
        wastageFactorPct: true,
        treatmentMethod: true,
        createdAt: true,
        shippedDate: true,
        deliveredDate: true,
        trackingNumber: true,
        carrier: true,
        fulfillmentSource: true,
        factory: { select: { name: true, country: true, city: true } },
        distributor: { select: { name: true } },
        brand: { select: { name: true } },
        fabric: { select: { fuzeNumber: true, name: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Shipment not found" }, { status: 404 });
    }

    // Only public events
    const events = await prisma.orderLifecycleEvent.findMany({
      where: { orderId: order.id, isPublic: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        eventType: true,
        title: true,
        description: true,
        location: true,
        createdAt: true,
        documentUrl: true,
      },
    });

    return NextResponse.json({ ok: true, order, events });
  } catch (e: any) {
    console.error("Public shipment error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
