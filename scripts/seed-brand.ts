/**
 * NEED-1 — seed-brand
 *
 * Idempotent. Takes a brand name + email domain + primary rep email,
 * upserts the Brand row + sane FUZE spec defaults + an EntityManager
 * (primary ACCOUNT_MANAGER) for the named rep.
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
 *   2  — missing required arg
 *   3  — primary rep not found (ask Andrew to invite them first)
 *   4  — runtime error
 */

import { PrismaClient } from "@prisma/client";

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
    dsn.includes(".rlwy.net:28355") || // canonical caboose prod proxy
    dsn.includes("postgres.railway.internal");
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

  const brandName = need(args, "name");
  const domain = need(args, "domain").trim().toLowerCase();
  const repEmail = need(args, "rep").trim().toLowerCase();

  const tier = (args["tier"] || "F2").toUpperCase();
  if (!["F1", "F2", "F3", "F4"].includes(tier)) {
    console.error("✗ --tier must be F1|F2|F3|F4");
    process.exit(2);
  }
  const cadenceBatches = parseInt(args["cadence-batches"] || "5", 10);
  if (!Number.isFinite(cadenceBatches) || cadenceBatches <= 0) {
    console.error("✗ --cadence-batches must be a positive integer");
    process.exit(2);
  }
  const website = args["website"] || `https://${domain}`;
  const country = args["country"] || null;

  // Verify the rep exists. We refuse to silently create a User —
  // EntityManager.userId must be real.
  const rep = await prisma.user.findUnique({
    where: { email: repEmail },
    select: { id: true, name: true, email: true },
  });
  if (!rep) {
    console.error(
      `✗ Primary rep ${repEmail} not found. Invite them via /settings/access-requests first.`,
    );
    process.exit(3);
  }

  // Brand upsert (natural key: name).
  const brand = await prisma.brand.upsert({
    where: { name: brandName },
    create: {
      name: brandName,
      website,
      country,
      pipelineStage: "LEAD",
      requiredFuzeTier: tier,
      icpCadenceEveryNBatches: cadenceBatches,
      brandSpecUpdatedAt: new Date(),
      salesRepId: rep.id,
      lastActivityAt: new Date(),
    },
    update: {
      // Only fill missing fields; don't trample existing data.
      website: undefined, // never overwrite an explicitly-set website
    },
  });

  // Ensure spec defaults are present when null. update-only path for
  // an existing brand that's missing one of the spec defaults.
  const specPatch: Record<string, any> = {};
  if (!brand.requiredFuzeTier) specPatch.requiredFuzeTier = tier;
  if (!brand.icpCadenceEveryNBatches) specPatch.icpCadenceEveryNBatches = cadenceBatches;
  if (!brand.salesRepId) specPatch.salesRepId = rep.id;
  if (!brand.country && country) specPatch.country = country;
  if (Object.keys(specPatch).length > 0) {
    specPatch.brandSpecUpdatedAt = new Date();
    await prisma.brand.update({
      where: { id: brand.id },
      data: specPatch,
    });
    console.log(
      `= Filled missing spec fields on existing brand "${brand.name}":`,
      Object.keys(specPatch).join(", "),
    );
  } else if (brand.createdAt && Date.now() - brand.createdAt.getTime() < 5_000) {
    console.log(`✓ Created brand "${brand.name}" with defaults tier=${tier}, cadence=${cadenceBatches} batches`);
  } else {
    console.log(`= Brand "${brand.name}" already in place — no changes`);
  }

  // EntityManager: (entityType, entityId, userId, role) is unique.
  // Idempotent upsert + ensure isPrimary=true for the named rep.
  const em = await prisma.entityManager.upsert({
    where: {
      entityType_entityId_userId_role: {
        entityType: "BRAND",
        entityId: brand.id,
        userId: rep.id,
        role: "ACCOUNT_MANAGER",
      },
    },
    create: {
      entityType: "BRAND",
      entityId: brand.id,
      userId: rep.id,
      role: "ACCOUNT_MANAGER",
      isPrimary: true,
    },
    update: { isPrimary: true },
  });

  // Clear any other isPrimary=true rows for this brand to keep the
  // primary AM unique (one true primary per entity).
  await prisma.entityManager.updateMany({
    where: {
      entityType: "BRAND",
      entityId: brand.id,
      role: "ACCOUNT_MANAGER",
      id: { not: em.id },
    },
    data: { isPrimary: false },
  });

  console.log(
    `✓ Primary AM: ${rep.name || rep.email} → ${brand.name} (EntityManager ${em.id})`,
  );
  console.log(`  Brand id: ${brand.id}`);
  console.log(`  Domain hint: ${domain} (saved on brand.website if not previously set)`);

  // If the brand has no website yet, stamp the inferred one (one-time fill).
  const final = await prisma.brand.findUnique({
    where: { id: brand.id },
    select: { website: true },
  });
  if (!final?.website && website) {
    await prisma.brand.update({ where: { id: brand.id }, data: { website } });
    console.log(`  ✓ Website filled: ${website}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("✗ Failed:", err?.message || err);
    await prisma.$disconnect();
    process.exit(4);
  });
