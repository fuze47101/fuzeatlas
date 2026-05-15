// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/**
 * Distributor view of the FUZE orders flowing in from factories
 * assigned to them. Built on /api/orders GET which already scopes
 * by user.distributorId.
 */

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  QUOTED: "bg-blue-100 text-blue-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  PROCESSING: "bg-purple-100 text-purple-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-cyan-100 text-cyan-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const STATUS_GROUPS: Array<{ id: string; label: string; statuses: string[] }> = [
  { id: "all", label: "All", statuses: [] },
  { id: "open", label: "Open", statuses: ["QUOTED", "PENDING_APPROVAL", "APPROVED", "PROCESSING"] },
  { id: "shipping", label: "Shipping", statuses: ["SHIPPED"] },
  { id: "delivered", label: "Delivered", statuses: ["DELIVERED"] },
];

export default function DistributorFactoryOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();

  const isDistributor = user?.role === "DISTRIBUTOR_USER";
  const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user?.role || "");

  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    if (!isDistributor && !isInternal) {
      router.push("/home");
      return;
    }
    load();
  }, [user?.id]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/orders");
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Failed to load orders");
        return;
      }
      setOrders(j.orders || []);
      setStats(j.stats || null);
    } catch (e: any) {
      setError(e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === "all") return orders;
    const g = STATUS_GROUPS.find((x) => x.id === filter);
    if (!g) return orders;
    return orders.filter((o) => g.statuses.includes(o.status));
  }, [filter, orders]);

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-slate-500">Loading factory orders…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p className="font-bold mb-1">Couldn't load factory orders</p>
          <p>{error}</p>
          <button
            onClick={load}
            className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/distributor-portal" className="hover:text-[#00b4c3]">
            Distributor Portal
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Factory Orders</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Factory Orders</h1>
        <p className="text-slate-500 text-sm mt-1">
          FUZE orders flowing in from the factories you supply.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} accent="amber" />
          <StatCard label="Approved" value={stats.approved} accent="emerald" />
          <StatCard label="Shipped" value={stats.shipped} accent="indigo" />
          <StatCard label="Delivered" value={stats.delivered} accent="cyan" />
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => setFilter(g.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              filter === g.id
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-500">No orders in this view.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Order</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Factory</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Tier</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs">Volume</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs">Price</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Brand(s)</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">PO</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-mono font-semibold text-[#00b4c3]">
                    <Link href={`/admin/orders/${o.id}/qr-label`} target="_blank" className="hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {o.factory?.name || "—"}
                    {o.factory?.country && (
                      <span className="ml-1 text-xs text-slate-400">· {o.factory.country}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {o.fuzeTier || "—"}
                    {o.distributorTierIndexAtOrder ? (
                      <span className="ml-1 text-xs text-slate-400">
                        · rung {o.distributorTierIndexAtOrder}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {o.volumeLiters ? `${o.volumeLiters} L` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-semibold">
                    {o.totalPrice != null
                      ? `${o.currency || "USD"} ${o.totalPrice.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700 text-xs">
                    {o.brandAllocations?.length ? (
                      <span>
                        {o.brandAllocations
                          .map((a: any) => `${a.brand?.name} ${a.allocatedPct}%`)
                          .join(", ")}
                      </span>
                    ) : o.brand?.name ? (
                      o.brand.name
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700 text-xs">
                    {o.poNumber || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        STATUS_COLORS[o.status] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const cls =
    accent === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : accent === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : accent === "indigo"
          ? "border-indigo-200 bg-indigo-50 text-indigo-900"
          : accent === "cyan"
            ? "border-cyan-200 bg-cyan-50 text-cyan-900"
            : "border-slate-200 bg-white text-slate-900";
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-xs uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-2xl font-black mt-1">{value ?? 0}</p>
    </div>
  );
}
