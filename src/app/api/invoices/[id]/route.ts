// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/invoices/[id] ── Invoice detail ──── */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        distributor: { select: { id: true, name: true, country: true } },
        factory: { select: { id: true, name: true, country: true } },
        brand: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, stage: true, projectedValue: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ ok: false, error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, invoice });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── PUT /api/invoices/[id] ── Update invoice ──── */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: any = {};
    if (body.invoiceDate) data.invoiceDate = new Date(body.invoiceDate);
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.paidDate !== undefined) data.paidDate = body.paidDate ? new Date(body.paidDate) : null;
    if (body.amount !== undefined) data.amount = parseFloat(body.amount);
    if (body.currency) data.currency = body.currency;
    if (body.status) data.status = body.status;
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
    if (body.brandId !== undefined) data.brandId = body.brandId || null;
    if (body.projectId !== undefined) data.projectId = body.projectId || null;

    // Auto-set paidDate when marking as PAID
    if (body.status === "PAID" && !data.paidDate) {
      data.paidDate = new Date();
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data,
      include: {
        distributor: { select: { name: true } },
        factory: { select: { name: true } },
      },
    });

    return NextResponse.json({ ok: true, invoice });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── DELETE /api/invoices/[id] ── Soft delete (CANCELLED) ──── */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ ok: true, invoice });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
