"use client";

/**
 * /brand-portal/inventory — Phase 4F.
 *
 * Per-factory FUZE estimated on-hand for the brand's supply chain.
 * Reads /api/brand-portal/inventory (SupplyChainLink-driven).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Row {
  factoryId: string;
  factoryName: string;
  country: string | null;
  city: string | null;
  ordersTotalLiters: number;
  consumedTotalLiters: number;
  onHandLiters: number;
  lastConsumptionAt: string | null;
  lastConsumptionTier: string | null;
}

function fmt(n: number) {
  if (!n) return "0";
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  return Math.round(n).toLocaleString();
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function BrandPortalInventoryPage() {
  const { t } = useI18n();
  const tx = t.brandPortal.inventoryView;
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brand-portal/inventory")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load");
        setRows(j.factories || []);
        setTotals(j.totals || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            {t.brandPortal.crumb}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {totals ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-[#00b4c3]">{totals.factories}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.totalFactories}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-slate-900">{fmt(totals.ordersTotalLiters)}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.totalOrders}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-amber-600">{fmt(totals.consumedTotalLiters)}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.totalConsumed}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-emerald-600">{fmt(totals.onHandLiters)}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.totalOnHand}</div>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">{tx.noFactories}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">{tx.colFactory}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colOrdered}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colConsumed}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colOnHand}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colLastUse}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.factoryId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/factories/${r.factoryId}`}
                        className="font-semibold text-slate-900 hover:text-[#00b4c3]"
                      >
                        {r.factoryName}
                      </Link>
                      {r.country || r.city ? (
                        <div className="text-xs text-slate-500">
                          {[r.city, r.country].filter(Boolean).join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {fmt(r.ordersTotalLiters)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-600">
                      {fmt(r.consumedTotalLiters)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                      {fmt(r.onHandLiters)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex flex-col">
                        <span>{formatDate(r.lastConsumptionAt)}</span>
                        {r.lastConsumptionTier ? (
                          <span className="text-xs text-slate-400">{r.lastConsumptionTier}</span>
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
    </div>
  );
}
