// @ts-nocheck
"use client";

/**
 * /admin/distributors/inventory
 *
 * Single-screen, sortable inventory + burn-rate roll-up across every
 * active distributor. Built for Andrew's Monday morning spot-check —
 * "who's about to run out, who hasn't moved a liter in 90 days, who
 * still doesn't have FUZE pricing set."
 *
 * Companion to /admin/distributors (which is the per-distributor edit
 * surface). This page is read-only — every cell links back to the
 * relevant edit surface.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  factoryCount: number;
  stockLiters: number;
  stockBottles: number;
  reorderPointLiters: number;
  lowStock: boolean;
  idle: boolean;
  noPriceSet: boolean;
  noFactories: boolean;
  lastShipmentDate: string | null;
  lastShipmentLiters: number | null;
  lastShipmentOrderNumber: string | null;
  last90DaysOutbound: number;
  last90DaysOrderCount: number;
  dailyBurn: number;
  daysOfStockLeft: number | null;
  fuzeRestockPricePerLiter: number | null;
  fuzeRestockCurrency: string | null;
  inventoryUpdatedAt: string | null;
}

interface Summary {
  total: number;
  lowStock: number;
  idle: number;
  noPriceSet: number;
  noFactories: number;
  totalStockLiters: number;
  totalDailyBurn: number;
}

export default function AdminDistributorsInventoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (
      !["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role)
    ) {
      router.push("/home");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/admin/distributors-inventory");
        const json = await res.json();
        if (json.ok) {
          setRows(json.distributors);
          setSummary(json.summary);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : "—";

  const fmtPrice = (n: number | null, c: string | null) =>
    n != null ? `${c || "USD"} ${n.toFixed(2)}/L` : "—";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/admin" className="hover:text-[#00b4c3]">
              Admin
            </Link>
            <span>/</span>
            <Link href="/admin/distributors" className="hover:text-[#00b4c3]">
              Distributors
            </Link>
            <span>/</span>
            <span>Inventory</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900">
            Distributor Inventory & Burn Rate
          </h1>
          <p className="text-slate-600 mt-1">
            Stock on hand, 90-day burn rate, projected runout — sortable
            spot-check view across every active distributor.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Looking for hangtag inventory, weekly consumption charts, or
            in-transit shipment tracking?{" "}
            <Link
              href="/admin/worldwide-inventory"
              className="text-blue-600 hover:underline font-semibold"
            >
              Open the worldwide dashboard view →
            </Link>
          </p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <SummaryCard
            label="Distributors"
            value={summary.total.toString()}
            icon="🌍"
          />
          <SummaryCard
            label="Total Stock"
            value={`${summary.totalStockLiters.toLocaleString()}L`}
            icon="🧴"
          />
          <SummaryCard
            label="Total Daily Burn"
            value={`${summary.totalDailyBurn.toLocaleString()} L/day`}
            icon="🔥"
          />
          <SummaryCard
            label="Low Stock"
            value={summary.lowStock.toString()}
            icon="⚠"
            warn={summary.lowStock > 0}
          />
          <SummaryCard
            label="Idle 90d"
            value={summary.idle.toString()}
            icon="💤"
          />
          <SummaryCard
            label="Missing Pricing"
            value={summary.noPriceSet.toString()}
            icon="🚫"
            warn={summary.noPriceSet > 0}
          />
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Distributor</th>
              <th className="text-right px-3 py-3">Stock</th>
              <th className="text-right px-3 py-3">Reorder pt</th>
              <th className="text-right px-3 py-3">Days left</th>
              <th className="text-right px-3 py-3">Burn (L/day)</th>
              <th className="text-right px-3 py-3">90d out</th>
              <th className="text-left px-3 py-3">Last ship in</th>
              <th className="text-left px-3 py-3">FUZE $/L</th>
              <th className="text-right px-3 py-3">Factories</th>
              <th className="text-left px-4 py-3">Health</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, idx) => {
              const flags: string[] = [];
              if (d.lowStock) flags.push("LOW STOCK");
              if (d.idle) flags.push("IDLE");
              if (d.noPriceSet) flags.push("NO PRICE");
              if (d.noFactories) flags.push("NO FACTORIES");
              const healthy = flags.length === 0;

              return (
                <tr
                  key={d.id}
                  className={
                    idx % 2 === 0
                      ? "bg-white border-b border-slate-100"
                      : "bg-slate-50/40 border-b border-slate-100"
                  }
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{d.name}</div>
                    <div className="text-xs text-slate-500">
                      {[d.city, d.country].filter(Boolean).join(", ") || "—"}
                    </div>
                  </td>
                  <td
                    className={`px-3 py-3 text-right tabular-nums font-semibold ${
                      d.lowStock ? "text-red-700" : ""
                    }`}
                  >
                    {d.stockLiters.toLocaleString()}L
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                    {d.reorderPointLiters > 0
                      ? `${d.reorderPointLiters}L`
                      : "—"}
                  </td>
                  <td
                    className={`px-3 py-3 text-right tabular-nums font-bold ${
                      d.daysOfStockLeft != null && d.daysOfStockLeft < 30
                        ? "text-red-700"
                        : d.daysOfStockLeft != null &&
                            d.daysOfStockLeft < 60
                          ? "text-amber-600"
                          : ""
                    }`}
                  >
                    {d.daysOfStockLeft != null ? d.daysOfStockLeft : "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {d.dailyBurn}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {d.last90DaysOutbound.toLocaleString()}L
                    {d.last90DaysOrderCount > 0 && (
                      <span className="text-xs text-slate-400 ml-1">
                        ({d.last90DaysOrderCount})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {d.lastShipmentDate ? (
                      <>
                        {fmtDate(d.lastShipmentDate)}
                        {d.lastShipmentLiters && (
                          <span className="text-slate-400 ml-1">
                            ({d.lastShipmentLiters}L)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">never</span>
                    )}
                  </td>
                  <td
                    className={`px-3 py-3 text-xs ${
                      d.noPriceSet ? "text-red-600 font-semibold" : ""
                    }`}
                  >
                    {fmtPrice(
                      d.fuzeRestockPricePerLiter,
                      d.fuzeRestockCurrency,
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {d.factoryCount}
                  </td>
                  <td className="px-4 py-3">
                    {healthy ? (
                      <span className="text-emerald-600 text-xs font-bold">
                        ✓ healthy
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {flags.map((f) => (
                          <span
                            key={f}
                            className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        Sorted: low-stock first, then idle, then by days-of-stock-left
        ascending. &quot;Daily burn&quot; = rolling 90-day average of liters
        shipped to factories. &quot;Days left&quot; = current stock ÷ daily
        burn. &quot;Idle&quot; = no factory orders in last 90 days. &quot;No
        price&quot; means FUZE wholesale rate is unset; the distributor
        cannot place restock orders. Edit on the per-distributor page.
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  warn,
}: {
  label: string;
  value: string;
  icon: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        warn
          ? "bg-red-50 border-red-300"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-slate-600 uppercase tracking-wide">
          {label}
        </p>
        <span className="text-lg">{icon}</span>
      </div>
      <p
        className={`text-2xl font-black tabular-nums ${
          warn ? "text-red-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
