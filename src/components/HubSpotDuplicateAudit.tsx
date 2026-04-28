// @ts-nocheck
"use client";

/**
 * Duplicate audit panel for the HubSpot import page. Shows every
 * Brand row imported from HubSpot whose name/website matches an
 * existing Factory or Distributor, and offers a one-click "Merge
 * into Factory/Distributor" action per duplicate.
 *
 * Drops in below the CSV import UI so Andrew can spot-check the
 * import after the fact — especially useful when the import ran
 * before the cross-table check was deployed (or before
 * Factory/Distributor had hubspotId columns and the stamp failed
 * silently).
 */

import { useEffect, useState } from "react";

type Match = {
  kind: "factory" | "distributor";
  id: string;
  name: string;
  via: "name" | "domain";
  hubspotIdAlreadyStamped: string | null;
};

type Duplicate = {
  brandId: string;
  brandName: string;
  brandWebsite: string | null;
  hubspotId: string | null;
  hubspotImportedAt: string;
  contactCount: number;
  matches: Match[];
};

export default function HubSpotDuplicateAudit() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    totalImported: number;
    duplicateCount: number;
    duplicates: Duplicate[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergedIds, setMergedIds] = useState<Set<string>>(new Set());
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
      const res = await fetch("/api/admin/hubspot-import/audit-duplicates");
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Audit failed");
        setData(null);
      } else {
        setData(json);
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Bulk-merge every duplicate whose only/best match is a Factory.
   * Distributor matches are skipped — we already filter known-bad
   * legacy distributor names server-side, but bulk-merging into
   * distributors should still be a per-row decision since
   * distributors are a smaller, more strategic set than factories.
   *
   * Walks duplicates serially to keep DB load low and so a single
   * failure doesn't tank the whole batch.
   */
  async function bulkMergeFactoryMatches() {
    if (!data) return;
    const eligible = data.duplicates.filter(
      (d) => !mergedIds.has(d.brandId) && d.matches.some((m) => m.kind === "factory"),
    );
    if (eligible.length === 0) {
      alert("No unmerged duplicates with a factory match.");
      return;
    }
    if (
      !confirm(
        `Merge ${eligible.length} duplicate brand(s) into their matching factories?\n\n` +
          `For each duplicate, we'll pick the first factory match (preferring 'name' match over 'domain'),\n` +
          `move any contacts onto the factory, stamp hubspotId on the factory, and delete the duplicate brand.\n\n` +
          `This walks one row at a time. You'll see progress as it goes.\n\n` +
          `Cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkRunning(true);
    setBulkProgress({ processed: 0, total: eligible.length, succeeded: 0, failed: 0, failures: [] });
    const newMerged = new Set(mergedIds);
    const failures: Array<{ name: string; error: string }> = [];
    let succeeded = 0;
    let failed = 0;
    for (const dup of eligible) {
      // Prefer name match over domain match
      const factoryMatches = dup.matches.filter((m) => m.kind === "factory");
      const target =
        factoryMatches.find((m) => m.via === "name") || factoryMatches[0];
      try {
        const res = await fetch("/api/admin/hubspot-import/merge-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId: dup.brandId,
            targetKind: target.kind,
            targetId: target.id,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          failed++;
          failures.push({ name: dup.brandName, error: json.error || `HTTP ${res.status}` });
        } else {
          succeeded++;
          newMerged.add(dup.brandId);
        }
      } catch (e: any) {
        failed++;
        failures.push({ name: dup.brandName, error: e?.message || "network error" });
      }
      setMergedIds(new Set(newMerged));
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

  async function mergeDuplicate(
    dup: Duplicate,
    target: Match,
  ) {
    if (
      !confirm(
        `Merge "${dup.brandName}" into ${target.kind} "${target.name}"?\n\n` +
          `This will:\n` +
          ` • Move ${dup.contactCount} contact(s) onto the ${target.kind}\n` +
          ` • Stamp hubspotId ${dup.hubspotId} on the ${target.kind}\n` +
          ` • DELETE the duplicate brand row\n\n` +
          `Cannot be undone.`,
      )
    ) {
      return;
    }
    setMergingId(dup.brandId);
    try {
      const res = await fetch("/api/admin/hubspot-import/merge-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: dup.brandId,
          targetKind: target.kind,
          targetId: target.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(`Merge failed: ${json.error || res.status}`);
      } else {
        setMergedIds((prev) => new Set([...prev, dup.brandId]));
      }
    } catch (e: any) {
      alert(`Merge failed: ${e?.message || "network error"}`);
    } finally {
      setMergingId(null);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            Cross-table duplicate audit
          </h2>
          <p className="text-sm text-slate-600 mt-0.5 max-w-2xl">
            Finds Brand rows imported from HubSpot whose name or domain
            matches an existing Factory or Distributor. If the importer
            ran before the cross-table check was deployed (or before
            the schema migration), some companies that should have
            been stamps on Factory/Distributor may have landed as
            duplicate Brand rows.
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
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-slate-50 rounded p-3 border border-slate-200">
              <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">
                Brands imported from HubSpot
              </p>
              <p className="text-2xl font-black tabular-nums text-slate-900">
                {data.totalImported.toLocaleString()}
              </p>
            </div>
            <div
              className={`rounded p-3 border ${
                data.duplicateCount > 0
                  ? "bg-rose-50 border-rose-200"
                  : "bg-emerald-50 border-emerald-200"
              }`}
            >
              <p
                className={`text-[10px] uppercase tracking-wide font-bold ${
                  data.duplicateCount > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                Cross-table duplicates found
              </p>
              <p
                className={`text-2xl font-black tabular-nums ${
                  data.duplicateCount > 0 ? "text-rose-900" : "text-emerald-900"
                }`}
              >
                {data.duplicateCount.toLocaleString()}
              </p>
            </div>
          </div>

          {data.duplicateCount === 0 ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800">
              ✓ No duplicates. Every HubSpot-imported Brand has a unique
              name + domain among Atlas factories and distributors. Safe
              to proceed with the contacts import.
            </div>
          ) : (
            <div>
              {(() => {
                const remainingFactoryMatches = data.duplicates.filter(
                  (d) =>
                    !mergedIds.has(d.brandId) &&
                    d.matches.some((m) => m.kind === "factory"),
                ).length;
                return remainingFactoryMatches > 0 ? (
                  <div className="mb-3 p-3 bg-purple-50 border border-purple-300 rounded">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm text-purple-900">
                        <strong>{remainingFactoryMatches}</strong> duplicate(s) match a Factory.
                        Bulk-merge them all in one click.
                      </p>
                      <button
                        onClick={bulkMergeFactoryMatches}
                        disabled={bulkRunning}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                      >
                        {bulkRunning
                          ? `⏳ Merging ${bulkProgress?.processed || 0}/${bulkProgress?.total || 0}…`
                          : `Merge all ${remainingFactoryMatches} factory matches`}
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
                              {bulkProgress.failures.length} failures (click to expand)
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
                  </div>
                ) : null;
              })()}

              <p className="text-xs text-slate-600 mb-2">
                Click the matching Factory or Distributor to merge the
                duplicate brand into it. Contacts move with the merge,
                hubspotId gets stamped on the target so re-runs don't
                re-create the duplicate.
              </p>
              <div className="space-y-2 max-h-[600px] overflow-auto">
                {data.duplicates.map((dup) => {
                  const isMerged = mergedIds.has(dup.brandId);
                  const isMerging = mergingId === dup.brandId;
                  return (
                    <div
                      key={dup.brandId}
                      className={`rounded border p-3 ${
                        isMerged
                          ? "bg-emerald-50 border-emerald-200 opacity-60"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-baseline justify-between mb-2 gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {dup.brandName}
                            {isMerged && (
                              <span className="ml-2 text-[10px] uppercase font-bold text-emerald-700">
                                ✓ merged
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {dup.brandWebsite || "(no website)"} ·{" "}
                            {dup.contactCount} contact{dup.contactCount === 1 ? "" : "s"}
                            {dup.hubspotId && (
                              <span className="ml-2 font-mono text-[10px] bg-slate-100 px-1 rounded">
                                hubspot:{dup.hubspotId.slice(0, 12)}…
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {!isMerged && (
                        <div className="flex flex-wrap gap-2">
                          {dup.matches.map((m, i) => (
                            <button
                              key={i}
                              onClick={() => mergeDuplicate(dup, m)}
                              disabled={isMerging}
                              className={`text-xs px-3 py-1.5 rounded font-bold border transition ${
                                m.kind === "factory"
                                  ? "bg-purple-50 border-purple-300 text-purple-900 hover:bg-purple-100"
                                  : "bg-orange-50 border-orange-300 text-orange-900 hover:bg-orange-100"
                              } disabled:opacity-50`}
                              title={`Merge into ${m.kind} "${m.name}" matched via ${m.via}`}
                            >
                              {isMerging
                                ? "⏳ Merging…"
                                : `Merge → ${m.kind}: ${m.name} (${m.via})`}
                              {m.hubspotIdAlreadyStamped && (
                                <span className="ml-1 text-[10px] opacity-70">
                                  · already has hubspotId
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
