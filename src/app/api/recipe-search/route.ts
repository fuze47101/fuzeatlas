// @ts-nocheck
/**
 * GET /api/recipe-search
 *
 * Network-wide recipe library, anonymized for out-of-scope rows.
 * Phase 3 of the Penfabric / distributor work — answers Andrew's
 * push: "we also want all of these recipes searchable by fabric,
 * fabric style, fabric content by factories that they can quickly
 * match something that they are working on. Even if it is not their
 * fabric or current fabric."
 *
 * SCOPE & PRIVACY:
 *   In-scope rows  → full customer/brand/factory attribution
 *   Out-of-scope    → anonymized: recipe (pickup, padder settings,
 *                     ICP outcome, tier) is visible, but brand /
 *                     factory / customer reference / item numbers
 *                     are stripped. The fabric category, fiber
 *                     content, and weight stay visible — those are
 *                     the search keys.
 *
 *   Scope rules:
 *     ADMIN / EMPLOYEE         → see everything attributed
 *     SALES_REP / SALES_MANAGER → all attributed
 *     BD_REP                    → attributed for brands they manage
 *     FACTORY_USER / _MANAGER   → attributed for their own factory's
 *                                 fabrics; anonymized otherwise
 *     DISTRIBUTOR_USER          → attributed for fabrics in their
 *                                 territory (factory.distributorId
 *                                 = me) OR their projects' brands;
 *                                 anonymized otherwise
 *     BRAND_USER                → attributed for their own brand's
 *                                 fabrics; anonymized otherwise
 *
 * Filters (all optional):
 *   ?q=…              — keyword across category / fiber / construction / yarn
 *   ?category=knit|woven|nonwoven
 *   ?fiber=cotton|polyester|nylon|...
 *   ?gsmMin / ?gsmMax — fabric weight range
 *   ?tier=F1|F2|F3|F4 — recipes proven at this tier
 *   ?factoryId=…      — fabrics belonging to a specific factory
 *                       (subject to scope rules — factory user can
 *                       only filter on their own factory)
 *   ?onlyValidated=1  — only fabrics with a measured pickup
 *   ?limit=50         — default 50, max 200
 *
 * Response: { ok: true, results: [...], totalCount, scope: { ... } }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const TIER_MG_PER_KG: Record<string, number> = {
  F1: 1.0,
  F2: 0.75,
  F3: 0.5,
  F4: 0.25,
};

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const category = (url.searchParams.get("category") || "").trim();
    const fiber = (url.searchParams.get("fiber") || "").trim();
    const gsmMin = parseFloat(url.searchParams.get("gsmMin") || "");
    const gsmMax = parseFloat(url.searchParams.get("gsmMax") || "");
    const tier = (url.searchParams.get("tier") || "").trim();
    const factoryId = (url.searchParams.get("factoryId") || "").trim();
    const onlyValidated = url.searchParams.get("onlyValidated") === "1";
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50", 10) || 50,
      200,
    );

    // ─── Determine the user's scope ─────────────────────────────
    const role = user.role;
    const isInternalFull = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(role);
    const isBdRep = role === "BD_REP";
    const isFactory = role === "FACTORY_USER" || role === "FACTORY_MANAGER";
    const isDistributor = role === "DISTRIBUTOR_USER";
    const isBrand = role === "BRAND_USER";

    let scopedFactoryIds: string[] = [];
    let scopedBrandIds: string[] = [];
    if (isFactory && user.factoryId) {
      scopedFactoryIds = [user.factoryId];
    } else if (isDistributor && user.distributorId) {
      const [factories, projects] = await Promise.all([
        prisma.factory.findMany({
          where: { distributorId: user.distributorId },
          select: { id: true },
        }),
        prisma.project.findMany({
          where: { distributorId: user.distributorId, brandId: { not: null } },
          select: { brandId: true },
        }),
      ]);
      scopedFactoryIds = factories.map((f: any) => f.id);
      scopedBrandIds = Array.from(
        new Set(projects.map((p: any) => p.brandId).filter(Boolean) as string[]),
      );
    } else if (isBrand && user.brandId) {
      scopedBrandIds = [user.brandId];
    } else if (isBdRep) {
      const brands = await prisma.brand.findMany({
        where: { salesRepId: user.id },
        select: { id: true },
      });
      scopedBrandIds = brands.map((b: any) => b.id);
    }

    // Factory filter — limit non-internal users to their own
    // factory if they tried to scope to one they shouldn't see.
    const effectiveFactoryId: string | null = factoryId || null;
    if (
      effectiveFactoryId &&
      !isInternalFull &&
      !scopedFactoryIds.includes(effectiveFactoryId)
    ) {
      // They can still SEARCH for fabrics from that factory, but the
      // results will be anonymized. Don't 403 — that would defeat the
      // point of network-wide search.
    }

    // ─── Build the WHERE clause ─────────────────────────────────
    const ands: any[] = [];

    if (onlyValidated) {
      ands.push({
        recipeBenchTests: {
          some: { pickupDryToWetPct: { not: null } },
        },
      });
    } else {
      // Default behavior: still require AT LEAST one bench test row
      // attached, otherwise the result has no recipe to show. Network
      // search is recipe search, not raw fabric search.
      ands.push({
        recipeBenchTests: { some: {} },
      });
    }

    if (category) {
      ands.push({ fabricCategory: category });
    }
    if (fiber) {
      ands.push({
        OR: [
          { yarnType: { contains: fiber, mode: "insensitive" } },
          {
            contents: {
              some: { material: { contains: fiber, mode: "insensitive" } },
            },
          },
        ],
      });
    }
    if (Number.isFinite(gsmMin)) ands.push({ weightGsm: { gte: gsmMin } });
    if (Number.isFinite(gsmMax)) ands.push({ weightGsm: { lte: gsmMax } });
    if (effectiveFactoryId) ands.push({ factoryId: effectiveFactoryId });
    if (q) {
      ands.push({
        OR: [
          { fabricCategory: { contains: q, mode: "insensitive" } },
          { construction: { contains: q, mode: "insensitive" } },
          { yarnType: { contains: q, mode: "insensitive" } },
          { color: { contains: q, mode: "insensitive" } },
          {
            contents: {
              some: { material: { contains: q, mode: "insensitive" } },
            },
          },
        ],
      });
    }

    const where = ands.length > 0 ? { AND: ands } : {};

    const fabrics = await prisma.fabric.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true, distributorId: true } },
        contents: true,
        recipeBenchTests: {
          where: tier
            ? {
                OR: [{ testedAtTier: tier }, { f1BathMgPerL: { not: null } }],
              }
            : undefined,
          orderBy: { testDate: "desc" },
          take: 1,
          select: {
            id: true,
            testNumber: true,
            testDate: true,
            applicationMethod: true,
            squeezePressure: true,
            vfdFrequencyHz: true,
            lineSpeedMPerMin: true,
            stockMgPerL: true,
            pickupDryToWetPct: true,
            f1BathMgPerL: true,
            f2BathMgPerL: true,
            f3BathMgPerL: true,
            f4BathMgPerL: true,
            f1FuzeMlPerLBath: true,
            testedAtTier: true,
            icpExpectedPpm: true,
            icpMeasuredPpm: true,
            affinityPct: true,
            qcPassed: true,
          },
        },
      },
      orderBy: { fuzeNumber: "desc" },
      take: limit,
    });

    // ─── Anonymize out-of-scope rows ────────────────────────────
    const results = fabrics.map((f: any) => {
      const inScope =
        isInternalFull ||
        (f.brandId && scopedBrandIds.includes(f.brandId)) ||
        (f.factoryId && scopedFactoryIds.includes(f.factoryId));

      const bench = f.recipeBenchTests?.[0] || null;

      const recipeView = bench
        ? {
            testNumber: bench.testNumber,
            testDate: bench.testDate,
            applicationMethod: bench.applicationMethod,
            squeezePressure: bench.squeezePressure,
            vfdFrequencyHz: bench.vfdFrequencyHz,
            lineSpeedMPerMin: bench.lineSpeedMPerMin,
            stockMgPerL: bench.stockMgPerL,
            pickupDryToWetPct: bench.pickupDryToWetPct,
            testedAtTier: bench.testedAtTier,
            f1BathMgPerL: bench.f1BathMgPerL,
            f2BathMgPerL: bench.f2BathMgPerL,
            f3BathMgPerL: bench.f3BathMgPerL,
            f4BathMgPerL: bench.f4BathMgPerL,
            icpExpectedPpm: bench.icpExpectedPpm,
            icpMeasuredPpm: bench.icpMeasuredPpm,
            affinityPct: bench.affinityPct,
            qcPassed: bench.qcPassed,
          }
        : null;

      const fiberSummary =
        f.contents && f.contents.length > 0
          ? f.contents
              .map((c: any) =>
                c.percent ? `${c.material} ${c.percent}%` : c.material,
              )
              .join(" · ")
          : f.yarnType || null;

      if (inScope) {
        return {
          inScope: true,
          fabricId: f.id,
          fuzeNumber: f.fuzeNumber,
          customerReference: f.customerReference,
          customerCode: f.customerCode,
          factoryCode: f.factoryCode,
          fabricCategory: f.fabricCategory || f.construction,
          weightGsm: f.weightGsm,
          color: f.color,
          fiberSummary,
          brand: f.brand ? { id: f.brand.id, name: f.brand.name } : null,
          factory: f.factory
            ? { id: f.factory.id, name: f.factory.name }
            : null,
          recipe: recipeView,
        };
      }

      // ─── Anonymized view ─────────────────────────────────────
      return {
        inScope: false,
        // Hide individual fabric ID — clicking through would expose
        // the underlying customer record.
        fabricId: null,
        fuzeNumber: null,
        customerReference: null,
        customerCode: null,
        factoryCode: null,
        fabricCategory: f.fabricCategory || f.construction,
        weightGsm: f.weightGsm,
        color: null, // color is often a brand-distinctive marker
        fiberSummary,
        brand: null,
        factory: null,
        // Anonymized recipe — drop the tracking number, keep the
        // physics. Clone-as-starting-point flow can re-issue a fresh
        // bench test under the cloner's scope without referencing
        // the original.
        recipe: recipeView
          ? {
              ...recipeView,
              testNumber: null,
              testDate: null,
            }
          : null,
      };
    });

    // Filter rows that ended up with no recipe (after the tier-aware
    // bench fetch) — happens when the recipe was tagged at a different
    // tier than the searcher requested.
    const usable = results.filter((r: any) => r.recipe);

    return NextResponse.json({
      ok: true,
      results: usable,
      totalCount: usable.length,
      scope: {
        role,
        scopedFactoryCount: scopedFactoryIds.length,
        scopedBrandCount: scopedBrandIds.length,
        canSeeAll: isInternalFull,
      },
      tierMgPerKg: TIER_MG_PER_KG,
    });
  } catch (e: any) {
    console.error("[recipe-search] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
