// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ── GET /api/factory-portal/request-test ── list factory's test requests ── */
export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's factory
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { factory: true },
    });

    if (!user?.factoryId) {
      return NextResponse.json(
        { ok: false, error: "Not a factory user" },
        { status: 403 }
      );
    }

    // Fetch test requests for this factory
    const requests = await prisma.fuzeTestRequest.findMany({
      where: {
        factoryId: user.factoryId,
      },
      include: {
        fabric: {
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            factoryCode: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format response
    const formatted = requests.map((req) => ({
      id: req.id,
      fabricId: req.fabricId,
      fabricName: req.fabric
        ? `FUZE-${req.fabric.fuzeNumber} (${req.fabric.customerCode})`
        : "Unknown",
      selectedTests: req.selectedTests || [],
      status: req.status,
      controlRequired: req.controlRequired,
      totalMoqMeters: req.totalMoqMeters,
      trackingNumber: req.trackingNumber,
      shippedDate: req.shippedDate,
      receivedDate: req.receivedDate,
      createdAt: req.createdAt,
    }));

    return NextResponse.json({
      ok: true,
      total: formatted.length,
      requests: formatted,
    });
  } catch (error) {
    console.error("Error fetching test requests:", error);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}

/* ── POST /api/factory-portal/request-test ── create a FUZE test request ── */
export async function POST(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's factory
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { factory: true },
    });

    if (!user?.factoryId) {
      return NextResponse.json(
        { ok: false, error: "Not a factory user" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { fabricId, selectedTests, controlRequired, totalMoqMeters, notes } =
      body;

    if (!fabricId || !selectedTests || selectedTests.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Fabric and test selections required" },
        { status: 400 }
      );
    }

    // Verify fabric belongs to factory
    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
    });

    if (fabric?.factoryId !== user.factoryId) {
      return NextResponse.json(
        { ok: false, error: "Fabric does not belong to your factory" },
        { status: 403 }
      );
    }

    // Create test request
    const testRequest = await prisma.fuzeTestRequest.create({
      data: {
        fabricId,
        factoryId: user.factoryId,
        requestedBy: userId,
        selectedTests,
        controlRequired: controlRequired || false,
        totalMoqMeters,
        notes,
        status: "PENDING",
      },
      include: {
        fabric: {
          select: {
            fuzeNumber: true,
            customerCode: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Test request created successfully",
      requestId: testRequest.id,
    });
  } catch (error) {
    console.error("Error creating test request:", error);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
