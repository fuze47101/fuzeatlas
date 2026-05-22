// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  RECEIVED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const NEXT_STATUS: Record<string, string> = {
  PENDING_APPROVAL: "APPROVED",
  APPROVED: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "DELIVERED",
};

export default function AdminDistributorRestockPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const tx = (t as any).distributorRestockAdmin || {};
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPricing, setEditingPricing] = useState<string | null>(null);
  const [editingInventory, setEditingInventory] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (user && !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      router.push("/dashboard");
      return;
    }
    loadData();
  }, [user]);

  async function loadData() {
    try {
      const res = await fetch("/api/admin/distributor-restock");
      const data = await res.json();
      if (data.ok) setDistributors(data.distributors);
    } finally {
      setLoading(false);
    }
  }

  async function savePricing(distributorId: string) {
    const res = await fetch("/api/admin/distributor-restock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-pricing",
        distributorId,
        fuzeRestockPricePerLiter: form.fuzeRestockPricePerLiter,
        fuzeRestockCurrency: form.fuzeRestockCurrency || "USD",
        fuzeRestockNotes: form.fuzeRestockNotes,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setEditingPricing(null);
      setForm({});
      loadData();
    }
  }

  async function saveInventory(distributorId: string) {
    const res = await fetch("/api/admin/distributor-restock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-inventory",
        distributorId,
        fuzeStockLiters: form.fuzeStockLiters,
        fuzeStockBottles: form.fuzeStockBottles,
        reorderPointLiters: form.reorderPointLiters,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setEditingInventory(null);
      setForm({});
      loadData();
    }
  }

  async function advanceOrder(orderId: string, status: string, extras: any = {}) {
    await fetch("/api/admin/distributor-restock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-order-status", orderId, status, ...extras }),
    });
    setEditingOrder(null);
    setForm({});
    loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fmt = (amount: number, cur = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(amount);

  const totalPending = distributors.reduce((sum, d) => sum + (d.restockOrders?.length || 0), 0);
  const totalInventory = distributors.reduce((sum, d) => sum + (d.inventory?.fuzeStockLiters || 0), 0);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 mb-1">{tx.title || "Distributor Restock Management"}</h1>
        <p className="text-slate-600">{tx.subtitle || "FUZE → distributor pricing, stock levels, and order fulfillment"}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-500 mb-1">{tx.activeDistributors || "Active Distributors"}</p>
          <p className="text-3xl font-black text-slate-900">{distributors.length}</p>
        </div>
        <div className="bg-white border border-amber-300 bg-amber-50/50 rounded-xl p-5">
          <p className="text-sm text-amber-700 mb-1">{tx.openOrders || "Open Orders"}</p>
          <p className="text-3xl font-black text-amber-900">{totalPending}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-500 mb-1">{tx.distributorStockGlobal || "Distributor Stock (Global)"}</p>
          <p className="text-3xl font-black text-slate-900">{totalInventory.toLocaleString()}L</p>
        </div>
      </div>

      {/* Distributors List */}
      <div className="space-y-6">
        {distributors.map((d) => {
          const hasPricing = d.fuzeRestockPricePerLiter > 0;
          const stock = d.inventory?.fuzeStockLiters || 0;
          const reorder = d.inventory?.reorderPointLiters || 0;
          const isLow = reorder > 0 && stock < reorder;

          return (
            <div key={d.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-lg text-slate-900">{d.name}</h2>
                  <p className="text-sm text-slate-500">{d.city ? `${d.city}, ` : ""}{d.country || "—"}{d.localCurrency ? ` · ${d.localCurrency}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  {d.restockOrders?.length > 0 && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                      {d.restockOrders.length} {d.restockOrders.length > 1 ? (tx.openOrderPlural || "open orders") : (tx.openOrderSingular || "open order")}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-slate-200">
                {/* Pricing */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">{tx.fuzePricing || "FUZE Pricing"}</h3>
                    <button
                      onClick={() => {
                        setEditingPricing(editingPricing === d.id ? null : d.id);
                        setForm({
                          fuzeRestockPricePerLiter: d.fuzeRestockPricePerLiter || "",
                          fuzeRestockCurrency: d.fuzeRestockCurrency || "USD",
                          fuzeRestockNotes: d.fuzeRestockNotes || "",
                        });
                      }}
                      className="text-xs text-[#00b4c3] hover:underline font-semibold"
                    >
                      {editingPricing === d.id ? (tx.cancel || "Cancel") : (tx.edit || "Edit")}
                    </button>
                  </div>
                  {editingPricing === d.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={tx.pricePerL || "Price/L"}
                          value={form.fuzeRestockPricePerLiter}
                          onChange={(e) => setForm({ ...form, fuzeRestockPricePerLiter: e.target.value })}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        <select
                          value={form.fuzeRestockCurrency}
                          onChange={(e) => setForm({ ...form, fuzeRestockCurrency: e.target.value })}
                          className="px-2 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        placeholder={tx.pricingNotesPlaceholder || "Pricing notes (optional)"}
                        value={form.fuzeRestockNotes}
                        onChange={(e) => setForm({ ...form, fuzeRestockNotes: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <button
                        onClick={() => savePricing(d.id)}
                        className="w-full px-3 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg"
                      >
                        {tx.savePricing || "Save Pricing"}
                      </button>
                    </div>
                  ) : hasPricing ? (
                    <div>
                      <p className="text-2xl font-black text-slate-900">{fmt(d.fuzeRestockPricePerLiter, d.fuzeRestockCurrency)}<span className="text-sm font-medium text-slate-500">{tx.perLiter || "/liter"}</span></p>
                      {d.fuzeRestockNotes && <p className="text-xs text-slate-500 mt-1">{d.fuzeRestockNotes}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-red-600 font-medium">{tx.noPricingSet || "⚠ No pricing set"}</p>
                  )}
                </div>

                {/* Inventory */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">{tx.stockOnHand || "Stock on Hand"}</h3>
                    <button
                      onClick={() => {
                        setEditingInventory(editingInventory === d.id ? null : d.id);
                        setForm({
                          fuzeStockLiters: d.inventory?.fuzeStockLiters || 0,
                          fuzeStockBottles: d.inventory?.fuzeStockBottles || 0,
                          reorderPointLiters: d.inventory?.reorderPointLiters || 100,
                        });
                      }}
                      className="text-xs text-[#00b4c3] hover:underline font-semibold"
                    >
                      {editingInventory === d.id ? (tx.cancel || "Cancel") : (tx.edit || "Edit")}
                    </button>
                  </div>
                  {editingInventory === d.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          placeholder={tx.litersPh || "Liters"}
                          value={form.fuzeStockLiters}
                          onChange={(e) => setForm({ ...form, fuzeStockLiters: e.target.value })}
                          className="px-2 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          placeholder={tx.bottlesPh || "Bottles"}
                          value={form.fuzeStockBottles}
                          onChange={(e) => setForm({ ...form, fuzeStockBottles: e.target.value })}
                          className="px-2 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          placeholder={tx.reorderAtPh || "Reorder @"}
                          value={form.reorderPointLiters}
                          onChange={(e) => setForm({ ...form, reorderPointLiters: e.target.value })}
                          className="px-2 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <button
                        onClick={() => saveInventory(d.id)}
                        className="w-full px-3 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg"
                      >
                        {tx.saveInventory || "Save Inventory"}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className={`text-2xl font-black ${isLow ? "text-red-700" : "text-slate-900"}`}>
                        {stock.toLocaleString()}L
                      </p>
                      <p className="text-xs text-slate-500">
                        {d.inventory?.fuzeStockBottles || 0} {tx.bottlesSuffix || "bottles"} · {tx.reorderAtPrefix || "Reorder at"} {reorder}L
                        {isLow && <span className="text-red-600 font-semibold ml-1">{tx.lowFlag || "· LOW"}</span>}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Open Orders */}
              {d.restockOrders?.length > 0 && (
                <div className="border-t border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide mb-3">{tx.openOrdersHeader || "Open Orders"}</h3>
                  <div className="space-y-2">
                    {d.restockOrders.map((o: any) => (
                      <div key={o.id} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm text-slate-900">{o.orderNumber}</span>
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[o.status]}`}>
                                {o.status.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              {o.unitQuantity} × {o.unitType.replace("_", " ")} · {o.totalLiters.toLocaleString()}L · <strong>{fmt(o.totalPrice, o.currency)}</strong>
                            </p>
                            {o.trackingNumber && <p className="text-xs text-slate-500 mt-1">{tx.trackingLabel || "Tracking:"} {o.trackingNumber} ({o.carrier || "?"})</p>}
                          </div>
                          <div className="flex gap-2">
                            {NEXT_STATUS[o.status] && (
                              <button
                                onClick={() => {
                                  if (o.status === "PROCESSING") {
                                    setEditingOrder(o.id);
                                    setForm({ trackingNumber: "", carrier: "", estimatedDelivery: "" });
                                  } else {
                                    advanceOrder(o.id, NEXT_STATUS[o.status]);
                                  }
                                }}
                                className="px-3 py-1.5 bg-[#00b4c3] text-white text-xs font-semibold rounded-lg hover:bg-[#009aa8]"
                              >
                                → {NEXT_STATUS[o.status].replace("_", " ")}
                              </button>
                            )}
                            {o.status === "PENDING_APPROVAL" && (
                              <button
                                onClick={() => advanceOrder(o.id, "CANCELLED")}
                                className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200"
                              >
                                {tx.cancelBtn || "Cancel"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Ship Form */}
                        {editingOrder === o.id && (
                          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder={tx.trackingNumPh || "Tracking #"}
                                value={form.trackingNumber}
                                onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              />
                              <input
                                type="text"
                                placeholder={tx.carrierPh || "Carrier (DHL, FedEx...)"}
                                value={form.carrier}
                                onChange={(e) => setForm({ ...form, carrier: e.target.value })}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              />
                              <input
                                type="date"
                                value={form.estimatedDelivery}
                                onChange={(e) => setForm({ ...form, estimatedDelivery: e.target.value })}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <button
                              onClick={() => advanceOrder(o.id, "SHIPPED", {
                                trackingNumber: form.trackingNumber,
                                carrier: form.carrier,
                                estimatedDelivery: form.estimatedDelivery,
                              })}
                              className="w-full px-3 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg"
                            >
                              {tx.markShipped || "Mark as Shipped"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
