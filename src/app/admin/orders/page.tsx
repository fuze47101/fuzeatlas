// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
  QUOTED: { bg: "bg-blue-100", text: "text-blue-700", label: "Quoted" },
  PENDING_APPROVAL: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending Approval" },
  APPROVED: { bg: "bg-green-100", text: "text-green-700", label: "Approved" },
  PROCESSING: { bg: "bg-purple-100", text: "text-purple-700", label: "Processing" },
  SHIPPED: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Shipped" },
  DELIVERED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Delivered" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
};

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [shipForm, setShipForm] = useState({ trackingNumber: "", carrier: "" });

  const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user?.role || "");

  useEffect(() => {
    if (!isInternal) {
      router.push("/dashboard");
      return;
    }
    loadOrders();
  }, [user, showMineOnly]);

  async function loadOrders() {
    try {
      const url = showMineOnly ? "/api/orders?mine=true" : "/api/orders";
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setOrders(data.orders || []);
        setStats(data.stats || null);
      }
    } catch (e) {
      console.error("Failed to load orders:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(orderId: string, action: string, extraData?: any) {
    setUpdating(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action, adminNotes: adminNotes || undefined, ...extraData }),
      });
      const data = await res.json();
      if (data.ok) {
        const labels: Record<string, string> = {
          approve: "approved", process: "marked as processing",
          ship: "shipped", deliver: "delivered", cancel: "cancelled",
        };
        setSuccess(`Order ${labels[action] || "updated"} successfully!`);
        setAdminNotes("");
        setShipForm({ trackingNumber: "", carrier: "" });
        loadOrders();
        setSelectedOrder(null);
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(data.error || "Action failed");
      }
    } catch (e: any) {
      setError(e.message || "Error performing action");
    } finally {
      setUpdating(false);
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterType !== "all" && o.orderType !== filterType) return false;
      return true;
    });
  }, [orders, filterStatus, filterType]);

  // Priority orders needing action
  const actionNeeded = orders.filter((o) => o.status === "PENDING_APPROVAL");

  function formatCurrency(amount: number, currency = "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Order Management</h1>
          <p className="text-slate-500 mt-1">Review, approve, and track all FUZE orders</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showMineOnly}
            onChange={(e) => setShowMineOnly(e.target.checked)}
            className="rounded"
          />
          <span className="text-slate-600 font-medium">My accounts only</span>
        </label>
      </div>

      {/* Alerts */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">{success}</div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-bold">✕</button>
        </div>
      )}

      {/* Action Needed Banner */}
      {actionNeeded.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl animate-pulse">⚡</span>
            <p className="font-bold text-yellow-800">{actionNeeded.length} order{actionNeeded.length > 1 ? "s" : ""} awaiting approval</p>
          </div>
          <div className="space-y-1">
            {actionNeeded.slice(0, 5).map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                className="block w-full text-left text-sm text-yellow-700 hover:text-yellow-900 hover:underline"
              >
                {o.orderNumber} — {o.factory?.name} — {o.volumeLiters ? `${o.volumeLiters}L` : `${o.hangtagQty} hangtags`} — {formatCurrency(o.totalPrice || 0)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {[
            { label: "Total", value: stats.total, color: "" },
            { label: "Pending", value: stats.pending, color: "text-yellow-600" },
            { label: "Approved", value: stats.approved, color: "text-green-600" },
            { label: "Processing", value: stats.processing, color: "text-purple-600" },
            { label: "Shipped", value: stats.shipped, color: "text-indigo-600" },
            { label: "Delivered", value: stats.delivered, color: "text-emerald-600" },
            { label: "Revenue", value: formatCurrency(stats.totalRevenue || 0), color: "text-slate-900" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] text-slate-500 font-medium uppercase">{s.label}</p>
              <p className={`text-xl font-bold ${s.color || "text-slate-900"}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex flex-wrap gap-1">
          {["all", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "SHIPPED", "DELIVERED", "QUOTED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? "bg-[#00b4c3] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "All" : STATUS_COLORS[s]?.label || s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {["all", "PRODUCTION", "SAMPLE", "HANGTAG"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === t ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t === "all" ? "All Types" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-slate-500">No orders matching filters</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Order</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Factory</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Volume</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Brand</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Total</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Fulfillment</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.DRAFT;
                    const needsAction = order.status === "PENDING_APPROVAL";
                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          needsAction ? "bg-yellow-50/50 hover:bg-yellow-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-slate-700">{order.factory?.name || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium">{order.orderType}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {order.volumeLiters ? `${order.volumeLiters}L` : order.hangtagQty ? `${order.hangtagQty} tags` : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{order.brand?.name || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(order.totalPrice || 0, order.currency)}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {order.fulfillmentSource === "DIRECT_USA" ? "Direct USA" : order.distributor?.name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(order.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((order) => {
              const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.DRAFT;
              const needsAction = order.status === "PENDING_APPROVAL";
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer ${
                    needsAction ? "border-yellow-300 bg-yellow-50/30" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-900 text-sm">{order.orderNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>{order.factory?.name} — {order.orderType}</p>
                    <div className="flex justify-between">
                      <span>{order.volumeLiters ? `${order.volumeLiters}L` : `${order.hangtagQty || 0} tags`}</span>
                      <span className="font-bold text-slate-900">{formatCurrency(order.totalPrice || 0)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ═══ ORDER ACTION MODAL ═══ */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 pt-8 sm:pt-16">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedOrder.orderNumber}</h2>
                  <p className="text-sm text-slate-500">{selectedOrder.factory?.name} — {selectedOrder.orderType}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Order Summary */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-slate-500">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedOrder.status]?.bg} ${STATUS_COLORS[selectedOrder.status]?.text}`}>
                    {STATUS_COLORS[selectedOrder.status]?.label}
                  </span>
                </div>
                <div><p className="text-slate-500">Ordered By</p><p className="font-semibold">{selectedOrder.orderedBy?.name || "—"}</p></div>
                {selectedOrder.volumeLiters && (
                  <div><p className="text-slate-500">Volume</p><p className="font-semibold">{selectedOrder.volumeLiters}L ({selectedOrder.bottles} bottles)</p></div>
                )}
                {selectedOrder.hangtagQty && (
                  <div><p className="text-slate-500">Hangtags</p><p className="font-semibold">{selectedOrder.hangtagQty?.toLocaleString()}</p></div>
                )}
                <div><p className="text-slate-500">FUZE Tier</p><p className="font-semibold">{selectedOrder.fuzeTier || "—"}</p></div>
                <div><p className="text-slate-500">Price/L</p><p className="font-semibold">{formatCurrency(selectedOrder.pricePerLiter || 0)}</p></div>
                <div><p className="text-slate-500">Total</p><p className="font-bold text-lg">{formatCurrency(selectedOrder.totalPrice || 0)}</p></div>
                {selectedOrder.brand?.name && <div><p className="text-slate-500">Brand</p><p className="font-semibold">{selectedOrder.brand.name}</p></div>}
                {selectedOrder.fabric?.fuzeNumber && <div><p className="text-slate-500">Fabric</p><p className="font-semibold">{selectedOrder.fabric.fuzeNumber}</p></div>}
                <div><p className="text-slate-500">Fulfillment</p><p className="font-semibold">{selectedOrder.fulfillmentSource === "DIRECT_USA" ? "Direct from USA" : selectedOrder.distributor?.name || "TBD"}</p></div>
                <div><p className="text-slate-500">Account Manager</p><p className="font-semibold">{selectedOrder.accountManager?.name || "Unassigned"}</p></div>
                {selectedOrder.quoteNumber && <div><p className="text-slate-500">Quote</p><p className="font-semibold">{selectedOrder.quoteNumber}</p></div>}
              </div>

              {/* Sample subsidy */}
              {selectedOrder.isSampleSubsidized && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-green-800">FUZE Sample Subsidy: {formatCurrency(selectedOrder.subsidyAmount || 0)}</p>
                </div>
              )}

              {/* Shipping info */}
              {selectedOrder.shippingAddress && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <p className="text-slate-500 font-medium">Ship To</p>
                  <p className="text-slate-800">{selectedOrder.shippingAddress}, {selectedOrder.shippingCity}, {selectedOrder.shippingCountry}</p>
                </div>
              )}

              {/* Notes */}
              {(selectedOrder.purposeNote || selectedOrder.notes) && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  {selectedOrder.purposeNote && <p className="text-slate-700 mb-1"><strong>Purpose:</strong> {selectedOrder.purposeNote}</p>}
                  {selectedOrder.notes && <p className="text-slate-700"><strong>Notes:</strong> {selectedOrder.notes}</p>}
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes about this order..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-sm"
                />
              </div>

              {/* Actions by Status */}
              <div className="space-y-3">
                {selectedOrder.status === "PENDING_APPROVAL" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAction(selectedOrder.id, "approve")}
                      disabled={updating}
                      className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                    >
                      {updating ? "..." : "Approve Order"}
                    </button>
                    <button
                      onClick={() => { if (confirm("Cancel this order?")) handleAction(selectedOrder.id, "cancel"); }}
                      disabled={updating}
                      className="px-4 py-2.5 bg-red-50 text-red-700 rounded-lg font-semibold hover:bg-red-100 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {selectedOrder.status === "APPROVED" && (
                  <button
                    onClick={() => handleAction(selectedOrder.id, "process")}
                    disabled={updating}
                    className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
                  >
                    {updating ? "..." : "Start Processing"}
                  </button>
                )}

                {selectedOrder.status === "PROCESSING" && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Ship Order</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        value={shipForm.trackingNumber}
                        onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })}
                        placeholder="Tracking number"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00b4c3]"
                      />
                      <input
                        type="text"
                        value={shipForm.carrier}
                        onChange={(e) => setShipForm({ ...shipForm, carrier: e.target.value })}
                        placeholder="Carrier"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00b4c3]"
                      />
                    </div>
                    <button
                      onClick={() => handleAction(selectedOrder.id, "ship", shipForm)}
                      disabled={updating}
                      className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {updating ? "..." : "Mark as Shipped"}
                    </button>
                  </div>
                )}

                {selectedOrder.status === "SHIPPED" && (
                  <button
                    onClick={() => handleAction(selectedOrder.id, "deliver")}
                    disabled={updating}
                    className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {updating ? "..." : "Confirm Delivery"}
                  </button>
                )}

                {!["CANCELLED", "DELIVERED"].includes(selectedOrder.status) && (
                  <button
                    onClick={() => { if (confirm("Cancel this order?")) handleAction(selectedOrder.id, "cancel"); }}
                    disabled={updating}
                    className="w-full px-4 py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 disabled:opacity-50 text-sm"
                  >
                    Cancel Order
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
