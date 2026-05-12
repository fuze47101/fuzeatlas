/**
 * NEED-1 — seed-factory (CLI wrapper)
 *
 * Hard work lives in src/lib/seed-factory.ts. This script is the CLI
 * face. The bulk import wizard at /admin/import/factories also calls
 * the same lib, so behavior is consistent across surfaces.
 *
 * Usage:
 *   npx tsx scripts/seed-factory.ts \
 *     --name="Penfabric Sdn. Bhd." \
 *     --country=Malaysia \
 *     --distributor="Harris & Menuk" \
 *     --brands="KUIU,Rhone,Lululemon"
 *
 *   Optional:
 *     --city="Penang"
 *     --website=https://penfabric.com
 *
 * Production safety: refuses unless ALLOW_PROD_SEED=1.
 */
import { PrismaClient } from "@prisma/client";
import { seedFactory, SeedFactoryError } from "../src/lib/seed-factory";

const prisma = new PrismaClient();

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? "true";
  }
  return out;
}

function need(args: Record<string, string>, key: string): string {
  const v = args[key];
  if (!v) {
    console.error(`✗ Missing required --${key}`);
    process.exit(2);
  }
  return v;
}

function refuseProdWithoutFlag() {
  const dsn = process.env.DATABASE_URL || "";
  const looksProd =
    process.env.NODE_ENV === "production" ||
    dsn.includes(".rlwy.net:28355") ||
    dsn.includes("postgres.railway.internal");
  if (looksProd && process.env.ALLOW_PROD_SEED !== "1") {
    console.error("✗ Refusing prod DSN. Set ALLOW_PROD_SEED=1 to override.");
    process.exit(2);
  }
}

async function main() {
  refuseProdWithoutFlag();
  const args = parseArgs();

  try {
    const result = await seedFactory(prisma, {
      name: need(args, "name"),
      country: need(args, "country"),
      distributor: args["distributor"] || null,
      brands: args["brands"]
        ? args["brands"].split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      city: args["city"] || null,
      website: args["website"] || null,
    });

    if (result.outcome === "created") {
      console.log(`✓ Created factory "${result.factoryName}"`);
    } else if (result.outcome === "filled") {
      console.log(
        `= Filled missing fields on existing factory "${result.factoryName}": ${result.filledFields.join(", ")}`,
      );
    } else {
      console.log(`= Factory "${result.factoryName}" already in place — no changes`);
    }
    if (result.distributorLinked) {
      console.log(`  ✓ Linked to distributor "${result.distributorLinked}"`);
    }
    if (result.distributorSkipped) {
      console.log(
        `  ⚠ Distributor "${result.distributorSkipped}" not found — link skipped`,
      );
    }
    for (const brand of result.brandsLinked) {
      console.log(`  ✓ SupplyChainLink BRAND ${brand} → FACTORY ${result.factoryName}`);
    }
    for (const brand of result.brandsMissing) {
      console.warn(
        `  ⚠ Brand "${brand}" not found. Run seed-brand first to add it.`,
      );
    }
    console.log(`\nFactory id: ${result.factoryId}`);
  } catch (e: any) {
    if (e instanceof SeedFactoryError) {
      console.error(`✗ ${e.message}`);
      process.exit(2);
    }
    throw e;
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("✗ Failed:", err?.message || err);
    await prisma.$disconnect();
    process.exit(4);
  });
