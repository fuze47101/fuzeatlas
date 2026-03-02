// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/brands/:id/products — list products for a brand
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const products = await prisma.product.findMany({
      where: { brandId: params.id },
      include: {
        sows: {
          include: { sow: { select: { id: true, title: true, status: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, products });
  } catch (e: any) {
    console.error("Brand products error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST /api/brands/:id/products — create a product under a brand
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const { name, productType, sku, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ ok: false, error: "Product name is required" }, { status: 400 });
    }

    // Check for existing product with same name under this brand
    const existing = await prisma.product.findUnique({
      where: { brandId_name: { brandId: params.id, name: name.trim() } },
    });
    if (existing) {
      return NextResponse.json({ ok: true, product: existing, existed: true });
    }

    const product = await prisma.product.create({
      data: {
        brandId: params.id,
        name: name.trim(),
        productType: productType || null,
        sku: sku || null,
        description: description || null,
      },
    });

    return NextResponse.json({ ok: true, product });
  } catch (e: any) {
    console.error("Create product error:", e);
    if (e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "A product with this name already exists for this brand" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
