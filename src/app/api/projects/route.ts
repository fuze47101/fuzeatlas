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

    const projects = await prisma.project.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        brand: { select: { id: true, name: true } },
        _count: { select: { testRuns: true } },
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
        testCount: p._count.testRuns,
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
    const { name, brandId, description } = body;

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
      },
    });

    return NextResponse.json({ ok: true, project });
  } catch (err: any) {
    console.error("Project create error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
