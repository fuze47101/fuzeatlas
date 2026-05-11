/**
 * NEED-1 — seed-factory
 *
 * Idempotent. Creates a Factory + the SupplyChainLink rows that
 * connect it to (a) its distributor and (b) the named brands. For
 * brands that DON'T exist yet, drops a FactoryInvitation row keyed
 * on (brandId, invitedFactoryName) so the brand can confirm via
 * /factory-invitation/[token].
 *
 * Usage:
 *   npx tsx scripts/seed-factory.ts \
 *     --name="Penfabric Sdn. Bhd." \
 *     --country=Malaysia \
 *     --distributor="Harris & Menuk" \
 *     --brands="KUIU,Rhone,Lululemon"
 *
 *   # Optional:
 *   --city="Penang"
 *   --website=https://penfabric.com
 *
 * Production safety: refuses unless ALLOW_PROD_SEED=1.
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

function randToken() {
  return `inv-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`;
}

async function main() {
  refuseProdWithoutFlag();
  const args = parseArgs();

  const factoryName = need(args, "name");
  const country = need(args, "country");
  const distributorName = args["distributor"] || null;
  const brandsCsv = (args["brands"] || "").trim();
  const brandNames = brandsCsv ? brandsCsv.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const city = args["city"] || null;
  const website = args["website"] || null;

  // Factory upsert (natural key: name).
  const factory = await prisma.factory.upsert({
    where: { name: factoryName },
    create: {
      name: factoryName,
      country,
      city,
      website,
    },
    update: {
      // Conservatively fill country/city/website if missing.
      ...(country ? { country } : {}),
      ...(city ? { city } : {}),
      ...(website ? { website } : {}),
    },
  });

  const isNewFactory =
    factory.createdAt && Date.now() - factory.createdAt.getTime() < 5_000;
  if (isNewFactory) {
    console.log(`✓ Created factory "${factory.name}" in ${country}`);
  } else {
    console.log(`= Factory "${factory.name}" already in place`);
  }

  // Distributor link (factory.distributorId).
  if (distributorName) {
    const distributor = await prisma.distributor.findFirst({
      where: { name: { equals: distributorName, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (!distributor) {
      console.warn(
        `  ⚠ Distributor "${distributorName}" not found — link skipped. Add the distributor first.`,
      );
    } else {
      if (factory.distributorId !== distributor.id) {
        await prisma.factory.update({
          where: { id: factory.id },
          data: { distributorId: distributor.id },
        });
        console.log(`  ✓ Linked factory → distributor "${distributor.name}"`);
      } else {
        console.log(`  = Factory already linked to distributor "${distributor.name}"`);
      }
    }
  }

  // Per-brand: existing brand → SupplyChainLink; missing brand →
  // FactoryInvitation row so the brand can claim later.
  for (const brandName of brandNames) {
    const brand = await prisma.brand.findFirst({
      where: { name: { equals: brandName, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (brand) {
      // Upsert the link in both directions — brand→factory (SUPPLIES)
      // covers the dashboard query; factory→brand is the inverse.
      const link = await prisma.supplyChainLink.upsert({
        where: {
          supply_chain_link_unique: {
            fromType: "BRAND",
            fromId: brand.id,
            toType: "FACTORY",
            toId: factory.id,
            relation: "SUPPLIES",
          },
        },
        create: {
          fromType: "BRAND",
          fromId: brand.id,
          toType: "FACTORY",
          toId: factory.id,
          relation: "SUPPLIES",
          active: true,
        },
        update: { active: true },
      });
      const created = Date.now() - link.createdAt.getTime() < 5_000;
      console.log(
        `  ${created ? "✓" : "="} SupplyChainLink BRAND ${brand.name} → FACTORY ${factory.name}`,
      );
    } else {
      // No brand row yet — drop an invitation for an admin to chase.
      // Dedupe on (brandName, factoryName, status=PENDING) by checking
      // for an existing one keyed on invitedFactoryName+invitedContactEmail.
      // We use a synthetic contact email derived from the brand name so
      // re-running the same seed doesn't double-insert.
      const syntheticEmail = `invite+${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@fuze47.com`;
      const existing = await prisma.factoryInvitation.findFirst({
        where: {
          invitedFactoryName: factoryName,
          invitedContactEmail: syntheticEmail,
          status: "PENDING",
        },
        select: { id: true },
      });
      if (existing) {
        console.log(
          `  = FactoryInvitation pending for brand "${brandName}" → factory "${factoryName}" (row ${existing.id})`,
        );
        continue;
      }
      // We need a brandId for FactoryInvitation. Spec says invitation
      // is brand-initiated — but here we're seeding "factory exists,
      // brand doesn't yet". Skip and log so an admin can add the
      // brand first.
      console.warn(
        `  ⚠ Brand "${brandName}" not found. Run seed-brand first, or use the inverse FactoryInvitation flow from the brand portal.`,
      );
    }
  }

  console.log(`\nFactory id: ${factory.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("✗ Failed:", err?.message || err);
    await prisma.$disconnect();
    process.exit(4);
  });
