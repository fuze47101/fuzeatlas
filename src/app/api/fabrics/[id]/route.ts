// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const fabric = await prisma.fabric.findUnique({
      where: { id: params.id },
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        contents: true,
        submissions: {
          include: {
            testRuns: { include: { icpResult: true, abResult: true, fungalResult: true, odorResult: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!fabric) return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
    return NextResponse.json({ ok: true, fabric });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const data: any = {};
    const strFields = ["customerCode","factoryCode","construction","color","yarnType","finishNote","note"];
    for (const f of strFields) { if (body[f] !== undefined) data[f] = body[f] || null; }
    if (body.fuzeNumber !== undefined) data.fuzeNumber = body.fuzeNumber ? parseInt(body.fuzeNumber) : null;
    if (body.weightGsm !== undefined) data.weightGsm = body.weightGsm ? parseFloat(body.weightGsm) : null;
    if (body.widthInches !== undefined) data.widthInches = body.widthInches ? parseFloat(body.widthInches) : null;
    if (body.brandId !== undefined) data.brandId = body.brandId || null;
    if (body.factoryId !== undefined) data.factoryId = body.factoryId || null;

    const fabric = await prisma.fabric.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, fabric });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const id = params.id;

    // Delete related records first (no cascade in Prisma by default)
    await prisma.fabricContent.deleteMany({ where: { fabricId: id } });

    // Check for submissions — warn if any exist
    const subCount = await prisma.fabricSubmission.count({ where: { fabricId: id } });
    if (subCount > 0) {
      // Unlink submissions instead of deleting them (preserve test data)
      await prisma.fabricSubmission.updateMany({
        where: { fabricId: id },
        data: { fabricId: null },
      });
    }

    await prisma.fabric.delete({ where: { id } });
    return NextResponse.json({ ok: true, unlinkedSubmissions: subCount });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
