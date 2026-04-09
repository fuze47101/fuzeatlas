// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { pushTestRequestStatus } from "@/lib/notify-realtime";
import { sendTestRequestStatusEmail } from "@/lib/email";

/* ── GET /api/factory-portal/request-test ── list factory's test requests ── */
export async function GET(req: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's factory (use DB lookup for full relations)
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
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
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const userId = sessionUser.id;

    // Get user's factory (use DB lookup for full relations)
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

    // ── Bridge: Auto-create admin TestRequest (PO) in DRAFT status ──
    let adminPO = null;
    try {
      // Generate PO number: FUZE-PO-YYYYMMDD-XXXX
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const poNumber = `FUZE-PO-${dateStr}-${rand}`;

      // Look up fabric's brand
      const fabricWithBrand = await prisma.fabric.findUnique({
        where: { id: fabricId },
        select: { brandId: true, fuzeNumber: true, customerCode: true, factoryCode: true },
      });

      // Map selected tests to TestRequestLine items
      const TEST_TYPE_MAP: Record<string, string> = {
        icp: "ICP", antibacterial: "ANTIBACTERIAL", fungal: "FUNGAL",
        odor: "ODOR", uv: "UV", microfiber: "MICROFIBER",
      };

      const lineData = (selectedTests || []).map((testKey: string) => ({
        testType: TEST_TYPE_MAP[testKey.toLowerCase()] || testKey.toUpperCase(),
        description: `Factory-requested ${testKey} test`,
        quantity: 1,
        status: "PENDING",
      }));

      adminPO = await prisma.testRequest.create({
        data: {
          poNumber,
          brandId: fabricWithBrand?.brandId || null,
          fabricId,
          status: "PENDING_APPROVAL",
          priority: "NORMAL",
          requestedById: userId,
          requestedAt: now,
          internalNotes: `Auto-created from factory test request ${testRequest.id}.\nFactory: ${user.factory?.name || user.factoryId}\nNotes: ${notes || "None"}`,
          fuzeFabricNumber: fabricWithBrand?.fuzeNumber ? String(fabricWithBrand.fuzeNumber) : null,
          customerFabricCode: fabricWithBrand?.customerCode || null,
          factoryFabricCode: fabricWithBrand?.factoryCode || null,
          lines: lineData.length > 0 ? { createMany: { data: lineData } } : undefined,
        },
      });

      // Link the factory request to the admin PO
      await prisma.fuzeTestRequest.update({
        where: { id: testRequest.id },
        data: { notes: `${notes || ""}\n[Linked to PO: ${poNumber}]`.trim() },
      });
    } catch (poErr) {
      console.error("Auto-create admin PO failed (non-fatal):", poErr);
    }

    // ── Notify admins (non-blocking) ──
    (async () => {
      try {
        const admins = await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "EMPLOYEE"] }, email: { not: null }, status: "ACTIVE" },
          select: { id: true, email: true, name: true },
        });
        for (const admin of admins) {
          if (admin.email) {
            sendTestRequestStatusEmail({
              email: admin.email,
              name: admin.name || "Admin",
              poNumber: adminPO?.poNumber || testRequest.id,
              newStatus: "PENDING_APPROVAL",
              testRequestId: adminPO?.id || testRequest.id,
            }).catch(() => {});
          }
        }
        // Push real-time notification
        await pushTestRequestStatus({
          testRequestId: adminPO?.id || testRequest.id,
          status: "PENDING_APPROVAL",
          createdByUserId: userId,
        });
      } catch (err) {
        console.error("[NOTIFY] Factory test request notification failed:", err);
      }
    })();

    return NextResponse.json({
      ok: true,
      message: "Test request created successfully",
      requestId: testRequest.id,
      adminPONumber: adminPO?.poNumber || null,
    });
  } catch (error) {
    console.error("Error creating test request:", error);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
