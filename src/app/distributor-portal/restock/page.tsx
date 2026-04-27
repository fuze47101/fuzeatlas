// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Distributor {
  id: string;
  name: string;
  country: string | null;
  address: string | null;
  city: string | null;
  fuzeRestockPricePerLiter: number | null;
  fuzeRestockCurrency: string | null;
  fuzeRestockNotes: string | null;
  parentDistributorId: string | null;
  parentDistributor: {
    id: string;
    name: string;
    country: string | null;
    subDistributorPricePerLiter: number | null;
    subDistributorCurrency: string | null;
    subDistributorNotes: string | null;
  } | null;
}

interface EffectivePricing {
  pricePerLiter: number | null;
  currency: string;
  sourceName: string;
  ordersFromParent: boolean;
}

interface Order {
  id: string;
  orderNumber: string;
  unitType: string;
  unitQuantity: number;
  totalLiters: number;
  pricePerLiter: number;
  currency: string;
  totalPrice: number;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  shippedDate: string | null;
  estimatedDelivery: string | null;
  deliveredDate: string | null;
  receivedConfirmedAt: string | null;
  notes: string | null;
  createdAt: string;
}

const UNIT_META: Record<string, { label: string; liters: number; desc: string; icon: string }> = {
  CARBOY: { label: "Carboy", liters: 19, desc: "19L — single bottle (USA only)", icon: "🧴" },
  GAYLORD: { label: "Gaylord", liters: 608, desc: "32 carboys · 608L — international minimum", icon: "📦" },
  CONTAINER_20: { label: "20' Container", liters: 6080, desc: "10 gaylords · 6,080L", icon: "🚛" },
  CONTAINER_40: { label: "40' Container", liters: 12160, desc: "20 gaylords · 12,160L", icon: "🚢" },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  RECEIVED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function DistributorRestockPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [effective, setEffective] = useState<EffectivePricing | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Order form
  const [selectedUnit, setSelectedUnit] = useState<string>("GAYLORD");
  const [quantity, setQuantity] = useState<number>(1);
  const [useDefaultShipping, setUseDefaultShipping] = useState(true);
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingCountry, setShippingCountry] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (user && user.role !== "DISTRIBUTOR_USER" && !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      router.push("/dashboard");
      return;
    }
    loadData();
  }, [user]);

  async function loadData() {
    try {
      const res = await fetch("/api/distributor-portal/restock");
      const data = await res.json();
      if (data.ok) {
        setDistributor(data.distributor);
        setEffective(data.effective || null);
        setOrders(data.orders);
      } else {
        setError(data.error || "Failed to load");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const payload: any = {
        unitType: selectedUnit,
        unitQuantity: quantity,
        notes,
      };
      if (!useDefaultShipping) {
        payload.shippingAddress = shippingAddress;
        payload.shippingCity = shippingCity;
        payload.shippingCountry = shippingCountry;
      }

      const res = await fetch("/api/distributor-portal/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.ok) {
        setOrders([data.order, ...orders]);
        setQuantity(1);
        setNotes("");
        setSuccess(`Order ${data.order.orderNumber} submitted — awaiting FUZE approval`);
        setTimeout(() => setSuccess(""), 6000);
      } else {
        setError(data.error || "Failed to submit order");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Use the effective pricing the API computed (handles sub-of-master
  // case automatically). Fall back to local fields for safety.
  const price =
    effective?.pricePerLiter ?? distributor?.fuzeRestockPricePerLiter ?? 0;
  const currency =
    effective?.currency || distributor?.fuzeRestockCurrency || "USD";
  const sourceName = effective?.sourceName || "FUZE HQ";
  const ordersFromParent = !!effective?.ordersFromParent;
  const parent = distributor?.parentDistributor || null;
  const isUSA = (distributor?.country || "").toUpperCase().includes("USA") ||
                (distributor?.country || "").toUpperCase().includes("UNITED STATES");

  const unitLiters = UNIT_META[selectedUnit]?.liters || 0;
  const totalLiters = unitLiters * quantity;
  const totalPrice = price * totalLiters;

  const formatCurrency = (amount: number, cur = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(amount);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/distributor-portal" className="hover:text-[#00b4c3]">Distributor Portal</Link>
          <span>›</span>
          <span>Restock from {sourceName}</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-1">
          Restock from {sourceName}
        </h1>
        <p className="text-slate-600">
          {ordersFromParent && parent
            ? `Order FUZE product from your master distributor — ${parent.name}${parent.country ? `, ${parent.country}` : ""}.`
            : "Order FUZE product directly from FUZE HQ in Salt Lake City"}
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-2 font-bold">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✓ {success}
        </div>
      )}

      {/* Pricing Card */}
      <div className="mb-6 bg-gradient-to-br from-[#00b4c3] to-[#009ba8] rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-white/80 mb-1">
              Your price from {sourceName}
            </p>
            {price > 0 ? (
              <>
                <p className="text-4xl font-black">{formatCurrency(price, currency)}<span className="text-lg font-medium">/liter</span></p>
                <p className="text-sm text-white/80 mt-1">
                  All orders priced in {currency}
                  {ordersFromParent
                    ? ""
                    : " · FOB Salt Lake City"}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-black">Pricing Not Set</p>
                <p className="text-sm text-white/90 mt-1">
                  {ordersFromParent
                    ? `Ask ${sourceName} to set their master→sub wholesale price.`
                    : "Contact andrew@fuze47.com to establish your pricing"}
                </p>
              </>
            )}
          </div>
          <span className="text-4xl">💧</span>
        </div>
        {(ordersFromParent
          ? parent?.subDistributorNotes
          : distributor?.fuzeRestockNotes) && (
          <div className="mt-3 pt-3 border-t border-white/20 text-sm text-white/90">
            {ordersFromParent
              ? parent?.subDistributorNotes
              : distributor?.fuzeRestockNotes}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Order Form ── */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">New Restock Order</h2>

            {/* Unit Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-3">Select Unit Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(UNIT_META).map(([key, meta]) => {
                  const disabled = !isUSA && key === "CARBOY";
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedUnit(key)}
                      className={`text-left p-4 rounded-lg border-2 transition-all ${
                        disabled
                          ? "border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed"
                          : selectedUnit === key
                            ? "border-[#00b4c3] bg-cyan-50"
                            : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{meta.icon}</span>
                          <span className="font-bold text-slate-900">{meta.label}</span>
                        </div>
                        {selectedUnit === key && !disabled && (
                          <span className="text-[#00b4c3] text-xl">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">{meta.desc}</p>
                      {price > 0 && !disabled && (
                        <p className="text-sm font-bold text-[#00b4c3] mt-2">
                          {formatCurrency(price * meta.liters, currency)} each
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
              {!isUSA && (
                <p className="text-xs text-slate-500 mt-2">
                  International distributors: minimum 1 Gaylord (32 carboys / 608L)
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-lg border border-slate-300 hover:bg-slate-50 font-bold text-xl"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 text-center text-xl font-bold px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 rounded-lg border border-slate-300 hover:bg-slate-50 font-bold text-xl"
                >
                  +
                </button>
                <span className="text-sm text-slate-500 ml-2">
                  × {UNIT_META[selectedUnit]?.label} = <strong>{totalLiters.toLocaleString()}L</strong>
                </span>
              </div>
            </div>

            {/* Shipping */}
            <div className="mb-6">
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={useDefaultShipping}
                  onChange={(e) => setUseDefaultShipping(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-semibold text-slate-700">Ship to registered address</span>
              </label>
              {useDefaultShipping ? (
                <div className="text-sm text-slate-600 pl-6 bg-slate-50 rounded-lg p-3">
                  {distributor?.address || "No address on file"}<br />
                  {distributor?.city}{distributor?.city && distributor?.country ? ", " : ""}{distributor?.country}
                </div>
              ) : (
                <div className="space-y-2 pl-6">
                  <input
                    type="text"
                    placeholder="Shipping address"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="City"
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Country"
                      value={shippingCountry}
                      onChange={(e) => setShippingCountry(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Special instructions, target arrival date, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || price === 0}
              className="w-full py-3 bg-[#00b4c3] text-white rounded-lg font-bold hover:bg-[#009aa8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : price === 0 ? "Pricing Not Set — Contact FUZE HQ" : "Submit Order for Approval"}
            </button>
          </form>
        </div>

        {/* ── Quote Summary ── */}
        <div>
          <div className="bg-slate-900 text-white rounded-xl p-6 sticky top-4">
            <h3 className="font-black text-lg mb-4">Order Summary</h3>

            <div className="space-y-3 text-sm mb-4 pb-4 border-b border-white/20">
              <div className="flex justify-between">
                <span className="text-white/70">Unit</span>
                <span className="font-semibold">{UNIT_META[selectedUnit]?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Quantity</span>
                <span className="font-semibold">{quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Volume per unit</span>
                <span className="font-semibold">{UNIT_META[selectedUnit]?.liters.toLocaleString()}L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Total volume</span>
                <span className="font-semibold">{totalLiters.toLocaleString()}L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Price per liter</span>
                <span className="font-semibold">{price > 0 ? formatCurrency(price, currency) : "—"}</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline mb-2">
              <span className="text-white/70 text-sm">Total</span>
              <span className="text-3xl font-black text-[#00b4c3]">
                {price > 0 ? formatCurrency(totalPrice, currency) : "—"}
              </span>
            </div>
            <p className="text-xs text-white/60">FOB Salt Lake City · Shipping billed separately</p>

            <div className="mt-6 pt-4 border-t border-white/20 text-xs text-white/70 space-y-1">
              <p>✓ FUZE has no shelf life — stock indefinitely</p>
              <p>✓ Every shipment includes SDS & COA via QR</p>
              <p>✓ Production lead time: typically 10-14 days</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order History ── */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Order History</h2>
        {orders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-3xl mb-3">📦</p>
            <h3 className="font-semibold text-slate-900 mb-1">No restock orders yet</h3>
            <p className="text-sm text-slate-500">Your first order will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900">{o.orderNumber}</span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[o.status] || "bg-slate-100"}`}>
                        {o.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      {o.unitQuantity} × {UNIT_META[o.unitType]?.label || o.unitType} · {o.totalLiters.toLocaleString()}L ·{" "}
                      <strong>{formatCurrency(o.totalPrice, o.currency)}</strong>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Ordered {new Date(o.createdAt).toLocaleDateString()}
                      {o.trackingNumber && ` · Tracking: ${o.trackingNumber}`}
                      {o.estimatedDelivery && ` · ETA ${new Date(o.estimatedDelivery).toLocaleDateString()}`}
                    </div>
                  </div>
                  {(o.status === "DELIVERED" || o.status === "SHIPPED") && !o.receivedConfirmedAt && (
                    <button
                      onClick={async () => {
                        const res = await fetch(`/api/distributor-portal/restock/${o.id}/confirm-receipt`, { method: "POST" });
                        const data = await res.json();
                        if (data.ok) loadData();
                      }}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700"
                    >
                      Confirm Receipt
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
