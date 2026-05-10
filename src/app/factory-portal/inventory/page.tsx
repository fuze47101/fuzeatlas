"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Summary {
  ordersTotalLiters: number;
  consumedTotalLiters: number;
  onHandLiters: number;
  consumedLast30Liters: number;
  dailyBurnLiters: number;
  daysRemaining: number | null;
}

interface RecentRow {
  id: string;
  usageDate: string;
  litersUsed: number;
  fuzeTier: string | null;
  brand: { id: string; name: string } | null;
}

function fmt(n: number, dp = 0) {
  if (!n) return "0";
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  return n.toFixed(dp);
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

export default function FactoryInventoryPage() {
  const { t } = useI18n();
  const tx = t.factoryPortal.inventoryView;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/factory-portal/inventory")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load");
        setSummary(j.summary);
        setRecent(j.recent || []);
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
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/factory-portal" className="hover:text-[#00b4c3]">
            {t.factoryPortal.crumb}
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

      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-200">
            <div className="text-3xl font-black text-emerald-700">{fmt(summary.onHandLiters)}</div>
            <div className="text-xs text-emerald-700 mt-1">{tx.onHandLabel}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-slate-900">{fmt(summary.ordersTotalLiters)}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.orderedLabel}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-amber-600">{fmt(summary.consumedTotalLiters)}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.consumedLabel}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-slate-700">{fmt(summary.consumedLast30Liters)}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.consumed30Label}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-slate-700">
              {summary.dailyBurnLiters.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500 mt-1">{tx.dailyBurnLabel}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-[#00b4c3]">
              {summary.daysRemaining !== null ? summary.daysRemaining : "—"}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {summary.daysRemaining !== null ? tx.daysRemainingLabel : tx.daysRemainingNone}
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">{tx.recentHeader}</h2>
        </div>
        {recent.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">{tx.noRecent}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white text-xs uppercase tracking-wider text-slate-500 border-b">
              <tr>
                <th className="text-left px-5 py-2 font-bold">{tx.colDate}</th>
                <th className="text-left px-5 py-2 font-bold">{tx.colBrand}</th>
                <th className="text-left px-5 py-2 font-bold">{tx.colTier}</th>
                <th className="text-right px-5 py-2 font-bold">{tx.colLiters}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 text-slate-600">{formatDate(r.usageDate)}</td>
                  <td className="px-5 py-2 text-slate-700">{r.brand?.name || "—"}</td>
                  <td className="px-5 py-2 text-slate-700">{r.fuzeTier || "—"}</td>
                  <td className="px-5 py-2 text-right font-mono text-slate-800">
                    {r.litersUsed.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
