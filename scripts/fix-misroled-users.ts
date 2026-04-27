// @ts-nocheck
/**
 * Find users with a SALES role tag but linked to an external entity
 * (brandId/factoryId/distributorId/labId set) — they're mis-tagged
 * brand/factory/dist/lab contacts that ended up on the BD scoreboard.
 *
 * Josie Ross-MacLeod at Spanx is a real example: role=SALES_REP,
 * email=josie.ross-macleod@spanx.com. Almost certainly should be
 * BRAND_USER linked to the Spanx brand.
 *
 * Defensive: the scoreboard route now also filters out role-tagged
 * users with any external entity link, so even unfixed cases stop
 * polluting the scoreboard. This script tidies the underlying data.
 *
 *   npx tsx scripts/fix-misroled-users.ts            # dry run
 *   npx tsx scripts/fix-misroled-users.ts --apply    # write fixes
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const BD_ROLES = ["SALES_REP", "SALES_MANAGER", "BD_REP"];

async function main() {
  // Anyone with a BD-role tag AND an external entity link is mis-tagged.
  const misRoled = await prisma.user.findMany({
    where: {
      role: { in: BD_ROLES },
      OR: [
        { brandId: { not: null } },
        { factoryId: { not: null } },
        { distributorId: { not: null } },
        { labId: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      brandId: true,
      factoryId: true,
      distributorId: true,
      labId: true,
    },
    orderBy: { name: "asc" },
  });

  if (misRoled.length === 0) {
    console.log("\n✅ No mis-roled users found. Nothing to fix.\n");
    return;
  }

  console.log(`\nFound ${misRoled.length} mis-roled user(s):\n`);
  for (const u of misRoled) {
    let suggestedRole = "EMPLOYEE";
    if (u.brandId) suggestedRole = "BRAND_USER";
    else if (u.factoryId) suggestedRole = "FACTORY_USER";
    else if (u.distributorId) suggestedRole = "DISTRIBUTOR_USER";
    else if (u.labId) suggestedRole = "LAB_USER";

    console.log(
      `  ${u.name || "(no name)"} <${u.email}>  role=${u.role}  →  ${suggestedRole}`,
    );
    console.log(
      `    linked: ${[
        u.brandId && `brand=${u.brandId}`,
        u.factoryId && `factory=${u.factoryId}`,
        u.distributorId && `distributor=${u.distributorId}`,
        u.labId && `lab=${u.labId}`,
      ]
        .filter(Boolean)
        .join(", ")}`,
    );

    if (APPLY) {
      await prisma.user.update({
        where: { id: u.id },
        data: { role: suggestedRole },
      });
      console.log(`    ✓ updated`);
    }
  }

  console.log("");
  if (!APPLY) {
    console.log("Dry run — no writes. Re-run with --apply to fix.\n");
  } else {
    console.log("Done.\n");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
