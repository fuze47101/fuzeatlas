"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  HydrationFrame,
  useMountLog,
  loggedFetch,
} from "@/components/HydrationFrame";

/* ────────────────────────────────────────────────────────────────────────
 * /admin/dedupe — Entity de-duplication review dashboard.
 * Human-approved merges only. Every merge previews (dry-run) before commit.
 * ──────────────────────────────────────────────────────────────────────── */

type Member = {
  id: string;
  shortId: string;
  name: string;
  normalized: string;
  createdAt: string;
  salesRepId: string | null;
  pipelineStage: string | null;
  subtype: string | null;
  category: string | null;
  distributorId: string | null;
  totalLinked: number;
  counts: Record<string, number>;
};

type Cluster = {
  key: string;
  suggestedKeeperId: string;
  members: Member[];
};

type Collision = {
  key: string;
  suggestedFactoryId: string;
  brands: Member[];
  factories: Member[];
};

type ScanData = {
  generatedAt: string;
  brandClusters: Cluster[];
  factoryClusters: Cluster[];
  typeCollisions: Collision[];
  summary: {
    brandClusterCount: number;
    factoryClusterCount: number;
    typeCollisionCount: number;
    totalClusters: number;
  };
};

const TABS = [
  { id: "brands", label: "Brands" },
  { id: "factories", label: "Factories" },
  { id: "collisions", label: "Type Collisions" },
] as const;

function clickLog(what: string, extra?: any) {
  // eslint-disable-next-line no-console
  console.log("[CLICK]", new Date().toISOString(), what, extra ?? "");
  if (typeof window !== "undefined") {
    (window as any).__lastClick = { what, extra, ts: Date.now() };
  }
}

function fmtDate(d: string) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return d;
  }
}

function CountChips({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts || {}).filter(([, n]) => n > 0);
  if (!entries.length)
    return <span className="text-xs text-slate-400">no linked rows</span>;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([k, n]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
        >
          {k} <span className="text-slate-500">{n}</span>
        </span>
      ))}
    </div>
  );
}

function MoveReport({ result }: { result: any }) {
  if (!result) return null;
  if (!result.ok) {
    return (
      <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        <strong>Error:</strong> {result.error}
      </div>
    );
  }
  const moved = result.moved || {};
  const movedEntries = Object.entries(moved).filter(([, n]) => (n as number) > 0);
  return (
    <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm">
      <div className="font-semibold text-indigo-900">
        {result.dryRun ? "Preview (nothing written yet)" : "✓ Merge committed"}
      </div>
      {movedEntries.length ? (
        <ul className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
          {movedEntries.map(([k, n]) => (
            <li key={k} className="text-indigo-800">
              would move <strong>{n as number}</strong> {k}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-indigo-700">No child rows to move.</p>
      )}
      <p className="mt-1.5 text-xs text-indigo-700">
        {result.husksRemoved ?? 0} husk(s) will be removed ·{" "}
        {result.aliasesAdded ?? 0} alias(es) added ·{" "}
        {(result.scalarsFilled || []).length} keeper field(s) fill-null merged
        {(result.scalarsFilled || []).length
          ? ` (${result.scalarsFilled.join(", ")})`
          : ""}
      </p>
    </div>
  );
}

/* ── Same-type merge cluster card ────────────────────────────────────── */
function ClusterCard({
  entityType,
  cluster,
  onCommitted,
}: {
  entityType: "BRAND" | "FACTORY";
  cluster: Cluster;
  onCommitted: () => void;
}) {
  const [keeperId, setKeeperId] = useState(cluster.suggestedKeeperId);
  const [losers, setLosers] = useState<Set<string>>(
    () => new Set(cluster.members.filter((m) => m.id !== cluster.suggestedKeeperId).map((m) => m.id)),
  );
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Keeper can never be a loser.
  useEffect(() => {
    setLosers((prev) => {
      const next = new Set(prev);
      next.delete(keeperId);
      return next;
    });
    setPreview(null);
  }, [keeperId]);

  const toggleLoser = (id: string) => {
    setLosers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreview(null);
  };

  const loserIds = useMemo(() => Array.from(losers), [losers]);

  const call = useCallback(
    async (dryRun: boolean) => {
      setBusy(true);
      try {
        const r = await loggedFetch("/api/admin/dedupe/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, keeperId, loserIds, dryRun }),
        });
        const json = await r.json();
        // eslint-disable-next-line no-console
        console.log("[FETCH-RESULT]", "merge", { dryRun, ok: json.ok });
        if (dryRun) {
          setPreview(json);
        } else if (json.ok) {
          setDone(true);
          onCommitted();
        } else {
          setPreview(json);
        }
      } catch (e: any) {
        setPreview({ ok: false, error: e?.message || String(e) });
      } finally {
        setBusy(false);
      }
    },
    [entityType, keeperId, loserIds, onCommitted],
  );

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        ✓ Merged “{cluster.key}” — keeper kept, husks removed.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Cluster: <span className="text-slate-500">“{cluster.key}”</span>{" "}
          <span className="text-xs font-normal text-slate-400">
            {cluster.members.length} records
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cluster.members.map((m) => {
          const isKeeper = m.id === keeperId;
          const isLoser = losers.has(m.id);
          return (
            <div
              key={m.id}
              className={`rounded-md border p-3 ${
                isKeeper
                  ? "border-emerald-300 bg-emerald-50"
                  : isLoser
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-800">{m.name}</div>
                  <div className="text-[11px] text-slate-500">
                    id …{m.shortId} · {fmtDate(m.createdAt)} ·{" "}
                    {m.totalLinked} linked
                    {m.pipelineStage ? ` · ${m.pipelineStage}` : ""}
                    {m.subtype ? ` · ${m.subtype}` : ""}
                    {m.category ? ` · ${m.category}` : ""}
                  </div>
                </div>
                {m.id === cluster.suggestedKeeperId && (
                  <span className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    suggested
                  </span>
                )}
              </div>

              <CountChips counts={m.counts} />

              <div className="mt-3 flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`keeper-${cluster.key}-${cluster.members[0].id}`}
                    checked={isKeeper}
                    onChange={() => {
                      clickLog("set-keeper", m.id);
                      setKeeperId(m.id);
                    }}
                  />
                  <span className="font-medium text-emerald-700">Keep</span>
                </label>
                {!isKeeper && (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLoser}
                      onChange={() => {
                        clickLog("toggle-loser", m.id);
                        toggleLoser(m.id);
                      }}
                    />
                    <span className="text-amber-700">Merge into keeper</span>
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <MoveReport result={preview} />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={busy || loserIds.length === 0}
          onClick={() => {
            clickLog("preview-merge", { keeperId, loserIds });
            call(true);
          }}
          className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
        >
          {busy ? "…" : "Preview"}
        </button>
        <button
          type="button"
          disabled={busy || !preview?.ok || preview?.dryRun !== true || loserIds.length === 0}
          onClick={() => {
            clickLog("commit-merge", { keeperId, loserIds });
            call(false);
          }}
          className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
          title={
            preview?.ok && preview?.dryRun
              ? "Commit the merge"
              : "Preview first to enable"
          }
        >
          Merge
        </button>
        {loserIds.length === 0 && (
          <span className="text-xs text-slate-400">
            select at least one record to merge
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Type-collision reallocation card ────────────────────────────────── */
function CollisionCard({
  collision,
  onCommitted,
}: {
  collision: Collision;
  onCommitted: () => void;
}) {
  const [factoryId, setFactoryId] = useState(collision.suggestedFactoryId);
  const [results, setResults] = useState<Record<string, any>>({});
  const [busyBrand, setBusyBrand] = useState<string | null>(null);
  const [doneBrands, setDoneBrands] = useState<Set<string>>(new Set());

  const call = useCallback(
    async (brandId: string, dryRun: boolean) => {
      setBusyBrand(brandId);
      try {
        const r = await loggedFetch("/api/admin/dedupe/reallocate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId, factoryId, dryRun }),
        });
        const json = await r.json();
        // eslint-disable-next-line no-console
        console.log("[FETCH-RESULT]", "reallocate", { dryRun, ok: json.ok });
        setResults((prev) => ({ ...prev, [brandId]: json }));
        if (!dryRun && json.ok) {
          setDoneBrands((prev) => new Set(prev).add(brandId));
          onCommitted();
        }
      } catch (e: any) {
        setResults((prev) => ({ ...prev, [brandId]: { ok: false, error: e?.message } }));
      } finally {
        setBusyBrand(null);
      }
    },
    [factoryId, onCommitted],
  );

  return (
    <div className="rounded-lg border border-purple-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-800">
        Type collision:{" "}
        <span className="text-purple-600">“{collision.key}”</span>
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        A Brand and a Factory share this name. Choose the correct Factory to keep,
        then reallocate each mis-typed Brand’s contacts &amp; CRM notes into it.
        Brand-only rows (fabrics, pricing, engagement…) are flagged for your review,
        never guessed.
      </p>

      {/* Factory picker (correct type) */}
      <div className="mb-3 rounded-md border border-purple-100 bg-purple-50 p-3">
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700">
          Correct type — keep this Factory
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {collision.factories.map((f) => (
            <label
              key={f.id}
              className={`flex cursor-pointer items-start gap-2 rounded border p-2 ${
                factoryId === f.id
                  ? "border-purple-400 bg-white"
                  : "border-slate-200 bg-white/50"
              }`}
            >
              <input
                type="radio"
                name={`factory-${collision.key}`}
                checked={factoryId === f.id}
                onChange={() => {
                  clickLog("set-collision-factory", f.id);
                  setFactoryId(f.id);
                }}
              />
              <span>
                <span className="text-sm font-medium text-slate-800">
                  {f.name}
                </span>
                <span className="block text-[11px] text-slate-500">
                  Factory · id …{f.shortId} · {f.totalLinked} linked
                </span>
                <CountChips counts={f.counts} />
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Brand rows to reallocate */}
      <div className="space-y-3">
        {collision.brands.map((b) => {
          const res = results[b.id];
          const done = doneBrands.has(b.id);
          if (done) {
            return (
              <div
                key={b.id}
                className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                ✓ Reallocated Brand “{b.name}” into the Factory.
              </div>
            );
          }
          return (
            <div key={b.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {b.name}{" "}
                    <span className="text-[11px] font-normal text-amber-700">
                      (Brand — likely mis-typed)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    id …{b.shortId} · {fmtDate(b.createdAt)} · {b.totalLinked} linked
                  </div>
                  <CountChips counts={b.counts} />
                </div>
              </div>

              {res && res.ok && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs">
                    <div className="font-semibold text-emerald-800">
                      {res.dryRun ? "Would move automatically" : "Moved automatically"}
                    </div>
                    {Object.entries(res.moved || {}).length ? (
                      <ul className="mt-1 space-y-0.5 text-emerald-700">
                        {Object.entries(res.moved).map(([k, n]) => (
                          <li key={k}>
                            {n as number} {k}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-emerald-700">nothing</p>
                    )}
                    <p className="mt-1 text-[11px] text-emerald-700">
                      husk {res.huskRemoved ? "will be deleted (empty)" : "kept (flagged rows remain)"}
                    </p>
                  </div>
                  <div className="rounded border border-orange-200 bg-orange-50 p-2 text-xs">
                    <div className="font-semibold text-orange-800">
                      Needs your review ({res.flaggedTotal || 0})
                    </div>
                    {(res.needsReview || []).length ? (
                      <ul className="mt-1 space-y-0.5 text-orange-700">
                        {res.needsReview.map((n: any) => (
                          <li key={n.model}>
                            {n.model}.{n.field}: {n.count}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-orange-700">nothing — clean reallocation</p>
                    )}
                  </div>
                </div>
              )}
              {res && !res.ok && (
                <div className="mt-2 rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                  <strong>Error:</strong> {res.error}
                </div>
              )}

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busyBrand === b.id}
                  onClick={() => {
                    clickLog("preview-reallocate", { brandId: b.id, factoryId });
                    call(b.id, true);
                  }}
                  className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
                >
                  {busyBrand === b.id ? "…" : "Preview"}
                </button>
                <button
                  type="button"
                  disabled={busyBrand === b.id || !res?.ok || res?.dryRun !== true}
                  onClick={() => {
                    clickLog("commit-reallocate", { brandId: b.id, factoryId });
                    call(b.id, false);
                  }}
                  className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40"
                >
                  Reallocate
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
function DedupePage() {
  useMountLog("admin-dedupe");
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as string) || "brands";

  const [tab, setTab] = useState<string>(
    TABS.some((t) => t.id === initialTab) ? initialTab : "brands",
  );
  const [data, setData] = useState<ScanData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ADMIN gate (impersonation-safe gate also enforced server-side).
  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "ADMIN") router.replace("/home");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const r = await loggedFetch("/api/admin/dedupe/data", {
        cache: "no-store",
      });
      const json = await r.json();
      // eslint-disable-next-line no-console
      console.log("[FETCH-RESULT]", "dedupe-data", { ok: json.ok });
      if (!json.ok) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user?.role === "ADMIN") load();
  }, [loading, user, load]);

  if (loading || (!user && fetching)) {
    return <div className="p-8 text-sm text-slate-500">Loading…</div>;
  }
  if (user && user.role !== "ADMIN") {
    return <div className="p-8 text-sm text-slate-500">Redirecting…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Entity De-duplication
          </h1>
          <p className="text-sm text-slate-500">
            Find &amp; merge duplicate Brands and Factories — human-approved,
            dry-run-first, nothing auto-deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clickLog("rescan");
            load();
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ↻ Rescan
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const count =
            !data
              ? null
              : t.id === "brands"
                ? data.summary.brandClusterCount
                : t.id === "factories"
                  ? data.summary.factoryClusterCount
                  : data.summary.typeCollisionCount;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                clickLog("tab", t.id);
                setTab(t.id);
                router.replace(`/admin/dedupe?tab=${t.id}`);
              }}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === t.id
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
              {count != null && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}
      {fetching && (
        <div className="text-sm text-slate-500">Scanning for duplicates…</div>
      )}

      {!fetching && data && (
        <div className="space-y-4">
          {tab === "brands" &&
            (data.brandClusters.length ? (
              data.brandClusters.map((c, i) => (
                <ClusterCard
                  key={`b-${c.key}-${c.members[0].id}-${i}`}
                  entityType="BRAND"
                  cluster={c}
                  onCommitted={load}
                />
              ))
            ) : (
              <EmptyState label="No duplicate brand clusters found." />
            ))}

          {tab === "factories" &&
            (data.factoryClusters.length ? (
              data.factoryClusters.map((c, i) => (
                <ClusterCard
                  key={`f-${c.key}-${c.members[0].id}-${i}`}
                  entityType="FACTORY"
                  cluster={c}
                  onCommitted={load}
                />
              ))
            ) : (
              <EmptyState label="No duplicate factory clusters found." />
            ))}

          {tab === "collisions" &&
            (data.typeCollisions.length ? (
              data.typeCollisions.map((c, i) => (
                <CollisionCard
                  key={`c-${c.key}-${i}`}
                  collision={c}
                  onCommitted={load}
                />
              ))
            ) : (
              <EmptyState label="No Brand/Factory type collisions found." />
            ))}
        </div>
      )}

      {data && (
        <p className="mt-6 text-[11px] text-slate-400">
          Scan generated {fmtDate(data.generatedAt)} ·{" "}
          {data.summary.totalClusters} total cluster(s)
        </p>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

export default function AdminDedupePageOuter() {
  return (
    <HydrationFrame name="/admin/dedupe">
      <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading…</div>}>
        <DedupePage />
      </Suspense>
    </HydrationFrame>
  );
}
