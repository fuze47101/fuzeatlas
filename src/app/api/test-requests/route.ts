// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Auto PO Number Generation ─────────────────────────
// Format: FUZE-PO-YYYYMMDD-XXXX (4-digit sequence per day)
async function generatePoNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const prefix = `FUZE-PO-${dateStr}-`;

  // Find highest existing PO for today
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

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ─── GET: List test requests ─────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const brandId = searchParams.get("brandId") || "";
    const labId = searchParams.get("labId") || "";
    const priority = searchParams.get("priority") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = 50;

    const where: any = {};
    if (status) where.status = status;
    if (brandId) where.brandId = brandId;
    if (labId) where.labId = labId;
    if (priority) where.priority = priority;

    const [requests, total, stats] = await Promise.all([
      prisma.testRequest.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        include: {
          brand: { select: { id: true, name: true } },
          fabric: { select: { id: true, fuzeNumber: true, customerCode: true, construction: true, weightGsm: true } },
          lab: { select: { id: true, name: true, customerNumber: true } },
          project: { select: { id: true, name: true } },
          sow: { select: { id: true, title: true } },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          lines: {
            include: {
              testRun: { select: { id: true, testReportNumber: true, testDate: true } },
            },
          },
        },
      }),
      prisma.testRequest.count({ where }),
      prisma.testRequest.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { estimatedCost: true },
      }),
    ]);

    const statusStats: Record<string, { count: number; totalCost: number }> = {};
    for (const s of stats) {
      statusStats[s.status] = {
        count: s._count.id,
        totalCost: s._sum.estimatedCost || 0,
      };
    }

    return NextResponse.json({
      ok: true,
      requests,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats: statusStats,
    });
  } catch (e: any) {
    console.error("Test requests GET error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ─── POST: Create new test request ─────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      brandId, fabricId, submissionId, projectId, sowId,
      labId, specialInstructions, internalNotes, priority,
      requestedCompletionDate, lines,
    } = body;

    if (!labId) {
      return NextResponse.json({ ok: false, error: "Lab is required" }, { status: 400 });
    }
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ ok: false, error: "At least one test line item is required" }, { status: 400 });
    }

    // Get the requesting user from headers
    const userId = request.headers.get("x-user-id") || null;

    // Generate PO number
    const poNumber = await generatePoNumber();

    // Fetch lab for customer number auto-fill
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: { customerNumber: true },
    });

    // Fetch fabric details for PO
    let fuzeFabricNumber: string | null = null;
    let customerFabricCode: string | null = null;
    let factoryFabricCode: string | null = null;
    if (fabricId) {
      const fabric = await prisma.fabric.findUnique({
        where: { id: fabricId },
        select: { fuzeNumber: true, customerCode: true, factoryCode: true },
      });
      if (fabric) {
        fuzeFabricNumber = fabric.fuzeNumber ? `FUZE-${fabric.fuzeNumber}` : null;
        customerFabricCode = fabric.customerCode || null;
        factoryFabricCode = fabric.factoryCode || null;
      }
    }

    // Look up pricing from LabService for each line
    const labServices = await prisma.labService.findMany({
      where: { labId },
    });

    // Build line items with pricing
    const lineData = lines.map((line: any) => {
      const service = labServices.find(
        (s) => s.testType === line.testType && (!line.testMethod || s.testMethod === line.testMethod)
      );
      const qty = line.quantity || 1;
      const isRush = line.rush === true;
      const unitPrice = line.unitPrice ?? service?.priceUSD ?? null;
      const rushPrice = isRush ? (line.rushPrice ?? service?.rushPriceUSD ?? null) : null;
      const totalPrice = unitPrice != null ? unitPrice * qty + (rushPrice || 0) : null;
      const estimatedDays = isRush ? (service?.rushDays ?? service?.turnaroundDays ?? null) : (service?.turnaroundDays ?? null);

      return {
        testType: line.testType,
        testMethod: line.testMethod || service?.testMethod || null,
        description: line.description || service?.description || null,
        quantity: qty,
        unitPrice,
        totalPrice,
        rush: isRush,
        rushPrice,
        estimatedDays,
        notes: line.notes || null,
      };
    });

    // Calculate total estimated cost
    const estimatedCost = lineData.reduce((sum: number, l: any) => sum + (l.totalPrice || 0), 0);

    const testRequest = await prisma.testRequest.create({
      data: {
        poNumber,
        brandId: brandId || null,
        fabricId: fabricId || null,
        submissionId: submissionId || null,
        projectId: projectId || null,
        sowId: sowId || null,
        labId,
        labCustomerNumber: lab?.customerNumber || null,
        fuzeFabricNumber,
        customerFabricCode,
        factoryFabricCode,
        status: "DRAFT",
        requestedById: userId,
        priority: priority || "NORMAL",
        requestedCompletionDate: requestedCompletionDate ? new Date(requestedCompletionDate) : null,
        specialInstructions: specialInstructions || null,
        internalNotes: internalNotes || null,
        estimatedCost,
        lines: {
          create: lineData,
        },
      },
      include: {
        brand: { select: { id: true, name: true } },
        lab: { select: { id: true, name: true } },
        fabric: { select: { id: true, fuzeNumber: true } },
        lines: true,
      },
    });

    return NextResponse.json({ ok: true, testRequest, poNumber });
  } catch (e: any) {
    console.error("Test request POST error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
