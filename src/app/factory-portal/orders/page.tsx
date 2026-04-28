// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

const FUZE_TIERS = [
  { value: "F1", label: "F1 — 1.0 mg/kg", desc: "Maximum antimicrobial performance", mgPerKg: 1.0 },
  { value: "F2", label: "F2 — 0.75 mg/kg", desc: "High performance", mgPerKg: 0.75 },
  { value: "F3", label: "F3 — 0.5 mg/kg", desc: "Standard performance", mgPerKg: 0.5 },
  { value: "F4", label: "F4 — 0.25 mg/kg", desc: "Light performance", mgPerKg: 0.25 },
];

// Stock concentration of delivered FUZE (mg active metamaterial / L)
const FUZE_STOCK_MG_PER_L = 30;

const TREATMENT_METHODS = [
  { value: "EXHAUST", label: "Exhaust (dyebath)", desc: "Bath exhaustion method" },
  { value: "PAD_DRY_CURE", label: "Pad-Dry-Cure", desc: "Foulard + dry + cure" },
  { value: "SPRAY", label: "Spray", desc: "6\" head spacing, 15 m/min" },
];

const ORDER_TYPES = [
  { value: "PRODUCTION", label: "Production Order", icon: "🏭", desc: "Full production volume of FUZE treatment" },
  { value: "SAMPLE", label: "Sample Order", icon: "🧪", desc: "Sample for new account or fabric testing — FUZE subsidizes 50%" },
  { value: "HANGTAG", label: "Hangtag Order", icon: "🏷️", desc: "FUZE-certified hangtags for treated fabrics" },
];

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

interface BrandAllocation {
  brandId: string;
  brandName: string;
  allocatedPct: string;
  notes: string;
}

interface OrderFormData {
  orderType: string;
  volumeLiters: string;
  bottles: string;
  fuzeTier: string;
  brandId: string;
  fabricId: string;
  hangtagQty: string;
  hangtagDesign: string;
  purposeNote: string;
  // Fabric spec / calculator
  fabricWeightGsm: string;
  fabricLengthMeters: string;
  fabricWidthMeters: string;
  fabricMassKg: string;
  treatmentMethod: string;
  wastageFactorPct: string;
  baseFuzeLiters: string;
  shippingAddress: string;
  shippingCity: string;
  shippingCountry: string;
  notes: string;
  brandAllocations: BrandAllocation[];
}

const INITIAL_FORM: OrderFormData = {
  orderType: "PRODUCTION",
  volumeLiters: "",
  bottles: "",
  fuzeTier: "F1",
  brandId: "",
  fabricId: "",
  hangtagQty: "",
  hangtagDesign: "",
  purposeNote: "",
  fabricWeightGsm: "",
  fabricLengthMeters: "",
  fabricWidthMeters: "",
  fabricMassKg: "",
  treatmentMethod: "EXHAUST",
  wastageFactorPct: "10",
  baseFuzeLiters: "",
  shippingAddress: "",
  shippingCity: "",
  shippingCountry: "",
  notes: "",
  brandAllocations: [{ brandId: "", brandName: "", allocatedPct: "100", notes: "" }],
};

export default function FactoryOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<OrderFormData>(INITIAL_FORM);
  const [quote, setQuote] = useState<any>(null);
  const [acceptingQuote, setAcceptingQuote] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showRequestBrand, setShowRequestBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandWebsite, setNewBrandWebsite] = useState("");
  const [newBrandContact, setNewBrandContact] = useState("");
  const [requestingBrand, setRequestingBrand] = useState(false);

  const isFactory = user?.role === "FACTORY_USER" || user?.role === "FACTORY_MANAGER";
  const isAdmin = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user?.role || "");

  useEffect(() => {
    if (!isFactory && !isAdmin) {
      router.push("/dashboard");
      return;
    }
    loadOrders();
    loadContext();
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

  async function loadContext() {
    try {
      // Load brands the factory works with
      const [brandsRes, fabricsRes] = await Promise.all([
        fetch("/api/brands?limit=100"),
        fetch("/api/fabrics?limit=100"),
      ]);
      const brandsData = await brandsRes.json();
      const fabricsData = await fabricsRes.json();
      if (brandsData.ok || brandsData.brands) setBrands(brandsData.brands || []);
      if (fabricsData.ok || fabricsData.fabrics) setFabrics(fabricsData.fabrics || []);
    } catch (e) {
      console.error("Failed to load context:", e);
    }
  }

  // Auto-calculate bottles from volume and vice versa
  const calculatedBottles = form.volumeLiters ? Math.ceil(Number(form.volumeLiters) / 19) : 0;
  const calculatedVolume = form.bottles ? Number(form.bottles) * 19 : 0;

  const effectiveVolume = form.volumeLiters ? Number(form.volumeLiters) : calculatedVolume;
  const effectiveBottles = form.bottles ? Number(form.bottles) : calculatedBottles;

  // ── FUZE Volume Calculator ──
  // Fabric mass → silver needed (mg) → FUZE stock volume (L) at 30 mg/L
  const [showCalc, setShowCalc] = useState(false);
  const computeFabricMass = (): number => {
    if (form.fabricMassKg) return Number(form.fabricMassKg);
    const gsm = Number(form.fabricWeightGsm) || 0;
    const length = Number(form.fabricLengthMeters) || 0;
    const width = Number(form.fabricWidthMeters) || 0;
    if (gsm && length && width) return (gsm * length * width) / 1000;
    return 0;
  };
  const fabricMass = computeFabricMass();
  const selectedTier = FUZE_TIERS.find((t) => t.value === form.fuzeTier);
  const baseFuzeLiters = selectedTier && fabricMass
    ? (fabricMass * selectedTier.mgPerKg) / FUZE_STOCK_MG_PER_L
    : 0;
  const wastagePct = Number(form.wastageFactorPct) || 0;
  const wastageLiters = baseFuzeLiters * (wastagePct / 100);
  const totalWithWastage = baseFuzeLiters + wastageLiters;
  const recommendedBottles = Math.ceil(totalWithWastage / 19);
  const recommendedVolume = recommendedBottles * 19;

  function applyCalculation() {
    if (totalWithWastage <= 0) return;
    setForm((f) => ({
      ...f,
      volumeLiters: String(recommendedVolume),
      bottles: "",
      baseFuzeLiters: baseFuzeLiters.toFixed(2),
    }));
    setShowCalc(false);
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    // Validate at least one brand is selected
    const validAllocations = form.brandAllocations.filter((a) => a.brandId);
    if (validAllocations.length === 0) {
      setError("Please select at least one brand this order is for. If the brand isn't listed, use 'Request New Brand' to add it.");
      setSubmitting(false);
      return;
    }

    // Validate percentages sum to ~100
    const totalPct = validAllocations.reduce((sum, a) => sum + (Number(a.allocatedPct) || 0), 0);
    if (validAllocations.length > 1 && (totalPct < 95 || totalPct > 105)) {
      setError(`Brand volume allocations should total 100%. Currently: ${totalPct}%`);
      setSubmitting(false);
      return;
    }

    try {
      const payload: any = {
        orderType: form.orderType,
        fuzeTier: form.fuzeTier,
        brandId: validAllocations[0]?.brandId || undefined, // Primary brand for backward compat
        fabricId: form.fabricId || undefined,
        purposeNote: form.purposeNote || undefined,
        shippingAddress: form.shippingAddress || undefined,
        shippingCity: form.shippingCity || undefined,
        shippingCountry: form.shippingCountry || undefined,
        notes: form.notes || undefined,
        brandAllocations: validAllocations.map((a) => ({
          brandId: a.brandId,
          allocatedPct: Number(a.allocatedPct) || (100 / validAllocations.length),
          notes: a.notes || undefined,
        })),
      };

      if (form.orderType === "HANGTAG") {
        payload.hangtagQty = form.hangtagQty ? Number(form.hangtagQty) : undefined;
        payload.hangtagDesign = form.hangtagDesign || undefined;
      } else {
        payload.volumeLiters = effectiveVolume || undefined;
        payload.bottles = effectiveBottles || undefined;
        // Fabric spec + wastage
        if (form.fabricWeightGsm) payload.fabricWeightGsm = Number(form.fabricWeightGsm);
        if (form.fabricLengthMeters) payload.fabricLengthMeters = Number(form.fabricLengthMeters);
        if (form.fabricWidthMeters) payload.fabricWidthMeters = Number(form.fabricWidthMeters);
        if (form.fabricMassKg || fabricMass) payload.fabricMassKg = Number(form.fabricMassKg) || fabricMass;
        if (form.treatmentMethod) payload.treatmentMethod = form.treatmentMethod;
        if (form.baseFuzeLiters || baseFuzeLiters) payload.baseFuzeLiters = Number(form.baseFuzeLiters) || baseFuzeLiters;
        payload.wastageFactorPct = wastagePct;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok) {
        setQuote(data.order);
        setSuccess(`Order ${data.order.orderNumber} created with quote ${data.order.quoteNumber}!`);
        loadOrders();
      } else {
        setError(data.error || "Failed to create order");
      }
    } catch (e: any) {
      setError(e.message || "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcceptQuote(orderId: string) {
    setAcceptingQuote(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "accept_quote" }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess("Quote accepted! Your account manager will review and approve.");
        loadOrders();
        setSelectedOrder(null);
        setQuote(null);
      } else {
        setError(data.error || "Failed to accept quote");
      }
    } catch (e: any) {
      setError(e.message || "Error accepting quote");
    } finally {
      setAcceptingQuote(false);
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "cancel", reason: "Cancelled by factory" }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess("Order cancelled.");
        loadOrders();
        setSelectedOrder(null);
      }
    } catch (e) {
      setError("Failed to cancel order");
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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Order FUZE</h1>
          <p className="text-slate-500 mt-1">Order FUZE treatment, samples, and hangtags</p>
        </div>
        <button
          onClick={() => { setShowNewOrder(true); setForm(INITIAL_FORM); setQuote(null); setError(""); setSuccess(""); }}
          className="px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009aa8] transition-colors shadow-lg shadow-[#00b4c3]/25 flex items-center gap-2"
        >
          <span className="text-lg">+</span> New Order
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-start gap-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="font-semibold">Success</p>
            <p className="text-sm">{success}</p>
          </div>
          <button onClick={() => setSuccess("")} className="ml-auto text-green-400 hover:text-green-600">✕</button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
          {[
            { label: "Total Orders", value: stats.total, icon: "📦" },
            { label: "Pending", value: stats.pending, icon: "⏳" },
            { label: "Approved", value: stats.approved, icon: "✅" },
            { label: "Processing", value: stats.processing, icon: "⚙️" },
            { label: "Shipped", value: stats.shipped, icon: "🚚" },
            { label: "Delivered", value: stats.delivered, icon: "📬" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span>{s.icon}</span>
                <span className="text-xs text-slate-500 font-medium">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "QUOTED", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === s
                  ? "bg-[#00b4c3] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "All Orders" : STATUS_COLORS[s]?.label || s}
            </button>
          )
        )}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-4xl mb-4">📦</p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No orders yet</h3>
          <p className="text-slate-500 mb-6">Place your first order for FUZE treatment, samples, or hangtags.</p>
          <button
            onClick={() => setShowNewOrder(true)}
            className="px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009aa8] transition-colors"
          >
            Place First Order
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.DRAFT;
            return (
              <div
                key={order.id}
                onClick={() => router.push(`/factory-portal/orders/${order.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 hover:border-[#00b4c3]/40 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {order.orderType === "SAMPLE" ? "🧪" : order.orderType === "HANGTAG" ? "🏷️" : "🏭"}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{order.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                          {statusInfo.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {order.orderType}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                        {order.volumeLiters && (
                          <span>
                            {order.volumeLiters}L ({order.bottles || Math.ceil(order.volumeLiters / 19)} bottles)
                            {order.wastageFactorPct > 0 && order.baseFuzeLiters && (
                              <span className="text-amber-600"> · +{order.wastageFactorPct}% buffer</span>
                            )}
                          </span>
                        )}
                        {order.hangtagQty && <span>{order.hangtagQty.toLocaleString()} hangtags</span>}
                        {order.brandAllocations?.length > 0 ? (
                          <span>
                            {order.brandAllocations.length === 1
                              ? `Brand: ${order.brandAllocations[0]?.brand?.name || order.brand?.name || "—"}`
                              : `Brands: ${order.brandAllocations.map((a: any) => a.brand?.name).filter(Boolean).join(", ")}`}
                          </span>
                        ) : order.brand?.name ? <span>Brand: {order.brand.name}</span> : null}
                        {order.fabric?.fuzeNumber && <span>Fabric: {order.fabric.fuzeNumber}</span>}
                        {order.fuzeTier && <span>Tier: {order.fuzeTier}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-900">{formatCurrency(order.totalPrice || 0, order.currency)}</p>
                    {order.isSampleSubsidized && order.subsidyAmount > 0 && (
                      <p className="text-xs text-green-600 font-medium">FUZE subsidy: {formatCurrency(order.subsidyAmount)}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{formatDate(order.createdAt)}</p>
                  </div>
                </div>

                {/* Progress bar for active orders */}
                {!["CANCELLED", "DELIVERED", "DRAFT"].includes(order.status) && (
                  <div className="mt-3 flex items-center gap-1">
                    {["QUOTED", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "SHIPPED"].map((step, i) => {
                      const steps = ["QUOTED", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "SHIPPED"];
                      const currentIdx = steps.indexOf(order.status);
                      const done = i <= currentIdx;
                      return (
                        <div
                          key={step}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            done ? "bg-[#00b4c3]" : "bg-slate-200"
                          }`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* NEW ORDER MODAL */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showNewOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 pt-8 sm:pt-16">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  {quote ? "Quote Generated" : "New FUZE Order"}
                </h2>
                <button
                  onClick={() => { setShowNewOrder(false); setQuote(null); }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* ─── Quote Review ─── */}
            {quote ? (
              <div className="p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">📋</span>
                    <div>
                      <p className="font-bold text-blue-900">Quote {quote.quoteNumber}</p>
                      <p className="text-sm text-blue-700">Order {quote.orderNumber}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-blue-600 font-medium">Order Type</p>
                      <p className="text-blue-900 font-semibold">{quote.orderType}</p>
                    </div>
                    {quote.volumeLiters && (
                      <div>
                        <p className="text-blue-600 font-medium">Volume</p>
                        <p className="text-blue-900 font-semibold">{quote.volumeLiters}L ({quote.bottles} bottles)</p>
                        {quote.baseFuzeLiters && quote.wastageFactorPct !== undefined && (
                          <p className="text-xs text-blue-700 mt-0.5">
                            base {Number(quote.baseFuzeLiters).toFixed(1)}L + {quote.wastageFactorPct}% wastage
                          </p>
                        )}
                      </div>
                    )}
                    {quote.fabricMassKg && (
                      <div>
                        <p className="text-blue-600 font-medium">Fabric</p>
                        <p className="text-blue-900 font-semibold">
                          {Number(quote.fabricMassKg).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                          {quote.treatmentMethod && <span className="text-xs text-blue-700"> · {quote.treatmentMethod.replace("_", "-")}</span>}
                        </p>
                      </div>
                    )}
                    {quote.hangtagQty && (
                      <div>
                        <p className="text-blue-600 font-medium">Hangtags</p>
                        <p className="text-blue-900 font-semibold">{quote.hangtagQty.toLocaleString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-blue-600 font-medium">FUZE Tier</p>
                      <p className="text-blue-900 font-semibold">{quote.fuzeTier || "—"}</p>
                    </div>
                    <div>
                      <p className="text-blue-600 font-medium">Price per Liter</p>
                      <p className="text-blue-900 font-semibold">{formatCurrency(quote.pricePerLiter || 0, quote.currency)}</p>
                    </div>
                    {quote.discountPct > 0 && (
                      <div>
                        <p className="text-blue-600 font-medium">Volume Discount</p>
                        <p className="text-blue-900 font-semibold">{quote.discountPct}%</p>
                      </div>
                    )}
                    <div>
                      <p className="text-blue-600 font-medium">Fulfillment</p>
                      <p className="text-blue-900 font-semibold">
                        {quote.fulfillmentSource === "DIRECT_USA" ? "Direct from USA" : quote.distributor?.name || "Distributor"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-900 font-bold text-lg">Total</span>
                      <span className="text-blue-900 font-bold text-2xl">{formatCurrency(quote.totalPrice || 0, quote.currency)}</span>
                    </div>
                    {quote.isSampleSubsidized && quote.subsidyAmount > 0 && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-green-700 font-medium text-sm">FUZE Sample Subsidy (50%)</span>
                        <span className="text-green-700 font-semibold">−{formatCurrency(quote.subsidyAmount)}</span>
                      </div>
                    )}
                    {quote.quoteExpiresAt && (
                      <p className="text-xs text-blue-500 mt-2">Quote valid until {formatDate(quote.quoteExpiresAt)}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleAcceptQuote(quote.id)}
                    disabled={acceptingQuote}
                    className="flex-1 px-5 py-3 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009aa8] transition-colors disabled:opacity-50"
                  >
                    {acceptingQuote ? "Accepting..." : "Accept Quote & Submit"}
                  </button>
                  <button
                    onClick={() => { setShowNewOrder(false); setQuote(null); }}
                    className="px-5 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Review Later
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-3 text-center">
                  Accepting sends this order to your FUZE account manager for approval and fulfillment.
                </p>
              </div>
            ) : (
              /* ─── Order Form ─── */
              <form onSubmit={handleSubmitOrder} className="p-6 space-y-6">
                {/* Order Type Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">What would you like to order?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {ORDER_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setForm({ ...form, orderType: type.value })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          form.orderType === type.value
                            ? "border-[#00b4c3] bg-[#00b4c3]/5 shadow-md"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-2xl">{type.icon}</span>
                        <p className="font-semibold text-slate-900 mt-2">{type.label}</p>
                        <p className="text-xs text-slate-500 mt-1">{type.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── FUZE Volume Calculator (fabric spec → FUZE liters) ── */}
                {form.orderType !== "HANGTAG" && (
                  <div className="border-2 border-[#00b4c3]/30 bg-cyan-50/40 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowCalc(!showCalc)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-50 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xl">🧮</span>
                        <span className="font-semibold text-slate-900">Calculate from Fabric Spec</span>
                        <span className="text-xs text-slate-500">(recommended)</span>
                      </span>
                      <span className="text-slate-400">{showCalc ? "▲" : "▼"}</span>
                    </button>
                    {showCalc && (
                      <div className="p-4 border-t border-[#00b4c3]/20 space-y-3">
                        <p className="text-xs text-slate-600">
                          Enter your fabric specs and we'll calculate the exact FUZE volume needed — including your wastage buffer.
                        </p>

                        {/* Method */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Treatment Method</label>
                          <div className="grid grid-cols-3 gap-2">
                            {TREATMENT_METHODS.map((m) => (
                              <button
                                key={m.value}
                                type="button"
                                onClick={() => setForm({ ...form, treatmentMethod: m.value })}
                                className={`p-2 rounded-lg border text-left transition-all ${
                                  form.treatmentMethod === m.value
                                    ? "border-[#00b4c3] bg-white"
                                    : "border-slate-200 bg-white/50 hover:border-slate-300"
                                }`}
                              >
                                <p className="text-xs font-bold text-slate-900">{m.label}</p>
                                <p className="text-[10px] text-slate-500">{m.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Fabric mass direct entry */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Total Fabric Mass (kg)</label>
                          <input
                            type="number"
                            value={form.fabricMassKg}
                            onChange={(e) => setForm({ ...form, fabricMassKg: e.target.value })}
                            placeholder="If you already know total mass, enter it here"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <div className="flex-1 h-px bg-slate-200" />
                          <span>OR compute from dimensions</span>
                          <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        {/* Fabric dimensions */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Weight (g/m²)</label>
                            <input
                              type="number"
                              value={form.fabricWeightGsm}
                              onChange={(e) => setForm({ ...form, fabricWeightGsm: e.target.value, fabricMassKg: "" })}
                              placeholder="180"
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Length (m)</label>
                            <input
                              type="number"
                              value={form.fabricLengthMeters}
                              onChange={(e) => setForm({ ...form, fabricLengthMeters: e.target.value, fabricMassKg: "" })}
                              placeholder="1000"
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Width (m)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={form.fabricWidthMeters}
                              onChange={(e) => setForm({ ...form, fabricWidthMeters: e.target.value, fabricMassKg: "" })}
                              placeholder="1.5"
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                            />
                          </div>
                        </div>

                        {/* Wastage */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Wastage / Safety Buffer (%) —{" "}
                            <span className="text-slate-500 font-normal">process losses, retreatment margin, QC cushion</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="0"
                              max="30"
                              step="1"
                              value={form.wastageFactorPct}
                              onChange={(e) => setForm({ ...form, wastageFactorPct: e.target.value })}
                              className="flex-1"
                            />
                            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1">
                              <input
                                type="number"
                                min="0"
                                max="50"
                                value={form.wastageFactorPct}
                                onChange={(e) => setForm({ ...form, wastageFactorPct: e.target.value })}
                                className="w-12 text-sm text-center outline-none"
                              />
                              <span className="text-xs text-slate-500">%</span>
                            </div>
                          </div>
                        </div>

                        {/* Live Calculation */}
                        {fabricMass > 0 && selectedTier && (
                          <div className="bg-white rounded-lg border border-[#00b4c3]/40 p-3 space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Fabric mass</span>
                              <strong>{fabricMass.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Active ingredient needed ({selectedTier.value} @ {selectedTier.mgPerKg} mg/kg)</span>
                              <strong>{(fabricMass * selectedTier.mgPerKg).toLocaleString(undefined, { maximumFractionDigits: 0 })} mg</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Base FUZE volume (stock @ {FUZE_STOCK_MG_PER_L} mg/L)</span>
                              <strong>{baseFuzeLiters.toLocaleString(undefined, { maximumFractionDigits: 1 })} L</strong>
                            </div>
                            <div className="flex justify-between text-amber-700">
                              <span>+ Wastage buffer ({wastagePct}%)</span>
                              <strong>+{wastageLiters.toLocaleString(undefined, { maximumFractionDigits: 1 })} L</strong>
                            </div>
                            <div className="pt-1.5 border-t border-slate-200 flex justify-between text-base">
                              <span className="font-semibold">Recommended order</span>
                              <strong className="text-[#00b4c3]">{recommendedBottles} bottles ({recommendedVolume} L)</strong>
                            </div>
                            <button
                              type="button"
                              onClick={applyCalculation}
                              className="w-full mt-2 px-3 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg hover:bg-[#009aa8]"
                            >
                              Apply to Order →
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* FUZE Treatment Volume (for PRODUCTION & SAMPLE) */}
                {form.orderType !== "HANGTAG" && (
                  <>
                    {/* Sample-size quick picks — only show for SAMPLE
                        order type. For sample/lab orders, factories
                        often only need 500ml / 1L / 2L. The volume
                        field already accepts decimals natively (FuzeOrder.
                        volumeLiters is Float), so these just prefill the
                        input. The 19L carboy is the smallest packaging
                        unit but for samples we ship in lab-size
                        containers from the carboy supply. */}
                    {form.orderType === "SAMPLE" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Sample size (quick-pick)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: "0.5", label: "500 mL", desc: "smallest bench sample" },
                            { value: "1", label: "1 L", desc: "standard lab sample" },
                            { value: "2", label: "2 L", desc: "extended trial" },
                            { value: "5", label: "5 L", desc: "small pilot" },
                            { value: "19", label: "19 L (1 carboy)", desc: "full carboy" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setForm({
                                  ...form,
                                  volumeLiters: opt.value,
                                  bottles: "",
                                })
                              }
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
                                form.volumeLiters === opt.value
                                  ? "bg-[#00b4c3] text-white border-[#00b4c3]"
                                  : "bg-white text-slate-700 border-slate-300 hover:border-[#00b4c3] hover:text-[#00b4c3]"
                              }`}
                              title={opt.desc}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Or enter a custom volume below.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Volume (liters)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={form.volumeLiters}
                          onChange={(e) => setForm({ ...form, volumeLiters: e.target.value, bottles: "" })}
                          placeholder={form.orderType === "SAMPLE" ? "e.g. 0.5, 1, 2" : "e.g. 190"}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                        />
                        {form.volumeLiters && (
                          <p className="text-xs text-slate-500 mt-1">
                            {Number(form.volumeLiters) < 19 ? (
                              <>
                                = {(Number(form.volumeLiters) * 1000).toLocaleString()} mL · ships from carboy supply
                              </>
                            ) : (
                              <>
                                = {calculatedBottles} bottles (19L each)
                              </>
                            )}
                            {form.baseFuzeLiters && Number(form.baseFuzeLiters) > 0 && (
                              <> · base {Number(form.baseFuzeLiters).toFixed(1)}L + {wastagePct}% buffer</>
                            )}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Or enter bottles (19L)</label>
                        <input
                          type="number"
                          value={form.bottles}
                          onChange={(e) => setForm({ ...form, bottles: e.target.value, volumeLiters: "" })}
                          placeholder="e.g. 10"
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                          disabled={form.orderType === "SAMPLE"}
                          title={form.orderType === "SAMPLE" ? "Sample orders use the volume field above for sub-19L sizes." : undefined}
                        />
                        {form.bottles && (
                          <p className="text-xs text-slate-500 mt-1">= {calculatedVolume}L total</p>
                        )}
                        {form.orderType === "SAMPLE" && (
                          <p className="text-[11px] text-amber-600 mt-1">
                            Disabled for samples — use volume field above.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Wastage factor when not using calculator */}
                {form.orderType !== "HANGTAG" && !showCalc && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Wastage / Safety Buffer — <span className="text-slate-500 font-normal">stored on the order for QC and inventory planning</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={form.wastageFactorPct}
                        onChange={(e) => setForm({ ...form, wastageFactorPct: e.target.value })}
                        className="flex-1"
                      />
                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={form.wastageFactorPct}
                          onChange={(e) => setForm({ ...form, wastageFactorPct: e.target.value })}
                          className="w-12 text-sm text-center outline-none"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hangtag fields */}
                {form.orderType === "HANGTAG" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Hangtag Quantity</label>
                      <input
                        type="number"
                        value={form.hangtagQty}
                        onChange={(e) => setForm({ ...form, hangtagQty: e.target.value })}
                        placeholder="e.g. 5000"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Design Variant</label>
                      <select
                        value={form.hangtagDesign}
                        onChange={(e) => setForm({ ...form, hangtagDesign: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                      >
                        <option value="">Standard FUZE Tag</option>
                        <option value="premium">Premium FUZE Tag</option>
                        <option value="custom">Custom Branded Tag</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* FUZE Tier */}
                {form.orderType !== "HANGTAG" && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">FUZE Treatment Tier</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {FUZE_TIERS.map((tier) => (
                        <button
                          key={tier.value}
                          type="button"
                          onClick={() => setForm({ ...form, fuzeTier: tier.value })}
                          className={`p-3 rounded-lg border-2 text-center transition-all ${
                            form.fuzeTier === tier.value
                              ? "border-[#00b4c3] bg-[#00b4c3]/5"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <p className="font-bold text-slate-900">{tier.value}</p>
                          <p className="text-[10px] text-slate-500">{tier.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── Brand Attribution (REQUIRED) ─── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Brand(s) this order is for <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {form.brandAllocations.length < 5 && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              brandAllocations: [
                                ...form.brandAllocations,
                                { brandId: "", brandName: "", allocatedPct: "", notes: "" },
                              ],
                            })
                          }
                          className="text-xs text-[#00b4c3] hover:text-[#009aa8] font-medium"
                        >
                          + Add Another Brand
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Every order must be linked to at least one brand. This tracks usage for account management, commissions, and brand rebates.
                    {form.brandAllocations.length > 1 && " Split the volume percentage across brands."}
                  </p>

                  <div className="space-y-3">
                    {form.brandAllocations.map((alloc, idx) => {
                      // Filter out brands already selected in other rows
                      const selectedIds = form.brandAllocations
                        .filter((_, i) => i !== idx)
                        .map((a) => a.brandId);
                      const availableBrands = brands.filter(
                        (b) => !selectedIds.includes(b.id) || b.id === alloc.brandId
                      );

                      return (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row gap-2 items-start bg-slate-50 rounded-lg p-3 border border-slate-200"
                        >
                          <div className="flex-1 min-w-0">
                            <select
                              value={alloc.brandId}
                              onChange={(e) => {
                                const updated = [...form.brandAllocations];
                                const brand = brands.find((b) => b.id === e.target.value);
                                updated[idx] = {
                                  ...updated[idx],
                                  brandId: e.target.value,
                                  brandName: brand?.name || "",
                                };
                                // Auto-set 100% if single brand
                                if (updated.filter((a) => a.brandId).length === 1) {
                                  updated[idx].allocatedPct = "100";
                                }
                                setForm({ ...form, brandAllocations: updated });
                              }}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                              required={idx === 0}
                            >
                              <option value="">Select brand...</option>
                              {availableBrands.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {form.brandAllocations.filter((a) => a.brandId).length > 1 && (
                            <div className="w-24 shrink-0">
                              <div className="relative">
                                <input
                                  type="number"
                                  value={alloc.allocatedPct}
                                  onChange={(e) => {
                                    const updated = [...form.brandAllocations];
                                    updated[idx] = { ...updated[idx], allocatedPct: e.target.value };
                                    setForm({ ...form, brandAllocations: updated });
                                  }}
                                  placeholder="%"
                                  min="1"
                                  max="100"
                                  className="w-full px-3 py-2 pr-7 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none text-right"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                  %
                                </span>
                              </div>
                            </div>
                          )}

                          {form.brandAllocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = form.brandAllocations.filter((_, i) => i !== idx);
                                // If only one left, set it to 100%
                                if (updated.length === 1 && updated[0].brandId) {
                                  updated[0].allocatedPct = "100";
                                }
                                setForm({ ...form, brandAllocations: updated });
                              }}
                              className="p-2 text-slate-400 hover:text-red-500 transition shrink-0"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Allocation total indicator */}
                  {form.brandAllocations.filter((a) => a.brandId).length > 1 && (
                    <div className="mt-2 flex items-center gap-2">
                      {(() => {
                        const total = form.brandAllocations.reduce(
                          (sum, a) => sum + (Number(a.allocatedPct) || 0),
                          0
                        );
                        const isValid = total >= 95 && total <= 105;
                        return (
                          <>
                            <div
                              className={`h-1.5 flex-1 rounded-full ${
                                isValid ? "bg-green-200" : "bg-red-200"
                              }`}
                            >
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isValid ? "bg-green-500" : "bg-red-500"
                                }`}
                                style={{ width: `${Math.min(100, total)}%` }}
                              />
                            </div>
                            <span
                              className={`text-xs font-medium ${
                                isValid ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {total}%
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Request New Brand */}
                  <div className="mt-3">
                    {!showRequestBrand ? (
                      <button
                        type="button"
                        onClick={() => setShowRequestBrand(true)}
                        className="text-sm text-[#00b4c3] hover:text-[#009aa8] font-medium flex items-center gap-1"
                      >
                        <span>🏢</span> Brand not listed? Request to add it
                      </button>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-amber-800">Request New Brand</h4>
                          <button
                            type="button"
                            onClick={() => setShowRequestBrand(false)}
                            className="text-amber-400 hover:text-amber-600 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-xs text-amber-700">
                          Submit a request and FUZE will reach out to the brand and add them to the system.
                          You can continue placing your order once the brand is approved.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={newBrandName}
                            onChange={(e) => setNewBrandName(e.target.value)}
                            placeholder="Brand name *"
                            className="px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                          />
                          <input
                            type="text"
                            value={newBrandWebsite}
                            onChange={(e) => setNewBrandWebsite(e.target.value)}
                            placeholder="Website (optional)"
                            className="px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                          />
                          <input
                            type="text"
                            value={newBrandContact}
                            onChange={(e) => setNewBrandContact(e.target.value)}
                            placeholder="Your contact there (optional)"
                            className="px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={!newBrandName.trim() || requestingBrand}
                          onClick={async () => {
                            setRequestingBrand(true);
                            try {
                              const res = await fetch("/api/orders/request-brand", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  brandName: newBrandName.trim(),
                                  website: newBrandWebsite.trim() || undefined,
                                  contactName: newBrandContact.trim() || undefined,
                                }),
                              });
                              const data = await res.json();
                              if (data.ok) {
                                setSuccess(`Brand "${newBrandName}" request submitted! FUZE will review and reach out.`);
                                setShowRequestBrand(false);
                                setNewBrandName("");
                                setNewBrandWebsite("");
                                setNewBrandContact("");
                                // Reload brands in case it was auto-created
                                loadContext();
                              } else {
                                setError(data.error || "Failed to submit brand request");
                              }
                            } catch {
                              setError("Failed to submit brand request");
                            } finally {
                              setRequestingBrand(false);
                            }
                          }}
                          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-50"
                        >
                          {requestingBrand ? "Submitting..." : "Submit Brand Request"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fabric Context */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fabric (optional)</label>
                  <select
                    value={form.fabricId}
                    onChange={(e) => setForm({ ...form, fabricId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                  >
                    <option value="">Select fabric...</option>
                    {fabrics.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.fuzeNumber || f.customerCode || f.id}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Which fabric is being treated?</p>
                </div>

                {/* Purpose Note */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purpose / Notes</label>
                  <textarea
                    value={form.purposeNote}
                    onChange={(e) => setForm({ ...form, purposeNote: e.target.value })}
                    placeholder={
                      form.orderType === "SAMPLE"
                        ? "e.g. New account development — testing FUZE on polyester jersey for Rhone"
                        : form.orderType === "HANGTAG"
                        ? "e.g. FUZE-certified hangtags for Q3 production run"
                        : "e.g. Production run for Brand X — Q3 delivery"
                    }
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                  />
                </div>

                {/* Shipping */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Shipping Address</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={form.shippingAddress}
                        onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                        placeholder="Street address"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={form.shippingCity}
                        onChange={(e) => setForm({ ...form, shippingCity: e.target.value })}
                        placeholder="City"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={form.shippingCountry}
                        onChange={(e) => setForm({ ...form, shippingCountry: e.target.value })}
                        placeholder="Country"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Any special instructions for this order..."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                  />
                </div>

                {/* Sample subsidy notice */}
                {form.orderType === "SAMPLE" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                    <span className="text-xl">🎁</span>
                    <div>
                      <p className="font-semibold text-green-800">FUZE Sample Support</p>
                      <p className="text-sm text-green-700">
                        FUZE subsidizes 50% of sample order costs to help you develop new accounts and test new fabrics.
                        Your quote will reflect the subsidy automatically.
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-5 py-3 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009aa8] transition-colors disabled:opacity-50 shadow-lg shadow-[#00b4c3]/25"
                  >
                    {submitting ? "Generating Quote..." : "Get Quote"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewOrder(false)}
                    className="px-5 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ORDER DETAIL MODAL */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 pt-8 sm:pt-16">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedOrder.orderNumber}</h2>
                  <p className="text-sm text-slate-500">{selectedOrder.orderType} Order</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Status */}
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[selectedOrder.status]?.bg} ${STATUS_COLORS[selectedOrder.status]?.text}`}>
                  {STATUS_COLORS[selectedOrder.status]?.label || selectedOrder.status}
                </span>
                {selectedOrder.trackingNumber && (
                  <span className="text-sm text-slate-500">Tracking: {selectedOrder.trackingNumber}</span>
                )}
              </div>

              {/* Order Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedOrder.volumeLiters && (
                  <>
                    <div>
                      <p className="text-slate-500 font-medium">Volume</p>
                      <p className="text-slate-900 font-semibold">{selectedOrder.volumeLiters}L</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">Bottles</p>
                      <p className="text-slate-900 font-semibold">{selectedOrder.bottles || Math.ceil(selectedOrder.volumeLiters / 19)}</p>
                    </div>
                  </>
                )}
                {selectedOrder.hangtagQty && (
                  <div>
                    <p className="text-slate-500 font-medium">Hangtags</p>
                    <p className="text-slate-900 font-semibold">{selectedOrder.hangtagQty.toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 font-medium">FUZE Tier</p>
                  <p className="text-slate-900 font-semibold">{selectedOrder.fuzeTier || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Price/Liter</p>
                  <p className="text-slate-900 font-semibold">{formatCurrency(selectedOrder.pricePerLiter || 0, selectedOrder.currency)}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Total</p>
                  <p className="text-slate-900 font-bold text-lg">{formatCurrency(selectedOrder.totalPrice || 0, selectedOrder.currency)}</p>
                </div>
                {selectedOrder.brand?.name && (
                  <div>
                    <p className="text-slate-500 font-medium">Brand</p>
                    <p className="text-slate-900 font-semibold">{selectedOrder.brand.name}</p>
                  </div>
                )}
                {selectedOrder.fabric?.fuzeNumber && (
                  <div>
                    <p className="text-slate-500 font-medium">Fabric</p>
                    <p className="text-slate-900 font-semibold">{selectedOrder.fabric.fuzeNumber}</p>
                  </div>
                )}
                {selectedOrder.distributor?.name && (
                  <div>
                    <p className="text-slate-500 font-medium">Fulfilled By</p>
                    <p className="text-slate-900 font-semibold">{selectedOrder.distributor.name}</p>
                  </div>
                )}
                {selectedOrder.fulfillmentSource === "DIRECT_USA" && (
                  <div>
                    <p className="text-slate-500 font-medium">Fulfilled By</p>
                    <p className="text-slate-900 font-semibold">Direct from USA</p>
                  </div>
                )}
                {selectedOrder.accountManager?.name && (
                  <div>
                    <p className="text-slate-500 font-medium">Account Manager</p>
                    <p className="text-slate-900 font-semibold">{selectedOrder.accountManager.name}</p>
                  </div>
                )}
                {selectedOrder.shippedDate && (
                  <div>
                    <p className="text-slate-500 font-medium">Shipped</p>
                    <p className="text-slate-900 font-semibold">{formatDate(selectedOrder.shippedDate)}</p>
                  </div>
                )}
                {selectedOrder.deliveredDate && (
                  <div>
                    <p className="text-slate-500 font-medium">Delivered</p>
                    <p className="text-slate-900 font-semibold">{formatDate(selectedOrder.deliveredDate)}</p>
                  </div>
                )}
              </div>

              {/* Subsidy Info */}
              {selectedOrder.isSampleSubsidized && selectedOrder.subsidyAmount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <span>🎁</span>
                    <p className="text-green-800 font-semibold">FUZE Sample Subsidy Applied</p>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    FUZE is covering {formatCurrency(selectedOrder.subsidyAmount)} of this sample order.
                  </p>
                </div>
              )}

              {/* Notes */}
              {(selectedOrder.purposeNote || selectedOrder.notes) && (
                <div className="bg-slate-50 rounded-lg p-4">
                  {selectedOrder.purposeNote && (
                    <div className="mb-2">
                      <p className="text-xs text-slate-500 font-medium">Purpose</p>
                      <p className="text-sm text-slate-700">{selectedOrder.purposeNote}</p>
                    </div>
                  )}
                  {selectedOrder.notes && (
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Notes</p>
                      <p className="text-sm text-slate-700">{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {selectedOrder.status === "QUOTED" && (
                  <button
                    onClick={() => handleAcceptQuote(selectedOrder.id)}
                    disabled={acceptingQuote}
                    className="flex-1 px-5 py-3 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009aa8] transition-colors disabled:opacity-50"
                  >
                    {acceptingQuote ? "Accepting..." : "Accept Quote"}
                  </button>
                )}
                {selectedOrder.status === "DELIVERED" && (
                  <button
                    onClick={() => {
                      // Pre-fill reorder form from previous order
                      setForm({
                        orderType: selectedOrder.orderType,
                        volumeLiters: selectedOrder.volumeLiters ? String(selectedOrder.volumeLiters) : "",
                        bottles: selectedOrder.bottles ? String(selectedOrder.bottles) : "",
                        fuzeTier: selectedOrder.fuzeTier || "F1",
                        brandId: selectedOrder.brand?.id || selectedOrder.brandId || "",
                        fabricId: selectedOrder.fabric?.id || selectedOrder.fabricId || "",
                        hangtagQty: selectedOrder.hangtagQty ? String(selectedOrder.hangtagQty) : "",
                        hangtagDesign: selectedOrder.hangtagDesign || "",
                        purposeNote: `Reorder of ${selectedOrder.orderNumber}`,
                        shippingAddress: selectedOrder.shippingAddress || "",
                        shippingCity: selectedOrder.shippingCity || "",
                        shippingCountry: selectedOrder.shippingCountry || "",
                        notes: "",
                      });
                      setSelectedOrder(null);
                      setShowNewOrder(true);
                      setQuote(null);
                      setError("");
                      setSuccess("");
                    }}
                    className="flex-1 px-5 py-3 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009aa8] transition-colors"
                  >
                    Reorder
                  </button>
                )}
                {["DRAFT", "QUOTED"].includes(selectedOrder.status) && (
                  <button
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    className="px-5 py-3 bg-red-50 text-red-700 rounded-lg font-semibold hover:bg-red-100 transition-colors"
                  >
                    Cancel Order
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-5 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
