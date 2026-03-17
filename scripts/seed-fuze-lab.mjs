/**
 * Seed FUZE Internal Laboratory
 * Creates "FUZE Atlas Lab" as an internal lab with 5 proprietary test programs.
 *
 * Test Catalog:
 *   FZ-100  FUZE Recipe Development Protocol (application optimization)
 *   FZ-200  FUZE Antimicrobial Verification (ASTM E2149 internal)
 *   FZ-300  Borealis Performance Protocol (wind tunnel + IR thermal + wicking)
 *   FZ-400  Helios Solar Activation Protocol (UV/thermal/down performance)
 *   FZ-500  Solaris IR Heat Deflection Protocol (infrared heat refraction)
 *
 * Usage: node scripts/seed-fuze-lab.mjs
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🔬 Seeding FUZE Atlas Internal Laboratory...\n");

  // ── Check if FUZE Lab already exists ──
  let lab = await prisma.lab.findFirst({
    where: { name: { contains: "FUZE", mode: "insensitive" } },
  });

  if (lab) {
    console.log(`  ⚠ FUZE lab already exists (id: ${lab.id}). Updating...`);
    lab = await prisma.lab.update({
      where: { id: lab.id },
      data: {
        name: "FUZE Atlas Lab",
        city: "Los Angeles",
        state: "CA",
        country: "United States",
        region: "North America",
        website: "https://fuzeatlas.com",
        email: "lab@fuzeatlas.com",
        accreditations: "FUZE Internal · Proprietary Protocols",
        icpApproved: true,
        abApproved: true,
        fungalApproved: false,
        odorApproved: false,
        uvApproved: false,
        active: true,
        notes: "FUZE internal laboratory — proprietary test protocols for treatment optimization and performance verification.",
      },
    });
  } else {
    lab = await prisma.lab.create({
      data: {
        name: "FUZE Atlas Lab",
        city: "Los Angeles",
        state: "CA",
        country: "United States",
        region: "North America",
        website: "https://fuzeatlas.com",
        email: "lab@fuzeatlas.com",
        accreditations: "FUZE Internal · Proprietary Protocols",
        icpApproved: true,
        abApproved: true,
        fungalApproved: false,
        odorApproved: false,
        uvApproved: false,
        active: true,
        notes: "FUZE internal laboratory — proprietary test protocols for treatment optimization and performance verification.",
      },
    });
    console.log(`  ✅ Created FUZE Atlas Lab (id: ${lab.id})`);
  }

  // ── Define FUZE Test Services ──
  const FUZE_TESTS = [
    {
      testType: "RECIPE_DEVELOPMENT",
      testMethod: "FZ-100",
      description:
        "FUZE Recipe Development Protocol — Determines optimal application parameters for FUZE treatment including bath concentration, pickup rates, and process settings. Covers exhaust, pad-dry-cure, and spray application methods. Delivers a certified Recipe Card for production scale-up.",
      priceUSD: 450,
      listPriceUSD: 450,
      turnaroundDays: 10,
      rushPriceUSD: 675,
      rushDays: 5,
      preferred: true,
      preferredNote: "FUZE Recommended",
      notes: "Prerequisite for all FUZE treatments. Includes 3 recipe iterations. Required before production.",
    },
    {
      testType: "ANTIMICROBIAL",
      testMethod: "FZ-200",
      description:
        "FUZE Antimicrobial Verification — Internal ASTM E2149 dynamic shake flask protocol. Measures antimicrobial efficacy of silver and gold nanoparticles on treated fabrics. Reports log reduction values against standard organisms at specified wash counts.",
      priceUSD: 280,
      listPriceUSD: 350,
      turnaroundDays: 7,
      rushPriceUSD: 420,
      rushDays: 3,
      preferred: true,
      preferredNote: "Best Price",
      notes: "Internal ASTM E2149. Tests at 0, 25, 50, 75, and 100 wash cycles. Includes control comparison.",
    },
    {
      testType: "PERFORMANCE",
      testMethod: "FZ-300",
      description:
        "Borealis Performance Protocol — Comprehensive thermal and moisture management analysis using the FUZE wind tunnel system. Measures evaporative cooling rate, wicking distance and speed, thermal regulation, and drying time via IR thermography at 15-second intervals. Tests include baseline, 520nm photoactivation, and 4 mph airflow conditions in all combinations.",
      priceUSD: 850,
      listPriceUSD: 850,
      turnaroundDays: 14,
      rushPriceUSD: 1275,
      rushDays: 7,
      preferred: true,
      preferredNote: "FUZE Recommended",
      notes: "Proprietary wind tunnel protocol. 6\" suspension hoop, 1g H₂O application, IR camera capture at 15s intervals. 8 test condition combinations.",
    },
    {
      testType: "SOLAR_PERFORMANCE",
      testMethod: "FZ-400",
      description:
        "Helios Solar Activation Protocol — Evaluates photocatalytic performance of FUZE-treated fabrics and down products under simulated solar conditions. Measures UV-activated antimicrobial enhancement, thermal regulation under UV exposure, moisture management with solar activation, and self-cleaning photocatalytic response.",
      priceUSD: 950,
      listPriceUSD: 950,
      turnaroundDays: 14,
      rushPriceUSD: 1425,
      rushDays: 7,
      preferred: true,
      preferredNote: "FUZE Recommended",
      notes: "Proprietary protocol for FUZE solar-activated performance. Applicable to fabrics and down insulation.",
    },
    {
      testType: "HEAT_DEFLECTION",
      testMethod: "FZ-500",
      description:
        "Solaris IR Heat Deflection Protocol — Measures infrared heat refraction and thermal barrier performance of FUZE-treated fabrics. Uses calibrated IR lamp source over 6\" test hoop with precision heat absorption plate. Quantifies heat transmission reduction, IR reflectance improvement, and thermal barrier coefficient vs. untreated control.",
      priceUSD: 650,
      listPriceUSD: 650,
      turnaroundDays: 10,
      rushPriceUSD: 975,
      rushDays: 5,
      preferred: true,
      preferredNote: "FUZE Recommended",
      notes: "Proprietary IR heat deflection protocol. Standardized lamp distance, controlled environment. Reports % heat reduction.",
    },
  ];

  // ── Upsert each service ──
  for (const svc of FUZE_TESTS) {
    const existing = await prisma.labService.findFirst({
      where: { labId: lab.id, testMethod: svc.testMethod },
    });

    if (existing) {
      await prisma.labService.update({
        where: { id: existing.id },
        data: svc,
      });
      console.log(`  ✅ Updated ${svc.testMethod}: ${svc.testType}`);
    } else {
      await prisma.labService.create({
        data: { labId: lab.id, ...svc },
      });
      console.log(`  ✅ Created ${svc.testMethod}: ${svc.testType}`);
    }
  }

  console.log(`\n🎉 FUZE Atlas Lab seeded with ${FUZE_TESTS.length} test services!`);
  console.log(`\n📋 Test Catalog:`);
  console.log(`   FZ-100  FUZE Recipe Development Protocol        $${FUZE_TESTS[0].priceUSD}`);
  console.log(`   FZ-200  FUZE Antimicrobial Verification          $${FUZE_TESTS[1].priceUSD}`);
  console.log(`   FZ-300  Borealis Performance Protocol            $${FUZE_TESTS[2].priceUSD}`);
  console.log(`   FZ-400  Helios Solar Activation Protocol         $${FUZE_TESTS[3].priceUSD}`);
  console.log(`   FZ-500  Solaris IR Heat Deflection Protocol      $${FUZE_TESTS[4].priceUSD}`);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
