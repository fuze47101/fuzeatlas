// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── PUT /api/compliance-docs/categories ── Rename a category (bulk update) ──── */
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) {
      return NextResponse.json({ ok: false, error: "Only admins can manage categories" }, { status: 403 });
    }

    const { oldCategory, newCategory } = await req.json();

    if (!oldCategory || !newCategory) {
      return NextResponse.json({ ok: false, error: "Both oldCategory and newCategory are required" }, { status: 400 });
    }

    const sanitized = newCategory.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (!sanitized) {
      return NextResponse.json({ ok: false, error: "Invalid category name" }, { status: 400 });
    }

    const result = await prisma.complianceDocument.updateMany({
      where: { category: oldCategory },
      data: { category: sanitized },
    });

    return NextResponse.json({
      ok: true,
      updated: result.count,
      oldCategory,
      newCategory: sanitized,
    });
  } catch (err: any) {
    console.error("Error renaming category:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── DELETE /api/compliance-docs/categories ── Delete category (move docs to target) ──── */
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Only administrators can delete categories" }, { status: 403 });
    }

    const { category, moveTo } = await req.json();

    if (!category) {
      return NextResponse.json({ ok: false, error: "category is required" }, { status: 400 });
    }

    if (!moveTo) {
      return NextResponse.json({ ok: false, error: "moveTo category is required — documents must be reassigned" }, { status: 400 });
    }

    const result = await prisma.complianceDocument.updateMany({
      where: { category },
      data: { category: moveTo },
    });

    return NextResponse.json({
      ok: true,
      moved: result.count,
      from: category,
      to: moveTo,
    });
  } catch (err: any) {
    console.error("Error deleting category:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
