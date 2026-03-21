// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/projects ── list all projects (optionally filter by brandId) */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId") || undefined;

    const where: any = {};
    if (brandId) where.brandId = brandId;

    const stage = searchParams.get("stage") || undefined;
    if (stage) where.stage = stage;

    const projects = await prisma.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true, country: true } },
        distributor: { select: { id: true, name: true } },
        _count: { select: { testRuns: true, invoices: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        brandId: p.brandId,
        brandName: p.brand?.name || null,
        stage: p.stage,
        projectedValue: p.projectedValue,
        actualValue: p.actualValue,
        currency: p.currency,
        probability: p.probability,
        fuzeTier: p.fuzeTier,
        annualVolumeMeters: p.annualVolumeMeters,
        annualFuzeLiters: p.annualFuzeLiters,
        factoryId: p.factoryId,
        factoryName: p.factory?.name || null,
        factoryCountry: p.factory?.country || null,
        distributorId: p.distributorId,
        distributorName: p.distributor?.name || null,
        expectedProductionDate: p.expectedProductionDate,
        actualProductionDate: p.actualProductionDate,
        testCount: p._count.testRuns,
        invoiceCount: p._count.invoices,
      })),
    });
  } catch (err: any) {
    console.error("Projects list error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── POST /api/projects ── create a new project */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name, brandId, description, stage,
      projectedValue, currency, probability, fuzeTier,
      annualVolumeMeters, annualFuzeLiters,
      factoryId, distributorId,
      expectedProductionDate, actualProductionDate,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { ok: false, error: "Project name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name under same brand
    const existing = await prisma.project.findFirst({
      where: { name: name.trim(), brandId: brandId || null },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        project: existing,
        message: "Project already exists",
      });
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        brandId: brandId || null,
        description: description || null,
        stage: stage || "DEVELOPMENT",
        projectedValue: projectedValue ? parseFloat(projectedValue) : null,
        currency: currency || "USD",
        probability: probability != null ? parseInt(probability, 10) : 50,
        fuzeTier: fuzeTier || null,
        annualVolumeMeters: annualVolumeMeters ? parseFloat(annualVolumeMeters) : null,
        annualFuzeLiters: annualFuzeLiters ? parseFloat(annualFuzeLiters) : null,
        factoryId: factoryId || null,
        distributorId: distributorId || null,
        expectedProductionDate: expectedProductionDate ? new Date(expectedProductionDate) : null,
        actualProductionDate: actualProductionDate ? new Date(actualProductionDate) : null,
      },
    });

    return NextResponse.json({ ok: true, project });
  } catch (err: any) {
    console.error("Project create error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
