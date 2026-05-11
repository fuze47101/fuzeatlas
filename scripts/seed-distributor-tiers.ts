/**
 * NEED-1 — seed-distributor-tiers
 *
 * Idempotent. Applies a 5-rung default DistributorPricing ladder
 * to a named distributor in the distributor's local currency. Used
 * to bootstrap a new distributor so factory orders have a price
 * to quote against before the distributor manually edits.
 *
 * Usage:
 *   npx tsx scripts/seed-distributor-tiers.ts \
 *     --distributor="Harris & Menuk" \
 *     --currency=INR \
 *     --base=120
 *
 *   # Optional:
 *   --tier-1=130  # explicit per-rung override (USD/L); falls back to formula
 *   --tier-5=85
 *
 * Default ladder (per-liter, applied as price = base × multiplier):
 *   Tier 1 — Premium       1.10×   (low volume / boutique)
 *   Tier 2 — Standard      1.00×   (default rung)
 *   Tier 3 — Volume        0.92×
 *   Tier 4 — Strategic     0.85×
 *   Tier 5 — Anchor        0.78×   (high volume / anchor customer)
 *
 * Production safety: refuses unless ALLOW_PROD_SEED=1.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TIER_LADDER: { index: number; name: string; multiplier: number }[] = [
  { index: 1, name: "Premium", multiplier: 1.1 },
  { index: 2, name: "Standard", multiplier: 1.0 },
  { index: 3, name: "Volume", multiplier: 0.92 },
  { index: 4, name: "Strategic", multiplier: 0.85 },
  { index: 5, name: "Anchor", multiplier: 0.78 },
];

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

  const distributorName = need(args, "distributor");
  const currency = (args["currency"] || "USD").toUpperCase();
  const baseRaw = need(args, "base");
  const base = parseFloat(baseRaw);
  if (!Number.isFinite(base) || base <= 0) {
    console.error("✗ --base must be a positive number (price per liter at Tier 2 / Standard)");
    process.exit(2);
  }

  const distributor = await prisma.distributor.findFirst({
    where: { name: { equals: distributorName, mode: "insensitive" } },
    select: { id: true, name: true, localCurrency: true },
  });
  if (!distributor) {
    console.error(`✗ Distributor "${distributorName}" not found.`);
    process.exit(3);
  }

  // Persist localCurrency on the distributor if unset.
  if (!distributor.localCurrency && currency !== "USD") {
    await prisma.distributor.update({
      where: { id: distributor.id },
      data: { localCurrency: currency },
    });
    console.log(`✓ Set localCurrency=${currency} on distributor`);
  }

  let created = 0;
  let updated = 0;
  for (const rung of TIER_LADDER) {
    const override = args[`tier-${rung.index}`];
    const price = override ? parseFloat(override) : base * rung.multiplier;
    if (!Number.isFinite(price) || price <= 0) {
      console.error(`✗ Invalid price for tier ${rung.index}`);
      process.exit(2);
    }

    // Unique key per (distributorId, tierIndex). The DistributorPricing
    // model doesn't have a Prisma @unique constraint on (distributorId,
    // tierIndex) — we dedupe by find-then-update / create.
    const existing = await prisma.distributorPricing.findFirst({
      where: { distributorId: distributor.id, tierIndex: rung.index },
      select: { id: true, pricePerLiter: true },
    });
    if (existing) {
      if (Math.abs((existing.pricePerLiter || 0) - price) > 0.001) {
        await prisma.distributorPricing.update({
          where: { id: existing.id },
          data: {
            pricePerLiter: price,
            currency,
            tierName: rung.name,
          },
        });
        updated++;
        console.log(
          `  ✓ Updated Tier ${rung.index} (${rung.name}): ${price.toFixed(2)} ${currency}/L`,
        );
      } else {
        console.log(
          `  = Tier ${rung.index} (${rung.name}) unchanged: ${price.toFixed(2)} ${currency}/L`,
        );
      }
    } else {
      await prisma.distributorPricing.create({
        data: {
          distributorId: distributor.id,
          tierIndex: rung.index,
          tierName: rung.name,
          pricePerLiter: price,
          currency,
        },
      });
      created++;
      console.log(
        `  ✓ Created Tier ${rung.index} (${rung.name}): ${price.toFixed(2)} ${currency}/L`,
      );
    }
  }

  console.log(
    `\nDistributor "${distributor.name}" tier ladder: ${created} created, ${updated} updated, base ${base} ${currency}/L`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("✗ Failed:", err?.message || err);
    await prisma.$disconnect();
    process.exit(4);
  });
