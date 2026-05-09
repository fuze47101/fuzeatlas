"use client";

/**
 * Brand pricing & volume rollup (KUIU promise May 2026 — "we can then
 * calculate and control pricing reductions based on volume across all
 * factories").
 *
 * Read-only dashboard. Admins set the ladder via /api/admin/
 * brand-pricing-tiers; brand managers see the result here.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface Tier {
  id: string;
  thresholdLiters: number;
  discountPct: number;
  label: string | null;
}

interface Rollup {
  brand: { id: string; name: string };
  totals: {
    consumptionLitersTotal: number;
    orderLitersTotal: number;
    orderCount: number;
    factoryCount: number;
  };
  currentTier: Tier | null;
  nextTier: Tier | null;
  litersToNextTier: number | null;
  tiers: Tier[];
  perFactory: Array<{
    factoryId: string;
    factoryName: string;
    country: string | null;
    litersUsed: number;
  }>;
}

function fmtLiters(n: number): string {
  if (!n) return "0 L";
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k L`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k L`;
  return `${n.toFixed(0)} L`;
}

export default function BrandPricingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Rollup | null>(null);

  useEffect(() => {
    fetch("/api/brand-portal/pricing-rollup")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load pricing");
        setData(j);
      })
      .catch((e) => setError(e?.message || "Network error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading pricing rollup…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error || "Unable to load pricing"}
      </div>
    );
  }

  const consumed = data.totals.consumptionLitersTotal;
  const next = data.nextTier;
  const progressPct =
    next && next.thresholdLiters > 0
      ? Math.min(100, (consumed / next.thresholdLiters) * 100)
      : 100;

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            Brand Portal
          </Link>
          <span>›</span>
          <span>Pricing & Volume</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          Pricing & Volume — {data.brand.name}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Cumulative FUZE consumption across every factory in your supply chain. Volume across
          factories rolls up into your discount tier — buying more, anywhere in your supply
          chain, advances you up the ladder.
        </p>
      </div>

      {/* Hero — current tier + progress to next */}
      <div className="rounded-2xl bg-gradient-to-br from-[#00b4c3] to-[#0a7a85] text-white p-6 mb-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-80 mb-1">
              Current Tier
            </div>
            <div className="text-4xl font-black">
              {data.currentTier
                ? `${data.currentTier.discountPct}% off`
                : "—"}
            </div>
            <div className="text-sm opacity-90 mt-1">
              {data.currentTier?.label
                ? data.currentTier.label
                : data.currentTier
                ? `Qualified at ${fmtLiters(data.currentTier.thresholdLiters)} consumed`
                : "No discount tier qualified yet."}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest opacity-80 mb-1">
              Lifetime FUZE consumed
            </div>
            <div className="text-3xl font-black">{fmtLiters(consumed)}</div>
            <div className="text-xs opacity-90 mt-1">
              across {data.totals.factoryCount} factor
              {data.totals.factoryCount === 1 ? "y" : "ies"} ·{" "}
              {data.totals.orderCount} order
              {data.totals.orderCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {next ? (
          <>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-2 opacity-90">
              <span>
                {fmtLiters(consumed)} of {fmtLiters(next.thresholdLiters)}
              </span>
              <span>
                {fmtLiters(data.litersToNextTier || 0)} to{" "}
                <strong>{next.discountPct}% off</strong>
                {next.label ? ` (${next.label})` : ""}
              </span>
            </div>
          </>
        ) : data.currentTier ? (
          <div className="text-xs opacity-90 mt-2">
            You&apos;re at the top tier. No further discount tiers configured.
          </div>
        ) : null}
      </div>

      {/* Ladder visualization */}
      {data.tiers.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">Discount ladder</h2>
          <div className="space-y-2">
            {data.tiers.map((t) => {
              const qualified = consumed >= t.thresholdLiters;
              const isCurrent = data.currentTier?.id === t.id;
              return (
                <div
                  key={t.id}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                    isCurrent
                      ? "bg-[#00b4c3]/10 ring-2 ring-[#00b4c3]"
                      : qualified
                      ? "bg-slate-50"
                      : "bg-white border border-dashed border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl ${qualified ? "" : "opacity-30 grayscale"}`}>
                      {qualified ? "✓" : "○"}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">
                        {t.discountPct}% off
                        {t.label ? (
                          <span className="ml-2 text-xs uppercase tracking-wider text-slate-500 font-medium">
                            {t.label}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {fmtLiters(t.thresholdLiters)} cumulative consumption
                      </div>
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="text-xs font-bold uppercase tracking-wider text-[#00b4c3]">
                      You are here
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-6 mb-6 text-center">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-sm font-bold text-slate-900 mb-1">
            No discount ladder configured yet
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Reach out to your account manager — once your contract has volume tiers stipulated,
            they&apos;ll appear here automatically.
          </p>
        </div>
      )}

      {/* Per-factory contribution */}
      {data.perFactory.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-bold text-slate-900">Consumption by factory</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Where the {fmtLiters(consumed)} came from. Sorted by largest contributor.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white text-xs text-slate-500 uppercase tracking-wider">
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-2 font-bold">Factory</th>
                <th className="text-right px-5 py-2 font-bold">FUZE consumed</th>
                <th className="text-right px-5 py-2 font-bold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.perFactory.map((row) => {
                const share = consumed > 0 ? (row.litersUsed / consumed) * 100 : 0;
                return (
                  <tr key={row.factoryId} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/factories/${row.factoryId}`}
                        className="font-semibold text-slate-900 hover:text-[#00b4c3]"
                      >
                        {row.factoryName}
                      </Link>
                      {row.country ? (
                        <span className="text-xs text-slate-500 ml-2">{row.country}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700">
                      {fmtLiters(row.litersUsed)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {share.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
