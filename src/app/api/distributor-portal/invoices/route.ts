// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "DISTRIBUTOR_USER") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const distributorId = user.distributorId;
    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";

    const where: any = { distributorId };
    if (status) where.status = status;

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        paidDate: true,
        amount: true,
        currency: true,
        status: true,
        description: true,
        factory: { select: { id: true, name: true, country: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { invoiceDate: "desc" },
    });

    return NextResponse.json({ ok: true, invoices });
  } catch (e: any) {
    console.error("Distributor invoices error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
