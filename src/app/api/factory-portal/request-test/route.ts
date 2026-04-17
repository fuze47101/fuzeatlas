// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { pushTestRequestStatus } from "@/lib/notify-realtime";
import { notifyTestRequestCreated } from "@/lib/notify";
import { sendEmail, sendTestRequestStatusEmail } from "@/lib/email";

/* ── GET /api/factory-portal/request-test ── list factory's test requests ── */
export async function GET(req: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Get user's factory (use DB lookup for full relations)
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: { factory: true },
    });

    if (!user?.factoryId) {
      return NextResponse.json({ ok: false, error: "Not a factory user" }, { status: 403 });
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
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/* ── POST /api/factory-portal/request-test ── create a FUZE test request ── */
export async function POST(req: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = sessionUser.id;

    // Get user's factory (use DB lookup for full relations)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { factory: true },
    });

    if (!user?.factoryId) {
      return NextResponse.json({ ok: false, error: "Not a factory user" }, { status: 403 });
    }

    const body = await req.json();
    const { fabricId, labId, selectedTests, controlRequired, totalMoqMeters, notes } = body;

    if (!fabricId || !selectedTests || selectedTests.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Fabric and test selections required" },
        { status: 400 },
      );
    }

    // Validate labId if supplied
    if (labId) {
      const labExists = await prisma.lab.findUnique({
        where: { id: labId },
        select: { id: true, active: true },
      });
      if (!labExists || !labExists.active) {
        return NextResponse.json(
          { ok: false, error: "Selected lab not found or inactive" },
          { status: 400 },
        );
      }
    }

    // Verify fabric belongs to factory
    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
    });

    if (fabric?.factoryId !== user.factoryId) {
      return NextResponse.json(
        { ok: false, error: "Fabric does not belong to your factory" },
        { status: 403 },
      );
    }

    // Create test request
    const testRequest = await prisma.fuzeTestRequest.create({
      data: {
        fabricId,
        factoryId: user.factoryId,
        labId: labId || null,
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
        icp: "ICP",
        antibacterial: "ANTIBACTERIAL",
        fungal: "FUNGAL",
        odor: "ODOR",
        uv: "UV",
        microfiber: "MICROFIBER",
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
          labId: labId || null,
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

        const factoryName = user.factory?.name || "A factory";
        const poNum = adminPO?.poNumber || testRequest.id;
        const testList = (selectedTests || []).map((t: string) => t.toUpperCase()).join(", ");
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

        const adminHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1A1A2E;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:#00b4c3;margin:0">Test Request Submitted</h2>
            </div>
            <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
              <p style="font-size:14px;color:#333"><strong>${factoryName}</strong> submitted a test request to <strong>FUZE Atlas Lab</strong></p>
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:6px 0;color:#888;width:130px">PO</td><td style="padding:6px 0;font-weight:600">${poNum}</td></tr>
                <tr><td style="padding:6px 0;color:#888">Tests</td><td style="padding:6px 0">${testList}</td></tr>
                <tr><td style="padding:6px 0;color:#888">Priority</td><td style="padding:6px 0">NORMAL</td></tr>
              </table>
              <div style="margin-top:20px;text-align:center">
                <a href="${baseUrl}/test-requests"
                   style="display:inline-block;background:#00b4c3;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
                  Review Request
                </a>
              </div>
            </div>
          </div>
        `;

        for (const admin of admins) {
          if (admin.email) {
            sendEmail({
              to: admin.email,
              subject: `🧪 Test Request ${poNum} — ${factoryName} → FUZE Atlas Lab`,
              html: adminHtml,
            }).catch(() => {});
          }
        }

        // Push real-time notification to requester
        await pushTestRequestStatus({
          testRequestId: adminPO?.id || testRequest.id,
          status: "PENDING_APPROVAL",
          createdByUserId: userId,
          poNumber: adminPO?.poNumber,
          factoryName: user.factory?.name || undefined,
        });

        // Notify admins in-app about the new test submission
        await notifyTestRequestCreated({
          testRequestId: adminPO?.id || testRequest.id,
          poNumber: adminPO?.poNumber,
          factoryName: user.factory?.name || undefined,
          selectedTests,
          requesterName: user.name || user.email || undefined,
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
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
