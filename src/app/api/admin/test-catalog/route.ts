// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { FUZE_TEST_CATALOG } from "@/lib/fuze-test-catalog";

/**
 * GET /api/admin/test-catalog
 * Returns the test catalog. If DB has entries, use those. Otherwise fall back to static catalog.
 * Available to: ADMIN, EMPLOYEE, FACTORY_USER, FACTORY_MANAGER (read-only for factories)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Try DB first
    const dbItems = await prisma.testCatalogItem.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });

    if (dbItems.length > 0) {
      return NextResponse.json({
        ok: true,
        source: "database",
        catalog: dbItems.map((item) => ({
          id: item.testKey,
          name: item.name,
          description: item.description,
          category: item.category,
          moqMeters: item.moqMeters,
          controlRequired: item.controlRequired,
          controlNote: item.controlNote,
          turnaroundDays: item.turnaroundDays,
          estimatedCostUsd: item.estimatedCostUsd,
          methods: item.methods,
          active: item.active,
          sortOrder: item.sortOrder,
          dbId: item.id,
          updatedAt: item.updatedAt,
          updatedBy: item.updatedBy,
        })),
      });
    }

    // Fallback to static catalog
    return NextResponse.json({
      ok: true,
      source: "static",
      catalog: FUZE_TEST_CATALOG.map((t, i) => ({
        ...t,
        active: true,
        sortOrder: i,
        dbId: null,
        updatedAt: null,
        updatedBy: null,
      })),
    });
  } catch (error: any) {
    console.error("Test catalog GET error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/test-catalog
 * Update one or more test catalog items. Admin only.
 * Body: { items: [{ testKey, name?, description?, estimatedCostUsd?, turnaroundDays?, moqMeters?, controlRequired?, controlNote?, methods?, active?, sortOrder? }] }
 */
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    const { items } = await req.json();
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ ok: false, error: "items array required" }, { status: 400 });
    }

    const results = [];
    for (const item of items) {
      if (!item.testKey) continue;

      const updateData: any = {};
      if (item.name !== undefined) updateData.name = item.name;
      if (item.description !== undefined) updateData.description = item.description;
      if (item.estimatedCostUsd !== undefined) updateData.estimatedCostUsd = item.estimatedCostUsd;
      if (item.turnaroundDays !== undefined) updateData.turnaroundDays = item.turnaroundDays;
      if (item.moqMeters !== undefined) updateData.moqMeters = item.moqMeters;
      if (item.controlRequired !== undefined) updateData.controlRequired = item.controlRequired;
      if (item.controlNote !== undefined) updateData.controlNote = item.controlNote;
      if (item.methods !== undefined) updateData.methods = item.methods;
      if (item.active !== undefined) updateData.active = item.active;
      if (item.sortOrder !== undefined) updateData.sortOrder = item.sortOrder;
      if (item.category !== undefined) updateData.category = item.category;
      updateData.updatedBy = user.name || user.email || user.id;

      const updated = await prisma.testCatalogItem.upsert({
        where: { testKey: item.testKey },
        update: updateData,
        create: {
          testKey: item.testKey,
          name: item.name || item.testKey,
          description: item.description || "",
          category: item.category || "performance",
          moqMeters: item.moqMeters || 1,
          controlRequired: item.controlRequired || false,
          controlNote: item.controlNote || null,
          turnaroundDays: item.turnaroundDays || 7,
          estimatedCostUsd: item.estimatedCostUsd || null,
          methods: item.methods || [],
          active: item.active !== undefined ? item.active : true,
          sortOrder: item.sortOrder || 0,
          updatedBy: user.name || user.email || user.id,
        },
      });
      results.push(updated);
    }

    return NextResponse.json({ ok: true, updated: results.length });
  } catch (error: any) {
    console.error("Test catalog PATCH error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
