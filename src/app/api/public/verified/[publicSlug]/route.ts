// @ts-nocheck
/**
 * GET /api/public/verified/[publicSlug] — Phase 12A.
 *
 * Public, no-auth endpoint. Returns 404 unless:
 *   - BrandProfile.publicEnabled = true
 *   - At least one TestRun where brandApprovalStatus = "APPROVED"
 *     exists on a FabricSubmission tied to this brand.
 *
 * Cache 5 minutes at edge, stale-while-revalidate 30 minutes.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ publicSlug: string }> },
) {
  const { publicSlug } = await params;
  if (!publicSlug) {
    return NextResponse.json({ ok: false, error: "Bad slug" }, { status: 404 });
  }

  const profile = await prisma.brandProfile.findUnique({
    where: { publicSlug },
    select: {
      brandId: true,
      logoUrl: true,
      primaryColor: true,
      heroHeadline: true,
      heroSubhead: true,
      supportEmail: true,
      publicEnabled: true,
      brand: {
        select: {
          id: true,
          name: true,
          website: true,
          // Brand model has no country column — was throwing on every
          // public QR scan / verified-page load. Dropped May 16 audit.
          textileCategory: true,
        },
      },
    },
  });

  if (!profile || !profile.publicEnabled) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Permission gate part 2: at least one brand-approved test result
  // must exist.
  const approvedCount = await prisma.testRun.count({
    where: {
      brandApprovalStatus: "APPROVED",
      submission: { brandId: profile.brandId },
    },
  });
  if (approvedCount === 0) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const twelveMonthsAgo = new Date(Date.now() - 365 * 86400_000);
  const [fabricsCertified, testsPassed12mo, countries, recentTiers] = await Promise.all([
    prisma.fabricSubmission.findMany({
      where: { brandId: profile.brandId, brandApprovalStatus: "APPROVED" },
      select: { fabricId: true },
      distinct: ["fabricId"],
    }),
    prisma.testRun.count({
      where: {
        brandApprovalStatus: "APPROVED",
        submission: { brandId: profile.brandId },
        testDate: { gte: twelveMonthsAgo },
      },
    }),
    prisma.factory.findMany({
      where: {
        submissions: {
          some: { brandId: profile.brandId, brandApprovalStatus: "APPROVED" },
        },
      },
      select: { country: true },
      distinct: ["country"],
    }),
    // Tier lives on Fabric.targetFuzeTier, NOT on FabricSubmission —
    // submission has no fuzeTier column. Pull via the related fabric.
    prisma.fabricSubmission.findMany({
      where: {
        brandId: profile.brandId,
        brandApprovalStatus: "APPROVED",
        fabric: { targetFuzeTier: { not: null } },
      },
      select: {
        updatedAt: true,
        fabric: { select: { targetFuzeTier: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  const tierMap = new Map<string, { tier: string; lastPassedAt: Date }>();
  for (const r of recentTiers) {
    const tier = r.fabric?.targetFuzeTier;
    if (!tier) continue;
    if (!tierMap.has(tier)) {
      tierMap.set(tier, { tier, lastPassedAt: r.updatedAt });
    }
  }
  const activeTiers = Array.from(tierMap.values()).sort((a, b) =>
    a.tier.localeCompare(b.tier),
  );

  return NextResponse.json(
    {
      ok: true,
      brand: {
        name: profile.brand.name,
        website: profile.brand.website,
        // Brand.country dropped — column doesn't exist on Brand model.
        textileCategory: profile.brand.textileCategory,
      },
      profile: {
        logoUrl: profile.logoUrl,
        primaryColor: profile.primaryColor,
        heroHeadline:
          profile.heroHeadline || `${profile.brand.name} × FUZE`,
        heroSubhead:
          profile.heroSubhead ||
          "Certified FUZE-treated fabrics — third-party validated antimicrobial performance.",
        supportEmail: profile.supportEmail,
      },
      stats: {
        fabricsCertified: fabricsCertified.length,
        testsPassed12mo,
        countriesShipping: countries.filter((c) => c.country).length,
      },
      activeTiers,
      certifiedSince: null, // first APPROVED date — can be computed later if needed
    },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}
