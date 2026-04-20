/**
 * rename-hurricane-ventures.ts
 *
 * One-shot rename of the "Hurricane Filter" brand record to its actual
 * name "Hurricane Ventures" (President/Co-Founder Alec Miller) + pin the
 * correct address (Greenville, PA) and contact email.
 *
 * Run once from fuzeatlas root:
 *   npx tsx scripts/rename-hurricane-ventures.ts
 *
 * Idempotent: if the brand is already named "Hurricane Ventures" this
 * will still normalise the website + backgroundInfo + contact rows.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Find by any plausible legacy name. Prefer exact match on "Hurricane Filter".
  const candidates = await prisma.brand.findMany({
    where: {
      OR: [
        { name: "Hurricane Filter" },
        { name: "Hurricane Filters" },
        { name: "Hurricane Ventures" },
        { name: { contains: "Hurricane", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, website: true },
  });

  if (candidates.length === 0) {
    console.error("No Hurricane* brand found. Nothing to rename.");
    process.exit(1);
  }

  if (candidates.length > 1) {
    console.warn("Multiple Hurricane* brands found — will rename the first:");
    candidates.forEach((c) => console.warn(`  - ${c.id}  ${c.name}`));
  }

  const target = candidates[0];
  console.log(`Renaming brand ${target.id} (${target.name}) → Hurricane Ventures`);

  const updated = await prisma.brand.update({
    where: { id: target.id },
    data: {
      name: "Hurricane Ventures",
      website: "https://hurricane-pool-filters.com",
      backgroundInfo:
        "U.S. manufacturer of pool & spa cartridge filters. HQ & manufacturing: 1404 Arlington Dr, Greenville, PA 16125. Co-founded by Alec Miller (President). Only full-service private-label cartridge filter manufacturer in the US.",
    },
    select: { id: true, name: true, website: true },
  });
  console.log("  → updated:", updated);

  // Touch Alec's contact: match either the legacy domain or first/last name.
  const alecWhere = {
    OR: [
      { email: "alec@hurricane-ventures.com" },
      { email: { endsWith: "@hurricane-ventures.com" } },
      {
        AND: [
          { firstName: { equals: "Alec", mode: "insensitive" as const } },
          { lastName: { equals: "Miller", mode: "insensitive" as const } },
        ],
      },
    ],
  };

  const alec = await prisma.contact.findFirst({ where: alecWhere });
  if (alec) {
    await prisma.contact.update({
      where: { id: alec.id },
      data: {
        firstName: "Alec",
        lastName: "Miller",
        name: "Alec Miller",
        email: "alec@hurricane-ventures.com",
        jobTitle: "President / Co-Founder",
        seniority: "c_suite",
      },
    });
    console.log(`  → contact ${alec.id} normalised → alec@hurricane-ventures.com`);
  } else {
    console.warn("  ! No Alec Miller contact found. Create one manually from the brand page.");
  }

  // Clean up any duplicate Hurricane* brands beyond the first.
  for (const dup of candidates.slice(1)) {
    if (dup.id === target.id) continue;
    console.warn(`  ! duplicate brand ${dup.id} (${dup.name}) not touched — review & merge manually.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
