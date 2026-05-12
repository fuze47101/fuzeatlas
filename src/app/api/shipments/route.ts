// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

/* ── POST /api/shipments ── create shipment ──────────
 *
 * Phase 15 Kaylee fix (cmp2roui8) — previously read userId from a
 * spoof-able `x-user-id` header that the frontend never set, and
 * accepted `fabricId` / `labId` as free-text from the form (Kaylee
 * was typing "FUZE 2504" hoping it would resolve). Both led to a
 * silent 500 with the button "doing nothing" from her POV. Now:
 *   - session lookup via getCurrentUser
 *   - validate fabricId + labId exist before insert; explicit 400
 *     with a human-readable error if they don't
 *   - bubble the actual error message back to the client so the
 *     toast can show it
 */
export async function POST(req: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
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

    // FK pre-checks — produces a real error message instead of a
    // Prisma constraint blowup the user can't act on.
    if (!fabricId) {
      return NextResponse.json(
        { ok: false, error: "Pick a fabric from the search picker — a fabric is required." },
        { status: 400 },
      );
    }
    const fabricExists = await prisma.fabric.findUnique({
      where: { id: String(fabricId) },
      select: { id: true },
    });
    if (!fabricExists) {
      return NextResponse.json(
        { ok: false, error: "That fabric id wasn't found. Use the search picker so we attach a real fabric." },
        { status: 400 },
      );
    }
    if (labId) {
      const labExists = await prisma.lab.findUnique({
        where: { id: String(labId) },
        select: { id: true },
      });
      if (!labExists) {
        return NextResponse.json(
          { ok: false, error: "That lab wasn't found. Pick a lab from the dropdown." },
          { status: 400 },
        );
      }
    }

    const shipment = await prisma.sampleShipment.create({
      data: {
        fabricId: String(fabricId),
        submissionId: submissionId || null,
        testRequestId: testRequestId || null,
        originName: originName || null,
        originAddress: originAddress || null,
        destinationName: destinationName || null,
        destinationAddress: destinationAddress || null,
        labId: labId ? String(labId) : null,
        carrier: carrier || null,
        trackingNumber: trackingNumber || null,
        sampleCount: sampleCount || 1,
        sampleType: sampleType || null,
        sampleCondition: sampleCondition || null,
        weight: weight || null,
        notes: notes || null,
        createdBy: sessionUser.id,
        status: "PREPARING",
      },
      include: { events: true, fabric: true, lab: true, testRequest: true },
    });

    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: "CREATED",
        handler: sessionUser.id,
        notes: "Shipment created",
      },
    });

    return NextResponse.json({ ok: true, shipment });
  } catch (error: any) {
    console.error("Error creating shipment:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create shipment" },
      { status: 500 },
    );
  }
}
