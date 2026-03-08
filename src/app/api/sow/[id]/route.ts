// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { notifySOWStatusChange } from "@/lib/notify";
import { sendSOWStatusEmail } from "@/lib/email";

const prisma = new PrismaClient();

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const sow = await prisma.sOW.findUnique({
      where: { id: params.id },
      include: {
        brand: { select: { id: true, name: true, pipelineStage: true, salesRepId: true } },
        milestones: { orderBy: { sortOrder: "asc" } },
        documents: true,
      },
    });

    if (!sow) return NextResponse.json({ ok: false, error: "SOW not found" }, { status: 404 });

    // Load products separately — table may not exist yet
    let products = [];
    try {
      products = await prisma.sOWProduct.findMany({
        where: { sowId: params.id },
        include: { product: true },
      });
    } catch {
      // SOWProduct table doesn't exist yet
    }

    return NextResponse.json({ ok: true, sow: { ...sow, products } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const data: any = {};

    // Simple fields
    const strFields = ["title","expectations","performanceCriteria","pricingTerms","costControls","signatory","signatoryTitle","signatoryEmail"];
    for (const f of strFields) { if (body[f] !== undefined) data[f] = body[f] || null; }
    if (body.status !== undefined) data.status = body.status;

    // Get old SOW for status change detection
    const oldSow = await prisma.sOW.findUnique({
      where: { id: params.id },
      include: { brand: { select: { id: true, name: true } } },
    });

    const sow = await prisma.sOW.update({ where: { id: params.id }, data });

    // Fire notifications on status change
    if (body.status && oldSow && body.status !== oldSow.status) {
      const currentUser = await getCurrentUser().catch(() => null);
      await notifySOWStatusChange({
        sowId: params.id,
        sowTitle: oldSow.title || `SOW for ${oldSow.brand?.name || "Unknown"}`,
        newStatus: body.status,
        brandId: oldSow.brandId || undefined,
        changedBy: currentUser?.id,
      });

      // Email signatory if SOW is being SENT
      if (body.status === "SENT" && oldSow.signatoryEmail) {
        await sendSOWStatusEmail({
          email: oldSow.signatoryEmail,
          name: oldSow.signatory || "Team",
          sowTitle: oldSow.title || `SOW for ${oldSow.brand?.name || "Unknown"}`,
          brandName: oldSow.brand?.name || "Unknown",
          newStatus: body.status,
          sowId: params.id,
        });
      }
    }

    return NextResponse.json({ ok: true, sow });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    // Delete milestones first, then SOW
    await prisma.sOWMilestone.deleteMany({ where: { sowId: params.id } });
    await prisma.sOW.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
