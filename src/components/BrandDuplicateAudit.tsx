// @ts-nocheck
"use client";

/**
 * Brand-to-brand duplicate audit panel.
 * Drops below the cross-table audit on /admin/hubspot-import.
 *
 * Different problem from cross-table:
 *   cross-table = Brand row colliding with a Factory or Distributor
 *   brand-to-brand = Brand row colliding with ANOTHER brand row
 *
 * Three match types in the audit response:
 *   EXACT_NAME (highest confidence) — admin can bulk-merge safely
 *   DOMAIN     (high confidence)    — admin can bulk-merge safely
 *   NORMALIZED (high but fuzzier)   — admin should review per-cluster
 *
 * Bulk-merge button only operates on EXACT_NAME + DOMAIN clusters of
 * size 2. NORMALIZED + larger clusters need the admin to confirm
 * which brand to keep as canonical.
 */

import { useState } from "react";

type Brand = {
  id: string;
  name: string;
  website: string | null;
  hubspotId: string | null;
  hubspotImportedAt: string | null;
  pipelineStage: string;
  validationStatus: string | null;
  createdAt: string;
  contactCount: number;
  noteCount: number;
  projectCount: number;
  submissionCount: number;
  sowCount: number;
  invoiceCount: number;
  score: number;
  isCanonical: boolean;
};

type Cluster = {
  matchType: "EXACT_NAME" | "DOMAIN" | "NORMALIZED";
  matchKey: string;
  brands: Brand[];
};

type AuditData = {
  totalBrands: number;
  clusterCount: number;
  duplicateBrandCount: number;
  clusters: Cluster[];
};

const SAMPLE_CAP = 8;

export default function BrandDuplicateAudit() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergingPair, setMergingPair] = useState<string | null>(null);
  const [mergedClusterIds, setMergedClusterIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    processed: number;
    total: number;
    succeeded: number;
    failed: number;
    failures: Array<{ name: string; error: string }>;
  } | null>(null);

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/brand-duplicates/audit");
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Audit failed");
        setData(null);
      } else {
        setData(json);
        setMergedClusterIds(new Set());
        setBulkProgress(null);
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function mergeBrand(keepId: string, mergeId: string, keepName: string, mergeName: string) {
    if (
      !confirm(
        `Merge "${mergeName}" into "${keepName}"?\n\n` +
          `This will:\n` +
          ` • Move all contacts, notes, projects, submissions, orders, etc. from\n` +
          `   "${mergeName}" onto "${keepName}"\n` +
          ` • Copy any missing scalar fields (website, hubspotId, etc.) over\n` +
          ` • DELETE the "${mergeName}" brand row\n\n` +
          `Cannot be undone.`,
      )
    ) {
      return false;
    }
    setMergingPair(`${keepId}:${mergeId}`);
    try {
      const res = await fetch("/api/admin/brand-duplicates/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepBrandId: keepId, mergeBrandId: mergeId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(`Merge failed: ${json.error || res.status}`);
        return false;
      }
      return true;
    } catch (e: any) {
      alert(`Merge failed: ${e?.message || "network error"}`);
      return false;
    } finally {
      setMergingPair(null);
    }
  }

  async function mergeCluster(cluster: Cluster) {
    // Walk every non-canonical brand and merge into the canonical
    const canonical = cluster.brands.find((b) => b.isCanonical) || cluster.brands[0];
    let allOk = true;
    for (const b of cluster.brands) {
      if (b.id === canonical.id) continue;
      const ok = await mergeBrand(canonical.id, b.id, canonical.name, b.name);
      if (!ok) {
        allOk = false;
        break;
      }
    }
    if (allOk) {
      const next = new Set(mergedClusterIds);
      next.add(clusterKey(cluster));
      setMergedClusterIds(next);
    }
  }

  /**
   * Bulk-merge every EXACT_NAME + DOMAIN cluster of size 2 (high
   * confidence + simple pair). Skips clusters of 3+ since those
   * deserve a human eye, and skips NORMALIZED clusters since the
   * fuzzy matcher might be wrong.
   */
  async function bulkMergeSafePairs() {
    if (!data) return;
    const eligible = data.clusters.filter(
      (c) =>
        !mergedClusterIds.has(clusterKey(c)) &&
        c.brands.length === 2 &&
        (c.matchType === "EXACT_NAME" || c.matchType === "DOMAIN"),
    );
    if (eligible.length === 0) {
      alert("No safe-to-bulk-merge pairs left.");
      return;
    }
    if (
      !confirm(
        `Bulk-merge ${eligible.length} brand pair(s)?\n\n` +
          `Only EXACT_NAME + DOMAIN matches of size 2 are processed —\n` +
          `NORMALIZED matches and clusters of 3+ are left for manual review.\n\n` +
          `For each pair, the brand with more attached data is kept and the\n` +
          `other is merged into it. Cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkRunning(true);
    setBulkProgress({
      processed: 0,
      total: eligible.length,
      succeeded: 0,
      failed: 0,
      failures: [],
    });
    let succeeded = 0;
    let failed = 0;
    const failures: Array<{ name: string; error: string }> = [];
    const newMerged = new Set(mergedClusterIds);

    for (const cluster of eligible) {
      const canonical = cluster.brands.find((b) => b.isCanonical) || cluster.brands[0];
      const dup = cluster.brands.find((b) => b.id !== canonical.id);
      if (!dup) continue;
      try {
        const res = await fetch("/api/admin/brand-duplicates/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keepBrandId: canonical.id,
            mergeBrandId: dup.id,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          failed++;
          failures.push({
            name: `${dup.name} → ${canonical.name}`,
            error: json.error || `HTTP ${res.status}`,
          });
        } else {
          succeeded++;
          newMerged.add(clusterKey(cluster));
        }
      } catch (e: any) {
        failed++;
        failures.push({
          name: `${dup.name} → ${canonical.name}`,
          error: e?.message || "network",
        });
      }
      setMergedClusterIds(new Set(newMerged));
      setBulkProgress({
        processed: succeeded + failed,
        total: eligible.length,
        succeeded,
        failed,
        failures: [...failures],
      });
    }
    setBulkRunning(false);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            Brand-to-brand duplicate audit
          </h2>
          <p className="text-sm text-slate-600 mt-0.5 max-w-2xl">
            Finds Atlas Brand rows that are duplicates of other Atlas
            Brand rows. Catches HubSpot imports that didn't auto-merge
            into pre-existing Atlas brands (because of slight name
            differences or domain mismatches), plus stale duplicates
            from pre-HubSpot data.
          </p>
        </div>
        <button
          onClick={runAudit}
          disabled={loading}
          className="px-4 py-2 text-sm font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "⏳ Scanning…" : "Run audit"}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <div className="mt-3">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Tile label="Total brands in Atlas" value={data.totalBrands} tone="slate" />
            <Tile label="Duplicate clusters" value={data.clusterCount} tone="amber" />
            <Tile
              label="Brands that would be merged away"
              value={data.duplicateBrandCount}
              tone="rose"
            />
          </div>

          {data.clusterCount === 0 ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800">
              ✓ No brand-to-brand duplicates. Every Atlas Brand row has a
              unique name + domain. Nothing to merge.
            </div>
          ) : (
            <>
              {(() => {
                const safePairs = data.clusters.filter(
                  (c) =>
                    !mergedClusterIds.has(clusterKey(c)) &&
                    c.brands.length === 2 &&
                    (c.matchType === "EXACT_NAME" || c.matchType === "DOMAIN"),
                ).length;
                return safePairs > 0 ? (
                  <div className="mb-3 p-3 bg-purple-50 border border-purple-300 rounded">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm text-purple-900">
                        <strong>{safePairs}</strong> high-confidence pairs
                        (EXACT_NAME or DOMAIN, size 2). Bulk-merge with the
                        canonical-pick auto-selected.
                      </p>
                      <button
                        onClick={bulkMergeSafePairs}
                        disabled={bulkRunning}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                      >
                        {bulkRunning
                          ? `⏳ Merging ${bulkProgress?.processed || 0}/${bulkProgress?.total || 0}…`
                          : `Merge all ${safePairs} safe pairs`}
                      </button>
                    </div>
                    {bulkProgress && (bulkRunning || bulkProgress.processed > 0) && (
                      <div className="mt-2 text-xs text-purple-800 space-y-1">
                        <div className="flex justify-between">
                          <span>
                            ✓ {bulkProgress.succeeded} merged
                            {bulkProgress.failed > 0 ? ` · ✗ ${bulkProgress.failed} failed` : ""}
                          </span>
                          <span>
                            {bulkProgress.processed} / {bulkProgress.total}
                          </span>
                        </div>
                        <div className="w-full bg-white rounded h-1.5 overflow-hidden border border-purple-200">
                          <div
                            className="bg-purple-500 h-full transition-all"
                            style={{
                              width: `${
                                bulkProgress.total > 0
                                  ? (bulkProgress.processed / bulkProgress.total) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        {bulkProgress.failures.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer font-semibold">
                              {bulkProgress.failures.length} failures
                            </summary>
                            <ul className="mt-1 max-h-32 overflow-auto bg-white rounded p-1.5 border border-purple-200">
                              {bulkProgress.failures.map((f, i) => (
                                <li key={i} className="truncate">
                                  <strong>{f.name}:</strong> {f.error}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-purple-700 mt-2">
                      NORMALIZED matches + clusters of 3+ are left for
                      manual review below — they need a human eye to pick
                      canonical.
                    </p>
                  </div>
                ) : null;
              })()}

              <div className="space-y-2 max-h-[700px] overflow-auto">
                {data.clusters.map((cluster, idx) => {
                  const isMerged = mergedClusterIds.has(clusterKey(cluster));
                  const isMergingThis =
                    mergingPair !== null &&
                    cluster.brands.some((b) => mergingPair.includes(b.id));
                  return (
                    <div
                      key={`${cluster.matchType}:${idx}`}
                      className={`rounded border p-3 ${
                        isMerged
                          ? "bg-emerald-50 border-emerald-200 opacity-60"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs">
                          <MatchTypeBadge type={cluster.matchType} />
                          <span className="font-mono text-slate-500 truncate max-w-[400px]">
                            {cluster.matchKey}
                          </span>
                          {cluster.brands.length > 2 && (
                            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              cluster of {cluster.brands.length}
                            </span>
                          )}
                          {isMerged && (
                            <span className="text-[10px] uppercase font-bold text-emerald-700">
                              ✓ merged
                            </span>
                          )}
                        </div>
                        {!isMerged && cluster.brands.length === 2 && (
                          <button
                            onClick={() => mergeCluster(cluster)}
                            disabled={isMergingThis || bulkRunning}
                            className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-900 text-white rounded font-bold disabled:opacity-50"
                          >
                            {isMergingThis ? "⏳ Merging…" : "Auto-merge pair"}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {cluster.brands.map((b) => (
                          <BrandCard
                            key={b.id}
                            brand={b}
                            cluster={cluster}
                            isMerged={isMerged}
                            isMergingThis={isMergingThis || bulkRunning}
                            onMerge={async (keepId, mergeId) => {
                              const ok = await mergeBrand(
                                keepId,
                                mergeId,
                                cluster.brands.find((x) => x.id === keepId)!.name,
                                cluster.brands.find((x) => x.id === mergeId)!.name,
                              );
                              if (ok) {
                                const next = new Set(mergedClusterIds);
                                next.add(clusterKey(cluster));
                                setMergedClusterIds(next);
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function clusterKey(c: Cluster): string {
  return `${c.matchType}:${c.matchKey}:${c.brands.map((b) => b.id).sort().join(",")}`;
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "amber" | "rose";
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : tone === "rose"
        ? "bg-rose-50 border-rose-200 text-rose-900"
        : "bg-slate-50 border-slate-200 text-slate-900";
  return (
    <div className={`rounded p-3 border ${cls}`}>
      <p className="text-[10px] uppercase tracking-wide font-bold opacity-70">{label}</p>
      <p className="text-2xl font-black tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function MatchTypeBadge({ type }: { type: string }) {
  const cls =
    type === "EXACT_NAME"
      ? "bg-emerald-100 text-emerald-800"
      : type === "DOMAIN"
        ? "bg-cyan-100 text-cyan-800"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${cls}`}>
      {type}
    </span>
  );
}

function BrandCard({
  brand,
  cluster,
  isMerged,
  isMergingThis,
  onMerge,
}: {
  brand: Brand;
  cluster: Cluster;
  isMerged: boolean;
  isMergingThis: boolean;
  onMerge: (keepId: string, mergeId: string) => void;
}) {
  const otherBrands = cluster.brands.filter((b) => b.id !== brand.id);
  return (
    <div
      className={`rounded border p-2 text-xs ${
        brand.isCanonical
          ? "bg-purple-50 border-purple-300"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="font-bold text-slate-900 truncate">
          {brand.name}
          {brand.isCanonical && (
            <span className="ml-1.5 text-[9px] uppercase font-bold bg-purple-200 text-purple-900 px-1 rounded">
              canonical
            </span>
          )}
        </p>
      </div>
      <p className="text-slate-500 truncate text-[11px]">
        {brand.website || "(no website)"}
      </p>
      <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
        <Stat label="contacts" value={brand.contactCount} />
        <Stat label="notes" value={brand.noteCount} />
        <Stat label="projects" value={brand.projectCount} />
        <Stat label="submissions" value={brand.submissionCount} />
        <Stat label="sows" value={brand.sowCount} />
        <Stat label="invoices" value={brand.invoiceCount} />
      </div>
      <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-2 flex-wrap">
        <span>stage: {brand.pipelineStage}</span>
        {brand.hubspotId && (
          <span className="font-mono bg-slate-100 px-1 rounded">
            hubspot:{brand.hubspotId.slice(0, 10)}…
          </span>
        )}
        <span>created {new Date(brand.createdAt).toLocaleDateString()}</span>
      </div>
      {!isMerged && !brand.isCanonical && otherBrands.length === 1 && (
        <button
          onClick={() => onMerge(otherBrands[0].id, brand.id)}
          disabled={isMergingThis}
          className="mt-2 w-full text-xs px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-900 rounded font-bold disabled:opacity-50"
        >
          {isMergingThis ? "⏳…" : `Merge this into "${otherBrands[0].name}" →`}
        </button>
      )}
      {!isMerged && brand.isCanonical && otherBrands.length > 1 && (
        <p className="mt-2 text-[10px] text-purple-700">
          Will receive everything from {otherBrands.length} other brands when
          you click Auto-merge above.
        </p>
      )}
      {!isMerged && !brand.isCanonical && otherBrands.length > 1 && (
        <button
          onClick={() => {
            const canonical = cluster.brands.find((b) => b.isCanonical);
            if (canonical) onMerge(canonical.id, brand.id);
          }}
          disabled={isMergingThis}
          className="mt-2 w-full text-xs px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-900 rounded font-bold disabled:opacity-50"
        >
          {isMergingThis ? "⏳…" : `Merge this into canonical →`}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-100 rounded px-1 py-0.5">
      <p className="text-[8px] uppercase font-bold text-slate-400 truncate">{label}</p>
      <p className="text-xs font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
