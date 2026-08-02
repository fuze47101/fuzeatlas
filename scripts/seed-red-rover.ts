/**
 * Local runner for the Red Rover seed — shares src/lib/red-rover-seed.ts
 * with the /api/cron/seed-red-rover route, so this and prod can't drift.
 *
 * Usage (against caboose, the DB Vercel reads):
 *   DATABASE_URL="$DATABASE_URL_DEV" npx tsx scripts/seed-red-rover.ts
 */
import { PrismaClient } from "@prisma/client";
import { seedRedRover } from "../src/lib/red-rover-seed";

const prisma = new PrismaClient();

async function main() {
  const out = await seedRedRover(prisma);
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
