/**
 * src/lib/spec-acks.ts — NEED-6 helpers for the brand-spec
 * acknowledgement loop.
 *
 * Pending model: a (brandId, factoryId) pair is "ack pending" when
 * there's a SupplyChainLink between them AND either:
 *   - no BrandSpecAcknowledgement row exists for that pair, OR
 *   - the latest ack's specVersion < brand.brandSpecUpdatedAt.
 *
 * We don't denormalize a flag — the join is cheap and the truth
 * stays a single comparison between Brand.brandSpecUpdatedAt and
 * the latest ack row.
 */
import { prisma } from "@/lib/prisma";

export interface PendingAck {
  brandId: string;
  brandName: string;
  specVersion: Date; // brand.brandSpecUpdatedAt
  requiredFuzeTier: string | null;
  icpCadenceEveryNBatches: number | null;
  icpCadenceEveryLitersConsumed: number | null;
  protocolDocUrl: string | null;
  lastAcknowledgedAt: Date | null;
  lastAcknowledgedVersion: Date | null;
}

/**
 * Returns one entry per brand that supplies this factory and has a
 * newer spec version than the factory's most-recent ack (if any).
 *
 * Drives the /factory-portal banner + the spec ack page.
 */
export async function listPendingAcksForFactory(factoryId: string): Promise<PendingAck[]> {
  const links = await prisma.supplyChainLink.findMany({
    where: {
      toType: "FACTORY",
      toId: factoryId,
      fromType: "BRAND",
      relation: "SUPPLIES",
      active: true,
    },
    select: { fromId: true },
  });
  if (links.length === 0) return [];

  const brandIds = Array.from(new Set(links.map((l) => l.fromId)));
  const brands = await prisma.brand.findMany({
    where: { id: { in: brandIds } },
    select: {
      id: true,
      name: true,
      brandSpecUpdatedAt: true,
      requiredFuzeTier: true,
      icpCadenceEveryNBatches: true,
      icpCadenceEveryLitersConsumed: true,
      protocolDocUrl: true,
    },
  });

  // Latest ack per (brand, factory). One query, group in memory.
  let acks: any[] = [];
  try {
    acks = await prisma.brandSpecAcknowledgement.findMany({
      where: {
        factoryId,
        brandId: { in: brandIds },
      },
      orderBy: { specVersion: "desc" },
      select: {
        brandId: true,
        specVersion: true,
        acknowledgedAt: true,
      },
    });
  } catch {
    // Table may not be provisioned yet (pre-migration).
  }
  const latestByBrand = new Map<string, { specVersion: Date; acknowledgedAt: Date }>();
  for (const a of acks) {
    const existing = latestByBrand.get(a.brandId);
    if (!existing || a.specVersion > existing.specVersion) {
      latestByBrand.set(a.brandId, {
        specVersion: a.specVersion,
        acknowledgedAt: a.acknowledgedAt,
      });
    }
  }

  const pending: PendingAck[] = [];
  for (const b of brands) {
    // No spec yet → nothing to ack.
    if (!b.brandSpecUpdatedAt) continue;
    const ack = latestByBrand.get(b.id);
    if (!ack || ack.specVersion < b.brandSpecUpdatedAt) {
      pending.push({
        brandId: b.id,
        brandName: b.name,
        specVersion: b.brandSpecUpdatedAt,
        requiredFuzeTier: b.requiredFuzeTier,
        icpCadenceEveryNBatches: b.icpCadenceEveryNBatches,
        icpCadenceEveryLitersConsumed: b.icpCadenceEveryLitersConsumed,
        protocolDocUrl: b.protocolDocUrl,
        lastAcknowledgedAt: ack?.acknowledgedAt || null,
        lastAcknowledgedVersion: ack?.specVersion || null,
      });
    }
  }
  return pending;
}

/**
 * Stamp a new BrandSpecAcknowledgement row for this (brand, factory,
 * user). Writes the snapshot of the four spec fields at ack time
 * for the audit trail.
 *
 * Caller is responsible for the notify fan-out — see
 * `notifySpecAcknowledged` in src/lib/notify.ts.
 */
export async function acknowledgeSpec(input: {
  brandId: string;
  factoryId: string;
  userId: string;
}): Promise<{ acknowledged: boolean; id?: string; specVersion?: Date; error?: string }> {
  const brand = await prisma.brand.findUnique({
    where: { id: input.brandId },
    select: {
      id: true,
      name: true,
      brandSpecUpdatedAt: true,
      requiredFuzeTier: true,
      icpCadenceEveryNBatches: true,
      icpCadenceEveryLitersConsumed: true,
      protocolDocUrl: true,
    },
  });
  if (!brand) return { acknowledged: false, error: "Brand not found" };
  if (!brand.brandSpecUpdatedAt) {
    return { acknowledged: false, error: "Brand has no spec to acknowledge" };
  }

  // Confirm there's an active SupplyChainLink — refuse to ack a spec
  // for a brand this factory doesn't supply.
  const link = await prisma.supplyChainLink.findFirst({
    where: {
      fromType: "BRAND",
      fromId: input.brandId,
      toType: "FACTORY",
      toId: input.factoryId,
      relation: "SUPPLIES",
      active: true,
    },
    select: { id: true },
  });
  if (!link) {
    return { acknowledged: false, error: "Factory does not supply this brand" };
  }

  let row: any;
  try {
    row = await prisma.brandSpecAcknowledgement.create({
      data: {
        brandId: input.brandId,
        factoryId: input.factoryId,
        specVersion: brand.brandSpecUpdatedAt,
        acknowledgedByUserId: input.userId,
        acknowledgedTier: brand.requiredFuzeTier,
        acknowledgedCadenceBatches: brand.icpCadenceEveryNBatches,
        acknowledgedCadenceLiters: brand.icpCadenceEveryLitersConsumed,
        acknowledgedProtocolDocUrl: brand.protocolDocUrl,
      },
    });
  } catch (e: any) {
    return {
      acknowledged: false,
      error: e?.message?.includes("BrandSpecAcknowledgement")
        ? "BrandSpecAcknowledgement table not yet provisioned. Run /api/cron/migrate-spec-ack."
        : e?.message || "Failed to write acknowledgement",
    };
  }

  return { acknowledged: true, id: row.id, specVersion: row.specVersion };
}
