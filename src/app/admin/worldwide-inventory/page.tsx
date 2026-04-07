// @ts-nocheck
"use client";

import { useState, useEffect } from "react";

interface DistributorStock {
  distributorId: string;
  name: string;
  country: string;
  region: string | null;
  city: string | null;
  location: string;
  stockLiters: number;
  stockKg: number;
  bottles: number;
  hangtagStock: number;
  reorderThreshold: number | null;
  belowThreshold: boolean;
  lastUpdated: string | null;
}

interface WeeklyData {
  weekLabel: string;
  weekStart: string;
  totalLiters: number;
  totalKg: number;
  orderCount: number;
  bySource: { name: string; liters: number; orders: number }[];
}

interface ShipmentSource {
  name: string;
  country: string;
  totalLiters: number;
  orderCount: number;
}

interface InTransitOrder {
  orderNumber: string;
  volumeLiters: number | null;
  bottles: number | null;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  distributor: { name: string; country: string } | null;
  factory: { name: string; country: string } | null;
}

interface WorldwideData {
  worldwide: {
    totalLiters: number;
    totalKg: number;
    totalBottles: number;
    totalHangtags: number;
    distributorCount: number;
    locationsWithStock: number;
    lowStockLocations: number;
    inTransitLiters: number;
  };
  distributors: DistributorStock[];
  weeklyConsumption: WeeklyData[];
  shipmentSources: ShipmentSource[];
  inTransit: InTransitOrder[];
}

export default function WorldwideInventoryDashboard() {
  const [data, setData] = useState<WorldwideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"overview" | "weekly" | "sources">("overview");

  useEffect(() => {
    fetch("/api/admin/worldwide-inventory")
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setData(res);
        else setError(res.error || "Failed to load");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">{error || "No data available"}</p>
        </div>
      </div>
    );
  }

  const { worldwide: ww, distributors, weeklyConsumption, shipmentSources, inTransit } = data;

  // Chart bar max for visual scaling
  const maxWeeklyLiters = Math.max(...weeklyConsumption.map((w) => w.totalLiters), 1);
  const maxDistLiters = Math.max(...distributors.map((d) => d.stockLiters), 1);
  const maxSourceLiters = Math.max(...shipmentSources.map((s) => s.totalLiters), 1);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Worldwide Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Global FUZE stock levels, consumption trends, and shipment tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            Updated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Stock"
          value={`${ww.totalLiters.toLocaleString()} L`}
          sub={`${ww.totalKg.toLocaleString()} kg`}
          icon="🌍"
          color="bg-blue-50 border-blue-200"
        />
        <KPICard
          label="Bottles Worldwide"
          value={ww.totalBottles.toLocaleString()}
          sub={`${ww.locationsWithStock} locations active`}
          icon="🧴"
          color="bg-green-50 border-green-200"
        />
        <KPICard
          label="In Transit"
          value={`${ww.inTransitLiters.toLocaleString()} L`}
          sub={`${inTransit.length} shipments`}
          icon="🚢"
          color="bg-purple-50 border-purple-200"
        />
        <KPICard
          label="Low Stock Alerts"
          value={ww.lowStockLocations.toString()}
          sub={`of ${ww.distributorCount} distributors`}
          icon="⚠️"
          color={ww.lowStockLocations > 0 ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}
          alert={ww.lowStockLocations > 0}
        />
      </div>

      {/* ─── View Tabs ─── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: "overview", label: "Distributor Breakdown" },
          { key: "weekly", label: "Weekly Consumption" },
          { key: "sources", label: "Shipment Sources" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              view === tab.key
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Distributor Breakdown ─── */}
      {view === "overview" && (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Distributor</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Location</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Stock (L)</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Stock (kg)</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Bottles</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Hangtags</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Inventory Level</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {distributors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      No distributors configured yet
                    </td>
                  </tr>
                ) : (
                  distributors.map((d) => (
                    <tr key={d.distributorId} className="border-b hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                      <td className="px-4 py-3 text-gray-600">{d.location}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        {d.stockLiters.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {d.stockKg.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">{d.bottles}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {d.hangtagStock.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                d.belowThreshold ? "bg-red-500" : d.stockLiters > 0 ? "bg-blue-500" : "bg-gray-300"
                              }`}
                              style={{ width: `${Math.min(100, (d.stockLiters / maxDistLiters) * 100)}%` }}
                            />
                          </div>
                          {d.reorderThreshold && (
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                              Min: {d.reorderThreshold}L
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {d.belowThreshold ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            LOW
                          </span>
                        ) : d.stockLiters > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            NO STOCK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
                {/* Totals row */}
                {distributors.length > 0 && (
                  <tr className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                    <td className="px-4 py-3 text-blue-900">WORLDWIDE TOTAL</td>
                    <td className="px-4 py-3 text-blue-700">{ww.locationsWithStock} locations</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-900">
                      {ww.totalLiters.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-900">
                      {ww.totalKg.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-900">
                      {ww.totalBottles.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-900">
                      {ww.totalHangtags.toLocaleString()}
                    </td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {/* Worldwide total card */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-blue-800 mb-2">WORLDWIDE TOTAL</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-blue-600">Stock (L)</div>
                  <div className="text-lg font-bold text-blue-900">{ww.totalLiters.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-600">Stock (kg)</div>
                  <div className="text-lg font-bold text-blue-900">{ww.totalKg.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-600">Bottles</div>
                  <div className="text-lg font-bold text-blue-900">{ww.totalBottles.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-600">Locations</div>
                  <div className="text-lg font-bold text-blue-900">{ww.locationsWithStock}</div>
                </div>
              </div>
            </div>

            {distributors.map((d) => (
              <div
                key={d.distributorId}
                className={`rounded-xl border p-4 ${
                  d.belowThreshold ? "bg-red-50 border-red-200" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">{d.name}</div>
                  {d.belowThreshold ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">LOW</span>
                  ) : d.stockLiters > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">OK</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">EMPTY</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-3">{d.location}</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs text-gray-500">Liters</div>
                    <div className="font-semibold">{d.stockLiters.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">kg</div>
                    <div className="font-semibold">{d.stockKg.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Bottles</div>
                    <div className="font-semibold">{d.bottles}</div>
                  </div>
                </div>
                {/* Bar */}
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${d.belowThreshold ? "bg-red-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(100, (d.stockLiters / maxDistLiters) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Weekly Consumption ─── */}
      {view === "weekly" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Weekly Consumption (Last 12 Weeks)</h2>
            <p className="text-sm text-gray-500 mb-6">
              Liters shipped per week from delivered orders, reducing worldwide inventory
            </p>

            {weeklyConsumption.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                No delivered orders in the last 12 weeks
              </div>
            ) : (
              <div className="space-y-3">
                {weeklyConsumption.map((week) => (
                  <div key={week.weekStart} className="group">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-36 text-sm text-gray-600 shrink-0">{week.weekLabel}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-7 bg-gray-50 rounded-md overflow-hidden relative">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-md transition-all"
                              style={{ width: `${Math.max(2, (week.totalLiters / maxWeeklyLiters) * 100)}%` }}
                            />
                          </div>
                          <div className="w-24 text-right">
                            <span className="font-mono font-semibold text-sm text-gray-900">
                              {week.totalLiters.toLocaleString()} L
                            </span>
                          </div>
                          <div className="w-16 text-right">
                            <span className="text-xs text-gray-500">{week.orderCount} orders</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Source breakdown on hover/focus */}
                    <div className="ml-36 pl-3 hidden group-hover:block">
                      {week.bySource.map((src, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-500 py-0.5">
                          <span className="w-2 h-2 rounded-full bg-blue-300" />
                          <span>{src.name}</span>
                          <span className="font-mono">{src.liters} L</span>
                          <span>({src.orders} orders)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Weekly average */}
                <div className="border-t pt-3 mt-3 flex items-center gap-3">
                  <div className="w-36 text-sm font-semibold text-gray-700">Weekly Average</div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1" />
                    <div className="w-24 text-right">
                      <span className="font-mono font-bold text-sm text-blue-700">
                        {Math.round(
                          weeklyConsumption.reduce((sum, w) => sum + w.totalLiters, 0) /
                            Math.max(1, weeklyConsumption.length)
                        ).toLocaleString()}{" "}
                        L
                      </span>
                    </div>
                    <div className="w-16 text-right">
                      <span className="text-xs text-gray-500">
                        {Math.round(
                          weeklyConsumption.reduce((sum, w) => sum + w.orderCount, 0) /
                            Math.max(1, weeklyConsumption.length)
                        )}{" "}
                        orders
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Consumption total summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="text-sm text-gray-500 mb-1">12-Week Total</div>
              <div className="text-2xl font-bold text-gray-900">
                {weeklyConsumption.reduce((sum, w) => sum + w.totalLiters, 0).toLocaleString()} L
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {weeklyConsumption.reduce((sum, w) => sum + w.totalKg, 0).toLocaleString()} kg
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-sm text-gray-500 mb-1">Total Orders</div>
              <div className="text-2xl font-bold text-gray-900">
                {weeklyConsumption.reduce((sum, w) => sum + w.orderCount, 0)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Delivered in 12 weeks</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-sm text-gray-500 mb-1">Projected Monthly</div>
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(
                  (weeklyConsumption.reduce((sum, w) => sum + w.totalLiters, 0) /
                    Math.max(1, weeklyConsumption.length)) *
                    4.33
                ).toLocaleString()}{" "}
                L
              </div>
              <div className="text-xs text-gray-400 mt-1">Based on weekly average</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Shipment Sources ─── */}
      {view === "sources" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Shipment Sources (All Time)</h2>
            <p className="text-sm text-gray-500 mb-6">
              Where FUZE orders have shipped from — distributors and direct fulfillment
            </p>

            {shipmentSources.length === 0 ? (
              <div className="py-12 text-center text-gray-400">No shipped orders yet</div>
            ) : (
              <div className="space-y-3">
                {shipmentSources.map((src, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-48 shrink-0">
                      <div className="font-medium text-gray-900 text-sm">{src.name}</div>
                      <div className="text-xs text-gray-500">{src.country}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-8 bg-gray-50 rounded-md overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-md"
                            style={{ width: `${Math.max(3, (src.totalLiters / maxSourceLiters) * 100)}%` }}
                          />
                        </div>
                        <div className="w-24 text-right">
                          <span className="font-mono font-semibold text-sm">{src.totalLiters.toLocaleString()} L</span>
                        </div>
                        <div className="w-20 text-right">
                          <span className="text-xs text-gray-500">{src.orderCount} orders</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* In Transit */}
          {inTransit.length > 0 && (
            <div className="bg-white rounded-xl border p-4 md:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Currently In Transit</h2>
              <p className="text-sm text-gray-500 mb-4">
                Active shipments reducing distributor inventory
              </p>

              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-3 py-2 font-semibold text-gray-600">Order</th>
                      <th className="px-3 py-2 font-semibold text-gray-600">From</th>
                      <th className="px-3 py-2 font-semibold text-gray-600">To</th>
                      <th className="px-3 py-2 font-semibold text-gray-600 text-right">Volume</th>
                      <th className="px-3 py-2 font-semibold text-gray-600">Status</th>
                      <th className="px-3 py-2 font-semibold text-gray-600">Tracking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inTransit.map((order, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs">{order.orderNumber}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {order.distributor?.name || "Direct (USA)"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {order.factory?.name || "—"}{" "}
                          {order.factory?.country && (
                            <span className="text-gray-400">({order.factory.country})</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {order.volumeLiters?.toLocaleString() || "—"} L
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              order.status === "SHIPPED"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {order.trackingNumber ? (
                            <span>
                              {order.carrier && <span className="font-medium">{order.carrier}: </span>}
                              {order.trackingNumber}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {inTransit.map((order, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs">{order.orderNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.status === "SHIPPED"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="text-sm">
                      {order.distributor?.name || "Direct (USA)"} → {order.factory?.name || "—"}
                    </div>
                    <div className="text-sm font-mono mt-1">{order.volumeLiters?.toLocaleString() || "—"} L</div>
                    {order.trackingNumber && (
                      <div className="text-xs text-gray-500 mt-1">
                        {order.carrier}: {order.trackingNumber}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KPI Card Component ───
function KPICard({
  label,
  value,
  sub,
  icon,
  color,
  alert,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  color: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${color} transition`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {alert && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
      </div>
      <div className="text-xl md:text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}
