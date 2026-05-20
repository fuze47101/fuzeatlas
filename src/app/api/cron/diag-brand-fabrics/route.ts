// @ts-nocheck
/**
 * GET /api/cron/diag-brand-fabrics?brand=Spanx
 *
 * Bearer-authed read-only diagnostic. For any brand, reports whether
 * /admin/brands/[id]/fabrics will render usefully:
 *   - how many fabrics are linked
 *   - how many have factory assignments
 *   - how many have fuzeNumber assigned
 *   - how many factoryCode rows
 *   - per-factory rollup
 *   - whether BrandFactory + SupplyChainLink junction rows exist
 *
 * Use this before pointing Tina (or any customer rep) at a brand's
 * fabric portfolio to confirm there's actually data behind it.
 *
 * Run: fzcron 'diag-brand-fabrics?brand=Spanx'
 *   or: fzcron 'diag-brand-fabrics?brand=SanMar'
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const brandQuery = (url.searchParams.get("brand") || "").trim();
  if (!brandQuery) {
    return NextResponse.json(
      { ok: false, error: "?brand= required (e.g. ?brand=Spanx)" },
      { status: 400 },
    );
  }

  const brand = await prisma.brand.findFirst({
    where: { name: { contains: brandQuery, mode: "insensitive" } },
    select: { id: true, name: true, pipelineStage: true, customerType: true, salesRepId: true, website: true },
  });

  if (!brand) {
    return NextResponse.json({
      ok: true,
      brandFound: false,
      verdict: `❌ No brand matches "${brandQuery}"`,
    });
  }

  const fabrics = await prisma.fabric.findMany({
    where: { brandId: brand.id },
    select: {
      id: true,
      fuzeNumber: true,
      factoryCode: true,
      customerCode: true,
      customerReference: true,
      construction: true,
      developmentStatus: true,
      factoryId: true,
      factory: { select: { id: true, name: true } },
      submissions: {
        select: {
          id: true,
          status: true,
          testRuns: {
            select: { id: true, testType: true, brandVisible: true },
          },
        },
      },
    },
    orderBy: [{ factory: { name: "asc" } }, { factoryCode: "asc" }],
  });

  const totalFabrics = fabrics.length;
  const withFactory = fabrics.filter((f) => f.factoryId).length;
  const withoutFactory = totalFabrics - withFactory;
  const withFuzeNumber = fabrics.filter((f) => f.fuzeNumber != null).length;
  const withoutFuzeNumber = totalFabrics - withFuzeNumber;
  const withFactoryCode = fabrics.filter((f) => !!f.factoryCode).length;
  const withCustomerCode = fabrics.filter((f) => !!f.customerCode).length;
  const withDevStatus = fabrics.filter((f) => !!f.developmentStatus).length;

  const factoryRollup = new Map();
  for (const f of fabrics) {
    const key = f.factoryId || "_unassigned";
    const name = f.factory?.name || "(no factory)";
    if (!factoryRollup.has(key)) {
      factoryRollup.set(key, { factoryId: f.factoryId, factoryName: name, fabricCount: 0, sampleFactoryCodes: [] });
    }
    const r = factoryRollup.get(key);
    r.fabricCount++;
    if (f.factoryCode && r.sampleFactoryCodes.length < 3) {
      r.sampleFactoryCodes.push(f.factoryCode);
    }
  }
  const byFactory = Array.from(factoryRollup.values()).sort((a, b) => b.fabricCount - a.fabricCount);

  const submissionCount = fabrics.reduce((sum, f) => sum + f.submissions.length, 0);
  const testRunCount = fabrics.reduce(
    (sum, f) => sum + f.submissions.reduce((s2, sub) => s2 + sub.testRuns.length, 0),
    0,
  );
  const brandVisibleTestRuns = fabrics.reduce(
    (sum, f) =>
      sum +
      f.submissions.reduce(
        (s2, sub) => s2 + sub.testRuns.filter((tr) => tr.brandVisible).length,
        0,
      ),
    0,
  );

  const bfLinks = await prisma.brandFactory.count({ where: { brandId: brand.id } });
  const sclLinks = await prisma.supplyChainLink.count({
    where: {
      fromType: "BRAND",
      fromId: brand.id,
      toType: "FACTORY",
      active: true,
    },
  });

  const distinctFactoriesViaFabric = new Set(fabrics.map((f) => f.factoryId).filter(Boolean)).size;
  const junctionsAgreeWithFabrics = bfLinks === distinctFactoriesViaFabric;

  const verdicts = [];
  if (totalFabrics === 0) {
    verdicts.push(`❌ Brand exists but has 0 fabrics — portfolio page will show empty state`);
  } else {
    verdicts.push(`✓ ${totalFabrics} fabric(s) attached to brand`);
  }
  if (totalFabrics > 0 && withoutFactory > 0) {
    verdicts.push(`⚠ ${withoutFactory} fabric(s) have no factory — will sit under "(no factory)" group`);
  }
  if (totalFabrics > 0 && withoutFuzeNumber > 0) {
    verdicts.push(`⚠ ${withoutFuzeNumber} fabric(s) have no FUZE number — column will show "unassigned"`);
  }
  if (totalFabrics > 0 && withDevStatus === 0) {
    verdicts.push(`⚠ 0 fabric(s) have developmentStatus set — status column will all read "Not set"`);
  }
  if (totalFabrics > 0 && !junctionsAgreeWithFabrics) {
    verdicts.push(
      `⚠ Factories tile will show ${bfLinks} but ${distinctFactoriesViaFabric} factories are actually reachable via fabrics — run backfill-brand-factory-links`,
    );
  } else if (totalFabrics > 0) {
    verdicts.push(`✓ Factories tile (${bfLinks}) agrees with fabric supply chain (${distinctFactoriesViaFabric})`);
  }
  if (totalFabrics > 0 && sclLinks === 0) {
    verdicts.push(`⚠ "No factory linked" suggested-next-move card will fire — SupplyChainLink table empty for this brand`);
  }

  return NextResponse.json({
    ok: true,
    brandFound: true,
    brand,
    portfolioUrl: `/admin/brands/${brand.id}/fabrics`,
    summary: {
      totalFabrics,
      withFactory,
      withoutFactory,
      withFuzeNumber,
      withoutFuzeNumber,
      withFactoryCode,
      withCustomerCode,
      withDevStatus,
      submissionCount,
      testRunCount,
      brandVisibleTestRuns,
      distinctFactoriesViaFabric,
      brandFactoryJunctionRows: bfLinks,
      supplyChainLinkRows: sclLinks,
    },
    byFactory,
    verdicts,
  });
}
