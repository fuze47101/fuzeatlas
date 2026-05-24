"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Sample {
  orderId: string;
  orderNumber?: string;
  brandName: string;
  status: string;
  date: string;
  volume: number;
}

interface Trial {
  trialId: string;
  brandName: string;
  status: string;
  date: string;
  volume: number;
}

interface ProdOrder {
  volume: number;
  revenue: number;
  status: string;
  date: string;
}

interface FactoryEntry {
  factoryId: string;
  factoryName: string;
  country: string;
  samples: Sample[];
  trials: Trial[];
  productionOrders: ProdOrder[];
  converted: boolean;
  daysToConvert: number | null;
  accountManager: string;
}

interface Summary {
  totalFactoriesWithSamples: number;
  totalSampleOrders: number;
  totalConverted: number;
  conversionRate: number;
  avgDaysToConvert: number | null;
  totalProductionRevenue: number;
  totalProductionLiters: number;
  pendingConversion: number;
}

export default function ConversionTrackingPage() {
  const { t } = useI18n();
  const T = t.conversionTracking;
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [converted, setConverted] = useState<FactoryEntry[]>([]);
  const [pending, setPending] = useState<FactoryEntry[]>([]);
  const [tab, setTab] = useState<"all" | "converted" | "pending">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/admin/conversion-tracking")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSummary(data.summary);
          setConverted(data.converted || []);
          setPending(data.pending || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const factories = tab === "converted" ? converted : tab === "pending" ? pending : [...converted, ...pending];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/admin" className="hover:text-slate-600">{T.crumbDashboard}</Link>
            <span>/</span>
            <span>{T.crumbCurrent}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800">{T.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {T.subtitle}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-blue-700">{summary.totalFactoriesWithSamples}</p>
            <p className="text-[10px] font-semibold text-blue-600 uppercase">{T.cardFactoriesSampled}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-emerald-700">{summary.totalConverted}</p>
            <p className="text-[10px] font-semibold text-emerald-600 uppercase">{T.cardConverted}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-amber-700">{summary.conversionRate}%</p>
            <p className="text-[10px] font-semibold text-amber-600 uppercase">{T.cardConversionRate}</p>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-cyan-700">
              {summary.avgDaysToConvert !== null ? `${summary.avgDaysToConvert}d` : "—"}
            </p>
            <p className="text-[10px] font-semibold text-cyan-600 uppercase">{T.cardAvgDays}</p>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white border rounded-xl p-4 text-center">
            <p className="text-xl font-black text-slate-700">{summary.totalProductionLiters.toLocaleString()}L</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">{T.cardProdVolume}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <p className="text-xl font-black text-slate-700">${summary.totalProductionRevenue.toLocaleString()}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">{T.cardProdRevenue}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "converted", "pending"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
              tab === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t === "all" ? `${T.tabAll} (${converted.length + pending.length})` : t === "converted" ? `${T.tabConverted} (${converted.length})` : `${T.tabPending} (${pending.length})`}
          </button>
        ))}
      </div>

      {/* Factory List */}
      <div className="space-y-2">
        {factories.length === 0 ? (
          <div className="text-center py-12 bg-white border rounded-xl">
            <p className="text-slate-400 text-sm">{T.emptyText}</p>
          </div>
        ) : (
          factories.map((f) => (
            <div key={f.factoryId} className="bg-white border rounded-xl overflow-hidden">
              {/* Factory Row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition"
                onClick={() => toggle(f.factoryId)}
              >
                <span className="text-lg">{expanded.has(f.factoryId) ? "▼" : "▶"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/factories/${f.factoryId}`} className="font-bold text-blue-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                      {f.factoryName}
                    </Link>
                    <span className="text-xs text-slate-400">{f.country}</span>
                    {f.converted ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">{T.badgeConverted}</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">{T.badgePending}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {f.samples.length + f.trials.length} sample{f.samples.length + f.trials.length !== 1 ? "s" : ""} · {f.productionOrders.length} production order{f.productionOrders.length !== 1 ? "s" : ""}
                    {f.daysToConvert !== null && ` · ${f.daysToConvert} ${T.daysToConvertSuffix}`}
                    {f.accountManager && f.accountManager !== "—" && ` · ${T.amPrefix} ${f.accountManager}`}
                  </p>
                </div>
                {f.converted && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-700">
                      {f.productionOrders.reduce((s, o) => s + o.volume, 0).toLocaleString()}L
                    </p>
                    <p className="text-[10px] text-slate-400">{T.productionLabel}</p>
                  </div>
                )}
              </div>

              {/* Expanded Detail */}
              {expanded.has(f.factoryId) && (
                <div className="border-t bg-slate-50 p-4 space-y-3">
                  {f.samples.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">{T.sectionSamples}</p>
                      {f.samples.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm py-1">
                          <span className="text-slate-400 text-xs">{new Date(s.date).toLocaleDateString()}</span>
                          <span className="font-semibold text-slate-700">{s.brandName}</span>
                          <span className="text-xs text-slate-500">{s.volume}L</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${s.status === "DELIVERED" ? "bg-green-100 text-green-700" : s.status === "SHIPPED" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                            {s.status}
                          </span>
                          {s.orderNumber && <span className="text-[10px] text-slate-400">#{s.orderNumber}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {f.trials.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">{T.sectionTrials}</p>
                      {f.trials.map((trial, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm py-1">
                          <span className="text-slate-400 text-xs">{new Date(trial.date).toLocaleDateString()}</span>
                          <span className="font-semibold text-slate-700">{trial.brandName}</span>
                          <span className="text-xs text-slate-500">{trial.volume}L</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${trial.status === "COMPLETE" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {trial.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {f.productionOrders.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-emerald-600 uppercase mb-1">{T.sectionProduction}</p>
                      {f.productionOrders.map((o, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm py-1">
                          <span className="text-slate-400 text-xs">{new Date(o.date).toLocaleDateString()}</span>
                          <span className="font-bold text-emerald-700">{o.volume.toLocaleString()}L</span>
                          <span className="text-sm text-slate-600">${o.revenue.toLocaleString()}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${o.status === "DELIVERED" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {o.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
