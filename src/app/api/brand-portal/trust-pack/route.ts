// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateTrustPackHtml } from "@/lib/pdf-trust-pack";

/**
 * POST /api/brand-portal/trust-pack
 *
 * BONUS-2 — generates a brand-scoped trust pack as a self-contained
 * HTML document. The client opens the response in a new tab and uses
 * Ctrl-P / Cmd-P → Save as PDF. Same pattern as
 * /api/reports/sustainability-competitive.
 *
 * Replaces the Phase 15 IMP-5 501-stub that previously held this
 * path. Returns:
 *   - 200 text/html         on success
 *   - 401 application/json  if unauthenticated
 *   - 403 application/json  if not a brand user
 *   - 404 application/json  if the caller's brand can't be loaded
 *
 * Body (optional): { preparedFor?: string }
 */

const ALLOWED_ROLES = ["BRAND_USER", "BRAND_MANAGER", "ADMIN", "EMPLOYEE"];

function jsonErr(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonErr(401, "Unauthorized");
  if (!ALLOWED_ROLES.includes(user.role)) return jsonErr(403, "Forbidden");
  if (!user.brandId) return jsonErr(403, "Not a brand user");

  const body = await req.json().catch(() => ({}));
  const preparedFor = (body.preparedFor || "").trim() || null;

  const brand = await prisma.brand.findUnique({
    where: { id: user.brandId },
    select: {
      id: true,
      name: true,
      website: true,
      requiredFuzeTier: true,
      icpCadenceEveryNBatches: true,
      icpCadenceEveryLitersConsumed: true,
      protocolDocUrl: true,
    },
  });
  if (!brand) return jsonErr(404, "Brand not found");

  const links = await prisma.supplyChainLink.findMany({
    where: {
      fromType: "BRAND",
      fromId: brand.id,
      toType: "FACTORY",
      active: true,
    },
    select: { toId: true },
  });
  const factoryIds = links.map((l) => l.toId);

  const factoryRecords = factoryIds.length
    ? await prisma.factory.findMany({
        where: { id: { in: factoryIds } },
        select: { id: true, name: true, country: true },
      })
    : [];

  // Per-factory fabric count (filtered to this brand).
  const factoryFabricCounts = new Map<string, number>();
  if (factoryIds.length) {
    const groups = await prisma.fabric.groupBy({
      by: ["factoryId"],
      where: { brandId: brand.id, factoryId: { in: factoryIds } },
      _count: { id: true },
    });
    for (const g of groups) {
      if (g.factoryId) factoryFabricCounts.set(g.factoryId, g._count.id);
    }
  }

  // Per-factory most-recent brand-visible test date.
  const factoryLastTest = new Map<string, string | null>();
  for (const fid of factoryIds) {
    const tr = await prisma.testRun.findFirst({
      where: {
        brandVisible: true,
        submission: { fabric: { brandId: brand.id, factoryId: fid } },
      },
      orderBy: { testDate: "desc" },
      select: { testDate: true },
    });
    factoryLastTest.set(fid, tr?.testDate?.toISOString() || null);
  }

  const factories = factoryRecords.map((f) => ({
    id: f.id,
    name: f.name,
    country: f.country,
    fabricCount: factoryFabricCounts.get(f.id) || 0,
    lastTestRunAt: factoryLastTest.get(f.id) || null,
  }));

  // Recent brand-visible test runs.
  const recentRuns = await prisma.testRun.findMany({
    where: {
      brandVisible: true,
      submission: { fabric: { brandId: brand.id } },
    },
    orderBy: { testDate: "desc" },
    take: 10,
    select: {
      id: true,
      testType: true,
      testDate: true,
      lab: { select: { name: true } },
      submission: {
        select: {
          fuzeFabricNumber: true,
          fabric: { select: { fuzeNumber: true } },
        },
      },
      icpResult: { select: { passed: true, agValue: true } },
      abResult: { select: { pass: true } },
    },
  });
  const recentTestRuns = recentRuns.map((r: any) => {
    let resultSummary: string | null = null;
    if (r.icpResult) {
      resultSummary = r.icpResult.passed
        ? `Passed${r.icpResult.agValue != null ? ` (Ag ${r.icpResult.agValue})` : ""}`
        : "Did not pass";
    } else if (r.abResult) {
      resultSummary = r.abResult.pass ? "Passed" : "Did not pass";
    }
    return {
      id: r.id,
      testType: r.testType,
      testDate: r.testDate?.toISOString() || null,
      labName: r.lab?.name || null,
      fuzeNumber:
        r.submission?.fabric?.fuzeNumber ??
        r.submission?.fuzeFabricNumber ??
        null,
      resultSummary,
    };
  });

  const html = generateTrustPackHtml({
    brand: {
      id: brand.id,
      name: brand.name,
      website: brand.website,
      requiredFuzeTier: brand.requiredFuzeTier,
      icpCadenceEveryNBatches: brand.icpCadenceEveryNBatches,
      icpCadenceEveryLitersConsumed: brand.icpCadenceEveryLitersConsumed,
      protocolDocUrl: brand.protocolDocUrl,
    },
    factories,
    recentTestRuns,
    generatedAt: new Date(),
    preparedFor,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
