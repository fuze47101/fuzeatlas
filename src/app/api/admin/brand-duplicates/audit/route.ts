// @ts-nocheck
/**
 * GET /api/admin/brand-duplicates/audit
 *
 * Finds Atlas Brand rows that look like duplicates of EACH OTHER.
 * Different from cross-table audit (which finds Brand colliding
 * with Factory/Distributor) — this is brand-vs-brand only.
 *
 * Three match types, ordered by confidence:
 *   1. EXACT_NAME — case-insensitive, trimmed equals → very high
 *   2. DOMAIN     — extracted website domain matches → very high
 *   3. NORMALIZED — name with Inc/LLC/Corp/Ltd/Group/punctuation/the
 *                   stripped → high but less certain
 *
 * Brands are grouped into "clusters" — if Spanx, Spanx Inc, and
 * Spanx LLC all collapse to the same normalized name, they're one
 * cluster of 3, not 3 separate pairs.
 *
 * Canonical recommendation: pick the brand in each cluster with
 * the most data attached (sum of contacts + notes + projects +
 * orders), tie-broken by oldest createdAt. Admin can override.
 *
 * Returns:
 *   {
 *     ok: true,
 *     totalBrands,
 *     clusterCount,
 *     duplicateBrandCount,   // sum of (cluster.size - 1) — would be deleted
 *     clusters: [
 *       {
 *         matchType: "EXACT_NAME" | "DOMAIN" | "NORMALIZED",
 *         matchKey: string,
 *         brands: [{
 *           id, name, website, hubspotId, hubspotImportedAt,
 *           pipelineStage, createdAt, contactCount, noteCount,
 *           projectCount, orderCount, isCanonical
 *         }]
 *       }
 *     ]
 *   }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const maxDuration = 120;

function extractDomain(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s.trim();
  if (!cleaned) return null;
  try {
    const url = cleaned.startsWith("http") ? cleaned : `https://${cleaned}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return cleaned.toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0] || null;
  }
}

/**
 * Aggressively normalize a brand name for fuzzy matching.
 * Strips:
 *   - Common corp suffixes (Inc, LLC, Corp, Corporation, Co, Ltd,
 *     Limited, Group, GmbH, S.A., S.p.A., etc.)
 *   - Punctuation
 *   - "The" prefix
 *   - Multiple whitespace → single space
 *   - Lowercased
 */
function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  let s = name.toLowerCase().trim();
  // Strip leading "the "
  s = s.replace(/^the\s+/i, "");
  // Strip common suffixes (handle order of removal carefully)
  const suffixes = [
    "incorporated",
    "corporation",
    "limited",
    "company",
    "holdings",
    "international",
    "global",
    "group",
    "inc",
    "llc",
    "ltd",
    "corp",
    "co",
    "gmbh",
    "s.a.",
    "s.p.a.",
    "spa",
    "ag",
    "kg",
    "bv",
    "nv",
    "plc",
    "pty",
    "lp",
    "lllp",
    "llp",
    "pbc",
    "pllc",
    "fzco",
    "fzc",
    "fz-llc",
    "free zone",
  ];
  // Multiple passes — "Spanx Inc Ltd" → strip Inc and Ltd
  for (let pass = 0; pass < 3; pass++) {
    for (const suf of suffixes) {
      const re = new RegExp(`[\\s,.]+${suf.replace(/\./g, "\\.")}\\b\\.?$`, "i");
      s = s.replace(re, "");
    }
  }
  // Strip remaining punctuation & collapse whitespace
  s = s.replace(/[.,;:'"!?()&\-_]/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Admin / employee only" },
        { status: 403 },
      );
    }

    // Pull every brand with the relation counts we'll use to score
    // canonicality. _count is cheap — Prisma adds it as subqueries.
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        name: true,
        website: true,
        hubspotId: true,
        hubspotImportedAt: true,
        pipelineStage: true,
        validationStatus: true,
        createdAt: true,
        _count: {
          select: {
            contacts: true,
            notes: true,
            projects: true,
            submissions: true,
            sows: true,
            invoices: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Build three indexes — for each match key, a list of brand ids
    // that share it.
    const byExactName = new Map<string, string[]>();
    const byDomain = new Map<string, string[]>();
    const byNormalized = new Map<string, string[]>();

    const brandById = new Map(brands.map((b) => [b.id, b]));

    for (const b of brands) {
      const exact = (b.name || "").toLowerCase().trim();
      if (exact) {
        if (!byExactName.has(exact)) byExactName.set(exact, []);
        byExactName.get(exact)!.push(b.id);
      }
      const dom = extractDomain(b.website);
      if (dom) {
        if (!byDomain.has(dom)) byDomain.set(dom, []);
        byDomain.get(dom)!.push(b.id);
      }
      const norm = normalizeName(b.name);
      if (norm && norm !== exact) {
        if (!byNormalized.has(norm)) byNormalized.set(norm, []);
        byNormalized.get(norm)!.push(b.id);
      }
    }

    // Build clusters — start with exact-name matches (highest
    // confidence). Then merge in domain and normalized matches that
    // would unite already-unrelated brands. We don't want to merge
    // distinct brands just because they share a domain hosted on a
    // shared platform — but two brands with same name AND same domain
    // are clearly the same.
    type Cluster = {
      matchType: "EXACT_NAME" | "DOMAIN" | "NORMALIZED";
      matchKey: string;
      brandIds: Set<string>;
    };
    const clusters: Cluster[] = [];
    const inCluster = new Map<string, number>(); // brandId → cluster index

    function addCluster(matchType: Cluster["matchType"], matchKey: string, ids: string[]) {
      if (ids.length < 2) return;
      // Are any of these brands already in a cluster? Merge into it.
      const existingClusterIdxs = Array.from(
        new Set(ids.map((id) => inCluster.get(id)).filter((v): v is number => v != null)),
      );
      if (existingClusterIdxs.length === 0) {
        // New cluster
        const cl: Cluster = { matchType, matchKey, brandIds: new Set(ids) };
        clusters.push(cl);
        const idx = clusters.length - 1;
        for (const id of ids) inCluster.set(id, idx);
      } else if (existingClusterIdxs.length === 1) {
        // Add to existing
        const idx = existingClusterIdxs[0];
        for (const id of ids) {
          clusters[idx].brandIds.add(id);
          inCluster.set(id, idx);
        }
      } else {
        // Multiple existing clusters share these brands — merge them
        const primary = existingClusterIdxs[0];
        for (let j = 1; j < existingClusterIdxs.length; j++) {
          const merge = existingClusterIdxs[j];
          for (const id of clusters[merge].brandIds) {
            clusters[primary].brandIds.add(id);
            inCluster.set(id, primary);
          }
          clusters[merge].brandIds.clear();
        }
        for (const id of ids) {
          clusters[primary].brandIds.add(id);
          inCluster.set(id, primary);
        }
      }
    }

    for (const [key, ids] of byExactName) {
      addCluster("EXACT_NAME", key, ids);
    }
    for (const [key, ids] of byDomain) {
      addCluster("DOMAIN", key, ids);
    }
    for (const [key, ids] of byNormalized) {
      addCluster("NORMALIZED", key, ids);
    }

    // Score canonical recommendation. Pick the brand with the most
    // attached data (sum of relations); tie-break by oldest
    // createdAt; final tie-break by id (stable).
    function scoreBrand(b: any): number {
      const c = b._count;
      return (
        (c?.contacts || 0) * 3 +
        (c?.notes || 0) * 2 +
        (c?.projects || 0) * 4 +
        (c?.submissions || 0) * 4 +
        (c?.sows || 0) * 5 +
        (c?.invoices || 0) * 5
      );
    }

    const out = clusters
      .filter((c) => c.brandIds.size >= 2)
      .map((cluster) => {
        const items = Array.from(cluster.brandIds)
          .map((id) => brandById.get(id))
          .filter(Boolean) as any[];
        // Rank
        items.sort((a, b) => {
          const sa = scoreBrand(a);
          const sb = scoreBrand(b);
          if (sb !== sa) return sb - sa;
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          if (ta !== tb) return ta - tb;
          return a.id.localeCompare(b.id);
        });
        const canonicalId = items[0].id;
        return {
          matchType: cluster.matchType,
          matchKey: cluster.matchKey,
          brands: items.map((b) => ({
            id: b.id,
            name: b.name,
            website: b.website,
            hubspotId: b.hubspotId,
            hubspotImportedAt: b.hubspotImportedAt,
            pipelineStage: b.pipelineStage,
            validationStatus: b.validationStatus,
            createdAt: b.createdAt,
            contactCount: b._count.contacts,
            noteCount: b._count.notes,
            projectCount: b._count.projects,
            submissionCount: b._count.submissions,
            sowCount: b._count.sows,
            invoiceCount: b._count.invoices,
            score: scoreBrand(b),
            isCanonical: b.id === canonicalId,
          })),
        };
      })
      // Sort clusters: highest-confidence match types first, then
      // size desc (bigger clusters = more dupes)
      .sort((a, b) => {
        const order: Record<string, number> = { EXACT_NAME: 0, DOMAIN: 1, NORMALIZED: 2 };
        const oa = order[a.matchType] ?? 99;
        const ob = order[b.matchType] ?? 99;
        if (oa !== ob) return oa - ob;
        return b.brands.length - a.brands.length;
      });

    const duplicateBrandCount = out.reduce((sum, c) => sum + (c.brands.length - 1), 0);

    return NextResponse.json({
      ok: true,
      totalBrands: brands.length,
      clusterCount: out.length,
      duplicateBrandCount,
      clusters: out,
    });
  } catch (e: any) {
    console.error("[brand-duplicates.audit] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
