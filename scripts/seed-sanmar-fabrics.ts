// @ts-nocheck
/**
 * scripts/seed-sanmar-fabrics.ts
 *
 * One-shot import of Tina's SanMar fabric portfolio spreadsheet
 * (FA27 Development) into Atlas. Replaces the parallel Excel file
 * she previously maintained.
 *
 * Source: screenshot Andrew sent May 18 2026 — 18 fabrics across
 * 9 mills.
 *
 * Idempotent — uses Brand.name + Factory.name + Fabric.factoryCode
 * as natural keys. Re-running matches existing rows; safe to retry.
 *
 * Run from the repo root after pushing the migration:
 *   set -a && source .env.local && set +a && \
 *     npx tsx scripts/seed-sanmar-fabrics.ts
 *
 * If you need to point at prod explicitly:
 *   ALLOW_PROD_SEED=1 npx tsx scripts/seed-sanmar-fabrics.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { mapTinaStatusToEnum } from "../src/lib/fabric-development-status";

const prisma = new PrismaClient();

const BRAND_NAME = "SanMar";
const BRAND_WEBSITE = "https://www.sanmar.com";

interface SeedRow {
  mill: string;
  factoryCode: string;
  type: "ACTUAL" | "DEVELOPMENT";
  content: string | null;
  weightGsm: number | null;
  customerCode: string | null;
  trialComplete: boolean;
  hasIcpResult: boolean;
  hasAmResult: boolean;
  icpValue: number | null;
  icpNote: string | null;
  reportDate: string | null;
  rawStatus: string;
  noteExtra?: string;
}

// Year inferred where Tina's sheet shows only month+day — assume current
// year (2026) for Jan/Feb/Mar entries; Dec entries are 2025 since they
// pre-date 2026 production runs.
const DATES = {
  "11-Feb": "2026-02-11",
  "23-Jan": "2026-01-23",
  "11-Mar": "2026-03-11",
  "28-Jan": "2026-01-28",
  "3-Feb": "2026-02-03",
  "13-Mar": "2026-03-13",
  "2025.12.12": "2025-12-12",
  "27-Mar": "2026-03-27",
};

const ROWS: SeedRow[] = [
  // ─── Wuxi Paradise Textile ─────────────────────────────────────
  {
    mill: "Wuxi Paradise Textile",
    factoryCode: "PT-WX-31997-2",
    type: "ACTUAL",
    content: "7%Spandex",
    weightGsm: 280,
    customerCode: null,
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: true,
    icpValue: 4.09,
    icpNote: null,
    reportDate: DATES["11-Feb"],
    rawStatus: "Bulk Production",
  },
  {
    mill: "Wuxi Paradise Textile",
    factoryCode: "PT-WX-32889-3",
    type: "ACTUAL",
    content: "89% rNylon 11%Spandex",
    weightGsm: 190,
    customerCode: null,
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: 1.3,
    icpNote: null,
    reportDate: DATES["23-Jan"],
    rawStatus: "Bulk Production",
  },
  {
    mill: "Wuxi Paradise Textile",
    factoryCode: "PT-WX-37330",
    type: "DEVELOPMENT",
    content: "44% Recycled Polyester 44% Polyester 12% Recycled Spandex",
    weightGsm: 190,
    customerCode: "FA27K009 Performance Refresh",
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: 0.74,
    icpNote: null,
    reportDate: DATES["11-Mar"],
    rawStatus: "Further update?",
  },
  {
    mill: "Wuxi Paradise Textile",
    factoryCode: "PT-WX-37794-1",
    type: "DEVELOPMENT",
    content: "spandex",
    weightGsm: 155,
    customerCode: null,
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: 0.62,
    icpNote: null,
    reportDate: DATES["11-Mar"],
    rawStatus: "Further update?",
  },
  {
    mill: "Wuxi Paradise Textile",
    factoryCode: "PT-WX-33614-15",
    type: "DEVELOPMENT",
    content: "75%Recycled Polyester 18%Rayon 7%Spandex",
    weightGsm: null,
    customerCode: "MERCER+METTLE K004MM",
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: 0.46,
    icpNote: null,
    reportDate: DATES["28-Jan"],
    rawStatus: "Dropped",
  },
  {
    mill: "Wuxi Paradise Textile",
    factoryCode: "PT-WX-33614-16",
    type: "DEVELOPMENT",
    content: "77%Recycled Polyester 18%Rayon 5%Spandex",
    weightGsm: null,
    customerCode: "MERCER+METTLE K004MM",
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: 0.5,
    icpNote: null,
    reportDate: DATES["28-Jan"],
    rawStatus: "Dropped",
  },
  {
    mill: "Wuxi Paradise Textile",
    factoryCode: "PT-WX-33614-20",
    type: "DEVELOPMENT",
    content: "77%Recycled Polyester 18%Rayon 5%Spandex",
    weightGsm: null,
    customerCode: "MERCER+METTLE K004MM",
    trialComplete: false,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: null,
    icpNote: null,
    reportDate: null,
    rawStatus: "NEW",
  },
  // ─── Hone Strong ─────────────────────────────────────────────
  {
    mill: "Hone Strong",
    factoryCode: "8-11786",
    type: "DEVELOPMENT",
    content: "100% Polyester",
    weightGsm: 190,
    customerCode: "EB-FA27K005",
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: true,
    icpValue: null,
    icpNote: "multiple results — see notes",
    reportDate: null,
    rawStatus: "Further update?",
  },
  {
    mill: "Hone Strong",
    factoryCode: "8-11787",
    type: "DEVELOPMENT",
    content: "100% Polyester",
    weightGsm: 160,
    customerCode: "PA-FA27K008",
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: true,
    icpValue: null,
    icpNote: "multiple results — see notes",
    reportDate: null,
    rawStatus: "AM testing at FUZE USA",
  },
  // ─── Chiao Hua ───────────────────────────────────────────────
  {
    mill: "Chiao Hua",
    factoryCode: "DS25049-01",
    type: "DEVELOPMENT",
    content: "100% Polyester",
    weightGsm: 160,
    customerCode: null,
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: true,
    icpValue: 1.2,
    icpNote: "1.2 / 0.7 ppm — two test methods",
    reportDate: DATES["3-Feb"],
    rawStatus: "AM testing at FUZE USA",
  },
  // ─── XinKaiSheng / New Kasum ─────────────────────────────────
  {
    mill: "XinKaiSheng (New Kasum)",
    factoryCode: "NKS-260112004R1",
    type: "DEVELOPMENT",
    content: "100% Recycled Polyester",
    weightGsm: 190,
    customerCode: null,
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: 0.95,
    icpNote: null,
    reportDate: DATES["13-Mar"],
    rawStatus: "Further update?",
  },
  // ─── Dongguan Shatian Lihai (東莞沙田麗海) ────────────────────
  {
    mill: "Dongguan Shatian Lihai (東莞沙田麗海紡織印染有限公司)",
    factoryCode: "AQVF0793-25",
    type: "DEVELOPMENT",
    content: "55% Cotton 37% Modal 8% Spandex",
    weightGsm: 162,
    customerCode: null,
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: 0.538,
    icpNote: null,
    reportDate: DATES["2025.12.12"],
    rawStatus: "Proceed with AM test",
  },
  {
    mill: "Dongguan Shatian Lihai (東莞沙田麗海紡織印染有限公司)",
    factoryCode: "AQVF0732-25",
    type: "DEVELOPMENT",
    content: "71% Rayon 25% Nylon 4% Spandex",
    weightGsm: 363,
    customerCode: null,
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: 0.675,
    icpNote: null,
    reportDate: DATES["2025.12.12"],
    rawStatus: "Proceed with AM test",
  },
  // ─── Fountain Set Limited ────────────────────────────────────
  {
    mill: "Fountain Set Limited",
    factoryCode: "MM45033W",
    type: "DEVELOPMENT",
    content: "68% Rayon 27% Nylon 5% Spandex",
    weightGsm: 430,
    customerCode: null,
    trialComplete: true,
    hasIcpResult: false,
    hasAmResult: true,
    icpValue: null,
    icpNote: null,
    reportDate: null,
    rawStatus: "Bulk Production",
    noteExtra: "Same as ST450? (Tina note)",
  },
  // ─── HuaFeng ─────────────────────────────────────────────────
  {
    mill: "HuaFeng",
    factoryCode: "HF-FJ03084 N",
    type: "DEVELOPMENT",
    content: null,
    weightGsm: null,
    customerCode: null,
    trialComplete: false,
    hasIcpResult: false,
    hasAmResult: false,
    icpValue: null,
    icpNote: null,
    reportDate: null,
    rawStatus: "No Further update",
  },
  // ─── New Wide ────────────────────────────────────────────────
  {
    mill: "New Wide",
    factoryCode: "#S618732A-Y1",
    type: "DEVELOPMENT",
    content: "85% Polyester 15% Spandex",
    weightGsm: 170,
    customerCode: null,
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: true,
    icpValue: 0.336,
    icpNote: null,
    reportDate: DATES["27-Mar"],
    rawStatus: "Dropped",
  },
  // ─── Texwinca ────────────────────────────────────────────────
  {
    mill: "Texwinca",
    factoryCode: "DS6012627",
    type: "DEVELOPMENT",
    content: "95% Recycled Polyester 5% Spandex",
    weightGsm: 290,
    customerCode: "FA27K003 / MERCER+METTLE",
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: 0.43,
    icpNote: null,
    reportDate: DATES["23-Jan"],
    rawStatus: "Dropped",
  },
  {
    mill: "Texwinca",
    factoryCode: "DS6012634",
    type: "DEVELOPMENT",
    content: "62% BCI Cotton 33% Recycled Polyester 5% Spandex",
    weightGsm: 290,
    customerCode: "FA27K003 / MERCER+METTLE",
    trialComplete: true,
    hasIcpResult: true,
    hasAmResult: false,
    icpValue: 0.1,
    icpNote: "<0.1 ppm (below detection limit; stored as 0.1)",
    reportDate: DATES["23-Jan"],
    rawStatus: "Dropped",
  },
];

async function ensureBrand() {
  const existing = await prisma.brand.findFirst({ where: { name: BRAND_NAME } });
  if (existing) {
    console.log(`✓ Brand exists: ${BRAND_NAME} (${existing.id})`);
    return existing;
  }
  const created = await prisma.brand.create({
    data: {
      name: BRAND_NAME,
      website: BRAND_WEBSITE,
      pipelineStage: "PRODUCTION",
      customerType: "ACTIVE",
    },
  });
  console.log(`+ Created brand: ${BRAND_NAME} (${created.id})`);
  return created;
}

async function ensureFactory(name: string) {
  const existing = await prisma.factory.findFirst({ where: { name } });
  if (existing) {
    return existing;
  }
  const created = await prisma.factory.create({
    data: {
      name,
      customerType: "ACTIVE",
    },
  });
  console.log(`+ Created factory: ${name} (${created.id})`);
  return created;
}

async function upsertFabric(brandId: string, factoryId: string, row: SeedRow) {
  // Match by (brandId + factoryCode) — natural key within this seed.
  const existing = await prisma.fabric.findFirst({
    where: {
      brandId,
      factoryCode: row.factoryCode,
    },
  });

  const devStatus = mapTinaStatusToEnum(row.rawStatus);
  const noteParts: string[] = [];
  if (row.icpNote) noteParts.push(row.icpNote);
  if (row.noteExtra) noteParts.push(row.noteExtra);
  noteParts.push(`Tina raw status: "${row.rawStatus}"`);
  const note = noteParts.join(" · ");

  const data = {
    brandId,
    factoryId,
    factoryCode: row.factoryCode,
    customerCode: row.customerCode,
    construction: row.content,
    weightGsm: row.weightGsm,
    quantityType: row.type,
    developmentStatus: devStatus,
    note,
  };

  if (existing) {
    await prisma.fabric.update({ where: { id: existing.id }, data: data as any });
    return { fabric: existing, created: false };
  }
  const created = await prisma.fabric.create({ data: data as any });
  return { fabric: created, created: true };
}

async function ensureSubmission(brandId: string, factoryId: string, fabricId: string, row: SeedRow) {
  const existing = await prisma.fabricSubmission.findFirst({
    where: { brandId, factoryId, fabricId },
  });
  const status = row.trialComplete ? "COMPLETE" : "SUBMITTED";
  if (existing) {
    await prisma.fabricSubmission.update({
      where: { id: existing.id },
      data: { status } as any,
    });
    return existing;
  }
  return prisma.fabricSubmission.create({
    data: {
      brandId,
      factoryId,
      fabricId,
      status,
    } as any,
  });
}

async function ensureIcpTest(submissionId: string, row: SeedRow) {
  if (!row.hasIcpResult || row.icpValue == null) return null;
  // Look for any TestRun on this submission of type ICP first
  const existing = await prisma.testRun.findFirst({
    where: { submissionId, testType: "ICP" as any },
    include: { icpResult: true },
  });
  if (existing) {
    if (existing.icpResult) {
      await prisma.icpResult.update({
        where: { testRunId: existing.id },
        data: { agValue: row.icpValue, unit: "ppm" },
      });
    } else {
      await prisma.icpResult.create({
        data: { testRunId: existing.id, agValue: row.icpValue, unit: "ppm" },
      });
    }
    return existing;
  }
  const run = await prisma.testRun.create({
    data: {
      submissionId,
      testType: "ICP" as any,
      testDate: row.reportDate ? new Date(row.reportDate) : null,
      brandVisible: false, // not brand-stamped — Tina-internal data
      icpResult: {
        create: { agValue: row.icpValue, unit: "ppm" },
      },
    },
  });
  return run;
}

async function ensureAmTest(submissionId: string, row: SeedRow) {
  if (!row.hasAmResult) return null;
  const existing = await prisma.testRun.findFirst({
    where: { submissionId, testType: "ANTIBACTERIAL" as any },
  });
  if (existing) return existing;
  return prisma.testRun.create({
    data: {
      submissionId,
      testType: "ANTIBACTERIAL" as any,
      testDate: row.reportDate ? new Date(row.reportDate) : null,
      brandVisible: false,
      abResult: {
        create: { pass: null },
      },
    },
  });
}

async function main() {
  console.log("\n═══ SanMar Fabric Portfolio Seed ═══\n");
  const brand = await ensureBrand();

  // Cache factories so we don't re-query
  const factoryCache = new Map<string, string>();

  let created = 0;
  let updated = 0;
  let icpCreated = 0;
  let amCreated = 0;

  for (const row of ROWS) {
    let factoryId = factoryCache.get(row.mill);
    if (!factoryId) {
      const f = await ensureFactory(row.mill);
      factoryId = f.id;
      factoryCache.set(row.mill, factoryId);
    }

    const { fabric, created: wasCreated } = await upsertFabric(brand.id, factoryId, row);
    if (wasCreated) created++; else updated++;

    const sub = await ensureSubmission(brand.id, factoryId, fabric.id, row);

    const icp = await ensureIcpTest(sub.id, row);
    if (icp) icpCreated++;
    const am = await ensureAmTest(sub.id, row);
    if (am) amCreated++;

    const flag = wasCreated ? "+" : "·";
    console.log(`  ${flag} ${row.mill} / ${row.factoryCode} — ${row.rawStatus}`);
  }

  console.log(`\n═══ Summary ═══`);
  console.log(`  Fabrics created: ${created}`);
  console.log(`  Fabrics updated: ${updated}`);
  console.log(`  Mills touched:   ${factoryCache.size}`);
  console.log(`  ICP test rows:   ${icpCreated}`);
  console.log(`  AM test rows:    ${amCreated}`);
  console.log(`\n  View portfolio at: /admin/brands/${brand.id}/fabrics\n`);
}

main()
  .catch((e) => {
    console.error("✗ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
