// @ts-nocheck
/**
 * POST /api/cron/seed-sanmar
 *
 * Bearer-authed runtime seed for SanMar fabric portfolio. Mirrors
 * scripts/seed-sanmar-fabrics.ts but runs inside Vercel where the
 * real prod DATABASE_URL is available (the local Mac DSN points at
 * an empty mirror, per the documented DSN-drift issue in CLAUDE.md).
 *
 * Idempotent. Re-running is safe — matches on (brandId + factoryCode)
 * for fabrics and on factory name (with aliases) for factories.
 *
 * Run: curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *      https://fuzeatlas.com/api/cron/seed-sanmar
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapTinaStatusToEnum } from "@/lib/fabric-development-status";

const CRON_SECRET = process.env.CRON_SECRET;

const BRAND_NAME = "SanMar";
const BRAND_WEBSITE = "https://www.sanmar.com";

const FACTORY_ALIASES: Record<string, { existingName?: string; existingId?: string }> = {
  "XinKaiSheng (New Kasum)": { existingName: "NK" },
  "New Wide": { existingName: "New Wide Enterprise Co." },
};

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

const ROWS = [
  { mill: "Wuxi Paradise Textile", factoryCode: "PT-WX-31997-2", type: "ACTUAL", content: "7%Spandex", weightGsm: 280, customerCode: null, trialComplete: true, hasIcpResult: true, hasAmResult: true, icpValue: 4.09, icpNote: null, reportDate: DATES["11-Feb"], rawStatus: "Bulk Production" },
  { mill: "Wuxi Paradise Textile", factoryCode: "PT-WX-32889-3", type: "ACTUAL", content: "89% rNylon 11%Spandex", weightGsm: 190, customerCode: null, trialComplete: true, hasIcpResult: true, hasAmResult: false, icpValue: 1.3, icpNote: null, reportDate: DATES["23-Jan"], rawStatus: "Bulk Production" },
  { mill: "Wuxi Paradise Textile", factoryCode: "PT-WX-37330", type: "DEVELOPMENT", content: "44% Recycled Polyester 44% Polyester 12% Recycled Spandex", weightGsm: 190, customerCode: "FA27K009 Performance Refresh", trialComplete: true, hasIcpResult: true, hasAmResult: false, icpValue: 0.74, icpNote: null, reportDate: DATES["11-Mar"], rawStatus: "Further update?" },
  { mill: "Wuxi Paradise Textile", factoryCode: "PT-WX-37794-1", type: "DEVELOPMENT", content: "spandex", weightGsm: 155, customerCode: null, trialComplete: true, hasIcpResult: true, hasAmResult: false, icpValue: 0.62, icpNote: null, reportDate: DATES["11-Mar"], rawStatus: "Further update?" },
  { mill: "Wuxi Paradise Textile", factoryCode: "PT-WX-33614-15", type: "DEVELOPMENT", content: "75%Recycled Polyester 18%Rayon 7%Spandex", weightGsm: null, customerCode: "MERCER+METTLE K004MM", trialComplete: true, hasIcpResult: true, hasAmResult: false, icpValue: 0.46, icpNote: null, reportDate: DATES["28-Jan"], rawStatus: "Dropped" },
  { mill: "Wuxi Paradise Textile", factoryCode: "PT-WX-33614-16", type: "DEVELOPMENT", content: "77%Recycled Polyester 18%Rayon 5%Spandex", weightGsm: null, customerCode: "MERCER+METTLE K004MM", trialComplete: true, hasIcpResult: true, hasAmResult: false, icpValue: 0.5, icpNote: null, reportDate: DATES["28-Jan"], rawStatus: "Dropped" },
  { mill: "Wuxi Paradise Textile", factoryCode: "PT-WX-33614-20", type: "DEVELOPMENT", content: "77%Recycled Polyester 18%Rayon 5%Spandex", weightGsm: null, customerCode: "MERCER+METTLE K004MM", trialComplete: false, hasIcpResult: true, hasAmResult: false, icpValue: null, icpNote: null, reportDate: null, rawStatus: "NEW" },
  { mill: "Hone Strong", factoryCode: "8-11786", type: "DEVELOPMENT", content: "100% Polyester", weightGsm: 190, customerCode: "EB-FA27K005", trialComplete: true, hasIcpResult: true, hasAmResult: true, icpValue: null, icpNote: "multiple results — see notes", reportDate: null, rawStatus: "Further update?" },
  { mill: "Hone Strong", factoryCode: "8-11787", type: "DEVELOPMENT", content: "100% Polyester", weightGsm: 160, customerCode: "PA-FA27K008", trialComplete: true, hasIcpResult: true, hasAmResult: true, icpValue: null, icpNote: "multiple results — see notes", reportDate: null, rawStatus: "AM testing at FUZE USA" },
  { mill: "Chiao Hua", factoryCode: "DS25049-01", type: "DEVELOPMENT", content: "100% Polyester", weightGsm: 160, customerCode: null, trialComplete: true, hasIcpResult: true, hasAmResult: true, icpValue: 1.2, icpNote: "1.2 / 0.7 ppm — two test methods", reportDate: DATES["3-Feb"], rawStatus: "AM testing at FUZE USA" },
  { mill: "XinKaiSheng (New Kasum)", factoryCode: "NKS-260112004R1", type: "DEVELOPMENT", content: "100% Recycled Polyester", weightGsm: 190, customerCode: null, trialComplete: true, hasIcpResult: true, hasAmResult: false, icpValue: 0.95, icpNote: null, reportDate: DATES["13-Mar"], rawStatus: "Further update?" },
  { mill: "Dongguan Shatian Lihai (東莞沙田麗海紡織印染有限公司)", factoryCode: "AQVF0793-25", type: "DEVELOPMENT", content: "55% Cotton 37% Modal 8% Spandex", weightGsm: 162, customerCode: null, trialComplete: true, hasIcpResult: true, hasAmResult: false, icpValue: 0.538, icpNote: null, reportDate: DATES["2025.12.12"], rawStatus: "Proceed with AM test" },
  { mill: "Dongguan Shatian Lihai (東莞沙田麗海紡織印染有限公司)", factoryCode: "AQVF0732-25", type: "DEVELOPMENT", content: "71% Rayon 25% Nylon 4% Spandex", weightGsm: 363, customerCode: null, trialComplete: true, hasIcpResult: true, hasAmResult: false, icpValue: 0.675, icpNote: null, reportDate: DATES["2025.12.12"], rawStatus: "Proceed with AM test" },
  { mill: "Fountain Set Limited", factoryCode: "MM45033W", type: "DEVELOPMENT", content: "68% Rayon 27% Nylon 5% Spandex", weightGsm: 430, customerCode: null, trialComplete: true, hasIcpResult: false, hasAmResult: true, icpValue: null, icpNote: null, reportDate: null, rawStatus: "Bulk Production", noteExtra: "Same as ST450? (Tina note)" },
  { mill: "HuaFeng", factoryCode: "HF-FJ03084 N", type: "DEVELOPMENT", content: null, weightGsm: null, customerCode: null, trialComplete: false, hasIcpResult: false, hasAmResult: false, icpValue: null, icpNote: null, reportDate: null, rawStatus: "No Further update" },
  { mill: "New Wide", factoryCode: "#S618732A-Y1", type: "DEVELOPMENT", content: "85% Polyester 15% Spandex", weightGsm: 170, customerCode: null, trialComplete: true, hasIcpResult: true, hasAmResult: true, icpValue: 0.336, icpNote: null, reportDate: DATES["27-Mar"], rawStatus: "Dropped" },
  { mill: "Texwinca", factoryCode: "DS6012627", type: "DEVELOPMENT", content: "95% Recycled Polyester 5% Spandex", weightGsm: 290, customerCode: "FA27K003 / MERCER+METTLE", trialComplete: true, hasIcpResult: true, hasAmResult: false, icpValue: 0.43, icpNote: null, reportDate: DATES["23-Jan"], rawStatus: "Dropped" },
  { mill: "Texwinca", factoryCode: "DS6012634", type: "DEVELOPMENT", content: "62% BCI Cotton 33% Recycled Polyester 5% Spandex", weightGsm: 290, customerCode: "FA27K003 / MERCER+METTLE", trialComplete: true, hasIcpResult: true, hasAmResult: false, icpValue: 0.1, icpNote: "<0.1 ppm (below detection limit; stored as 0.1)", reportDate: DATES["23-Jan"], rawStatus: "Dropped" },
];

async function ensureBrand(log) {
  const existing = await prisma.brand.findFirst({ where: { name: BRAND_NAME } });
  if (existing) {
    log.push(`✓ Brand exists: ${BRAND_NAME} (${existing.id})`);
    return existing;
  }
  const created = await prisma.brand.create({
    data: { name: BRAND_NAME, website: BRAND_WEBSITE, pipelineStage: "PRODUCTION", customerType: "ACTIVE" },
  });
  log.push(`+ Created brand: ${BRAND_NAME} (${created.id})`);
  return created;
}

async function ensureFactory(name, log) {
  const alias = FACTORY_ALIASES[name];
  if (alias?.existingId) {
    const byId = await prisma.factory.findUnique({ where: { id: alias.existingId } });
    if (byId) {
      log.push(`· Reusing factory (alias id): ${name} → ${byId.name} (${byId.id})`);
      return byId;
    }
  }
  if (alias?.existingName) {
    const byAlias = await prisma.factory.findFirst({ where: { name: alias.existingName } });
    if (byAlias) {
      log.push(`· Reusing factory (alias name): ${name} → ${byAlias.name} (${byAlias.id})`);
      return byAlias;
    }
  }
  const existing = await prisma.factory.findFirst({ where: { name } });
  if (existing) {
    log.push(`· Reusing factory (exact): ${name} (${existing.id})`);
    return existing;
  }
  const created = await prisma.factory.create({ data: { name, customerType: "ACTIVE" } });
  log.push(`+ Created factory: ${name} (${created.id})`);
  return created;
}

async function upsertFabric(brandId, factoryId, row) {
  const existing = await prisma.fabric.findFirst({ where: { brandId, factoryCode: row.factoryCode } });
  const devStatus = mapTinaStatusToEnum(row.rawStatus);
  const noteParts = [];
  if (row.icpNote) noteParts.push(row.icpNote);
  if (row.noteExtra) noteParts.push(row.noteExtra);
  noteParts.push(`Tina raw status: "${row.rawStatus}"`);
  const note = noteParts.join(" · ");
  const data = {
    brandId, factoryId, factoryCode: row.factoryCode, customerCode: row.customerCode,
    construction: row.content, weightGsm: row.weightGsm, quantityType: row.type,
    developmentStatus: devStatus, note,
  };
  if (existing) {
    await prisma.fabric.update({ where: { id: existing.id }, data });
    return { fabric: existing, created: false };
  }
  const created = await prisma.fabric.create({ data });
  return { fabric: created, created: true };
}

async function ensureSubmission(brandId, factoryId, fabricId, row) {
  const existing = await prisma.fabricSubmission.findFirst({ where: { brandId, factoryId, fabricId } });
  const status = row.trialComplete ? "COMPLETE" : "SUBMITTED";
  if (existing) {
    await prisma.fabricSubmission.update({ where: { id: existing.id }, data: { status } });
    return existing;
  }
  return prisma.fabricSubmission.create({ data: { brandId, factoryId, fabricId, status } });
}

async function ensureIcpTest(submissionId, row) {
  if (!row.hasIcpResult || row.icpValue == null) return null;
  const existing = await prisma.testRun.findFirst({
    where: { submissionId, testType: "ICP" },
    include: { icpResult: true },
  });
  if (existing) {
    if (existing.icpResult) {
      await prisma.icpResult.update({ where: { testRunId: existing.id }, data: { agValue: row.icpValue, unit: "ppm" } });
    } else {
      await prisma.icpResult.create({ data: { testRunId: existing.id, agValue: row.icpValue, unit: "ppm" } });
    }
    return existing;
  }
  return prisma.testRun.create({
    data: {
      submissionId, testType: "ICP",
      testDate: row.reportDate ? new Date(row.reportDate) : null,
      brandVisible: false,
      icpResult: { create: { agValue: row.icpValue, unit: "ppm" } },
    },
  });
}

async function ensureAmTest(submissionId, row) {
  if (!row.hasAmResult) return null;
  const existing = await prisma.testRun.findFirst({ where: { submissionId, testType: "ANTIBACTERIAL" } });
  if (existing) return existing;
  return prisma.testRun.create({
    data: {
      submissionId, testType: "ANTIBACTERIAL",
      testDate: row.reportDate ? new Date(row.reportDate) : null,
      brandVisible: false,
      abResult: { create: { pass: null } },
    },
  });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  try {
    const brand = await ensureBrand(log);
    const factoryCache = new Map();
    let created = 0, updated = 0, icpCreated = 0, amCreated = 0;

    for (const row of ROWS) {
      let factoryId = factoryCache.get(row.mill);
      if (!factoryId) {
        const f = await ensureFactory(row.mill, log);
        factoryId = f.id;
        factoryCache.set(row.mill, factoryId);
      }
      const { fabric, created: wasCreated } = await upsertFabric(brand.id, factoryId, row);
      if (wasCreated) created++; else updated++;
      const sub = await ensureSubmission(brand.id, factoryId, fabric.id, row);
      if (await ensureIcpTest(sub.id, row)) icpCreated++;
      if (await ensureAmTest(sub.id, row)) amCreated++;
      const flag = wasCreated ? "+" : "·";
      log.push(`  ${flag} ${row.mill} / ${row.factoryCode} — ${row.rawStatus}`);
    }

    return NextResponse.json({
      ok: true,
      summary: {
        brandId: brand.id,
        fabricsCreated: created,
        fabricsUpdated: updated,
        millsTouched: factoryCache.size,
        icpTestRows: icpCreated,
        amTestRows: amCreated,
        viewUrl: `/admin/brands/${brand.id}/fabrics`,
      },
      log,
    });
  } catch (e: any) {
    console.error("[seed-sanmar] failed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error", log },
      { status: 500 },
    );
  }
}
