/**
 * Phase 14D — bulk seed scripts for the data Andrew didn't want
 * to click through 5 pages to enter.
 *
 * Usage:
 *   npm run seed:brand-spec -- --brand "KUIU" --tier F2 \
 *                              --cadence-batches 5 \
 *                              --protocol-url https://...
 *
 *   npm run seed:pricing-tier -- --brand "KUIU" \
 *                                --threshold 1000 --discount 5 --label Bronze
 *
 *   npm run seed:supply-chain-link -- --brand "KUIU" --factory "BesTex"
 *
 *   npm run seed:factory-invitation -- --brand "KUIU" \
 *                                       --factory-name X --contact Y \
 *                                       --email Z
 *
 *   npm run seed:lab-test-catalog -- --lab "ITS Taiwan" \
 *                                     --test AATCC_100 \
 *                                     --protocol "AATCC 100 — S. aureus, 24hr" \
 *                                     --fuze-cost 87 --published 120
 *
 * Each command is idempotent (upsert, not insert). Each prints
 * what it did so a one-liner pipeline can chain them.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

function need(args: Record<string, any>, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || !v) {
    console.error(`✗ Missing required --${key}`);
    process.exit(2);
  }
  return v;
}

function optStr(args: Record<string, any>, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v ? v : null;
}

function optNum(args: Record<string, any>, key: string): number | null {
  const v = args[key];
  if (typeof v !== "string" || !v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function brandIdByName(name: string): Promise<string> {
  const b = await prisma.brand.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (!b) {
    console.error(`✗ Brand "${name}" not found. Add it first via /admin/brands.`);
    process.exit(3);
  }
  return b.id;
}
async function factoryIdByName(name: string): Promise<string> {
  const f = await prisma.factory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (!f) {
    console.error(`✗ Factory "${name}" not found.`);
    process.exit(3);
  }
  return f.id;
}
async function labIdByName(name: string): Promise<string> {
  const l = await prisma.lab.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (!l) {
    console.error(`✗ Lab "${name}" not found.`);
    process.exit(3);
  }
  return l.id;
}

async function seedBrandSpec() {
  const args = parseArgs();
  const brandName = need(args, "brand");
  const brandId = await brandIdByName(brandName);
  const tier = optStr(args, "tier");
  const cadenceBatches = optNum(args, "cadence-batches");
  const cadenceLiters = optNum(args, "cadence-liters");
  const protocolUrl = optStr(args, "protocol-url");

  await prisma.brand.update({
    where: { id: brandId },
    data: {
      ...(tier !== null && { requiredFuzeTier: tier }),
      ...(cadenceBatches !== null && { icpCadenceEveryNBatches: cadenceBatches }),
      ...(cadenceLiters !== null && { icpCadenceEveryLitersConsumed: cadenceLiters }),
      ...(protocolUrl !== null && { protocolDocUrl: protocolUrl }),
      brandSpecUpdatedAt: new Date(),
    },
  });
  console.log(
    `✓ Brand spec set for "${brandName}":`,
    [
      tier && `tier=${tier}`,
      cadenceBatches !== null && `cadence=${cadenceBatches} batches`,
      cadenceLiters !== null && `cadence=${cadenceLiters}L`,
      protocolUrl && `protocol=${protocolUrl}`,
    ].filter(Boolean).join(", "),
  );
}

async function seedPricingTier() {
  const args = parseArgs();
  const brandName = need(args, "brand");
  const brandId = await brandIdByName(brandName);
  const threshold = optNum(args, "threshold");
  const discount = optNum(args, "discount");
  const label = need(args, "label");
  if (threshold === null || discount === null) {
    console.error("✗ --threshold (liters) and --discount (pct) are required");
    process.exit(2);
  }
  const row = await prisma.brandPricingTier.upsert({
    where: {
      brandId_thresholdLiters: { brandId, thresholdLiters: threshold },
    },
    create: { brandId, thresholdLiters: threshold, discountPct: discount, label, active: true },
    update: { discountPct: discount, label, active: true },
  });
  console.log(
    `✓ Pricing tier for "${brandName}": ${label} @ ${threshold}L → ${discount}% discount (row ${row.id})`,
  );
}

async function seedSupplyChainLink() {
  const args = parseArgs();
  const brandName = need(args, "brand");
  const factoryName = need(args, "factory");
  const brandId = await brandIdByName(brandName);
  const factoryId = await factoryIdByName(factoryName);
  const row = await prisma.supplyChainLink.upsert({
    where: {
      fromType_fromId_toType_toId_relationship: {
        fromType: "BRAND",
        fromId: brandId,
        toType: "FACTORY",
        toId: factoryId,
        relationship: "SUPPLIES",
      },
    },
    create: {
      fromType: "BRAND",
      fromId: brandId,
      toType: "FACTORY",
      toId: factoryId,
      relationship: "SUPPLIES",
      active: true,
    },
    update: { active: true },
  });
  console.log(`✓ Supply chain link "${brandName}" → "${factoryName}" (row ${row.id})`);
}

async function seedFactoryInvitation() {
  const args = parseArgs();
  const brandName = need(args, "brand");
  const brandId = await brandIdByName(brandName);
  const invitedFactoryName = need(args, "factory-name");
  const invitedContactEmail = need(args, "email");
  const invitedContactName = optStr(args, "contact");

  // Idempotent on (brandId, invitedContactEmail).
  const existing = await prisma.factoryInvitation.findFirst({
    where: { brandId, invitedContactEmail, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    console.log(`= Factory invitation already pending: ${invitedContactEmail} (row ${existing.id})`);
    return;
  }
  // Generate a quick invite token.
  const inviteToken = `inv-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const row = await prisma.factoryInvitation.create({
    data: {
      brandId,
      invitedFactoryName,
      invitedContactName,
      invitedContactEmail,
      inviteToken,
      status: "PENDING",
    },
  });
  console.log(
    `✓ Factory invitation drafted for "${brandName}": ${invitedFactoryName} → ${invitedContactEmail} (row ${row.id}, token ${inviteToken})`,
  );
}

async function seedLabTestCatalog() {
  const args = parseArgs();
  const labName = need(args, "lab");
  const labId = await labIdByName(labName);
  const testType = need(args, "test");
  const protocolName = need(args, "protocol");
  const fuzeCost = optNum(args, "fuze-cost");
  const published = optNum(args, "published");
  const sla = optNum(args, "sla-days");

  const row = await prisma.labTest.upsert({
    where: {
      labId_testType_protocolName: { labId, testType, protocolName },
    },
    create: {
      labId,
      testType,
      protocolName,
      fuzeCostUsd: fuzeCost,
      publishedPriceUsd: published,
      slaDays: sla,
      active: true,
    },
    update: {
      fuzeCostUsd: fuzeCost,
      publishedPriceUsd: published,
      slaDays: sla,
      active: true,
    },
  });
  console.log(
    `✓ Lab catalog row for "${labName}": ${testType} / ${protocolName} → FUZE cost $${fuzeCost ?? "—"}, published $${published ?? "—"} (row ${row.id})`,
  );
}

async function main() {
  const cmd = process.argv[2];
  try {
    switch (cmd) {
      case "brand-spec":
        await seedBrandSpec();
        break;
      case "pricing-tier":
        await seedPricingTier();
        break;
      case "supply-chain-link":
        await seedSupplyChainLink();
        break;
      case "factory-invitation":
        await seedFactoryInvitation();
        break;
      case "lab-test-catalog":
        await seedLabTestCatalog();
        break;
      default:
        console.error(
          "usage: npm run seed:<brand-spec|pricing-tier|supply-chain-link|factory-invitation|lab-test-catalog> -- --opts",
        );
        process.exit(1);
    }
  } catch (err: any) {
    console.error("✗ Failed:", err?.message || err);
    process.exit(4);
  } finally {
    await prisma.$disconnect();
  }
}

main();
