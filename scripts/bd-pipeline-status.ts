// @ts-nocheck
/**
 * BD pipeline status — answers "why is Ryan out of contacts?"
 *
 * Walks the same filter the BD Wizard uses to pick the next brand
 * (next-brand route) and shows where the pipeline is bleeding off:
 *
 *   - Total brands in LEAD stage
 *   - LEAD brands that pass the wizard filter (unassigned, has contacts,
 *     validationStatus not dead/duplicate/irrelevant, not currently
 *     reserved by another rep)
 *   - LEAD brands ELIMINATED by each filter
 *   - Brands discovered/created in the last 7 days (so we can see if
 *     the discovery cron has been writing or silently failing)
 *
 * Run from your Mac:
 *   npx tsx scripts/bd-pipeline-status.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalBrands,
    leadBrands,
    leadOK,
    leadDead,
    leadDuplicate,
    leadIrrelevant,
    leadAssigned,
    leadReserved,
    leadNoContacts,
    discoveredLast7d,
    discoveredLast30d,
    workedLast7d,
  ] = await Promise.all([
    prisma.brand.count(),
    prisma.brand.count({ where: { pipelineStage: "LEAD" } }),
    // The exact wizard filter
    prisma.brand.count({
      where: {
        pipelineStage: "LEAD",
        salesRepId: null,
        validationStatus: { notIn: ["irrelevant", "dead", "duplicate"] },
        contacts: { some: {} },
        OR: [
          { reservedUntil: null },
          { reservedUntil: { lt: now } },
        ],
      },
    }),
    prisma.brand.count({
      where: { pipelineStage: "LEAD", validationStatus: "dead" },
    }),
    prisma.brand.count({
      where: { pipelineStage: "LEAD", validationStatus: "duplicate" },
    }),
    prisma.brand.count({
      where: { pipelineStage: "LEAD", validationStatus: "irrelevant" },
    }),
    prisma.brand.count({
      where: { pipelineStage: "LEAD", salesRepId: { not: null } },
    }),
    prisma.brand.count({
      where: {
        pipelineStage: "LEAD",
        reservedUntil: { gte: now },
        salesRepId: null,
      },
    }),
    prisma.brand.count({
      where: { pipelineStage: "LEAD", contacts: { none: {} } },
    }),
    prisma.brand.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.brand.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.outreachMessage.count({ where: { sentAt: { gte: sevenDaysAgo } } }),
  ]);

  console.log("\n═══ BD Pipeline Status ═══\n");
  console.log(`Total brands in DB:                  ${totalBrands}`);
  console.log(`Brands in LEAD stage:                ${leadBrands}`);
  console.log("");
  console.log("Wizard-eligible right now:");
  console.log(`  ✅ Available to pick:              ${leadOK}`);
  console.log("");
  console.log("Why the rest are excluded:");
  console.log(`  Already claimed by a rep:          ${leadAssigned}`);
  console.log(`  Currently reserved (wizard race):  ${leadReserved}`);
  console.log(`  Marked dead (domain probe failed): ${leadDead}`);
  console.log(`  Marked duplicate:                  ${leadDuplicate}`);
  console.log(`  Marked irrelevant:                 ${leadIrrelevant}`);
  console.log(`  Has zero contacts:                 ${leadNoContacts}`);
  console.log("");
  console.log("Discovery throughput (brand creation):");
  console.log(`  Created in last 7 days:            ${discoveredLast7d}`);
  console.log(`  Created in last 30 days:           ${discoveredLast30d}`);
  console.log("");
  console.log("Outreach throughput (sanity check):");
  console.log(`  OutreachMessage rows last 7 days:  ${workedLast7d}`);
  console.log("");

  if (leadOK === 0) {
    console.log("⚠ Wizard pipeline is EMPTY. Three paths to refill:");
    console.log(
      "  1. Open /admin/brand-discovery and run a manual discovery batch.",
    );
    console.log(
      "  2. Trigger the cron manually:",
    );
    console.log(
      `     curl -H "Authorization: Bearer $CRON_SECRET" \\`,
    );
    console.log(
      `       https://fuzeatlas.com/api/cron/brand-discovery`,
    );
    console.log(
      "  3. If lots of brands have validationStatus=dead, run brand-validation",
    );
    console.log(
      "     to re-probe the dead ones — some may be live now.",
    );
    console.log("");
  } else if (leadOK < 10) {
    console.log(
      `⚠ Only ${leadOK} brand(s) available — wizard will exhaust quickly. Run a discovery batch soon.`,
    );
    console.log("");
  } else {
    console.log(
      `✅ ${leadOK} brand(s) available. Pipeline is healthy.`,
    );
    console.log("");
  }

  if (discoveredLast7d === 0 && discoveredLast30d === 0) {
    console.log(
      "⚠ NO brands have been created in the last 30 days. The discovery",
    );
    console.log(
      "   cron has been silently failing (likely the URL bug just fixed).",
    );
    console.log(
      "   Run /admin/brand-discovery once manually to backfill.",
    );
    console.log("");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
