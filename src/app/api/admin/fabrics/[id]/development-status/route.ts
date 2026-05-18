// @ts-nocheck
/**
 * PATCH /api/admin/fabrics/[id]/development-status
 *
 * Update the Tina-workflow status on a fabric. Used by the brand
 * fabric portfolio inline dropdown.
 *
 * Body: { status: FabricDevStatus | null }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { FABRIC_DEV_STATUSES, isValidFabricDevStatus } from "@/lib/fabric-development-status";

const ALLOWED_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "TESTING_MANAGER", "FABRIC_MANAGER"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }
    const newStatus = body.status === null ? null : body.status;
    if (newStatus !== null && !isValidFabricDevStatus(newStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid status. Allowed: ${FABRIC_DEV_STATUSES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const updated = await prisma.fabric.update({
      where: { id },
      data: { developmentStatus: newStatus } as any,
      select: { id: true, developmentStatus: true } as any,
    });

    return NextResponse.json({ ok: true, fabric: updated });
  } catch (e: any) {
    console.error("[admin/fabrics/[id]/development-status] failed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
