/**
 * Lab Directory Cleanup Script
 * Based on Tina Hong's feedback (March 2026)
 *
 * Actions:
 * 1. Merge duplicate labs (ITS GT/ITS Guatemala, ITS SHA/ITS Shanghai, etc.)
 * 2. Rename "NOA (Shanghai)" → "VL Shanghai"
 * 3. Remove "MISTI Batch" (if it exists)
 * 3b. Remove "Shandong" (mistaken entry — ICP tests done in USA)
 * 4. Add "FPC Testing Center" (Taiwan)
 * 5. Normalize country names (china → China, etc.)
 *
 * Usage: node scripts/lab-cleanup.mjs
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🔬 Lab Directory Cleanup — Starting...\n");

  // ── 1. Merge duplicate labs ──
  // Strategy: find both entries, reassign testRuns from the duplicate to the primary, then deactivate the duplicate.

  const MERGE_PAIRS = [
    // [keepName, ...duplicateNamePatterns]
    { keep: "ITS - Guatemala", dupes: ["ITS GT", "ITS Guatemala"] },
    { keep: "ITS - Shanghai", dupes: ["ITS SHA", "ITS Shanghai"] },
    { keep: "ITS - Taiwan", dupes: ["ITS TW", "Intertek", "Intertek Taiwan"] },
    { keep: "SGS - Shanghai", dupes: ["SGS SHA", "SGS Shanghai"] },
    { keep: "SGS - Taiwan", dupes: ["SGS TW"] },
  ];

  for (const { keep, dupes } of MERGE_PAIRS) {
    const primary = await prisma.lab.findFirst({
      where: { name: { equals: keep, mode: "insensitive" } },
    });

    if (!primary) {
      console.log(`  ⚠ Primary lab "${keep}" not found — skipping merge`);
      continue;
    }

    for (const dupeName of dupes) {
      const dupe = await prisma.lab.findFirst({
        where: {
          name: { contains: dupeName, mode: "insensitive" },
          id: { not: primary.id },
        },
      });

      if (!dupe) continue;

      // Reassign test runs
      const moved = await prisma.testRun.updateMany({
        where: { labId: dupe.id },
        data: { labId: primary.id },
      });

      // Reassign sample trial ICP lab references
      const movedTrials = await prisma.sampleTrialRequest.updateMany({
        where: { icpLabId: dupe.id },
        data: { icpLabId: primary.id },
      }).catch(() => ({ count: 0 }));

      // Deactivate the duplicate
      await prisma.lab.update({
        where: { id: dupe.id },
        data: { active: false, notes: `[MERGED into ${keep}] ${dupe.notes || ""}`.trim() },
      });

      console.log(`  ✅ Merged "${dupe.name}" → "${keep}" (${moved.count} test runs, ${movedTrials.count} trials reassigned)`);
    }
  }

  // ── 2. Rename "NOA (Shanghai)" → "VL Shanghai" ──
  const noa = await prisma.lab.findFirst({
    where: { name: { contains: "NOA", mode: "insensitive" } },
  });

  if (noa) {
    await prisma.lab.update({
      where: { id: noa.id },
      data: { name: "VL Shanghai" },
    });
    console.log(`  ✅ Renamed "${noa.name}" → "VL Shanghai"`);
  } else {
    console.log(`  ⚠ "NOA" lab not found — skipping rename`);
  }

  // ── 3. Remove "MISTI Batch" ──
  const misti = await prisma.lab.findFirst({
    where: { name: { contains: "MISTI", mode: "insensitive" } },
  });

  if (misti) {
    // Check for linked test runs first
    const linkedTests = await prisma.testRun.count({ where: { labId: misti.id } });
    if (linkedTests > 0) {
      await prisma.lab.update({
        where: { id: misti.id },
        data: { active: false, notes: `[DEACTIVATED — had ${linkedTests} linked tests] ${misti.notes || ""}`.trim() },
      });
      console.log(`  ✅ Deactivated "MISTI Batch" (had ${linkedTests} linked tests)`);
    } else {
      await prisma.lab.delete({ where: { id: misti.id } });
      console.log(`  ✅ Deleted "MISTI Batch" (no linked tests)`);
    }
  } else {
    console.log(`  ⚠ "MISTI Batch" not found — skipping`);
  }

  // ── 3b. Remove "Shandong" (mistaken entry — ICP tested in USA, not a real lab) ──
  const shandong = await prisma.lab.findFirst({
    where: { name: { contains: "Shandong", mode: "insensitive" } },
  });

  if (shandong) {
    const linkedTests = await prisma.testRun.count({ where: { labId: shandong.id } });
    const linkedTrials = await prisma.sampleTrialRequest.count({ where: { icpLabId: shandong.id } });
    if (linkedTests > 0 || linkedTrials > 0) {
      await prisma.lab.update({ where: { id: shandong.id }, data: { active: false } });
      console.log(`  ✅ Deactivated "Shandong" (had ${linkedTests} tests, ${linkedTrials} trials)`);
    } else {
      await prisma.lab.delete({ where: { id: shandong.id } });
      console.log(`  ✅ Deleted "Shandong" (no linked records)`);
    }
  } else {
    console.log(`  ⚠ "Shandong" not found — skipping`);
  }

  // ── 4. Add "FPC Testing Center" (Taiwan) ──
  const fpcExists = await prisma.lab.findFirst({
    where: { name: { contains: "FPC", mode: "insensitive" } },
  });

  if (!fpcExists) {
    await prisma.lab.create({
      data: {
        name: "FPC Testing Center",
        city: "Miaoli",
        country: "Taiwan",
        region: "Asia Pacific",
        icpApproved: true,
        abApproved: false,
        fungalApproved: false,
        odorApproved: false,
        uvApproved: false,
        notes: "Added per Tina Hong's recommendation (March 2026)",
      },
    });
    console.log(`  ✅ Added "FPC Testing Center" (Miaoli, Taiwan)`);
  } else {
    console.log(`  ⚠ "FPC" lab already exists — skipping`);
  }

  // ── 5. Normalize country names ──
  // Fix inconsistent casing: "china" → "China", "taiwan" → "Taiwan", etc.
  const COUNTRY_NORMALIZE = {
    china: "China",
    taiwan: "Taiwan",
    "hong kong": "Hong Kong",
    usa: "USA",
    "united states": "United States",
    guatemala: "Guatemala",
  };

  for (const [wrong, correct] of Object.entries(COUNTRY_NORMALIZE)) {
    // Labs
    const labsFixed = await prisma.lab.updateMany({
      where: { country: { equals: wrong, mode: "insensitive" }, NOT: { country: correct } },
      data: { country: correct },
    });

    // Factories
    const factoriesFixed = await prisma.factory.updateMany({
      where: { country: { equals: wrong, mode: "insensitive" }, NOT: { country: correct } },
      data: { country: correct },
    });

    if (labsFixed.count > 0 || factoriesFixed.count > 0) {
      console.log(`  ✅ Normalized "${wrong}" → "${correct}" (${labsFixed.count} labs, ${factoriesFixed.count} factories)`);
    }
  }

  console.log("\n🎉 Lab directory cleanup complete!");
}

main()
  .catch((e) => { console.error("❌ Cleanup failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
