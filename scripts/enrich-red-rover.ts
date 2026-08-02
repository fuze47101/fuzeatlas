/**
 * Local runner for the Red Rover real-data load — shares
 * src/lib/red-rover-enrich.ts with /api/cron/enrich-red-rover.
 *
 *   DATABASE_URL="$DATABASE_URL_DEV" npx tsx scripts/enrich-red-rover.ts
 */
import { PrismaClient } from "@prisma/client";
import { enrichRedRover } from "../src/lib/red-rover-enrich";

const prisma = new PrismaClient();

async function main() {
  const out = await enrichRedRover(prisma);
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
