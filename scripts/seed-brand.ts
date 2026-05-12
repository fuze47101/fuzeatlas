/**
 * NEED-1 — seed-brand (CLI wrapper)
 *
 * The hard work lives in `src/lib/seed-brand.ts`. This script is a
 * thin CLI wrapper so humans on a terminal get the same idempotent
 * upsert that the runtime smoke test at `/api/cron/seed-brand-smoke`
 * exercises.
 *
 * Usage:
 *   npx tsx scripts/seed-brand.ts \
 *     --name="Rhone" \
 *     --domain=rhone.com \
 *     --rep=barth@fuze47.com
 *
 *   # Optional overrides:
 *   --tier=F1                # default F2
 *   --cadence-batches=10     # default 5
 *   --country=USA
 *   --website=https://rhone.com
 *
 * Production safety: refuses unless ALLOW_PROD_SEED=1.
 * Detected via NODE_ENV=production OR DATABASE_URL hostname matching
 * a "production-ish" Railway proxy.
 *
 * Exit codes:
 *   0  — change applied (or no-op upsert)
 *   2  — missing required arg or bad arg
 *   3  — primary rep not found (ask Andrew to invite them first)
 *   4  — runtime error
 */

import { PrismaClient } from "@prisma/client";
import { seedBrand, SeedBrandError } from "../src/lib/seed-brand";

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
  const isProdEnv = process.env.NODE_ENV === "production";
  const dsn = process.env.DATABASE_URL || "";
  const dsnLooksProd =
    dsn.includes(".rlwy.net:28355") || dsn.includes("postgres.railway.internal");
  if ((isProdEnv || dsnLooksProd) && process.env.ALLOW_PROD_SEED !== "1") {
    console.error(
      "✗ Refusing to run against what looks like a production DSN. Set ALLOW_PROD_SEED=1 to override.",
    );
    process.exit(2);
  }
}

async function main() {
  refuseProdWithoutFlag();
  const args = parseArgs();

  try {
    const result = await seedBrand(prisma, {
      name: need(args, "name"),
      domain: need(args, "domain"),
      repEmail: need(args, "rep"),
      tier: (args["tier"] || "F2").toUpperCase() as any,
      cadenceBatches: args["cadence-batches"]
        ? parseInt(args["cadence-batches"], 10)
        : undefined,
      country: args["country"] || null,
      website: args["website"] || null,
    });

    if (result.outcome === "created") {
      console.log(`✓ Created brand "${result.brandName}" with defaults`);
    } else if (result.outcome === "filled") {
      console.log(
        `= Filled missing spec fields on existing brand "${result.brandName}": ${result.filledFields.join(", ")}`,
      );
    } else {
      console.log(`= Brand "${result.brandName}" already in place — no changes`);
    }
    console.log(`  Brand id: ${result.brandId}`);
    console.log(`  Primary AM EntityManager: ${result.entityManagerId}`);
    if (result.websiteFilled) {
      console.log(`  ✓ Website filled: ${result.websiteFilled}`);
    }
  } catch (e: any) {
    if (e instanceof SeedBrandError) {
      console.error(`✗ ${e.message}`);
      process.exit(e.code === "REP_NOT_FOUND" ? 3 : 2);
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
