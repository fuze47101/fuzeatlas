// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/shipments/[id] ── get shipment details ────────── */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const shipment = await prisma.sampleShipment.findUnique({
      where: { id },
      include: {
        fabric: true,
        submission: true,
        testRequest: true,
        lab: true,
        events: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!shipment) {
      return NextResponse.json({ ok: false, error: "Shipment not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, shipment });
  } catch (error) {
    console.error("Error fetching shipment:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch shipment" },
      { status: 500 }
    );
  }
}

/* ── PUT /api/shipments/[id] ── update shipment + add event ────────── */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id");
    const body = await req.json();
    const {
      status,
      trackingNumber,
      carrier,
      shipDate,
      estimatedArrival,
      actualArrival,
      eventType,
      eventLocation,
      eventNotes,
      ...otherFields
    } = body;

    // Update shipment fields
    const updateData: any = { ...otherFields };
    if (status) updateData.status = status;
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (carrier) updateData.carrier = carrier;
    if (shipDate) updateData.shipDate = new Date(shipDate);
    if (estimatedArrival) updateData.estimatedArrival = new Date(estimatedArrival);
    if (actualArrival) updateData.actualArrival = new Date(actualArrival);

    const shipment = await prisma.sampleShipment.update({
      where: { id },
      data: updateData,
      include: { events: true, fabric: true, lab: true, testRequest: true },
    });

    // Add event if provided
    if (eventType) {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: id,
          eventType,
          location: eventLocation,
          handler: userId,
          notes: eventNotes,
        },
      });
    }

    return NextResponse.json({ ok: true, shipment });
  } catch (error) {
    console.error("Error updating shipment:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update shipment" },
      { status: 500 }
    );
  }
}

/* ── DELETE /api/shipments/[id] ── delete shipment (only PREPARING) ────────── */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const shipment = await prisma.sampleShipment.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!shipment) {
      return NextResponse.json({ ok: false, error: "Shipment not found" }, { status: 404 });
    }

    if (shipment.status !== "PREPARING") {
      return NextResponse.json(
        { ok: false, error: "Can only delete shipments in PREPARING status" },
        { status: 400 }
      );
    }

    await prisma.sampleShipment.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting shipment:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete shipment" },
      { status: 500 }
    );
  }
}
