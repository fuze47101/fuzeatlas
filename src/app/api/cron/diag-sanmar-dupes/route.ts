// @ts-nocheck
/**
 * GET /api/cron/diag-sanmar-dupes
 *
 * Verifies the SanMar seed didn't create duplicate Fabric or Factory
 * rows. Catches three failure modes:
 *
 *  1. Same factoryCode exists on more than one Fabric row
 *     (e.g., a factory-intake fabric AND a SanMar-seeded fabric)
 *  2. Same factory name exists more than once (slight spelling variants)
 *  3. SanMar brand has more than one row by name
 *
 * Bearer-authed read-only. Pattern matches diag-bd and friends.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET;

// Factory names + fabric codes from scripts/seed-sanmar-fabrics.ts.
// Keep this list in sync with the seed if more rows get added.
const SANMAR_FACTORY_NAMES = [
  "Wuxi Paradise Textile",
  "Hone Strong",
  "Chiao Hua",
  "XinKaiSheng (New Kasum)",
  "Dongguan Shatian Lihai (東莞沙田麗海紡織印染有限公司)",
  "Fountain Set Limited",
  "HuaFeng",
  "New Wide",
  "Texwinca",
];

const SANMAR_FACTORY_CODES = [
  "PT-WX-31997-2",
  "PT-WX-32889-3",
  "PT-WX-37330",
  "PT-WX-37794-1",
  "PT-WX-33614-15",
  "PT-WX-33614-16",
  "PT-WX-33614-20",
  "8-11786",
  "8-11787",
  "DS25049-01",
  "NKS-260112004R1",
  "AQVF0793-25",
  "AQVF0732-25",
  "MM45033W",
  "HF-FJ03084 N",
  "#S618732A-Y1",
  "DS6012627",
  "DS6012634",
];

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ─── Check 1: SanMar brand count ─────────────────────────────
  const sanmarBrands = await prisma.brand.findMany({
    where: { name: { contains: "SanMar", mode: "insensitive" } },
    select: { id: true, name: true, pipelineStage: true, customerType: true },
  });

  // ─── Check 2: Factory rows by name + fuzzy similarity ────────
  // Pull every factory whose name contains a token from any seed mill name,
  // then group to spot duplicates.
  const allFactories = await prisma.factory.findMany({
    select: { id: true, name: true, country: true, customerType: true },
  });
  const factoryReport = SANMAR_FACTORY_NAMES.map((seedName) => {
    const exact = allFactories.filter((f) => f.name === seedName);
    // Fuzzy: case-insensitive containment of the shorter seed-name fragment
    // (strip parens). Helps spot e.g. "wuxi paradise" vs "Wuxi Paradise Textile".
    const stem = seedName.split("(")[0].trim().toLowerCase();
    const fuzzy = allFactories.filter(
      (f) =>
        f.name !== seedName &&
        (f.name.toLowerCase().includes(stem) ||
          stem.includes(f.name.toLowerCase())),
    );
    return {
      seedName,
      exactCount: exact.length,
      exactIds: exact.map((f) => f.id),
      possibleDuplicates: fuzzy.map((f) => ({ id: f.id, name: f.name })),
    };
  });

  // ─── Check 3: Fabric rows by factoryCode ─────────────────────
  const fabrics = await prisma.fabric.findMany({
    where: { factoryCode: { in: SANMAR_FACTORY_CODES } },
    select: {
      id: true,
      factoryCode: true,
      brandId: true,
      factoryId: true,
      customerCode: true,
      construction: true,
      developmentStatus: true,
      brand: { select: { id: true, name: true } },
      factory: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: [{ factoryCode: "asc" }, { createdAt: "asc" }],
  });

  const fabricByCode: Record<string, typeof fabrics> = {};
  for (const f of fabrics) {
    if (!f.factoryCode) continue;
    (fabricByCode[f.factoryCode] ||= []).push(f);
  }

  const fabricReport = SANMAR_FACTORY_CODES.map((code) => {
    const matches = fabricByCode[code] || [];
    return {
      factoryCode: code,
      rowCount: matches.length,
      rows: matches.map((f) => ({
        id: f.id,
        brand: f.brand?.name || (f.brandId ? `<unknown:${f.brandId}>` : "—"),
        factory: f.factory?.name || (f.factoryId ? `<unknown:${f.factoryId}>` : "—"),
        developmentStatus: f.developmentStatus,
        customerCode: f.customerCode,
        createdAt: f.createdAt,
      })),
      isDuplicate: matches.length > 1,
    };
  });

  // ─── Verdicts ────────────────────────────────────────────────
  const duplicateFactories = factoryReport.filter(
    (r) => r.exactCount > 1 || r.possibleDuplicates.length > 0,
  );
  const duplicateFabrics = fabricReport.filter((r) => r.isDuplicate);
  const sanmarBrandIssue = sanmarBrands.length !== 1;

  const verdicts: string[] = [];
  if (sanmarBrandIssue) {
    verdicts.push(
      `⚠ SanMar brand: ${sanmarBrands.length} rows match "SanMar" (expected exactly 1)`,
    );
  } else {
    verdicts.push(`✓ SanMar brand: exactly 1 row (${sanmarBrands[0].id})`);
  }
  if (duplicateFactories.length === 0) {
    verdicts.push(`✓ Factories: no duplicates among the 9 SanMar mills`);
  } else {
    verdicts.push(
      `⚠ Factories: ${duplicateFactories.length} mill(s) have potential duplicates — see factoryReport`,
    );
  }
  if (duplicateFabrics.length === 0) {
    verdicts.push(`✓ Fabrics: each of the 18 factoryCodes has exactly 1 row`);
  } else {
    verdicts.push(
      `⚠ Fabrics: ${duplicateFabrics.length} factoryCode(s) have duplicates — see fabricReport`,
    );
  }

  const isClean =
    !sanmarBrandIssue &&
    duplicateFactories.length === 0 &&
    duplicateFabrics.length === 0;

  return NextResponse.json({
    ok: true,
    clean: isClean,
    verdicts,
    summary: {
      sanmarBrandCount: sanmarBrands.length,
      duplicateFactoryCount: duplicateFactories.length,
      duplicateFabricCount: duplicateFabrics.length,
      totalSanmarFabrics: fabrics.length,
    },
    sanmarBrands,
    duplicateFactories,
    duplicateFabrics,
    // Full reports for triage (omit if clean to keep payload small)
    factoryReport: isClean ? undefined : factoryReport,
    fabricReport: isClean ? undefined : fabricReport,
    generatedAt: new Date().toISOString(),
  });
}
