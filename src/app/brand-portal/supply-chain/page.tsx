"use client";

/**
 * Brand Supply Chain dashboard.
 *
 * Built May 2026 as the missing piece behind Andrew's email to Joseph
 * at KUIU: "you get visibility over all factories in your supply chain
 * that are supplying fabrics. Each time they submit for testing to our
 * lab you are notified of the submission and the results for approval
 * QA and oversight." The notifications shipped earlier this week; this
 * is the page Joseph opens to see the rollup.
 *
 * No edit affordances yet — pure read-only dashboard. Edit/approval
 * surfaces (per-fabric approve/reject, set ICP cadence) come in
 * subsequent commits as separate tasks (#39 and #40 on the roadmap).
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface FactoryRow {
  factoryId: string;
  factoryName: string;
  country: string | null;
  city: string | null;
  fabricCount: number;
  submissionCount: number;
  lastSubmissionAt: string | null;
  testRunsTotal: number;
  testRunsPassed: number;
  openTestRequests: number;
  lastTestRun: {
    id: string;
    testDate: string | null;
    testType: string | null;
    passed: boolean;
    brandVisible: boolean | null;
  } | null;
  consumptionLitersTotal: number;
  lastConsumptionAt: string | null;
  lastConsumptionTier: string | null;
}

interface Totals {
  factories: number;
  fabrics: number;
  submissions: number;
  testsTotal: number;
  testsPassed: number;
  openTestRequests: number;
  consumptionLitersTotal: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatLiters(n: number): string {
  if (!n) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k L`;
  if (n >= 100) return `${Math.round(n)} L`;
  return `${n.toFixed(1)} L`;
}

function StatusBadge({ row }: { row: FactoryRow }) {
  if (row.openTestRequests > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
        🟡 {row.openTestRequests} open
      </span>
    );
  }
  if (row.testRunsTotal === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
        No tests yet
      </span>
    );
  }
  const passRate = row.testRunsTotal > 0 ? row.testRunsPassed / row.testRunsTotal : 0;
  if (passRate >= 0.9) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        ✓ {Math.round(passRate * 100)}% pass
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300">
      {Math.round(passRate * 100)}% pass
    </span>
  );
}

export default function BrandSupplyChainPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<
    | {
        id: string;
        name: string;
        requiredFuzeTier?: string | null;
        icpCadenceEveryNBatches?: number | null;
        icpCadenceEveryLitersConsumed?: number | null;
        protocolDocUrl?: string | null;
      }
    | null
  >(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [factories, setFactories] = useState<FactoryRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brand-portal/supply-chain")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.ok) {
          setError(j.error || "Failed to load supply chain");
          return;
        }
        setBrand(j.brand);
        setTotals(j.totals);
        setFactories(j.factories || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading supply chain…
      </div>
    );
  }
  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            Brand Portal
          </Link>
          <span>›</span>
          <span>Supply Chain</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          Supply Chain {brand?.name ? <span className="text-slate-400 font-normal">— {brand.name}</span> : null}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Every factory currently producing FUZE-treated fabrics for your account. Each row links
          to the full factory detail with submissions, test results, and consumption history.
        </p>

        {/* Brand-stipulated spec strip — what every factory in this
            supply chain is being held to. Click "Edit spec" to update. */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs">
          <span className="font-bold uppercase tracking-wider text-slate-500">Brand spec:</span>
          {brand?.requiredFuzeTier ? (
            <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
              <span className="font-semibold text-slate-700">Tier:</span>{" "}
              <span className="text-[#00b4c3] font-bold">{brand.requiredFuzeTier}</span>
            </span>
          ) : (
            <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200 text-slate-400">
              No tier requirement
            </span>
          )}
          {brand?.icpCadenceEveryNBatches ? (
            <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
              <span className="font-semibold text-slate-700">ICP every:</span>{" "}
              {brand.icpCadenceEveryNBatches} order
              {brand.icpCadenceEveryNBatches === 1 ? "" : "s"}
            </span>
          ) : null}
          {brand?.icpCadenceEveryLitersConsumed ? (
            <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
              <span className="font-semibold text-slate-700">ICP every:</span>{" "}
              {brand.icpCadenceEveryLitersConsumed} L
            </span>
          ) : null}
          {!brand?.icpCadenceEveryNBatches && !brand?.icpCadenceEveryLitersConsumed ? (
            <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200 text-slate-400">
              No ICP cadence set
            </span>
          ) : null}
          {brand?.protocolDocUrl ? (
            <a
              href={brand.protocolDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-indigo-50 px-2 py-1 ring-1 ring-indigo-200 text-indigo-700 hover:bg-indigo-100"
            >
              📄 Protocol document
            </a>
          ) : null}
          <Link
            href="/brand-portal/spec"
            className="ml-auto text-[#00b4c3] hover:underline font-semibold"
          >
            Edit spec →
          </Link>
        </div>
      </div>

      {/* Totals strip */}
      {totals ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-[#00b4c3]">{totals.factories}</div>
            <div className="text-xs text-slate-500 mt-1">Factories</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-slate-700">{totals.fabrics}</div>
            <div className="text-xs text-slate-500 mt-1">Fabrics</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-slate-700">{totals.submissions}</div>
            <div className="text-xs text-slate-500 mt-1">Submissions</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-emerald-600">{totals.testsPassed}</div>
            <div className="text-xs text-slate-500 mt-1">Tests passed</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-amber-500">{totals.openTestRequests}</div>
            <div className="text-xs text-slate-500 mt-1">Open requests</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border col-span-2">
            <div className="text-2xl font-black text-slate-900">
              {formatLiters(totals.consumptionLitersTotal)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Total FUZE consumed</div>
          </div>
        </div>
      ) : null}

      {/* Factory table */}
      {factories.length === 0 ? (
        <div className="bg-white rounded-xl p-10 border border-dashed border-slate-300 text-center">
          <div className="text-5xl mb-3">🏭</div>
          <div className="text-base font-bold text-slate-900 mb-1">No factories yet</div>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Once one of your suppliers submits a fabric for FUZE treatment under your brand,
            they&apos;ll appear here with their full submission and test history.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">Factory</th>
                  <th className="text-right px-4 py-3 font-bold">Fabrics</th>
                  <th className="text-right px-4 py-3 font-bold">Submissions</th>
                  <th className="text-left px-4 py-3 font-bold">Last submission</th>
                  <th className="text-left px-4 py-3 font-bold">Last test</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-right px-4 py-3 font-bold">FUZE consumed</th>
                  <th className="text-left px-4 py-3 font-bold">Last run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {factories.map((row) => (
                  <tr key={row.factoryId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/factories/${row.factoryId}`}
                        className="font-semibold text-slate-900 hover:text-[#00b4c3]"
                      >
                        {row.factoryName}
                      </Link>
                      {row.country || row.city ? (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {[row.city, row.country].filter(Boolean).join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{row.fabricCount}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.submissionCount}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.lastSubmissionAt)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.lastTestRun ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">
                            {row.lastTestRun.testType || "Test"}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatDate(row.lastTestRun.testDate)}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatLiters(row.consumptionLitersTotal)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex flex-col">
                        <span>{formatDate(row.lastConsumptionAt)}</span>
                        {row.lastConsumptionTier ? (
                          <span className="text-xs text-slate-400">
                            {row.lastConsumptionTier}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-6">
        Need to set test cadence per factory or approve new submissions? Those controls are
        coming next — for now you can drill into any factory above to see the underlying data.
      </p>
    </div>
  );
}
