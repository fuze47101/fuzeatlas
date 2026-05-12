/**
 * src/lib/seed-factory.ts — callable form of the NEED-1 seed-factory CLI.
 *
 * Same shape as seed-brand.ts: the CLI script lives at
 * `scripts/seed-factory.ts` and human runs go through there, but the
 * runtime bulk-import wizard at `/admin/import/factories` needs to
 * call the upsert dance from inside the Vercel runtime, so we factor
 * the logic here. CLI imports this module.
 */
import type { PrismaClient } from "@prisma/client";

export interface SeedFactoryInput {
  /** Factory display name. Natural key — upsert is keyed on this. */
  name: string;
  /** Country. Required (no fallback). */
  country: string;
  /** Optional distributor name to link the factory under. */
  distributor?: string | null;
  /** Optional comma-separated brand names to link via SupplyChainLink. */
  brands?: string[];
  /** Optional city. */
  city?: string | null;
  /** Optional website. */
  website?: string | null;
}

export interface SeedFactoryResult {
  factoryId: string;
  factoryName: string;
  /** "created" if the Factory row was new; "noop" if it already existed. */
  outcome: "created" | "filled" | "noop";
  filledFields: string[];
  distributorLinked: string | null;
  distributorSkipped: string | null;
  brandsLinked: string[];
  brandsMissing: string[];
}

export class SeedFactoryError extends Error {
  code: "MISSING_ARG";
  constructor(code: SeedFactoryError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export async function seedFactory(
  prisma: PrismaClient,
  input: SeedFactoryInput,
): Promise<SeedFactoryResult> {
  const name = (input.name || "").trim();
  const country = (input.country || "").trim();
  if (!name) throw new SeedFactoryError("MISSING_ARG", "name is required");
  if (!country) throw new SeedFactoryError("MISSING_ARG", "country is required");

  const distributorName = input.distributor?.trim() || null;
  const brandNames = (input.brands || []).map((b) => b.trim()).filter(Boolean);
  const city = input.city?.trim() || null;
  const website = input.website?.trim() || null;

  // Factory.name is NOT marked @unique in the schema (multiple rows
  // with the same name can exist — they're disambiguated by city +
  // country at the data-entry level). So we can't use prisma.upsert
  // by name. Pre-flight findFirst, then create-or-update by id.
  const preExisting = await prisma.factory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, country: true, city: true, website: true, distributorId: true },
  });

  const factory = preExisting
    ? await prisma.factory.update({
        where: { id: preExisting.id },
        data: {
          ...(country && !preExisting.country ? { country } : {}),
          ...(city && !preExisting.city ? { city } : {}),
          ...(website && !preExisting.website ? { website } : {}),
        },
      })
    : await prisma.factory.create({
        data: {
          name,
          country,
          city,
          website,
        },
      });

  const filledFields: string[] = [];
  if (preExisting) {
    if (!preExisting.country && country) filledFields.push("country");
    if (!preExisting.city && city) filledFields.push("city");
    if (!preExisting.website && website) filledFields.push("website");
  }

  let distributorLinked: string | null = null;
  let distributorSkipped: string | null = null;
  if (distributorName) {
    const distributor = await prisma.distributor.findFirst({
      where: { name: { equals: distributorName, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (!distributor) {
      distributorSkipped = distributorName;
    } else if (factory.distributorId !== distributor.id) {
      await prisma.factory.update({
        where: { id: factory.id },
        data: { distributorId: distributor.id },
      });
      distributorLinked = distributor.name;
    } else {
      distributorLinked = distributor.name;
    }
  }

  const brandsLinked: string[] = [];
  const brandsMissing: string[] = [];
  for (const brandName of brandNames) {
    const brand = await prisma.brand.findFirst({
      where: { name: { equals: brandName, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (!brand) {
      brandsMissing.push(brandName);
      continue;
    }
    await prisma.supplyChainLink.upsert({
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
    brandsLinked.push(brand.name);
  }

  return {
    factoryId: factory.id,
    factoryName: factory.name,
    outcome: !preExisting
      ? "created"
      : filledFields.length > 0
        ? "filled"
        : "noop",
    filledFields,
    distributorLinked,
    distributorSkipped,
    brandsLinked,
    brandsMissing,
  };
}
