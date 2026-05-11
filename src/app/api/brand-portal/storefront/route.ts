// @ts-nocheck
/**
 * GET /api/brand-portal/storefront — Phase 12G.
 *
 * Returns 30-day public-page traffic + QR scan counts scoped to
 * the caller's brand.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  // Brand users + admins (admins see across all brands; for brand
  // users we scope by their brandId).
  const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE" || user.role === "SALES_MANAGER";
  const brandId = isAdmin ? null : user.brandId;
  if (!isAdmin && !brandId) {
    return NextResponse.json({ ok: false, error: "Not a brand user" }, { status: 403 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);

  const where: any = { createdAt: { gte: thirtyDaysAgo } };
  if (brandId) where.brandId = brandId;

  const [views, byPath, byReferer, scans] = await Promise.all([
    prisma.publicPageView.count({ where }),
    prisma.publicPageView.groupBy({
      by: ["path"],
      where,
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 20,
    }),
    prisma.publicPageView.groupBy({
      by: ["referer"],
      where: { ...where, referer: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { referer: "desc" } },
      take: 10,
    }),
    brandId
      ? prisma.hangtagQR.aggregate({
          where: { brandId },
          _sum: { scannedCount: true },
          _count: { _all: true },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    ok: true,
    windowDays: 30,
    totalViews: views,
    topPaths: byPath.map((p) => ({ path: p.path, count: p._count._all })),
    topReferers: byReferer.map((r) => ({ referer: r.referer, count: r._count._all })),
    qrTotalScans: scans?._sum?.scannedCount ?? 0,
    qrTokenCount: scans?._count?._all ?? 0,
  });
}
