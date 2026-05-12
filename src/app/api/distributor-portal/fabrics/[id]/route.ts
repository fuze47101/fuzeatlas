// @ts-nocheck
/**
 * PATCH /api/distributor-portal/fabrics/[id]
 *
 * Phase 15 NEED-FB-1 (Angela ticket cmp21i6vy) — distributors can
 * edit fabric metadata after submission. FUZE number is immutable
 * because the lab inventory + recipe-bench-test rows are keyed on
 * it; everything else in this allow-list is safe to amend.
 *
 * ACL: distributor users can only edit fabrics whose distributorId
 * matches their own. Admins/employees can edit any fabric (we
 * trust the role on this endpoint).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const EDITABLE_FIELDS = [
  "customerReference",
  "customerCode",
  "factoryCode",
  "construction",
  "color",
  "weightGsm",
  "widthInches",
  "yarnType",
  "finishNote",
  "note",
  "endUse",
  "targetFuzeTier",
  "fabricCategory",
] as const;

const NUMERIC_FIELDS = new Set(["weightGsm", "widthInches"]);

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = ["ADMIN", "EMPLOYEE"].includes(user.role);
    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

    const fabric = await prisma.fabric.findUnique({
      where: { id },
      select: { id: true, distributorId: true, fuzeNumber: true },
    });
    if (!fabric) {
      return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
    }
    if (isDistributor && fabric.distributorId !== user.distributorId) {
      return NextResponse.json(
        { ok: false, error: "Fabric is not in your distributor scope" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const data: any = {};
    for (const key of EDITABLE_FIELDS) {
      if (!(key in body)) continue;
      const raw = body[key];
      if (raw === null || raw === "") {
        data[key] = null;
        continue;
      }
      if (NUMERIC_FIELDS.has(key)) {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          return NextResponse.json(
            { ok: false, error: `${key} must be a number` },
            { status: 400 },
          );
        }
        data[key] = n;
      } else {
        data[key] = String(raw).trim();
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No editable fields provided" },
        { status: 400 },
      );
    }

    const updated = await prisma.fabric.update({
      where: { id },
      data,
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryCode: true,
        customerReference: true,
        construction: true,
        color: true,
        weightGsm: true,
        widthInches: true,
        yarnType: true,
        finishNote: true,
        note: true,
        endUse: true,
        targetFuzeTier: true,
        fabricCategory: true,
        labStatus: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true, country: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, fabric: updated });
  } catch (e: any) {
    console.error("[distributor-portal.fabrics PATCH] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Update failed" }, { status: 500 });
  }
}
