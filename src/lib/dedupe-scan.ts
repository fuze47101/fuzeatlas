// @ts-nocheck
/**
 * Entity de-duplication — read-only diagnostic scan.
 *
 * Finds candidate duplicate Brands / Factories and type-collisions (a Brand
 * whose name matches a Factory — the "Welspun is really a mill" case). NEVER
 * mutates anything. Powers both `GET /api/cron/diag-duplicates` (bearer) and
 * the `/admin/dedupe` dashboard data endpoint.
 */
import { prisma } from "@/lib/prisma";
import { batchCountRefs } from "@/lib/dedupe-refs";

// Legal / industry suffix words stripped before matching so
// "Welspun Textiles Ltd" and "Welspun" collapse to the same key.
const SUFFIXES = new Set([
  "inc",
  "llc",
  "ltd",
  "co",
  "corp",
  "group",
  "holdings",
  "textile",
  "textiles",
  "mills",
  "mill",
  "industries",
  "international",
  "apparel",
  "fabrics",
]);

/**
 * Normalize a name for matching: lowercase, strip punctuation, collapse
 * whitespace, drop trailing legal/industry suffix words. Keeps the raw name
 * available separately (caller retains it).
 */
export function normalizeName(raw: string): string {
  if (!raw) return "";
  const cleaned = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ") // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.split(" ").filter(Boolean);
  const kept = tokens.filter((t) => !SUFFIXES.has(t));
  // If suffix-stripping removed everything (e.g. a factory literally named
  // "Textiles"), fall back to the un-stripped token list so we don't cluster
  // every empty-key record together.
  const finalTokens = kept.length ? kept : tokens;
  return finalTokens.join(" ");
}

/** Bounded Levenshtein — returns the true distance, but bails early once it
 * provably exceeds `max` (returns max + 1). Keeps the O(n²) cluster pass fast. */
export function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const al = a.length;
  const bl = b.length;
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

const LEV_THRESHOLD = 2;
// Fuzzy (Levenshtein) matching is only meaningful for longer names. On short
// normalized names a distance of ≤2 is nearly universal ("ABLE"~"AREA"~"AYM"),
// which produced huge false-positive clusters. Short names must match EXACTLY
// (already handled by the normalized-key grouping); only names this long or
// longer are eligible for the fuzzy pass.
const MIN_FUZZY_LEN = 6;

interface RawRecord {
  id: string;
  name: string;
  norm: string;
  createdAt: Date;
  salesRepId: string | null;
  // brand-specific
  pipelineStage?: string | null;
  subtype?: string | null;
  // factory-specific
  category?: string | null;
  distributorId?: string | null;
}

/** Union-find cluster over records: same normalized key OR Levenshtein ≤ 2.
 * Blocked by first character of the normalized name to keep the fuzzy pass
 * from being a full O(n²) sweep across thousands of rows. */
function clusterRecords(records: RawRecord[]): RawRecord[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    // path-compress
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const r of records) parent.set(r.id, r.id);

  // Exact normalized-key grouping (cheap).
  const byNorm = new Map<string, RawRecord[]>();
  for (const r of records) {
    if (!r.norm) continue;
    if (!byNorm.has(r.norm)) byNorm.set(r.norm, []);
    byNorm.get(r.norm)!.push(r);
  }
  for (const group of byNorm.values()) {
    for (let i = 1; i < group.length; i++) union(group[0].id, group[i].id);
  }

  // Fuzzy pass within first-character blocks.
  const byFirst = new Map<string, RawRecord[]>();
  for (const r of records) {
    if (!r.norm) continue;
    const k = r.norm[0];
    if (!byFirst.has(k)) byFirst.set(k, []);
    byFirst.get(k)!.push(r);
  }
  for (const block of byFirst.values()) {
    for (let i = 0; i < block.length; i++) {
      for (let j = i + 1; j < block.length; j++) {
        const a = block[i].norm;
        const b = block[j].norm;
        // Short names: exact-only (the normalized-key pass already grouped them).
        if (a.length < MIN_FUZZY_LEN || b.length < MIN_FUZZY_LEN) continue;
        if (find(block[i].id) === find(block[j].id)) continue; // already joined
        if (levenshtein(a, b, LEV_THRESHOLD) <= LEV_THRESHOLD) {
          union(block[i].id, block[j].id);
        }
      }
    }
  }

  const groups = new Map<string, RawRecord[]>();
  for (const r of records) {
    const root = find(r.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(r);
  }
  return Array.from(groups.values()).filter((g) => g.length >= 2);
}

function decorate(
  r: RawRecord,
  counts: Map<string, { total: number; byModel: Record<string, number> }>,
) {
  const c = counts.get(r.id) || { total: 0, byModel: {} };
  return {
    id: r.id,
    shortId: r.id.slice(-6),
    name: r.name,
    normalized: r.norm,
    createdAt: r.createdAt,
    salesRepId: r.salesRepId,
    pipelineStage: r.pipelineStage ?? null,
    subtype: r.subtype ?? null,
    category: r.category ?? null,
    distributorId: r.distributorId ?? null,
    totalLinked: c.total,
    counts: c.byModel,
  };
}

/** Suggested keeper: most total linked rows, tiebreak oldest createdAt. */
function suggestKeeper(members: any[]): string {
  let best = members[0];
  for (const m of members) {
    if (
      m.totalLinked > best.totalLinked ||
      (m.totalLinked === best.totalLinked &&
        new Date(m.createdAt).getTime() < new Date(best.createdAt).getTime())
    ) {
      best = m;
    }
  }
  return best.id;
}

export interface DedupeScanResult {
  generatedAt: string;
  brandClusters: any[];
  factoryClusters: any[];
  typeCollisions: any[];
  summary: {
    brandClusterCount: number;
    factoryClusterCount: number;
    typeCollisionCount: number;
    totalClusters: number;
  };
}

export async function scanDuplicates(): Promise<DedupeScanResult> {
  const [brands, factories] = await Promise.all([
    prisma.brand.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        salesRepId: true,
        pipelineStage: true,
        subtype: true,
      },
    }),
    prisma.factory.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        salesRepId: true,
        category: true,
        distributorId: true,
      },
    }),
  ]);

  const brandRecs: RawRecord[] = brands.map((b) => ({
    ...b,
    norm: normalizeName(b.name),
  }));
  const factoryRecs: RawRecord[] = factories.map((f) => ({
    ...f,
    norm: normalizeName(f.name),
  }));

  // ── Cluster (cheap, in-memory) ────────────────────────────────────
  const brandGroups = clusterRecords(brandRecs);
  const factoryGroups = clusterRecords(factoryRecs);

  // Cross-type collision candidates: normalized Brand name == Factory name.
  const factoryByNorm = new Map<string, RawRecord[]>();
  for (const f of factoryRecs) {
    if (!f.norm) continue;
    if (!factoryByNorm.has(f.norm)) factoryByNorm.set(f.norm, []);
    factoryByNorm.get(f.norm)!.push(f);
  }
  const brandByNorm = new Map<string, RawRecord[]>();
  for (const b of brandRecs) {
    if (!b.norm) continue;
    if (!brandByNorm.has(b.norm)) brandByNorm.set(b.norm, []);
    brandByNorm.get(b.norm)!.push(b);
  }
  const collisionPairs: { norm: string; bs: RawRecord[]; fs: RawRecord[] }[] = [];
  for (const [norm, bs] of brandByNorm.entries()) {
    const fs = factoryByNorm.get(norm);
    if (fs && fs.length) collisionPairs.push({ norm, bs, fs });
  }

  // ── Batch-count ALL candidates in one pass per type (avoids per-record
  // round-trips that time out over the remote DB proxy). ────────────────
  const brandCandidateIds = new Set<string>();
  for (const g of brandGroups) for (const r of g) brandCandidateIds.add(r.id);
  for (const p of collisionPairs) for (const r of p.bs) brandCandidateIds.add(r.id);
  const factoryCandidateIds = new Set<string>();
  for (const g of factoryGroups) for (const r of g) factoryCandidateIds.add(r.id);
  for (const p of collisionPairs) for (const r of p.fs) factoryCandidateIds.add(r.id);

  const [brandCounts, factoryCounts] = await Promise.all([
    batchCountRefs(prisma, "BRAND", Array.from(brandCandidateIds)),
    batchCountRefs(prisma, "FACTORY", Array.from(factoryCandidateIds)),
  ]);

  // ── Build clusters ────────────────────────────────────────────────
  const brandClusters = brandGroups.map((g) => {
    const members = g.map((r) => decorate(r, brandCounts));
    members.sort((a, b) => b.totalLinked - a.totalLinked);
    return {
      key: members[0].normalized,
      suggestedKeeperId: suggestKeeper(members),
      members,
    };
  });

  const factoryClusters = factoryGroups.map((g) => {
    const members = g.map((r) => decorate(r, factoryCounts));
    members.sort((a, b) => b.totalLinked - a.totalLinked);
    return {
      key: members[0].normalized,
      suggestedKeeperId: suggestKeeper(members),
      members,
    };
  });

  const typeCollisions = collisionPairs.map(({ norm, bs, fs }) => {
    const brandMembers = bs.map((r) => decorate(r, brandCounts));
    const factoryMembers = fs.map((r) => decorate(r, factoryCounts));
    // Suggested resolution: keep the Factory with the most linked data and
    // reallocate the Brand(s) into it (spec §4 — the Welspun case).
    let bestFactory = factoryMembers[0];
    for (const fm of factoryMembers)
      if (fm.totalLinked > bestFactory.totalLinked) bestFactory = fm;
    return {
      key: norm,
      suggestedFactoryId: bestFactory.id,
      brands: brandMembers,
      factories: factoryMembers,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    brandClusters,
    factoryClusters,
    typeCollisions,
    summary: {
      brandClusterCount: brandClusters.length,
      factoryClusterCount: factoryClusters.length,
      typeCollisionCount: typeCollisions.length,
      totalClusters:
        brandClusters.length + factoryClusters.length + typeCollisions.length,
    },
  };
}
