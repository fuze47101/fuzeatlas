// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/distributor-portal/commission-preview
 *
 * BONUS-4 — single-query commission preview for the distributor.
 * Per CLAUDE.md preferences this is PREVIEW ONLY — no full
 * commission model, no payout flow, no reconciliation. Just one
 * estimated quarter-to-date number based on shipped orders × a
 * default margin assumption.
 *
 * If we ever build the full system the math here moves to a
 * canonical helper. For now this is a single SUM and a constant.
 */

const DEFAULT_DISTRIBUTOR_MARGIN_PCT = 12; // conservative midpoint;
// can be tightened per distributor later via DistributorPricing.

function quarterStart(now: Date): Date {
  const m = now.getMonth();
  const qStartMonth = Math.floor(m / 3) * 3;
  return new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0, 0);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.distributorId) {
    return NextResponse.json(
      { ok: false, error: "Not a distributor user" },
      { status: 403 },
    );
  }

  const now = new Date();
  const qStart = quarterStart(now);

  const shipped = await prisma.fuzeOrder
    .aggregate({
      where: {
        distributorId: user.distributorId,
        shippedDate: { gte: qStart },
        // Sample / hangtag orders shouldn't drive commission.
        orderType: "PRODUCTION",
      },
      _sum: { totalPrice: true, volumeLiters: true },
      _count: { id: true },
    })
    .catch(() => ({
      _sum: { totalPrice: 0, volumeLiters: 0 },
      _count: { id: 0 },
    }));

  const grossShipped = shipped._sum?.totalPrice || 0;
  const litersShipped = shipped._sum?.volumeLiters || 0;
  const orderCount = shipped._count?.id || 0;
  const estimatedCommission = grossShipped * (DEFAULT_DISTRIBUTOR_MARGIN_PCT / 100);

  return NextResponse.json({
    ok: true,
    preview: {
      quarterStart: qStart.toISOString(),
      orderCount,
      litersShipped: Math.round(litersShipped),
      grossShipped: Math.round(grossShipped * 100) / 100,
      marginPct: DEFAULT_DISTRIBUTOR_MARGIN_PCT,
      estimatedCommission: Math.round(estimatedCommission * 100) / 100,
      note: "Preview only — based on shipped production orders × a 12% default margin assumption. Final commission lands when a full commission system ships.",
    },
  });
}
