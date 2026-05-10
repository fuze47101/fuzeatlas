// @ts-nocheck
/**
 * GET /api/public/verified/[publicSlug]/esg — Phase 12C.
 * Public listing of published ESG snapshots for a brand. 404 unless
 * the brand profile is publicEnabled.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ publicSlug: string }> },
) {
  const { publicSlug } = await params;
  if (!publicSlug) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const profile = await prisma.brandProfile.findUnique({
    where: { publicSlug },
    select: {
      brandId: true,
      publicEnabled: true,
      brand: { select: { name: true } },
    },
  });
  if (!profile?.publicEnabled) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const snapshots = await prisma.brandEsgSnapshot.findMany({
    where: {
      brandId: profile.brandId,
      // Public listing only shows snapshots an admin has explicitly published
      publishedAt: { not: null },
    },
    orderBy: { periodStart: "desc" },
    select: {
      period: true,
      periodStart: true,
      periodEnd: true,
      fabricsCertified: true,
      testsRunCount: true,
      testsPassedCount: true,
      fuzeConsumedLiters: true,
      factoryCountActive: true,
      zeroPfasFabricCount: true,
      publicPdfUrl: true,
      publishedAt: true,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      brand: { name: profile.brand.name },
      snapshots,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    },
  );
}
