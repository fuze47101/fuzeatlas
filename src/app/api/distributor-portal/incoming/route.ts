// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateOrderApplication } from "@/lib/order-validation";

/**
 * GET /api/distributor-portal/incoming  (Phase 4F — DO+OVERSEE)
 *
 * Pending factory orders pointed at the caller's distributor, with
 * application-validation flags surfaced inline. The same pure
 * validateOrderApplication helper used by the order-create
 * notification path is invoked per row so the distributor sees
 * exactly why an order was flagged before deciding to fulfill.
 *
 * Pending = anything not in COMPLETE / DELIVERED / CANCELLED /
 * REJECTED.
 */

const FULFILLED_STATUSES = ["DELIVERED", "CANCELLED", "REJECTED", "COMPLETE"];

const ROLES = ["ADMIN", "EMPLOYEE", "DISTRIBUTOR_USER", "DISTRIBUTOR_MANAGER"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ROLES.includes(user.role)) return forbidden();
  if (!user.distributorId && user.role !== "ADMIN" && user.role !== "EMPLOYEE") return forbidden();

  const where: any = {
    status: { notIn: FULFILLED_STATUSES },
  };
  if (user.distributorId) where.distributorId = user.distributorId;

  const orders = await prisma.fuzeOrder.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      orderType: true,
      status: true,
      volumeLiters: true,
      bottles: true,
      fuzeTier: true,
      fabricMassKg: true,
      treatmentMethod: true,
      baseFuzeLiters: true,
      wastageFactorPct: true,
      brandId: true,
      factoryId: true,
      createdAt: true,
      currency: true,
      totalPrice: true,
      brand: { select: { id: true, name: true, requiredFuzeTier: true } },
      factory: { select: { id: true, name: true, country: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Compute validation per row using the same helper the create path
  // uses. Skips HANGTAG (no application math).
  const enriched = orders.map((o: any) => {
    if (o.orderType === "HANGTAG") return { ...o, validation: null };
    const v = validateOrderApplication(
      {
        volumeLiters: o.volumeLiters,
        fuzeTier: o.fuzeTier,
        fabricMassKg: o.fabricMassKg,
        baseFuzeLiters: o.baseFuzeLiters,
        wastageFactorPct: o.wastageFactorPct,
        brandId: o.brandId,
        orderType: o.orderType,
      },
      o.brand?.requiredFuzeTier ? { requiredFuzeTier: o.brand.requiredFuzeTier } : null,
    );
    const severity = v.findings.find((f: any) => f.severity === "error")
      ? "error"
      : v.findings.find((f: any) => f.severity === "warn")
        ? "warn"
        : v.findings.find((f: any) => f.severity === "info")
          ? "info"
          : null;
    return {
      ...o,
      validation: severity
        ? {
            severity,
            messages: v.findings.map((f: any) => f.message),
            expectedLiters: v.expectedLiters,
            actualLiters: v.actualLiters,
          }
        : null,
    };
  });

  return NextResponse.json({ ok: true, orders: enriched });
}
