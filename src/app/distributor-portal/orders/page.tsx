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

const UNIT_META: Record<string, { label: string; liters: number; desc: string; icon: string }> = {
  CARBOY: { label: "Carboy", liters: 19, desc: "19L — single bottle", icon: "🧴" },
  GAYLORD: { label: "Gaylord", liters: 608, desc: "32 carboys · 608L", icon: "📦" },
  CONTAINER_20: { label: "20' Container", liters: 6080, desc: "10 gaylords · 6,080L", icon: "🚛" },
  CONTAINER_40: {
    label: "40' Container",
    liters: 12160,
    desc: "20 gaylords · 12,160L",
    icon: "🚢",
  },
};

export default function DistributorOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [shipForm, setShipForm] = useState({ trackingNumber: "", carrier: "", batchId: "" });
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState("");

  // Create order state
  const [showCreate, setShowCreate] = useState(false);
  const [factories, setFactories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  // Surface backend signals so the modal can guide the user instead of
  // silently showing an empty dropdown (KJ Tang demo bug — Apr 2026).
  const [unlinkedUser, setUnlinkedUser] = useState(false);
  const [factoryLoadError, setFactoryLoadError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    factoryId: "",
    orderType: "PRODUCTION",
    unitType: "GAYLORD",
    unitQuantity: 1,
    fuzeTier: "F1",
    brandId: "",
    notes: "",
    shippingAddress: "",
    shippingCity: "",
    shippingCountry: "",
  });

  useEffect(() => {
    if (user?.role !== "DISTRIBUTOR_USER" && !["ADMIN", "EMPLOYEE"].includes(user?.role || "")) {
      router.push("/home");
      return;
    }
    loadOrders();
    loadBatches();
    loadFactoriesAndBrands();
  }, [user]);

  async function loadOrders() {
    try {
      const res = await fetch("/api/orders");
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

  async function loadBatches() {
    try {
      const res = await fetch("/api/admin/batches");
      const data = await res.json();
      if (data.ok) setBatches((data.batches || []).filter((b: any) => b.qcPassed));
    } catch {}
  }

  async function loadFactoriesAndBrands() {
    setFactoryLoadError(null);
    try {
      const [fRes, bRes] = await Promise.all([
        fetch("/api/distributor-portal/pricing"),
        fetch("/api/brands?limit=200"),
      ]);
      const fData = await fRes.json();
      const bData = await bRes.json();
      if (fData.ok) {
        setFactories(fData.factories || []);
        // Surface graceful-degradation signal from API: distributor user
        // exists but has no distributorId on their record — show admin
        // a heads-up rather than a mystery empty dropdown.
        setUnlinkedUser(Boolean(fData.unlinkedUser));
      } else {
        setFactoryLoadError(fData.error || "Could not load factory list");
        console.error("Factory load failed:", fData);
      }
      if (bData.ok || bData.brands) setBrands(bData.brands || []);
    } catch (e: any) {
      setFactoryLoadError(e?.message || "Network error loading factories");
      console.error("loadFactoriesAndBrands error:", e);
    }
  }

  const createVolumeLiters = useMemo(() => {
    const meta = UNIT_META[createForm.unitType];
    if (!meta) return 0;
    return meta.liters * createForm.unitQuantity;
  }, [createForm.unitType, createForm.unitQuantity]);

  const createBottles = useMemo(() => {
    return Math.ceil(createVolumeLiters / 19);
  }, [createVolumeLiters]);

  async function handleCreateOrder() {
    if (!createForm.factoryId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factoryId: createForm.factoryId,
          orderType: createForm.orderType,
          volumeLiters: createVolumeLiters,
          bottles: createBottles,
          fuzeTier: createForm.fuzeTier,
          brandId: createForm.brandId || undefined,
          notes: createForm.notes || undefined,
          shippingAddress: createForm.shippingAddress || undefined,
          shippingCity: createForm.shippingCity || undefined,
          shippingCountry: createForm.shippingCountry || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Order ${data.order?.orderNumber || ""} created!`);
        setShowCreate(false);
        setCreateForm({
          factoryId: "",
          orderType: "PRODUCTION",
          unitType: "GAYLORD",
          unitQuantity: 1,
          fuzeTier: "F1",
          brandId: "",
          notes: "",
          shippingAddress: "",
          shippingCity: "",
          shippingCountry: "",
        });
        loadOrders();
        setTimeout(() => setSuccess(""), 4000);
      } else {
        alert(data.error || "Failed to create order");
      }
    } catch (e) {
      console.error("Create order error:", e);
      alert("Failed to create order");
    } finally {
      setCreating(false);
    }
  }

  async function handleAction(orderId: string, action: string, extraData?: any) {
    setUpdating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action, ...extraData }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(
          `Order ${action === "ship" ? "shipped" : action === "deliver" ? "delivered" : "updated"}!`,
        );
        loadOrders();
        setSelectedOrder(null);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (e) {
      console.error("Action failed:", e);
    } finally {
      setUpdating(false);
    }
  }

  const filteredOrders = useMemo(() => {
    if (filterStatus === "all") return orders;
    return orders.filter((o) => o.status === filterStatus);
  }, [orders, filterStatus]);

  function formatCurrency(amount: number, currency = "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 mt-1">
            Orders assigned to your distribution center for fulfillment
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009ba8] transition-colors shadow-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <span className="text-lg">+</span> Create Factory Order
        </button>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total Orders</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
            <p className="text-xs text-yellow-600">Awaiting Fulfillment</p>
            <p className="text-2xl font-bold text-yellow-700">
              {orders.filter((o) => ["APPROVED", "PROCESSING"].includes(o.status)).length}
            </p>
          </div>
          <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
            <p className="text-xs text-indigo-600">In Transit</p>
            <p className="text-2xl font-bold text-indigo-700">{stats.shipped}</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <p className="text-xs text-green-600">Revenue</p>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(stats.totalRevenue || 0)}
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "APPROVED", "PROCESSING", "SHIPPED", "DELIVERED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === s
                ? "bg-[#00b4c3] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "all" ? "All" : STATUS_COLORS[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-slate-500">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.DRAFT;
            const needsAction = ["APPROVED"].includes(order.status);
            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`bg-white rounded-xl border p-4 sm:p-5 hover:shadow-md transition-all cursor-pointer ${
                  needsAction ? "border-yellow-300 bg-yellow-50/50" : "border-slate-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{order.orderNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}
                      >
                        {statusInfo.label}
                      </span>
                      {needsAction && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-200 text-yellow-800 animate-pulse">
                          ACTION NEEDED
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                      <span>{order.factory?.name || "Unknown factory"}</span>
                      {order.volumeLiters && <span>{order.volumeLiters}L</span>}
                      {order.brand?.name && <span>Brand: {order.brand.name}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      {formatCurrency(order.totalPrice || 0, order.currency)}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Factory Order Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 pt-8 sm:pt-12">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Record Factory Order</h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Record an order a factory has placed with you. The factory
                is the buyer; you fulfill from your warehouse stock. Use{" "}
                <a
                  href="/distributor-portal/restock"
                  className="text-[#00b4c3] underline font-semibold"
                >
                  Restock from FUZE
                </a>{" "}
                to order replacement product from Salt Lake.
              </p>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Factory Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Factory *</label>

                {/* Soft warning when this user isn't linked to a distributor —
                    they can still place an order against any active factory,
                    but pricing tiers won't apply until admin links the account. */}
                {unlinkedUser && (
                  <div className="mb-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                    <span className="font-semibold">Heads up:</span> your user isn't linked to a
                    distributor record yet, so distributor pricing tiers won't auto-apply. You can
                    still place an order — ask an admin to link your account for full pricing.
                  </div>
                )}

                {/* Hard error fallback — only fires if the API itself failed. */}
                {factoryLoadError && (
                  <div className="mb-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
                    <span className="font-semibold">Couldn't load factories:</span>{" "}
                    {factoryLoadError}.{" "}
                    <button
                      type="button"
                      onClick={() => loadFactoriesAndBrands()}
                      className="underline font-semibold"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Empty-state guard — show helpful message instead of an
                    empty dropdown the user can't act on. */}
                {!factoryLoadError && factories.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    No factories available to order from. This usually means your account hasn't
                    been linked to a distributor yet — please contact your Atlas admin.
                  </div>
                ) : (
                  <select
                    value={createForm.factoryId}
                    onChange={(e) => setCreateForm({ ...createForm, factoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none bg-white"
                  >
                    <option value="">— Select factory —</option>
                    {factories.filter((f: any) => f.assigned).length > 0 && (
                      <optgroup label="Your Factories">
                        {factories
                          .filter((f: any) => f.assigned)
                          .map((f: any) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                              {f.country ? ` (${f.country})` : ""}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {factories.filter((f: any) => f.inCoverage).length > 0 && (
                      <optgroup label="In Your Territory">
                        {factories
                          .filter((f: any) => f.inCoverage)
                          .map((f: any) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                              {f.country ? ` (${f.country})` : ""}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {factories.filter((f: any) => !f.assigned && !f.inCoverage).length > 0 && (
                      <optgroup label="Other Factories">
                        {factories
                          .filter((f: any) => !f.assigned && !f.inCoverage)
                          .map((f: any) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                              {f.country ? ` (${f.country})` : ""}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>

              {/* Order Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Order Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "PRODUCTION", label: "Production", icon: "🏭" },
                    { value: "SAMPLE", label: "Sample", icon: "🧪" },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, orderType: t.value })}
                      className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        createForm.orderType === t.value
                          ? "border-[#00b4c3] bg-[#00b4c3]/10 text-[#00b4c3]"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unit Type + Quantity */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Package Size
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {Object.entries(UNIT_META).map(([key, meta]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, unitType: key })}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                        createForm.unitType === key
                          ? "border-[#00b4c3] bg-[#00b4c3]/10"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-lg">{meta.icon}</span>
                      <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                      <p className="text-[10px] text-slate-500">{meta.desc}</p>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Quantity</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={createForm.unitQuantity}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          unitQuantity: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-center"
                    />
                    <span className="text-sm text-slate-500">
                      = <strong>{createVolumeLiters.toLocaleString()}L</strong> ({createBottles}{" "}
                      bottles)
                    </span>
                  </div>
                </div>
              </div>

              {/* FUZE Tier */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">FUZE Tier</label>
                <div className="grid grid-cols-4 gap-2">
                  {["F1", "F2", "F3", "F4"].map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, fuzeTier: tier })}
                      className={`px-3 py-2 rounded-lg border text-sm font-bold transition-colors ${
                        createForm.fuzeTier === tier
                          ? "border-[#00b4c3] bg-[#00b4c3]/10 text-[#00b4c3]"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  F1 = 1.0 mg/kg · F2 = 0.75 · F3 = 0.5 · F4 = 0.25
                </p>
              </div>

              {/* Brand (optional) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Brand <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <select
                  value={createForm.brandId}
                  onChange={(e) => setCreateForm({ ...createForm, brandId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none bg-white"
                >
                  <option value="">— No brand —</option>
                  {brands.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shipping */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Shipping Details <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={createForm.shippingAddress}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, shippingAddress: e.target.value })
                    }
                    placeholder="Address"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={createForm.shippingCity}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, shippingCity: e.target.value })
                      }
                      placeholder="City"
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-sm"
                    />
                    <input
                      type="text"
                      value={createForm.shippingCountry}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, shippingCountry: e.target.value })
                      }
                      placeholder="Country"
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Notes <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="PO number, special instructions, etc."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-sm resize-none"
                />
              </div>

              {/* Summary */}
              {createForm.factoryId && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                    Order Summary
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-500">Factory:</span>{" "}
                      <span className="font-semibold">
                        {factories.find((f: any) => f.id === createForm.factoryId)?.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Type:</span>{" "}
                      <span className="font-semibold">{createForm.orderType}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Package:</span>{" "}
                      <span className="font-semibold">
                        {createForm.unitQuantity}x {UNIT_META[createForm.unitType]?.label}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Volume:</span>{" "}
                      <span className="font-semibold">{createVolumeLiters.toLocaleString()}L</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Tier:</span>{" "}
                      <span className="font-semibold">{createForm.fuzeTier}</span>
                    </div>
                    {createForm.brandId && (
                      <div>
                        <span className="text-slate-500">Brand:</span>{" "}
                        <span className="font-semibold">
                          {brands.find((b: any) => b.id === createForm.brandId)?.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    Pricing will be auto-calculated from your distributor pricing tiers.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={creating || !createForm.factoryId}
                className="flex-1 px-4 py-2.5 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009ba8] transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail / Action Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 pt-8 sm:pt-16">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">{selectedOrder.orderNumber}</h2>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Factory</p>
                  <p className="font-semibold">{selectedOrder.factory?.name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Type</p>
                  <p className="font-semibold">{selectedOrder.orderType}</p>
                </div>
                {selectedOrder.volumeLiters && (
                  <div>
                    <p className="text-slate-500">Volume</p>
                    <p className="font-semibold">
                      {selectedOrder.volumeLiters}L ({selectedOrder.bottles} bottles)
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(selectedOrder.totalPrice || 0)}
                  </p>
                </div>
                {selectedOrder.shippingAddress && (
                  <div className="col-span-2">
                    <p className="text-slate-500">Ship To</p>
                    <p className="font-semibold">
                      {selectedOrder.shippingAddress}, {selectedOrder.shippingCity},{" "}
                      {selectedOrder.shippingCountry}
                    </p>
                  </div>
                )}
              </div>

              {/* Fulfillment Actions */}
              {selectedOrder.status === "APPROVED" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="font-semibold text-yellow-800 mb-3">Mark as Processing</p>
                  <button
                    onClick={() => handleAction(selectedOrder.id, "process")}
                    disabled={updating}
                    className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {updating ? "Updating..." : "Start Processing"}
                  </button>
                </div>
              )}

              {selectedOrder.status === "PROCESSING" && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="font-semibold text-purple-800 mb-3">Ship Order</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={shipForm.trackingNumber}
                      onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })}
                      placeholder="Tracking number"
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                    />
                    <input
                      type="text"
                      value={shipForm.carrier}
                      onChange={(e) => setShipForm({ ...shipForm, carrier: e.target.value })}
                      placeholder="Carrier (FedEx, DHL...)"
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                    />
                  </div>
                  {batches.length > 0 && (
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-purple-800 mb-1">
                        Production Batch (which batch did these bottles come from?)
                      </label>
                      <select
                        value={shipForm.batchId}
                        onChange={(e) => setShipForm({ ...shipForm, batchId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none bg-white"
                      >
                        <option value="">— Select batch —</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.batchCode} · {b.volumeProducedLiters}L ·{" "}
                            {new Date(b.productionDate).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-purple-700 mt-1">
                        Ties the QR sticker to this order's lifecycle timeline.
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => handleAction(selectedOrder.id, "ship", shipForm)}
                    disabled={updating}
                    className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {updating ? "Shipping..." : "Mark as Shipped"}
                  </button>
                </div>
              )}

              {selectedOrder.status === "SHIPPED" && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="font-semibold text-indigo-800 mb-3">Confirm Delivery</p>
                  {selectedOrder.trackingNumber && (
                    <p className="text-sm text-indigo-600 mb-3">
                      Tracking: {selectedOrder.trackingNumber} ({selectedOrder.carrier || "—"})
                    </p>
                  )}
                  <button
                    onClick={() => handleAction(selectedOrder.id, "deliver")}
                    disabled={updating}
                    className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {updating ? "Confirming..." : "Mark as Delivered"}
                  </button>
                </div>
              )}

              <a
                href={`/factory-portal/orders/${selectedOrder.id}`}
                className="block w-full text-center px-4 py-2.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
              >
                Open full lifecycle view →
              </a>
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
