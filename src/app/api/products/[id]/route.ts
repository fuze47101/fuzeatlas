// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PUT /api/products/:id — update a product
export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const { name, productType, sku, description } = body;

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(productType !== undefined && { productType: productType || null }),
        ...(sku !== undefined && { sku: sku || null }),
        ...(description !== undefined && { description: description || null }),
      },
    });

    return NextResponse.json({ ok: true, product });
  } catch (e: any) {
    console.error("Update product error:", e);
    if (e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "A product with this name already exists for this brand" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// DELETE /api/products/:id — delete a product
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;

    // Remove SOW links first
    await prisma.sOWProduct.deleteMany({ where: { productId: params.id } });
    await prisma.product.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Delete product error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
