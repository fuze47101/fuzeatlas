// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ErrorPanel from "@/components/ErrorPanel";
import { useI18n } from "@/i18n";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  QUOTED: "bg-blue-100 text-blue-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-indigo-100 text-indigo-700",
  PROCESSING: "bg-purple-100 text-purple-700",
  SHIPPED: "bg-cyan-100 text-cyan-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  DRAFT: "statusDraft",
  QUOTED: "statusQuoted",
  PENDING_APPROVAL: "statusPendingApproval",
  APPROVED: "statusApproved",
  PROCESSING: "statusProcessing",
  SHIPPED: "statusShipped",
  DELIVERED: "statusDelivered",
  CANCELLED: "statusCancelled",
};

const EVENT_ICONS: Record<string, string> = {
  ORDER_PLACED: "📝", QUOTE_ACCEPTED: "📋", APPROVED: "✅",
  SHIPPED_FROM_FUZE: "🚛", SHIPPED_FROM_DISTRIBUTOR: "🚛",
  IN_TRANSIT: "✈️", CUSTOMS: "🛃",
  RECEIVED_AT_FACTORY: "📦", TREATMENT_APPLIED: "💧",
  ICP_SAMPLE_SUBMITTED: "🧪", ICP_CERTIFIED: "🎖️",
  BRAND_NOTIFIED: "📨", CANCELLED: "❌", NOTE: "📝",
};

export default function OrdersDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const od = (t as any).ordersDashboard || {};
  const statusLabel = (s: string) =>
    od[STATUS_LABEL_KEYS[s] || ""] || s.replace("_", " ");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Silent-zero sweep — surface API failures instead of hanging on
  // the loading spinner (the old `try/finally` with no catch would
  // silently swallow network errors and never set data).
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders-dashboard");
      const d = await res.json().catch(() => null);
      if (!res.ok || !d || d.ok === false) {
        setError(
          (d && (d.error || d.message)) ||
            `${od.loadFailed || "Couldn't load orders dashboard"} (HTTP ${res.status}).`,
        );
        return;
      }
      setData(d);
    } catch (e: any) {
      setError(e?.message || od.networkError || "Network error while loading orders dashboard.");
    } finally {
      setLoading(false);
    }
  }, [od.loadFailed, od.networkError]);

  useEffect(() => {
    if (user && !["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      router.push("/dashboard");
      return;
    }
    load();
  }, [user, router, load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 mb-1">{od.title || "Orders Dashboard"}</h1>
          <p className="text-slate-600">
            {od.subtitle ||
              "Global view of the FUZE order pipeline — factory orders, distributor restocks, consumption, and stock."}
          </p>
        </div>
        <ErrorPanel
          context={od.loadContext || "Load orders dashboard"}
          error={error || od.noData || "No data returned."}
          onRetry={load}
        />
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString();
  const fmtUsd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

  const weeklyMax = Math.max(...data.weeklyTrend.map((w: any) => w.liters), 1);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 mb-1">{od.title || "Orders Dashboard"}</h1>
        <p className="text-slate-600">{od.subtitle || "Global view of the FUZE order pipeline — factory orders, distributor restocks, consumption, and stock."}</p>
      </div>

      {/* ─── Top KPI Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon="📦" label={od.activeOrders || "Active Orders"} value={fmt(data.kpis.totalActiveOrders)} hint={`${data.kpis.pendingApprovalCount} ${od.pendingApproval || "pending approval"}`} accent="blue" />
        <KpiCard icon="🚛" label={od.shippedWeek || "Shipped This Week"} value={`${fmt(data.kpis.shippedThisWeek.liters)}L`} hint={`${data.kpis.shippedThisWeek.count} ${od.ordersWord || "orders"}`} accent="cyan" />
        <KpiCard icon="💧" label={od.consumed || "Consumed (30d)"} value={`${fmt(data.kpis.consumedThisMonth.liters)}L`} hint={`${fmt(data.kpis.consumedThisMonth.meters)}m ${od.fabricTreated || "fabric treated"}`} accent="emerald" />
        <KpiCard icon="💰" label={od.openPipeline || "Open Pipeline"} value={fmtUsd(data.kpis.openPipeline.value)} hint={`${fmt(data.kpis.openPipeline.liters)}${od.litersInFlight || "L in flight"}`} accent="amber" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard icon="📊" label={od.shippedMonth || "Shipped (30d)"} value={`${fmt(data.kpis.shippedThisMonth.liters)}L`} hint={fmtUsd(data.kpis.shippedThisMonth.value)} />
        <KpiCard icon="🏭" label={od.distributorStock || "Distributor Stock"} value={`${fmt(data.kpis.totalDistributorStock)}L`} hint={od.globalWarehouses || "global warehouses"} />
        <KpiCard icon="💧" label={od.restockOpen || "Restock Orders Open"} value={fmt(data.kpis.distributorRestockOpen)} hint="distributors ← FUZE HQ" />
        <KpiCard icon="⚠️" label={od.lowStock || "Low-Stock Distributors"} value={fmt(data.lowStock.length)} hint={od.belowReorder || "below reorder point"} accent={data.lowStock.length > 0 ? "red" : "slate"} />
      </div>

      {/* ─── Status Strip ─── */}
      <div className="mb-8">
        <h2 className="font-bold text-slate-900 mb-3">{od.byStatus || "Orders by Status"}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {["DRAFT", "QUOTED", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((s) => {
            const stat = data.byStatus.find((b: any) => b.status === s);
            return (
              <div key={s} className={`rounded-lg p-3 ${STATUS_COLORS[s]}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{statusLabel(s)}</p>
                <p className="text-2xl font-black mt-0.5">{stat?.count || 0}</p>
                <p className="text-[10px] opacity-70">{fmt(stat?.liters || 0)}L</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Weekly Trend ─── */}
      <div className="mb-8 bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">{od.weeklyVolume || "Weekly Shipped Volume (last 8 weeks)"}</h2>
          <span className="text-xs text-slate-600">{od.barHeightHint || "bar height = liters shipped"}</span>
        </div>
        <div className="flex items-end gap-2 h-40">
          {data.weeklyTrend.map((w: any) => {
            const pct = weeklyMax > 0 ? (w.liters / weeklyMax) * 100 : 0;
            return (
              <div key={w.date} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-[#00b4c3] to-[#64dfe8] rounded-t-md hover:from-[#009aa8] transition-all relative"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity">
                      {fmt(w.liters)}L · {w.orders} {od.ordersWord || "orders"} · {fmtUsd(w.value)}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-600">
                  {new Date(w.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ─── Top Factories ─── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-bold text-slate-900 mb-4">{od.topFactories || "Top Factories (90d)"}</h2>
          {data.topFactories.length === 0 ? (
            <p className="text-sm text-slate-600">{od.noFactoryOrders || "No factory orders in the last 90 days."}</p>
          ) : (
            <div className="space-y-2">
              {data.topFactories.map((f: any, i: number) => (
                <Link key={f.id} href={`/factories/${f.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-[#00b4c3]/10 text-[#00b4c3] text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{f.name}</p>
                      <p className="text-xs text-slate-600">{f.country} · {f.orders} {od.ordersWord || "orders"}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-900">{fmt(f.liters)}L</p>
                    <p className="text-xs text-slate-600">{fmtUsd(f.value)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ─── Top Brands ─── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-bold text-slate-900 mb-4">{od.topBrands || "Top Brands (90d)"}</h2>
          {data.topBrands.length === 0 ? (
            <p className="text-sm text-slate-600">{od.noBrandAllocations || "No brand allocations in the last 90 days."}</p>
          ) : (
            <div className="space-y-2">
              {data.topBrands.map((b: any, i: number) => (
                <Link key={b.id} href={`/brands/${b.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <p className="font-semibold text-slate-900 text-sm truncate">{b.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-900">{fmt(b.liters)}L</p>
                    <p className="text-xs text-slate-600">{b.orders} {od.ordersWord || "orders"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Actionable Orders ─── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
        <h2 className="font-bold text-slate-900 mb-4">{od.attention || "Orders Requiring Attention"}</h2>
        {data.actionable.length === 0 ? (
          <p className="text-sm text-slate-600">{od.noActionable || "No open orders. 🎉"}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-600 uppercase tracking-wide border-b border-slate-200">
                  <th className="pb-2 pr-3">{od.colOrder || "Order"}</th>
                  <th className="pb-2 pr-3">{od.colFactory || "Factory"}</th>
                  <th className="pb-2 pr-3">{od.colBrand || "Brand"}</th>
                  <th className="pb-2 pr-3">{od.colVolume || "Volume"}</th>
                  <th className="pb-2 pr-3">{od.colValue || "Value"}</th>
                  <th className="pb-2 pr-3">{od.colDistributor || "Distributor"}</th>
                  <th className="pb-2">{od.colStatus || "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {data.actionable.map((o: any) => (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/factory-portal/orders/${o.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2 pr-3 font-semibold text-slate-900">{o.orderNumber}</td>
                    <td className="py-2 pr-3 text-slate-700">{o.factory?.name || "—"}</td>
                    <td className="py-2 pr-3 text-slate-700">{o.brand?.name || "—"}</td>
                    <td className="py-2 pr-3 text-slate-700">{o.volumeLiters ? `${o.volumeLiters}L` : o.hangtagQty ? `${o.hangtagQty} ${od.tagsSuffix || "tags"}` : "—"}</td>
                    <td className="py-2 pr-3 text-slate-700">{fmtUsd(o.totalPrice || 0)}</td>
                    <td className="py-2 pr-3 text-slate-600 text-xs">{o.distributor?.name || od.directUSA || "Direct USA"}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${STATUS_COLORS[o.status]}`}>
                        {statusLabel(o.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ─── Low Stock Distributors ─── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-bold text-slate-900 mb-4">{od.lowStock || "Low-Stock Distributors"}</h2>
          {data.lowStock.length === 0 ? (
            <p className="text-sm text-slate-600">{od.aboveReorder || "All distributors above reorder point. ✓"}</p>
          ) : (
            <div className="space-y-2">
              {data.lowStock.map((d: any) => (
                <Link
                  key={d.distributorId}
                  href="/admin/distributor-restock"
                  className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100"
                >
                  <div>
                    <p className="font-semibold text-red-900 text-sm">{d.name}</p>
                    <p className="text-xs text-red-700">{d.country} · {fmt(d.stockLiters)}L / {od.reorderAtPrefix || "reorder at"} {fmt(d.reorderAt)}L</p>
                  </div>
                  <span className="text-xs font-bold text-red-700">-{fmt(d.deficit)}L</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ─── Restock In Flight ─── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-bold text-slate-900 mb-4">{od.restockInFlight || "Distributor Restocks In Flight"}</h2>
          {data.restockInFlight.length === 0 ? (
            <p className="text-sm text-slate-600">{od.noRestockInFlight || "No open restock orders."}</p>
          ) : (
            <div className="space-y-2">
              {data.restockInFlight.map((o: any) => (
                <Link
                  key={o.id}
                  href="/admin/distributor-restock"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{o.orderNumber}</p>
                    <p className="text-xs text-slate-600 truncate">
                      {o.distributor?.name} · {o.unitQuantity} × {o.unitType.replace("_", " ")} · {fmt(o.totalLiters)}L
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full flex-shrink-0 ${STATUS_COLORS[o.status] || "bg-slate-100"}`}>
                    {statusLabel(o.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Recent Lifecycle Events ─── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-bold text-slate-900 mb-4">{od.recentEvents || "Recent Lifecycle Events"}</h2>
        {data.recentEvents.length === 0 ? (
          <p className="text-sm text-slate-600">{od.noRecentEvents || "No recent events."}</p>
        ) : (
          <div className="space-y-2">
            {data.recentEvents.map((e: any) => (
              <div key={e.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">
                <span className="text-xl flex-shrink-0">{EVENT_ICONS[e.eventType] || "•"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold text-slate-900">{e.order?.orderNumber}</span>
                    <span className="text-slate-600"> · {e.order?.factory?.name}</span>
                  </p>
                  <p className="text-sm text-slate-700">{e.title}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(e.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {e.actorName && ` · ${e.actorName}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, hint, accent = "slate" }: any) {
  const accents: Record<string, string> = {
    slate: "border-slate-200",
    blue: "border-blue-200 bg-blue-50/40",
    cyan: "border-cyan-200 bg-cyan-50/40",
    emerald: "border-emerald-200 bg-emerald-50/40",
    amber: "border-amber-200 bg-amber-50/40",
    red: "border-red-300 bg-red-50/60",
  };
  return (
    <div className={`bg-white rounded-xl border p-5 ${accents[accent]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-3xl font-black text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}
