// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "DISTRIBUTOR_USER") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const distributorId = user.distributorId;
    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor not found" }, { status: 404 });
    }

    const [totalInvoices, unpaidInvoices, totalDocuments, activeFactories] = await Promise.all([
      prisma.invoice.count({ where: { distributorId } }),
      prisma.invoice.count({ where: { distributorId, status: { in: ["SENT", "OVERDUE"] } } }),
      prisma.distributorDocument.count({ where: { distributorId } }),
      prisma.factory.count({ where: { distributorId } }),
    ]);

    // Sum of outstanding invoice amounts
    const outstandingResult = await prisma.invoice.aggregate({
      where: { distributorId, status: { in: ["SENT", "OVERDUE"] } },
      _sum: { amount: true },
    });

    return NextResponse.json({
      ok: true,
      stats: {
        totalInvoices,
        unpaidInvoices,
        outstandingAmount: outstandingResult._sum.amount || 0,
        totalDocuments,
        activeFactories,
      },
    });
  } catch (e: any) {
    console.error("Distributor stats error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
