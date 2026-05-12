/**
 * src/lib/seed-brand.ts — callable form of the NEED-1 seed-brand CLI.
 *
 * The CLI script `scripts/seed-brand.ts` is the canonical entry point
 * for humans on a terminal. This module factors the same upsert dance
 * into a function so the bearer-authed verification endpoint at
 * `/api/cron/seed-brand-smoke` can exercise it inside the Vercel
 * runtime (where shelling out to `tsx scripts/seed-brand.ts` isn't an
 * option). Same idempotent semantics either way.
 */
import type { PrismaClient } from "@prisma/client";

export interface SeedBrandInput {
  /** Brand display name. Natural key — upsert is keyed on this. */
  name: string;
  /** Email domain hint (used for website if no explicit website given). */
  domain: string;
  /** Email of the primary account manager. Must exist as a User. */
  repEmail: string;
  /** Optional tier (F1|F2|F3|F4). Defaults F2. */
  tier?: "F1" | "F2" | "F3" | "F4";
  /** Optional ICP cadence (positive integer). Defaults 5. */
  cadenceBatches?: number;
  /** Optional ISO 3166 country name. */
  country?: string | null;
  /** Optional explicit website (overrides domain inference). */
  website?: string | null;
}

export interface SeedBrandResult {
  brandId: string;
  brandName: string;
  /** "created" | "filled" | "noop" — what the upsert did this run. */
  outcome: "created" | "filled" | "noop";
  /** Which spec fields we filled on an existing brand (may be empty). */
  filledFields: string[];
  entityManagerId: string;
  primaryRepUserId: string;
  websiteFilled: string | null;
}

export class SeedBrandError extends Error {
  code: "MISSING_ARG" | "REP_NOT_FOUND" | "BAD_TIER" | "BAD_CADENCE";
  constructor(code: SeedBrandError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

const ALLOWED_TIERS = new Set(["F1", "F2", "F3", "F4"]);

/**
 * Idempotent seed of a Brand + EntityManager(ACCOUNT_MANAGER, isPrimary).
 *
 * Same guarantees as the CLI:
 *   - Brand upsert keyed on `name` (natural key).
 *   - Spec defaults (requiredFuzeTier, icpCadenceEveryNBatches, salesRepId,
 *     country) are only filled when missing — never trample existing values.
 *   - EntityManager upsert keyed on (entityType, entityId, userId, role).
 *   - Other primary rows for the same (brand, ACCOUNT_MANAGER) get
 *     isPrimary cleared so there's exactly one true primary AM.
 *   - User must already exist; we refuse to silently create one.
 */
export async function seedBrand(
  prisma: PrismaClient,
  input: SeedBrandInput,
): Promise<SeedBrandResult> {
  const name = (input.name || "").trim();
  const domain = (input.domain || "").trim().toLowerCase();
  const repEmail = (input.repEmail || "").trim().toLowerCase();

  if (!name) throw new SeedBrandError("MISSING_ARG", "name is required");
  if (!domain) throw new SeedBrandError("MISSING_ARG", "domain is required");
  if (!repEmail) throw new SeedBrandError("MISSING_ARG", "repEmail is required");

  const tier = (input.tier || "F2").toUpperCase() as "F1" | "F2" | "F3" | "F4";
  if (!ALLOWED_TIERS.has(tier)) {
    throw new SeedBrandError("BAD_TIER", "tier must be F1|F2|F3|F4");
  }
  const cadenceBatches = input.cadenceBatches ?? 5;
  if (!Number.isFinite(cadenceBatches) || cadenceBatches <= 0) {
    throw new SeedBrandError("BAD_CADENCE", "cadenceBatches must be positive integer");
  }
  const website = input.website || `https://${domain}`;
  // Brand has no country column in the canonical schema. We accept the
  // arg for forward-compatibility but ignore it on persist for now.

  const rep = await prisma.user.findUnique({
    where: { email: repEmail },
    select: { id: true, name: true, email: true },
  });
  if (!rep) {
    throw new SeedBrandError(
      "REP_NOT_FOUND",
      `Primary rep ${repEmail} not found. Invite them via /settings/access-requests first.`,
    );
  }

  // Pre-flight check so the outcome classifier doesn't rely on a
  // 5-second freshness heuristic — that broke seed-brand-smoke when
  // run 2 fired within a second of run 1 (both said "created" because
  // the Brand was 1s old from run 1's POV). Querying first is one
  // extra round-trip but gives us a reliable "preexisted" flag.
  const preExisting = await prisma.brand.findUnique({
    where: { name },
    select: { id: true },
  });

  const brand = await prisma.brand.upsert({
    where: { name },
    create: {
      name,
      website,
      pipelineStage: "LEAD",
      requiredFuzeTier: tier,
      icpCadenceEveryNBatches: cadenceBatches,
      brandSpecUpdatedAt: new Date(),
      salesRepId: rep.id,
      lastActivityAt: new Date(),
    },
    update: {},
  });

  const isFreshCreate = !preExisting;

  const specPatch: Record<string, any> = {};
  if (!brand.requiredFuzeTier) specPatch.requiredFuzeTier = tier;
  if (!brand.icpCadenceEveryNBatches) specPatch.icpCadenceEveryNBatches = cadenceBatches;
  if (!brand.salesRepId) specPatch.salesRepId = rep.id;
  if (Object.keys(specPatch).length > 0) {
    specPatch.brandSpecUpdatedAt = new Date();
    await prisma.brand.update({ where: { id: brand.id }, data: specPatch });
  }

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

  await prisma.entityManager.updateMany({
    where: {
      entityType: "BRAND",
      entityId: brand.id,
      role: "ACCOUNT_MANAGER",
      id: { not: em.id },
    },
    data: { isPrimary: false },
  });

  let websiteFilled: string | null = null;
  if (!brand.website && website) {
    await prisma.brand.update({ where: { id: brand.id }, data: { website } });
    websiteFilled = website;
  }

  return {
    brandId: brand.id,
    brandName: brand.name,
    outcome: isFreshCreate
      ? "created"
      : Object.keys(specPatch).length > 0
        ? "filled"
        : "noop",
    filledFields: Object.keys(specPatch).filter((k) => k !== "brandSpecUpdatedAt"),
    entityManagerId: em.id,
    primaryRepUserId: rep.id,
    websiteFilled,
  };
}
