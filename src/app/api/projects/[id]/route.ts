// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/projects/[id] ── Project detail with commercial data ──── */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, pipelineStage: true } },
        factory: { select: { id: true, name: true, country: true, distributorId: true } },
        distributor: { select: { id: true, name: true, country: true } },
        testRuns: {
          select: { id: true, testType: true, testDate: true, washCount: true },
          orderBy: { testDate: "desc" },
          take: 10,
        },
        invoices: {
          select: {
            id: true, invoiceNumber: true, invoiceDate: true,
            amount: true, currency: true, status: true,
          },
          orderBy: { invoiceDate: "desc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    // Calculate invoice totals
    const invoiceTotalPaid = project.invoices
      .filter((i) => i.status === "PAID")
      .reduce((s, i) => s + i.amount, 0);
    const invoiceTotalOutstanding = project.invoices
      .filter((i) => ["DRAFT", "SENT", "OVERDUE"].includes(i.status))
      .reduce((s, i) => s + i.amount, 0);

    return NextResponse.json({
      ok: true,
      project: {
        ...project,
        invoiceSummary: {
          paid: Math.round(invoiceTotalPaid * 100) / 100,
          outstanding: Math.round(invoiceTotalOutstanding * 100) / 100,
          total: Math.round((invoiceTotalPaid + invoiceTotalOutstanding) * 100) / 100,
          count: project.invoices.length,
        },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── PUT /api/projects/[id] ── Update project commercial fields ──── */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: any = {};

    // Basic fields
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.brandId !== undefined) data.brandId = body.brandId || null;

    // Commercial fields
    if (body.stage !== undefined) data.stage = body.stage;
    if (body.projectedValue !== undefined) data.projectedValue = body.projectedValue ? parseFloat(body.projectedValue) : null;
    if (body.actualValue !== undefined) data.actualValue = body.actualValue ? parseFloat(body.actualValue) : null;
    if (body.currency !== undefined) data.currency = body.currency || "USD";
    if (body.probability !== undefined) data.probability = Math.max(0, Math.min(100, parseInt(body.probability, 10) || 50));
    if (body.fuzeTier !== undefined) data.fuzeTier = body.fuzeTier || null;
    if (body.annualVolumeMeters !== undefined) data.annualVolumeMeters = body.annualVolumeMeters ? parseFloat(body.annualVolumeMeters) : null;
    if (body.annualFuzeLiters !== undefined) data.annualFuzeLiters = body.annualFuzeLiters ? parseFloat(body.annualFuzeLiters) : null;

    // Manufacturing
    if (body.factoryId !== undefined) data.factoryId = body.factoryId || null;
    if (body.distributorId !== undefined) data.distributorId = body.distributorId || null;

    // Auto-populate distributor from factory if factory changed and distributor not explicitly set
    if (body.factoryId && body.distributorId === undefined) {
      const factory = await prisma.factory.findUnique({
        where: { id: body.factoryId },
        select: { distributorId: true },
      });
      if (factory?.distributorId) {
        data.distributorId = factory.distributorId;
      }
    }

    // Timeline
    if (body.expectedProductionDate !== undefined) {
      data.expectedProductionDate = body.expectedProductionDate ? new Date(body.expectedProductionDate) : null;
    }
    if (body.actualProductionDate !== undefined) {
      data.actualProductionDate = body.actualProductionDate ? new Date(body.actualProductionDate) : null;
    }

    const project = await prisma.project.update({
      where: { id },
      data,
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true, country: true } },
        distributor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, project });
  } catch (e: any) {
    console.error("Project update error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
