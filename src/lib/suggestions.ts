/**
 * src/lib/suggestions.ts — BONUS-3 brand-detail "next moves" panel.
 *
 * Runs lightweight cross-table checks against a Brand and returns
 * actionable suggestions for the AM. Pure read-only; no writes.
 *
 * Dismissed suggestions ride a 7-day cooldown via a Note row
 * stamped on the brand with category="suggestion_dismissed". We
 * don't add a separate UserDismissal table for this — Note is the
 * existing audit trail and we get free history.
 *
 * Each suggestion has a stable `id` so the same check can be
 * dismissed without dismissing future variations.
 */
import { prisma } from "@/lib/prisma";

export type SuggestionSeverity = "info" | "warn" | "urgent";

export interface BrandSuggestion {
  /** Stable identifier — used for dismiss cooldown. */
  id: string;
  severity: SuggestionSeverity;
  /** One-line headline. */
  title: string;
  /** Optional second line with detail. */
  body?: string;
  /** Optional deep-link to act on this. */
  href?: string;
  /** Optional CTA label for the deep-link. */
  cta?: string;
}

const ICONS_BY_SEVERITY: Record<SuggestionSeverity, string> = {
  info: "ℹ️",
  warn: "⚠️",
  urgent: "🚨",
};

const DISMISS_COOLDOWN_MS = 7 * 86400_000;
const DISMISS_NOTE_PREFIX = "[suggestion-dismiss]";

function daysSince(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400_000);
}

/**
 * Pull recent dismissal note rows for this brand so we can filter
 * suggested-next-moves before returning them.
 */
async function loadDismissedSuggestionIds(brandId: string): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - DISMISS_COOLDOWN_MS);
  const notes = await prisma.note
    .findMany({
      where: {
        brandId,
        createdAt: { gte: cutoff },
        content: { startsWith: DISMISS_NOTE_PREFIX },
      },
      select: { content: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    .catch(() => []);
  const ids = new Set<string>();
  for (const n of notes) {
    // Content shape: "[suggestion-dismiss] <suggestionId> <reason?>"
    const match = n.content?.match(/^\[suggestion-dismiss\]\s+(\S+)/);
    if (match) ids.add(match[1]);
  }
  return ids;
}

/**
 * Compute the suggested-next-moves list for a brand.
 *
 * Checks (each gated by what data we actually have):
 *   - stale-activity: lastActivityAt > 14d
 *   - icp-cadence-overdue: any factory in supply chain past its
 *     brand-stipulated batch count without a recent ICP
 *   - factory-no-recent-order: any factory with no FuzeOrder in 90d
 *   - tier-mismatch: a recent FabricSubmission with a different
 *     targetFuzeTier than the brand's requiredFuzeTier
 *   - missing-spec: brand has no requiredFuzeTier set
 *   - no-supply-chain: brand has zero SupplyChainLink factories
 *
 * Returns at most N suggestions, ordered urgent → warn → info.
 */
export async function computeBrandSuggestions(brandId: string, take = 6): Promise<BrandSuggestion[]> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      lastActivityAt: true,
      requiredFuzeTier: true,
      icpCadenceEveryNBatches: true,
      protocolDocUrl: true,
    },
  });
  if (!brand) return [];

  const out: BrandSuggestion[] = [];

  // ── stale-activity ──────────────────────────────────────────────
  const daysSinceActivity = daysSince(brand.lastActivityAt);
  if (daysSinceActivity != null && daysSinceActivity >= 14) {
    out.push({
      id: "stale-activity",
      severity: daysSinceActivity >= 30 ? "warn" : "info",
      title: `Last activity ${daysSinceActivity} days ago`,
      body:
        daysSinceActivity >= 30
          ? `${brand.name} has been quiet for ${daysSinceActivity} days. Schedule a check-in or move to ARCHIVE if dormant.`
          : `Quiet for ${daysSinceActivity} days — a short check-in keeps the relationship warm.`,
      href: `/admin/brand-pipeline?brandId=${brand.id}`,
      cta: "Log activity →",
    });
  }

  // ── missing-spec ────────────────────────────────────────────────
  if (!brand.requiredFuzeTier) {
    out.push({
      id: "missing-spec",
      severity: "warn",
      title: "No FUZE spec set",
      body:
        "Without a required tier, factories can ship anything. Set the tier so the order-validation check has teeth.",
      href: `/brand-portal/spec`,
      cta: "Set spec →",
    });
  }

  // ── no-supply-chain ─────────────────────────────────────────────
  const supplyLinks = await prisma.supplyChainLink
    .count({
      where: {
        fromType: "BRAND",
        fromId: brand.id,
        toType: "FACTORY",
        active: true,
      },
    })
    .catch(() => 0);
  if (supplyLinks === 0) {
    out.push({
      id: "no-supply-chain",
      severity: "info",
      title: "No factory linked",
      body: "Link at least one factory to start tracking spec compliance.",
      href: `/brand-portal/supply-chain`,
      cta: "Open supply chain →",
    });
  }

  // ── factory-no-recent-order (last 90d) ──────────────────────────
  if (supplyLinks > 0) {
    const since90 = new Date(Date.now() - 90 * 86400_000);
    const linkedFactoryIds = await prisma.supplyChainLink.findMany({
      where: {
        fromType: "BRAND",
        fromId: brand.id,
        toType: "FACTORY",
        active: true,
      },
      select: { toId: true },
    });
    const factoryIds = linkedFactoryIds.map((l) => l.toId);
    if (factoryIds.length > 0) {
      const recentOrderFactoryIds = await prisma.fuzeOrder
        .findMany({
          where: {
            factoryId: { in: factoryIds },
            shippedDate: { gte: since90 },
          },
          select: { factoryId: true },
          distinct: ["factoryId"],
        })
        .catch(() => []);
      const recentSet = new Set(recentOrderFactoryIds.map((o: any) => o.factoryId));
      const stale = factoryIds.filter((id) => !recentSet.has(id));
      if (stale.length > 0) {
        const staleFactories = await prisma.factory.findMany({
          where: { id: { in: stale } },
          select: { id: true, name: true },
          take: 1,
        });
        const first = staleFactories[0];
        out.push({
          id: `factory-no-recent-order:${first?.id || "any"}`,
          severity: stale.length >= 2 ? "warn" : "info",
          title:
            stale.length === 1
              ? `${first?.name || "A linked factory"} hasn't reordered in 90d`
              : `${stale.length} linked factories haven't reordered in 90d`,
          body: "Could be inventory still on hand — or a quiet relationship. Ping the AM at each factory.",
          href: `/brand-portal/supply-chain`,
          cta: "Check supply chain →",
        });
      }
    }
  }

  // ── tier-mismatch on recent submission ──────────────────────────
  if (brand.requiredFuzeTier) {
    const since30 = new Date(Date.now() - 30 * 86400_000);
    const mismatched = await prisma.fabricSubmission
      .findFirst({
        where: {
          brandId: brand.id,
          createdAt: { gte: since30 },
          fabric: {
            targetFuzeTier: { not: brand.requiredFuzeTier },
          },
        },
        select: {
          id: true,
          fabric: { select: { id: true, targetFuzeTier: true } },
          factory: { select: { id: true, name: true } },
        },
      })
      .catch(() => null);
    if (mismatched && mismatched.fabric?.targetFuzeTier) {
      out.push({
        id: `tier-mismatch:${mismatched.id}`,
        severity: "urgent",
        title: `Tier mismatch on recent submission`,
        body: `${mismatched.factory?.name || "A factory"} submitted at ${mismatched.fabric.targetFuzeTier} but ${brand.name}'s spec requires ${brand.requiredFuzeTier}. Flag with the factory.`,
        href: `/fabrics/${mismatched.fabric.id}`,
        cta: "Open fabric →",
      });
    }
  }

  // ── icp-cadence-overdue ─────────────────────────────────────────
  if (brand.icpCadenceEveryNBatches && supplyLinks > 0) {
    // Cheap heuristic — look for factories with FuzeOrders >= cadence
    // since their last brand-visible ICP TestRun. Computing the exact
    // count is what /api/cron/test-cadence already does; here we just
    // surface "look at the supply chain dashboard" when at least one
    // factory looks behind.
    const since60 = new Date(Date.now() - 60 * 86400_000);
    const recentOrders = await prisma.fuzeOrder
      .findMany({
        where: {
          brandId: brand.id,
          orderType: "PRODUCTION",
          createdAt: { gte: since60 },
        },
        select: { factoryId: true },
        distinct: ["factoryId"],
      })
      .catch(() => []);
    if (recentOrders.length > 0) {
      out.push({
        id: "icp-cadence-check",
        severity: "info",
        title: "Review ICP cadence",
        body: `${recentOrders.length} factor${recentOrders.length === 1 ? "y has" : "ies have"} ordered in the last 60 days. Confirm ICP cadence is being met for each.`,
        href: `/brand-portal/supply-chain`,
        cta: "Open supply chain →",
      });
    }
  }

  // Filter out dismissed ones.
  const dismissed = await loadDismissedSuggestionIds(brand.id);
  const filtered = out.filter((s) => !dismissed.has(s.id));

  // Sort: urgent → warn → info, stable within tier.
  const rank: Record<SuggestionSeverity, number> = { urgent: 0, warn: 1, info: 2 };
  filtered.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return filtered.slice(0, take);
}

export function suggestionIcon(severity: SuggestionSeverity): string {
  return ICONS_BY_SEVERITY[severity] || "ℹ️";
}

export const SUGGESTION_DISMISS_NOTE_PREFIX = DISMISS_NOTE_PREFIX;
