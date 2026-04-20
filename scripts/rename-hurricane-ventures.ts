/**
 * rename-hurricane-ventures.ts
 *
 * Upsert the "Hurricane Ventures" brand record (President/Co-Founder
 * Alec Miller, Greenville, PA) and pin Alec's contact.
 *
 * Run from fuzeatlas root:
 *   npx tsx scripts/rename-hurricane-ventures.ts
 *
 * Behaviour:
 *   • If a brand named "Hurricane Filter(s)" or similar exists, rename it.
 *   • If no Hurricane* brand exists, CREATE a fresh "Hurricane Ventures" row.
 *   • Ensure Alec Miller contact exists on that brand with correct email.
 *
 * Idempotent: safe to re-run.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const BRAND_NAME = "Hurricane Ventures";
const BRAND_WEBSITE = "https://hurricane-pool-filters.com";
const BRAND_BACKGROUND =
  "U.S. manufacturer of pool & spa cartridge filters. HQ & manufacturing: 1404 Arlington Dr, Greenville, PA 16125. Co-founded by Alec Miller (President). Only full-service private-label cartridge filter manufacturer in the US. Nearest airports: Pittsburgh (PIT) ~75 mi south, Cleveland (CLE) ~75 mi west.";

async function main() {
  // 1. Find any existing Hurricane* brand.
  const candidates = await prisma.brand.findMany({
    where: {
      name: { contains: "Hurricane", mode: "insensitive" },
    },
    select: { id: true, name: true, website: true },
  });

  let targetId: string;

  if (candidates.length === 0) {
    // Create fresh
    const created = await prisma.brand.create({
      data: {
        name: BRAND_NAME,
        website: BRAND_WEBSITE,
        backgroundInfo: BRAND_BACKGROUND,
        pipelineStage: "CUSTOMER_WON", // approved + invoiced SOW
        customerType: "Brand",
        textileCategory: "Pool & spa filter cartridges",
        fuzeRelevance: "high",
      },
      select: { id: true, name: true },
    });
    targetId = created.id;
    console.log(`Created fresh brand: ${created.id} (${created.name})`);
  } else {
    if (candidates.length > 1) {
      console.warn(`Multiple Hurricane* brands found; renaming the first, leaving the rest for manual merge:`);
      candidates.forEach((c) => console.warn(`  - ${c.id}  ${c.name}`));
    }
    targetId = candidates[0].id;
    const updated = await prisma.brand.update({
      where: { id: targetId },
      data: {
        name: BRAND_NAME,
        website: BRAND_WEBSITE,
        backgroundInfo: BRAND_BACKGROUND,
      },
      select: { id: true, name: true, website: true },
    });
    console.log(`Renamed brand ${updated.id} → ${updated.name}`);
  }

  // 2. Upsert Alec's contact.
  const alec = await prisma.contact.findFirst({
    where: {
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
    },
  });

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
    console.log(`Contact ${alec.id} normalised → alec@hurricane-ventures.com`);
  } else {
    // Check if Contact has a brandId relation field before trying to attach.
    // Most Atlas Contact rows attach through a join table; keep this
    // standalone so the script works regardless of relation shape.
    const created = await prisma.contact.create({
      data: {
        firstName: "Alec",
        lastName: "Miller",
        name: "Alec Miller",
        email: "alec@hurricane-ventures.com",
        jobTitle: "President / Co-Founder",
        seniority: "c_suite",
        emailStatus: "verified",
        enrichmentSource: "manual",
      },
      select: { id: true, email: true },
    });
    console.log(`Created contact ${created.id} (${created.email})`);
    console.log(`  ! Attach to brand ${targetId} from the brand's Contacts tab.`);
  }

  console.log(`\nDone. Brand: ${targetId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
