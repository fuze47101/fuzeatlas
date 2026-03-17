// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── GET /api/brand-portal/test-request ── List available labs + services for brand users */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Fetch active labs with their services
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
          priceUSD: s.priceUSD,
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

/* ── POST /api/brand-portal/test-request ── Brand user submits a test request */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const brandId = user.brandId;
    if (!brandId) {
      return NextResponse.json({ ok: false, error: "No brand associated" }, { status: 403 });
    }

    const body = await req.json();
    const { fabricId, labId, services, specialInstructions, priority } = body;

    if (!fabricId) return NextResponse.json({ ok: false, error: "Fabric is required" }, { status: 400 });
    if (!labId) return NextResponse.json({ ok: false, error: "Lab is required" }, { status: 400 });
    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ ok: false, error: "Select at least one test" }, { status: 400 });
    }

    // Verify fabric belongs to this brand
    const fabric = await prisma.fabric.findFirst({
      where: { id: fabricId, brandId },
      select: { id: true, fuzeNumber: true, customerCode: true, factoryCode: true },
    });
    if (!fabric) {
      return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
    }

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
      where: { fabricId: fabric.id, brandId },
    });

    if (!submission) {
      submission = await prisma.fabricSubmission.create({
        data: {
          brandId,
          fabricId: fabric.id,
          fuzeFabricNumber: fabric.fuzeNumber ? String(fabric.fuzeNumber) : null,
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
        brandId,
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
