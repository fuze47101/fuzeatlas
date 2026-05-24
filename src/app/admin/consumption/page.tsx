// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n";

interface FactoryStat {
  factoryId: string;
  factoryName: string;
  country: string | null;
  fuzeEnabled: boolean | null;
  fabricCount: number;
  totalOrderedLiters: number;
  totalConsumedLiters: number;
  trialLiters: number;
  remainingLiters: number;
  annualDemandLiters: number;
  dailyBurnRate: number;
  daysUntilRunOut: number | null;
  reorderUrgency: string;
  lastOrderDate: string | null;
  activeOrders: number;
}

interface Summary {
  totalFactories: number;
  activeFactories: number;
  totalOrderedLiters: number;
  totalConsumedLiters: number;
  pendingOrders: number;
  criticalReorders: number;
  warningReorders: number;
  annualProjectedDemand: number;
}

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-300",
  WARNING: "bg-amber-100 text-amber-700 border-amber-300",
  MONITOR: "bg-blue-100 text-blue-700 border-blue-300",
  OK: "bg-green-100 text-green-700 border-green-300",
};

const URGENCY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500 animate-pulse",
  WARNING: "bg-amber-500",
  MONITOR: "bg-blue-400",
  OK: "bg-green-400",
};

export default function ConsumptionDashboard() {
  const { t } = useI18n();
  const T = t.consumptionAdmin;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [factoryStats, setFactoryStats] = useState<FactoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  const [factories, setFactories] = useState<{ id: string; name: string }[]>([]);

  // Order form
  const [orderFactory, setOrderFactory] = useState("");
  const [orderVolume, setOrderVolume] = useState("");
  const [orderTier, setOrderTier] = useState("F1");
  const [orderNotes, setOrderNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Consumption form
  const [consFactory, setConsFactory] = useState("");
  const [consLiters, setConsLiters] = useState("");
  const [consMeters, setConsMeters] = useState("");
  const [consMethod, setConsMethod] = useState("");
  const [consTier, setConsTier] = useState("F1");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/consumption");
      const data = await res.json();
      if (data.ok) {
        setSummary(data.summary);
        setFactoryStats(data.factoryStats);
      }
    } catch {}
    setLoading(false);
  };

  const fetchFactories = async () => {
    try {
      const res = await fetch("/api/factories");
      const data = await res.json();
      if (data.factories) {
        setFactories(data.factories.map((f: any) => ({ id: f.id, name: f.name })));
      }
    } catch {}
  };

  useEffect(() => {
    fetchData();
    fetchFactories();
  }, []);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/consumption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "order",
          factoryId: orderFactory,
          volumeLiters: Number(orderVolume),
          fuzeTier: orderTier,
          notes: orderNotes,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowOrderModal(false);
        setOrderFactory("");
        setOrderVolume("");
        setOrderNotes("");
        fetchData();
      } else {
        alert(data.error || T.errorCreateOrder);
      }
    } catch {
      alert(T.errorNetwork);
    }
    setSaving(false);
  };

  const handleLogConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/consumption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "consumption",
          factoryId: consFactory,
          litersUsed: Number(consLiters),
          metersProcessed: consMeters ? Number(consMeters) : undefined,
          applicationMethod: consMethod || undefined,
          fuzeTier: consTier,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowConsumptionModal(false);
        setConsFactory("");
        setConsLiters("");
        setConsMeters("");
        fetchData();
      } else {
        alert(data.error || T.errorLogUsage);
      }
    } catch {
      alert(T.errorNetwork);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-400 text-sm">{T.loading}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{T.pageTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {T.pageSubtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowOrderModal(true)}
            className="px-4 py-2 bg-[#00b4c3] text-white text-sm font-medium rounded-lg hover:bg-[#009ba8] transition-colors"
          >
            {T.btnNewOrder}
          </button>
          <button
            onClick={() => setShowConsumptionModal(true)}
            className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            {T.btnLogUsage}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium uppercase mb-1">{T.kpiActiveFactories}</div>
            <div className="text-2xl font-bold text-slate-900">{summary.activeFactories}</div>
            <div className="text-xs text-slate-400">{T.kpiOfTotal.replace("{n}", String(summary.totalFactories))}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium uppercase mb-1">{T.kpiTotalOrdered}</div>
            <div className="text-2xl font-bold text-[#00b4c3]">{summary.totalOrderedLiters.toFixed(0)}L</div>
            <div className="text-xs text-slate-400">{T.kpiPending.replace("{n}", String(summary.pendingOrders))}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium uppercase mb-1">{T.kpiTotalConsumed}</div>
            <div className="text-2xl font-bold text-slate-900">{summary.totalConsumedLiters.toFixed(0)}L</div>
            <div className="text-xs text-slate-400">{T.kpiAcrossAll}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium uppercase mb-1">{T.kpiReorderAlerts}</div>
            <div className="text-2xl font-bold text-red-600">
              {summary.criticalReorders + summary.warningReorders}
            </div>
            <div className="text-xs text-slate-400">
              {T.kpiAlertsSplit.replace("{c}", String(summary.criticalReorders)).replace("{w}", String(summary.warningReorders))}
            </div>
          </div>
        </div>
      )}

      {/* Projected Annual Demand */}
      {summary && summary.annualProjectedDemand > 0 && (
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-xs text-teal-600 font-semibold uppercase">{T.annualDemandLabel}</div>
              <div className="text-2xl font-bold text-teal-800">
                {summary.annualProjectedDemand.toLocaleString(undefined, { maximumFractionDigits: 0 })} {T.annualDemandUnit}
              </div>
            </div>
            <div className="text-sm text-teal-600">
              {T.annualDemandBottles.replace("{n}", String(Math.ceil(summary.annualProjectedDemand / 19)))}
              {" · "}
              {T.annualDemandRevenue.replace("{n}", (summary.annualProjectedDemand * 36).toLocaleString(undefined, { maximumFractionDigits: 0 }))}
            </div>
          </div>
        </div>
      )}

      {/* Factory Status Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">{T.sectionFactoryInventory}</h2>
        </div>

        {factoryStats.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400">{T.emptyTitle}</p>
            <p className="text-sm text-slate-300 mt-1">{T.emptySub}</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {factoryStats.map((f) => (
                <div key={f.factoryId} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${URGENCY_DOT[f.reorderUrgency] || "bg-slate-300"}`} />
                      <span className="font-semibold text-sm text-slate-900">{f.factoryName}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${URGENCY_COLORS[f.reorderUrgency] || ""}`}>
                      {f.reorderUrgency}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-slate-400">{T.cellRemaining}</div>
                      <div className="font-semibold text-slate-900">{f.remainingLiters.toFixed(1)}L</div>
                    </div>
                    <div>
                      <div className="text-slate-400">{T.cellBurn}</div>
                      <div className="font-semibold text-slate-900">{f.dailyBurnRate}L</div>
                    </div>
                    <div>
                      <div className="text-slate-400">{T.cellRunOut}</div>
                      <div className={`font-semibold ${f.daysUntilRunOut !== null && f.daysUntilRunOut <= 14 ? "text-red-600" : "text-slate-900"}`}>
                        {f.daysUntilRunOut !== null ? `${f.daysUntilRunOut}${T.daysSuffix}` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{T.colFactory}</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">{T.colCountry}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{T.colOrdered}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{T.colConsumed}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{T.colRemaining}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{T.colBurnDay}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{T.colRunOut}</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{T.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {factoryStats.map((f) => (
                    <tr key={f.factoryId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${URGENCY_DOT[f.reorderUrgency] || "bg-slate-300"}`} />
                          <span className="text-sm font-medium text-slate-900">{f.factoryName}</span>
                        </div>
                        <div className="text-xs text-slate-400 ml-4">
                          {f.fabricCount} {f.fabricCount !== 1 ? T.fabricsSuffix : T.fabricSuffix}
                          {f.activeOrders > 0 && ` · ${f.activeOrders} ${f.activeOrders !== 1 ? T.activeOrdersSuffix : T.activeOrderSuffix}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 hidden lg:table-cell">{f.country || "—"}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-700">{f.totalOrderedLiters.toFixed(0)}L</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-700">{f.totalConsumedLiters.toFixed(0)}L</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{f.remainingLiters.toFixed(1)}L</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{f.dailyBurnRate}L</td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${
                        f.daysUntilRunOut !== null && f.daysUntilRunOut <= 14
                          ? "text-red-600"
                          : f.daysUntilRunOut !== null && f.daysUntilRunOut <= 30
                          ? "text-amber-600"
                          : "text-slate-700"
                      }`}>
                        {f.daysUntilRunOut !== null ? `${f.daysUntilRunOut} ${T.daysWord}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${URGENCY_COLORS[f.reorderUrgency] || ""}`}>
                          {f.reorderUrgency}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* New Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">{T.modalOrderTitle}</h2>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{T.fieldFactory}</label>
                <select value={orderFactory} onChange={(e) => setOrderFactory(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">{T.placeholderFactory}</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.fieldVolumeL}</label>
                  <input type="number" value={orderVolume} onChange={(e) => setOrderVolume(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="19" required min="1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.fieldTier}</label>
                  <select value={orderTier} onChange={(e) => setOrderTier(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="F1">F1 (1.0 mg/kg)</option>
                    <option value="F2">F2 (0.75 mg/kg)</option>
                    <option value="F3">F3 (0.5 mg/kg)</option>
                    <option value="F4">F4 (0.25 mg/kg)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{T.fieldNotes}</label>
                <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>{T.summaryBottles}</span>
                  <span className="font-semibold">{orderVolume ? Math.ceil(Number(orderVolume) / 19) : 0}</span>
                </div>
                <div className="flex justify-between text-slate-600 mt-1">
                  <span>{T.summaryEstTotal}</span>
                  <span className="font-semibold text-[#00b4c3]">${orderVolume ? (Number(orderVolume) * 36).toLocaleString() : 0}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300">{T.btnCancel}</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-[#00b4c3] text-white font-medium rounded-lg hover:bg-[#009ba8] disabled:opacity-50">{saving ? T.btnCreating : T.btnCreateOrder}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Consumption Modal */}
      {showConsumptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">{T.modalUsageTitle}</h2>
            <form onSubmit={handleLogConsumption} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{T.fieldFactory}</label>
                <select value={consFactory} onChange={(e) => setConsFactory(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">{T.placeholderFactory}</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.fieldLitersUsed}</label>
                  <input type="number" step="0.1" value={consLiters} onChange={(e) => setConsLiters(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required min="0.1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.fieldMetersProcessed}</label>
                  <input type="number" value={consMeters} onChange={(e) => setConsMeters(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder={T.placeholderOptional} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.fieldMethod}</label>
                  <select value={consMethod} onChange={(e) => setConsMethod(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">{T.placeholderSelect}</option>
                    <option value="exhaust">{T.methodExhaust}</option>
                    <option value="pad">{T.methodPad}</option>
                    <option value="spray">{T.methodSpray}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.fieldTier}</label>
                  <select value={consTier} onChange={(e) => setConsTier(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="F1">F1</option>
                    <option value="F2">F2</option>
                    <option value="F3">F3</option>
                    <option value="F4">F4</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowConsumptionModal(false)} className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300">{T.btnCancel}</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50">{saving ? T.btnLogging : T.btnLogUsageSubmit}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
