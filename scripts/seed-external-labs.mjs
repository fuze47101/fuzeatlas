/**
 * Seed External Partner Labs
 * Ensures VL Shanghai, BV HK, ITS Taiwan, and FPC Testing Center
 * are present and active in the lab directory.
 *
 * Usage: node scripts/seed-external-labs.mjs
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const LABS = [
  {
    name: "FUZE USA",
    city: "Salt Lake City",
    country: "USA",
    region: "North America",
    icpApproved: true,
    abApproved: false,
    fungalApproved: false,
    odorApproved: false,
    uvApproved: false,
    notes: "FUZE internal ICP testing — headquarters lab",
  },
  {
    name: "VL Shanghai",
    city: "Shanghai",
    country: "China",
    region: "Asia Pacific",
    icpApproved: true,
    abApproved: true,
    fungalApproved: true,
    odorApproved: false,
    uvApproved: false,
    notes: "Formerly NOA (Shanghai). Full antimicrobial testing suite.",
  },
  {
    name: "Bureau Veritas Hong Kong",
    city: "Hong Kong",
    country: "Hong Kong",
    region: "Asia Pacific",
    icpApproved: true,
    abApproved: true,
    fungalApproved: true,
    odorApproved: true,
    uvApproved: false,
    notes: "BV HK — full testing capabilities for Greater China region.",
  },
  {
    name: "ITS - Taiwan",
    city: "Taipei",
    country: "Taiwan",
    region: "Asia Pacific",
    icpApproved: true,
    abApproved: true,
    fungalApproved: true,
    odorApproved: true,
    uvApproved: false,
    accreditations: "ISO 17025, TAF",
    notes: "Intertek Taiwan — primary APAC testing partner.",
  },
  {
    name: "FPC Testing Center",
    city: "Miaoli",
    country: "Taiwan",
    region: "Asia Pacific",
    icpApproved: true,
    abApproved: false,
    fungalApproved: false,
    odorApproved: false,
    uvApproved: false,
    notes: "Added per Tina Hong's recommendation.",
  },
];

async function main() {
  console.log("🔬 Seeding External Partner Labs...\n");

  for (const lab of LABS) {
    // Check by exact name first, then fuzzy match
    let existing = await prisma.lab.findFirst({
      where: { name: { equals: lab.name, mode: "insensitive" } },
    });

    // Also try partial match for BV
    if (!existing && lab.name.includes("Bureau Veritas")) {
      existing = await prisma.lab.findFirst({
        where: { name: { contains: "Bureau Veritas", mode: "insensitive" } },
      });
    }
    if (!existing && lab.name === "VL Shanghai") {
      existing = await prisma.lab.findFirst({
        where: { OR: [
          { name: { contains: "VL Shanghai", mode: "insensitive" } },
          { name: { contains: "NOA", mode: "insensitive" } },
        ] },
      });
    }

    if (existing) {
      // Ensure it's active
      if (!existing.active) {
        await prisma.lab.update({
          where: { id: existing.id },
          data: { active: true },
        });
        console.log(`  ✅ Reactivated "${existing.name}"`);
      } else {
        console.log(`  ⏭  "${existing.name}" already exists and is active`);
      }
    } else {
      await prisma.lab.create({ data: lab });
      console.log(`  ✅ Created "${lab.name}" (${lab.city}, ${lab.country})`);
    }
  }

  // List all active labs for verification
  const allActive = await prisma.lab.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { name: true, city: true, country: true },
  });

  console.log(`\n📋 All active labs (${allActive.length}):`);
  for (const l of allActive) {
    console.log(`   • ${l.name} — ${l.city || "?"}, ${l.country || "?"}`);
  }

  console.log("\n🎉 External lab seeding complete!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
