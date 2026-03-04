// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/invoices ── List invoices with filters ──── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const distributorId = searchParams.get("distributorId") || "";
    const factoryId = searchParams.get("factoryId") || "";
    const brandId = searchParams.get("brandId") || "";
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = 50;

    const where: any = {};
    if (status) where.status = status;
    if (distributorId) where.distributorId = distributorId;
    if (factoryId) where.factoryId = factoryId;
    if (brandId) where.brandId = brandId;
    if (fromDate || toDate) {
      where.invoiceDate = {};
      if (fromDate) where.invoiceDate.gte = new Date(fromDate);
      if (toDate) where.invoiceDate.lte = new Date(toDate);
    }

    const [total, invoices, metrics] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: {
          distributor: { select: { id: true, name: true } },
          factory: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { invoiceDate: "desc" },
      }),
      // Summary metrics (all invoices, no pagination)
      prisma.invoice.groupBy({
        by: ["status"],
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Build summary from metrics
    const statusTotals: Record<string, { amount: number; count: number }> = {};
    for (const m of metrics) {
      statusTotals[m.status] = { amount: m._sum.amount || 0, count: m._count.id };
    }

    const totalPaid = statusTotals["PAID"]?.amount || 0;
    const totalOutstanding =
      (statusTotals["DRAFT"]?.amount || 0) +
      (statusTotals["SENT"]?.amount || 0) +
      (statusTotals["OVERDUE"]?.amount || 0);
    const totalBilled = totalPaid + totalOutstanding;

    return NextResponse.json({
      ok: true,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      invoices: invoices.map((inv) => ({
        ...inv,
        ageDays: Math.floor((Date.now() - new Date(inv.invoiceDate).getTime()) / 86400000),
      })),
      summary: {
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        collectionRate: totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 1000) / 10 : 0,
        byStatus: statusTotals,
      },
    });
  } catch (e: any) {
    console.error("Invoices API error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── POST /api/invoices ── Create invoice ──── */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      invoiceNumber, invoiceDate, dueDate, amount, currency,
      status, description, notes,
      distributorId, factoryId, brandId, projectId,
    } = body;

    if (!invoiceNumber?.trim()) {
      return NextResponse.json({ ok: false, error: "Invoice number is required" }, { status: 400 });
    }
    if (!distributorId || !factoryId) {
      return NextResponse.json({ ok: false, error: "Distributor and Factory are required" }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Amount must be positive" }, { status: 400 });
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: new Date(invoiceDate || Date.now()),
        dueDate: dueDate ? new Date(dueDate) : null,
        amount: parseFloat(amount),
        currency: currency || "USD",
        status: status || "DRAFT",
        description: description?.trim() || null,
        notes: notes?.trim() || null,
        distributorId,
        factoryId,
        brandId: brandId || null,
        projectId: projectId || null,
      },
      include: {
        distributor: { select: { name: true } },
        factory: { select: { name: true } },
      },
    });

    return NextResponse.json({ ok: true, invoice });
  } catch (e: any) {
    console.error("Create invoice error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
