// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/shipments ── list shipments with filters ────────── */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const labId = url.searchParams.get("labId");
    const fabricId = url.searchParams.get("fabricId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const where: any = {};
    if (status) where.status = status;
    if (labId) where.labId = labId;
    if (fabricId) where.fabricId = fabricId;

    const [shipments, total] = await Promise.all([
      prisma.sampleShipment.findMany({
        where,
        include: {
          fabric: { select: { id: true, fuzeNumber: true, customerCode: true } },
          lab: { select: { id: true, name: true } },
          testRequest: { select: { id: true, poNumber: true } },
          events: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sampleShipment.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      shipments: shipments.map((s) => ({
        ...s,
        eventCount: s.events.length,
        events: undefined,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching shipments:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch shipments" },
      { status: 500 }
    );
  }
}

/* ── POST /api/shipments ── create shipment ────────── */
export async function POST(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    const body = await req.json();
    const {
      fabricId,
      submissionId,
      testRequestId,
      originName,
      originAddress,
      destinationName,
      destinationAddress,
      labId,
      carrier,
      trackingNumber,
      sampleCount,
      sampleType,
      sampleCondition,
      weight,
      notes,
    } = body;

    const shipment = await prisma.sampleShipment.create({
      data: {
        fabricId,
        submissionId,
        testRequestId,
        originName,
        originAddress,
        destinationName,
        destinationAddress,
        labId,
        carrier,
        trackingNumber,
        sampleCount: sampleCount || 1,
        sampleType,
        sampleCondition,
        weight,
        notes,
        createdBy: userId,
        status: "PREPARING",
      },
      include: { events: true, fabric: true, lab: true, testRequest: true },
    });

    // Create initial CREATED event
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: "CREATED",
        handler: userId,
        notes: "Shipment created",
      },
    });

    return NextResponse.json({ ok: true, shipment });
  } catch (error) {
    console.error("Error creating shipment:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create shipment" },
      { status: 500 }
    );
  }
}
