// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

/**
 * GET /api/distributor-portal/test-request
 *
 * Returns the labs + services available for the distributor to choose from.
 * Mirrors /api/brand-portal/test-request GET — distributors see all active
 * labs and the FUZE price (no list price).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user.role);
    if (!isDistributor && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const labs = await prisma.lab.findMany({
      where: { active: true },
      include: { services: { orderBy: { testMethod: "asc" } } },
      orderBy: { name: "asc" },
    });

    // FUZE first, then preferred labs, then alpha
    const sorted = labs.sort((a, b) => {
      const aFuze = a.name.toLowerCase().includes("fuze") ? 0 : 1;
      const bFuze = b.name.toLowerCase().includes("fuze") ? 0 : 1;
      if (aFuze !== bFuze) return aFuze - bFuze;
      const aPref = a.services.some((s) => s.preferred) ? 0 : 1;
      const bPref = b.services.some((s) => s.preferred) ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      ok: true,
      labs: sorted.map((lab) => ({
        id: lab.id,
        name: lab.name,
        city: lab.city,
        country: lab.country,
        accreditations: lab.accreditations,
        services: lab.services.map((s) => ({
          id: s.id,
          testType: s.testType,
          testMethod: s.testMethod,
          description: s.description,
          priceUSD: s.priceUSD,
          ...(isAdmin ? { listPriceUSD: s.listPriceUSD } : {}),
          turnaroundDays: s.turnaroundDays,
          rushPriceUSD: s.rushPriceUSD,
          rushDays: s.rushDays,
          preferred: s.preferred,
          preferredNote: s.preferredNote,
        })),
      })),
    });
  } catch (e: any) {
    console.error("Distributor test-request GET error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load test options" }, { status: 500 });
  }
}

/**
 * POST /api/distributor-portal/test-request
 *
 * A distributor user submits a test request on behalf of one of their
 * served brands or factories. The fabric must be visible to this
 * distributor — either:
 *   (a) the fabric's factoryId is in distributor.factories, OR
 *   (b) the fabric's brandId belongs to a Brand that has at least one
 *       Project assigned to this distributor.
 *
 * Andrew's note (Tina ticket 4/17): GS sends a lot of ICP/AM tests for
 * their customers — this is the symmetric flow to brand-portal but
 * scoped to the distributor's visible fabrics.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user.role);
    if (!isDistributor && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const distributorId = user.distributorId || null;
    if (isDistributor && !distributorId) {
      return NextResponse.json(
        { ok: false, error: "No distributor assigned to your account" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { fabricId, labId, services, specialInstructions, priority } = body;

    if (!fabricId)
      return NextResponse.json({ ok: false, error: "Fabric is required" }, { status: 400 });
    if (!labId) return NextResponse.json({ ok: false, error: "Lab is required" }, { status: 400 });
    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ ok: false, error: "Select at least one test" }, { status: 400 });
    }

    // Resolve distributor scope (factory IDs + brand IDs)
    let scopedFactoryIds: string[] = [];
    let scopedBrandIds: string[] = [];
    if (isDistributor) {
      const factories = await prisma.factory.findMany({
        where: { distributorId },
        select: { id: true },
      });
      scopedFactoryIds = factories.map((f) => f.id);

      const projects = await prisma.project.findMany({
        where: { distributorId, brandId: { not: null } },
        select: { brandId: true },
      });
      scopedBrandIds = Array.from(
        new Set(projects.map((p) => p.brandId).filter(Boolean) as string[]),
      );
    }

    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryCode: true,
        brandId: true,
        factoryId: true,
      },
    });
    if (!fabric) {
      return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
    }

    if (isDistributor) {
      const factoryMatch = fabric.factoryId && scopedFactoryIds.includes(fabric.factoryId);
      const brandMatch = fabric.brandId && scopedBrandIds.includes(fabric.brandId);
      if (!factoryMatch && !brandMatch) {
        return NextResponse.json(
          { ok: false, error: "Fabric is not in your distributor scope" },
          { status: 403 },
        );
      }
    }

    // Generate PO number — same format as brand-portal route
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `FUZE-PO-${dateStr}-`;
    const latest = await prisma.testRequest.findFirst({
      where: { poNumber: { startsWith: prefix } },
      orderBy: { poNumber: "desc" },
      select: { poNumber: true },
    });
    let seq = 1;
    if (latest?.poNumber) {
      const lastSeq = parseInt(latest.poNumber.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const poNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    // Pricing
    const labServices = await prisma.labService.findMany({ where: { labId } });

    const lineData = services.map((svc: any) => {
      const labSvc = labServices.find(
        (ls) => ls.testType === svc.testType && ls.testMethod === svc.testMethod,
      );
      const qty = svc.quantity || 1;
      const isRush = svc.rush === true;
      const unitPrice = labSvc?.priceUSD ?? null;
      const rushPrice = isRush ? (labSvc?.rushPriceUSD ?? null) : null;
      const totalPrice = unitPrice != null ? unitPrice * qty + (rushPrice || 0) : null;
      const estimatedDays = isRush
        ? (labSvc?.rushDays ?? labSvc?.turnaroundDays ?? null)
        : (labSvc?.turnaroundDays ?? null);
      return {
        testType: svc.testType,
        testMethod: svc.testMethod || labSvc?.testMethod || null,
        description: labSvc?.description || null,
        quantity: qty,
        unitPrice,
        totalPrice,
        rush: isRush,
        rushPrice,
        estimatedDays,
      };
    });

    const estimatedCost = lineData.reduce((sum: number, l: any) => sum + (l.totalPrice || 0), 0);

    // Find or create a FabricSubmission so the testRequest links to a real submission row
    let submission = await prisma.fabricSubmission.findFirst({
      where: {
        fabricId: fabric.id,
        ...(fabric.brandId ? { brandId: fabric.brandId } : {}),
        ...(fabric.factoryId ? { factoryId: fabric.factoryId } : {}),
      },
    });

    if (!submission) {
      submission = await prisma.fabricSubmission.create({
        data: {
          brandId: fabric.brandId,
          factoryId: fabric.factoryId,
          fabricId: fabric.id,
          fuzeFabricNumber: fabric.fuzeNumber ?? null,
          customerFabricCode: fabric.customerCode || null,
          factoryFabricCode: fabric.factoryCode || null,
          status: "Submitted",
          testStatus: "PENDING",
          progressPercent: 10,
          category: "DISTRIBUTOR_REQUESTED",
        },
      });
    }

    // Create the test request — also stamp distributorId so we can audit
    const testRequest = await prisma.testRequest.create({
      data: {
        poNumber,
        brandId: fabric.brandId,
        fabricId: fabric.id,
        submissionId: submission.id,
        labId,
        distributorId: distributorId || null,
        status: "PENDING_APPROVAL",
        requestedById: user.id,
        requestedAt: new Date(),
        priority: priority || "NORMAL",
        specialInstructions: specialInstructions || null,
        estimatedCost,
        fuzeFabricNumber: fabric.fuzeNumber ? `FUZE-${fabric.fuzeNumber}` : null,
        customerFabricCode: fabric.customerCode || null,
        factoryFabricCode: fabric.factoryCode || null,
        lines: { create: lineData },
      },
      include: {
        lab: { select: { id: true, name: true } },
        lines: true,
      },
    });

    // ── Notify lab + admins ──────────────────────────────────────────
    const labRecord = await prisma.lab.findUnique({
      where: { id: labId },
      select: {
        email: true,
        name: true,
        users: { select: { email: true }, where: { status: "ACTIVE" } },
      },
    });
    const labEmails = [
      ...(labRecord?.email ? [labRecord.email] : []),
      ...(labRecord?.users?.map((u: any) => u.email) || []),
    ].filter(Boolean);

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { email: true },
    });
    const adminEmails = admins.map((a) => a.email).filter(Boolean);

    const testList = lineData
      .map((l: any) => `${l.testMethod || l.testType} - $${l.totalPrice || 0}`)
      .join(", ");
    const brandRecord = fabric.brandId
      ? await prisma.brand.findUnique({ where: { id: fabric.brandId }, select: { name: true } })
      : null;
    const distributorRecord = distributorId
      ? await prisma.distributor.findUnique({
          where: { id: distributorId },
          select: { name: true },
        })
      : null;

    if (labEmails.length > 0) {
      sendEmail({
        to: labEmails,
        subject: `🧪 New Test Request ${poNumber} — ${distributorRecord?.name || "Distributor"} for ${brandRecord?.name || "Customer"}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#00b4c3;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:#fff;margin:0">New Test Request (Distributor)</h2>
            </div>
            <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:8px 0;color:#888;width:140px">PO Number</td><td style="padding:8px 0;font-weight:600">${poNumber}</td></tr>
                <tr><td style="padding:8px 0;color:#888">Distributor</td><td style="padding:8px 0">${distributorRecord?.name || "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#888">Brand (end customer)</td><td style="padding:8px 0">${brandRecord?.name || "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#888">Fabric</td><td style="padding:8px 0">FUZE ${fabric.fuzeNumber || "—"} (${fabric.customerCode || "—"})</td></tr>
                <tr><td style="padding:8px 0;color:#888">Tests</td><td style="padding:8px 0">${testList}</td></tr>
                <tr><td style="padding:8px 0;color:#888">Priority</td><td style="padding:8px 0;font-weight:600">${priority || "NORMAL"}</td></tr>
                <tr><td style="padding:8px 0;color:#888">Estimated Cost</td><td style="padding:8px 0;font-weight:600">$${estimatedCost}</td></tr>
                ${specialInstructions ? `<tr><td style="padding:8px 0;color:#888">Instructions</td><td style="padding:8px 0">${specialInstructions}</td></tr>` : ""}
              </table>
              <div style="margin-top:20px;text-align:center">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com"}/lab-portal/requests"
                   style="display:inline-block;background:#00b4c3;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
                  View in Lab Portal
                </a>
              </div>
            </div>
          </div>
        `,
      }).catch((err) => console.error("Failed to send lab notification:", err));
    }

    if (adminEmails.length > 0) {
      sendEmail({
        to: adminEmails,
        subject: `🧪 Distributor Test Request ${poNumber} — ${distributorRecord?.name || "Distributor"}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1A1A2E;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:#00b4c3;margin:0">Distributor Test Request</h2>
            </div>
            <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
              <p style="font-size:14px;color:#333"><strong>${distributorRecord?.name || "A distributor"}</strong> submitted a test request on behalf of <strong>${brandRecord?.name || "their customer"}</strong> to <strong>${labRecord?.name || "FUZE Atlas Lab"}</strong></p>
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:6px 0;color:#888;width:130px">PO</td><td style="padding:6px 0;font-weight:600">${poNumber}</td></tr>
                <tr><td style="padding:6px 0;color:#888">Tests</td><td style="padding:6px 0">${testList}</td></tr>
                <tr><td style="padding:6px 0;color:#888">Cost</td><td style="padding:6px 0">$${estimatedCost}</td></tr>
                <tr><td style="padding:6px 0;color:#888">Priority</td><td style="padding:6px 0">${priority || "NORMAL"}</td></tr>
              </table>
              <div style="margin-top:20px;text-align:center">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com"}/test-requests"
                   style="display:inline-block;background:#00b4c3;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
                  Review Request
                </a>
              </div>
            </div>
          </div>
        `,
      }).catch((err) => console.error("Failed to send admin notification:", err));
    }

    return NextResponse.json({
      ok: true,
      testRequest: {
        id: testRequest.id,
        poNumber: testRequest.poNumber,
        labName: testRequest.lab?.name,
        estimatedCost,
        lineCount: testRequest.lines.length,
      },
    });
  } catch (e: any) {
    console.error("Distributor test-request POST error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Failed to create test request" },
      { status: 500 },
    );
  }
}
