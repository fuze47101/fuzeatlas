// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

/* ── GET /api/brand-portal/test-request ── List available labs + services ── */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // LAB_USER can only see their own lab
    if (user.role === "LAB_USER" && user.labId) {
      const myLab = await prisma.lab.findUnique({
        where: { id: user.labId },
        include: { services: { orderBy: { testMethod: "asc" } } },
      });
      return NextResponse.json({
        ok: true,
        labs: myLab ? [{
          id: myLab.id, name: myLab.name, city: myLab.city, country: myLab.country,
          accreditations: myLab.accreditations,
          services: myLab.services.map((s) => ({
            id: s.id, testType: s.testType, testMethod: s.testMethod, description: s.description,
            priceUSD: s.priceUSD, turnaroundDays: s.turnaroundDays,
            rushPriceUSD: s.rushPriceUSD, rushDays: s.rushDays,
            preferred: s.preferred, preferredNote: s.preferredNote,
          })),
        }] : [],
      });
    }

    // Brand/Factory/Admin users: show all active labs but hide other labs' pricing for non-admin
    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    const labs = await prisma.lab.findMany({
      where: { active: true },
      include: {
        services: {
          orderBy: { testMethod: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // Sort: FUZE Atlas Lab first, then preferred labs, then the rest
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
          // Brand/factory users see FUZE price; admins see both
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
    console.error("Brand test-request GET error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load test options" }, { status: 500 });
  }
}

/* ── POST /api/brand-portal/test-request ── Brand/factory user OR admin/employee submits a test request */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Admin-class users can submit on behalf of any fabric's brand/factory.
    // Brand/factory users can only submit for fabrics they own.
    // Ticket cmokd13mn — Kaylee (EMPLOYEE) was getting blocked because the
    // old gate required user.brandId OR user.factoryId on the submitter,
    // but employees and admins have neither. Fall back to the fabric's
    // own assignments for these roles.
    const ADMIN_CLASS = ["ADMIN", "EMPLOYEE", "BD_REP", "LAB_USER", "LAB_ADMIN"];
    const isAdminClass = ADMIN_CLASS.includes(user.role);

    const userBrandId = user.brandId || null;
    const userFactoryId = user.factoryId || null;
    if (!isAdminClass && !userBrandId && !userFactoryId) {
      return NextResponse.json(
        { ok: false, error: "Your account isn't linked to a brand or factory. Ask an admin to link it before requesting a test." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { fabricId, labId, services, specialInstructions, priority } = body;

    if (!fabricId) return NextResponse.json({ ok: false, error: "Fabric is required" }, { status: 400 });
    if (!labId) return NextResponse.json({ ok: false, error: "Lab is required" }, { status: 400 });
    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ ok: false, error: "Select at least one test" }, { status: 400 });
    }

    // Look up the fabric. For brand/factory users we also enforce ownership;
    // for admin-class users we pull the fabric and use its own assignments.
    const fabricWhere: any = { id: fabricId };
    if (!isAdminClass) {
      if (userBrandId) fabricWhere.brandId = userBrandId;
      else if (userFactoryId) fabricWhere.factoryId = userFactoryId;
    }
    const fabric = await prisma.fabric.findFirst({
      where: fabricWhere,
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
      return NextResponse.json(
        { ok: false, error: "Fabric not found, or your account doesn't have access to it." },
        { status: 404 },
      );
    }
    // The brand we actually attach to the request: prefer the requester's brand
    // (for brand users), otherwise the fabric's brand. Same for factory.
    const effectiveBrandId = userBrandId || fabric.brandId || null;
    const effectiveFactoryId = userFactoryId || fabric.factoryId || null;

    // Generate PO number
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

    // Fetch lab services for pricing
    const labServices = await prisma.labService.findMany({ where: { labId } });

    // Build line items
    const lineData = services.map((svc: any) => {
      const labSvc = labServices.find(
        (ls) => ls.testType === svc.testType && ls.testMethod === svc.testMethod
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

    // Create submission if one doesn't exist for this fabric
    let submission = await prisma.fabricSubmission.findFirst({
      where: { fabricId: fabric.id, ...(effectiveBrandId ? { brandId: effectiveBrandId } : {}) },
    });

    if (!submission) {
      submission = await prisma.fabricSubmission.create({
        data: {
          brandId: effectiveBrandId,
          factoryId: effectiveFactoryId,
          fabricId: fabric.id,
          fuzeFabricNumber: fabric.fuzeNumber ?? null,
          customerFabricCode: fabric.customerCode || null,
          factoryFabricCode: fabric.factoryCode || null,
          status: "Submitted",
          testStatus: "PENDING",
          progressPercent: 10,
        },
      });
    }

    // Create the test request
    const testRequest = await prisma.testRequest.create({
      data: {
        poNumber,
        brandId: effectiveBrandId,
        fabricId: fabric.id,
        submissionId: submission.id,
        labId,
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

    // ── Notify lab via email ──
    const labRecord = await prisma.lab.findUnique({
      where: { id: labId },
      select: { email: true, name: true, users: { select: { email: true }, where: { status: "ACTIVE" } } },
    });
    const labEmails = [
      ...(labRecord?.email ? [labRecord.email] : []),
      ...(labRecord?.users?.map((u: any) => u.email) || []),
    ].filter(Boolean);

    // Also notify admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { email: true },
    });
    const adminEmails = admins.map((a) => a.email).filter(Boolean);

    const testList = lineData.map((l: any) => `${l.testMethod || l.testType} - $${l.totalPrice || 0}`).join(", ");
    const brandRecord = effectiveBrandId ? await prisma.brand.findUnique({ where: { id: effectiveBrandId }, select: { name: true } }) : null;

    if (labEmails.length > 0) {
      sendEmail({
        to: labEmails,
        subject: `🧪 New Test Request ${poNumber} — ${brandRecord?.name || "FUZE Customer"}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#00b4c3;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:#fff;margin:0">New Test Request</h2>
            </div>
            <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:8px 0;color:#888;width:130px">PO Number</td><td style="padding:8px 0;font-weight:600">${poNumber}</td></tr>
                <tr><td style="padding:8px 0;color:#888">Brand</td><td style="padding:8px 0">${brandRecord?.name || "—"}</td></tr>
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

    // Notify admins too
    if (adminEmails.length > 0) {
      sendEmail({
        to: adminEmails,
        subject: `🧪 Test Request ${poNumber} — ${brandRecord?.name || "Customer"} → ${labRecord?.name || "Lab"}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1A1A2E;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:#00b4c3;margin:0">Test Request Submitted</h2>
            </div>
            <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
              <p style="font-size:14px;color:#333"><strong>${brandRecord?.name || "A customer"}</strong> submitted a test request to <strong>${labRecord?.name || "FUZE Atlas Lab"}</strong></p>
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
    console.error("Brand test-request POST error:", e);
    return NextResponse.json({ ok: false, error: "Failed to create test request" }, { status: 500 });
  }
}
