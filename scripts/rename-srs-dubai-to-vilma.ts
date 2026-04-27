// @ts-nocheck
/**
 * Rename SRS Dubai → Vilma Trading FZE.
 *
 * Andrew's update: the Dubai distributor's real legal / government
 * filing name is "Vilma Trading FZE", not "SRS Dubai" (which was a
 * casual internal label).
 *
 * Strategy:
 *   1. Search for any Distributor whose name OR chineseName contains
 *      "Dubai" OR "SRS" + UAE, plus any record whose city/country is
 *      UAE/Dubai. Prints what we'd touch.
 *   2. With --apply, rename the BEST match (or upsert a new record if
 *      no match found) to "Vilma Trading FZE", country "United Arab
 *      Emirates", city "Dubai".
 *
 * Safe to run repeatedly — idempotent by name match on the new name.
 *
 *   npx tsx scripts/rename-srs-dubai-to-vilma.ts          # dry-run
 *   npx tsx scripts/rename-srs-dubai-to-vilma.ts --apply  # write
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const NEW_NAME = "Vilma Trading FZE";
const NEW_COUNTRY = "United Arab Emirates";
const NEW_CITY = "Dubai";

async function main() {
  // Idempotency check — already renamed?
  const alreadyRenamed = await prisma.distributor.findFirst({
    where: { name: NEW_NAME },
    select: { id: true, name: true, country: true, city: true, status: true, active: true },
  });
  if (alreadyRenamed) {
    console.log(
      `\n✅ Distributor already exists with the canonical name:\n   ${alreadyRenamed.name} · ${alreadyRenamed.city || "—"}, ${alreadyRenamed.country || "—"} · ${alreadyRenamed.status}${alreadyRenamed.active ? "" : " (INACTIVE)"}\n`,
    );
    console.log("No changes needed. Exiting.");
    return;
  }

  // Find candidate Dubai/SRS-Dubai records
  const candidates = await prisma.distributor.findMany({
    where: {
      OR: [
        { name: { contains: "Dubai", mode: "insensitive" } },
        { city: { contains: "Dubai", mode: "insensitive" } },
        {
          AND: [
            { name: { contains: "SRS", mode: "insensitive" } },
            {
              OR: [
                { country: { contains: "UAE", mode: "insensitive" } },
                { country: { contains: "Emirates", mode: "insensitive" } },
                { city: { contains: "Dubai", mode: "insensitive" } },
              ],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      country: true,
      city: true,
      status: true,
      active: true,
      _count: { select: { factories: true, fuzeOrders: true, users: true } },
    },
  });

  console.log(`\nFound ${candidates.length} candidate distributor row(s):\n`);
  for (const c of candidates) {
    console.log(
      `  · ${c.name} (id: ${c.id})  city: ${c.city || "—"}, country: ${c.country || "—"}  status: ${c.status}${c.active ? "" : " INACTIVE"}  factories=${c._count.factories} orders=${c._count.fuzeOrders} users=${c._count.users}`,
    );
  }

  // Pick the best match — prefer one with "Dubai" in the name. Fall
  // back to first candidate. If zero candidates, we'll create.
  let target = candidates.find((c: any) =>
    /dubai/i.test(c.name || ""),
  );
  if (!target && candidates.length > 0) target = candidates[0];

  if (target) {
    console.log(
      `\nTarget for rename:\n  ${target.name}  →  ${NEW_NAME}  (id: ${target.id})\n`,
    );
  } else {
    console.log(
      `\nNo Dubai distributor found. With --apply we will CREATE a new record:\n  ${NEW_NAME} · ${NEW_CITY}, ${NEW_COUNTRY}\n`,
    );
  }

  if (!APPLY) {
    console.log("Dry run — no writes. Re-run with --apply to commit.\n");
    return;
  }

  if (target) {
    const updated = await prisma.distributor.update({
      where: { id: target.id },
      data: {
        name: NEW_NAME,
        country: NEW_COUNTRY,
        city: NEW_CITY,
        // Keep status, active, pricing, factories, users untouched —
        // this is a label correction, not a new record.
      },
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
      },
    });
    console.log(
      `✅ Renamed:\n   ${updated.name} · ${updated.city}, ${updated.country}  (id: ${updated.id})\n`,
    );
  } else {
    const created = await prisma.distributor.create({
      data: {
        name: NEW_NAME,
        country: NEW_COUNTRY,
        city: NEW_CITY,
        status: "ACTIVE",
        active: true,
      },
      select: { id: true, name: true, country: true, city: true },
    });
    console.log(
      `✅ Created new distributor:\n   ${created.name} · ${created.city}, ${created.country}  (id: ${created.id})\n`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
