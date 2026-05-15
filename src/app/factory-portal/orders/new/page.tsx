// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/**
 * Factory creates a FUZE order through their distributor.
 *
 * Flow:
 *   1. Pick fabric (scoped to factory's own fabrics).
 *   2. Enter fabric mass (kg) for the production run + tier.
 *   3. Server computes FUZE volume + quote price in the
 *      distributor's local currency.
 *   4. Factory picks brand allocation (multi).
 *   5. Factory attaches their PO number / URL.
 *   6. Submit — server creates the FuzeOrder, fans out notifications.
 */

const TIERS = ["F1", "F2", "F3", "F4"] as const;

const TIER_LABELS: Record<string, string> = {
  F1: "F1 — Full Spectrum · 1.0 mg/kg",
  F2: "F2 — Advanced · 0.75 mg/kg",
  F3: "F3 — Core · 0.5 mg/kg",
  F4: "F4 — Foundation · 0.25 mg/kg",
};

export default function FactoryOrderNewPage() {
  const { user } = useAuth();
  const router = useRouter();

  const isFactory = ["FACTORY_USER", "FACTORY_MANAGER"].includes(user?.role || "");
  const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(
    user?.role || "",
  );

  const [fabrics, setFabrics] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form
  const [fabricId, setFabricId] = useState("");
  const [fabricMassKg, setFabricMassKg] = useState("");
  const [fuzeTier, setFuzeTier] = useState<typeof TIERS[number]>("F2");
  const [wastageFactorPct, setWastageFactorPct] = useState("10");
  const [treatmentMethod, setTreatmentMethod] = useState("PAD_DRY_CURE");
  const [purposeNote, setPurposeNote] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDocumentUrl, setPoDocumentUrl] = useState("");
  const [allocations, setAllocations] = useState<{ brandId: string; allocatedPct: number }[]>([]);
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingCountry, setShippingCountry] = useState("");

  const [quote, setQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!isFactory && !isInternal) {
      router.push("/home");
      return;
    }
    load();
  }, [user?.id]);

  async function load() {
    try {
      setLoading(true);
      setLoadError(null);
      const [fabRes, brandRes] = await Promise.all([
        fetch("/api/fabrics?pageSize=200"),
        fetch("/api/brand-portal/brands-list").catch(() => null),
      ]);
      const fabJson = await fabRes.json();
      if (!fabRes.ok || !fabJson.ok && !fabJson.fabrics && !fabJson.items) {
        setLoadError(fabJson.error || "Failed to load fabrics");
        return;
      }
      const list = fabJson.fabrics || fabJson.items || [];
      setFabrics(list);

      if (brandRes && brandRes.ok) {
        const bj = await brandRes.json();
        setBrands(bj.brands || bj.items || []);
      } else {
        // Fallback — distill unique brands from the fabric list
        const seen = new Map<string, any>();
        list.forEach((f: any) => {
          if (f.brand?.id && !seen.has(f.brand.id)) {
            seen.set(f.brand.id, f.brand);
          }
        });
        setBrands(Array.from(seen.values()));
      }
    } catch (e: any) {
      setLoadError(e?.message || "Failed to load order context");
    } finally {
      setLoading(false);
    }
  }

  const selectedFabric = useMemo(
    () => fabrics.find((f) => f.id === fabricId) || null,
    [fabricId, fabrics],
  );

  // Pre-populate single-brand allocation when the fabric carries a brand.
  useEffect(() => {
    if (selectedFabric?.brand?.id && allocations.length === 0) {
      setAllocations([{ brandId: selectedFabric.brand.id, allocatedPct: 100 }]);
    }
  }, [selectedFabric?.brand?.id]);

  async function fetchQuote() {
    setQuote(null);
    setQuoteError(null);
    if (!fabricId || !fabricMassKg || !fuzeTier) {
      setQuoteError("Pick a fabric, enter mass (kg), and pick a tier.");
      return;
    }
    setQuoting(true);
    try {
      const res = await fetch("/api/factory-portal/orders/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fabricId,
          fabricMassKg: Number(fabricMassKg),
          fuzeTier,
          wastageFactorPct: Number(wastageFactorPct) || 10,
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setQuoteError(j.error || "Quote failed");
        return;
      }
      setQuote(j);
    } catch (e: any) {
      setQuoteError(e?.message || "Quote failed");
    } finally {
      setQuoting(false);
    }
  }

  function addAllocation() {
    setAllocations((a) => [...a, { brandId: "", allocatedPct: 0 }]);
  }
  function setAlloc(i: number, patch: Partial<{ brandId: string; allocatedPct: number }>) {
    setAllocations((a) => a.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeAllocation(i: number) {
    setAllocations((a) => a.filter((_, idx) => idx !== i));
  }
  const allocSum = allocations.reduce((s, a) => s + (Number(a.allocatedPct) || 0), 0);

  async function submit() {
    setSubmitError(null);
    if (!quote) {
      setSubmitError("Run a quote before submitting.");
      return;
    }
    if (!poNumber) {
      setSubmitError("Attach a PO number before submitting (required for distributor approval).");
      return;
    }
    if (allocations.length === 0 || !allocations.some((a) => a.brandId)) {
      setSubmitError("At least one brand allocation is required.");
      return;
    }
    if (Math.abs(allocSum - 100) > 0.01) {
      setSubmitError(`Brand allocations must sum to 100% (currently ${allocSum}%).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "PRODUCTION",
          fabricId,
          fabricMassKg: Number(fabricMassKg),
          fuzeTier,
          volumeLiters: quote.volume.totalLiters,
          baseFuzeLiters: quote.volume.baseLiters,
          wastageFactorPct: Number(wastageFactorPct) || 10,
          treatmentMethod,
          brandId: allocations[0]?.brandId || null,
          brandAllocations: allocations.filter((a) => a.brandId),
          purposeNote: purposeNote || null,
          shippingAddress: shippingAddress || null,
          shippingCity: shippingCity || null,
          shippingCountry: shippingCountry || null,
          poNumber,
          poDocumentUrl: poDocumentUrl || null,
          distributorTierIndexAtOrder: quote.tier?.tierIndex || null,
          notes: "Submitted via /factory-portal/orders/new",
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setSubmitError(j.error || "Order create failed");
        return;
      }
      router.push(`/factory-portal/orders/${j.order.id}`);
    } catch (e: any) {
      setSubmitError(e?.message || "Order create failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-slate-500">Loading order context…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p className="font-bold mb-1">Couldn't load the order screen</p>
          <p>{loadError}</p>
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
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/factory-portal" className="hover:text-[#00b4c3]">
            Factory Portal
          </Link>
          <span>/</span>
          <Link href="/factory-portal/orders" className="hover:text-[#00b4c3]">
            Orders
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">New Order</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">New FUZE Order</h1>
        <p className="text-slate-500 text-sm mt-1">
          Order FUZE for a production run. We auto-compute the volume from the fabric spec and price
          it at your distributor's tier.
        </p>
      </div>

      {/* Step 1 — Fabric + spec */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h2 className="text-lg font-bold text-slate-900 mb-3">1. Fabric & treatment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Fabric
            </label>
            <select
              value={fabricId}
              onChange={(e) => setFabricId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">— select a fabric —</option>
              {fabrics.map((f) => (
                <option key={f.id} value={f.id}>
                  FUZE-{f.fuzeNumber} ·{" "}
                  {f.customerCode || f.factoryCode || f.construction || "Fabric"}
                  {f.brand?.name ? ` · for ${f.brand.name}` : ""}
                </option>
              ))}
            </select>
            {fabrics.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                No fabrics found. Submit a fabric in Intake first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Fabric mass (kg)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={fabricMassKg}
              onChange={(e) => setFabricMassKg(e.target.value)}
              placeholder="e.g. 1200"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              FUZE tier
            </label>
            <select
              value={fuzeTier}
              onChange={(e) => setFuzeTier(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Wastage %
            </label>
            <input
              type="number"
              min="0"
              max="50"
              step="1"
              value={wastageFactorPct}
              onChange={(e) => setWastageFactorPct(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Treatment method
            </label>
            <select
              value={treatmentMethod}
              onChange={(e) => setTreatmentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="EXHAUST">Exhaust (dyebath)</option>
              <option value="PAD_DRY_CURE">Pad–Dry–Cure</option>
              <option value="SPRAY">Spray</option>
            </select>
          </div>
        </div>
      </section>

      {/* Step 2 — Quote */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h2 className="text-lg font-bold text-slate-900 mb-3">2. Quote</h2>
        <button
          onClick={fetchQuote}
          disabled={quoting || !fabricId || !fabricMassKg}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          {quoting ? "Computing…" : "Get quote"}
        </button>
        {quoteError && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {quoteError}
          </div>
        )}
        {quote && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">FUZE volume</p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {quote.volume.totalLiters} L
              </p>
              <p className="text-xs text-slate-500 mt-1">
                base {quote.volume.baseLiters} L + {quote.volume.wastagePct}% wastage ·{" "}
                {quote.volume.bottles} bottles
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Distributor tier
              </p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {quote.tier.tierName || "—"}{" "}
                {quote.tier.tierIndex ? `(rung ${quote.tier.tierIndex})` : ""}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                via {quote.distributor?.name || "FUZE Direct"}
              </p>
            </div>
            <div className="rounded-xl border-2 border-[#00b4c3] bg-cyan-50/30 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-widest text-slate-500">Quoted price</p>
              {quote.quote.totalPrice != null ? (
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {quote.quote.currency} {quote.quote.totalPrice.toLocaleString()}
                </p>
              ) : (
                <p className="text-base text-amber-700 mt-1">
                  No tier price matched — your distributor needs to confirm pricing before approval.
                </p>
              )}
              {quote.quote.pricePerLiter != null && (
                <p className="text-xs text-slate-500 mt-1">
                  {quote.quote.currency} {quote.quote.pricePerLiter}/L · {quote.tier.source}
                </p>
              )}
            </div>
            {quote.warnings?.length > 0 && (
              <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-1">
                  Warnings
                </p>
                <ul className="text-sm text-amber-800 list-disc list-inside space-y-1">
                  {quote.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 3 — Brand allocation */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h2 className="text-lg font-bold text-slate-900 mb-1">3. Brand allocation</h2>
        <p className="text-xs text-slate-500 mb-3">
          Allocate this order across one or more brands. Must sum to 100%.
        </p>
        <div className="space-y-2">
          {allocations.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={a.brandId}
                onChange={(e) => setAlloc(i, { brandId: e.target.value })}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">— pick brand —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={a.allocatedPct}
                onChange={(e) => setAlloc(i, { allocatedPct: Number(e.target.value) })}
                className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <span className="text-slate-500">%</span>
              <button
                onClick={() => removeAllocation(i)}
                className="px-2 py-1 text-xs text-red-600 font-semibold hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={addAllocation}
            className="px-3 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200"
          >
            + Add brand
          </button>
          <p
            className={`text-xs mt-2 ${
              Math.abs(allocSum - 100) > 0.01 ? "text-red-600" : "text-emerald-600"
            }`}
          >
            Sum: {allocSum}%
          </p>
        </div>
      </section>

      {/* Step 4 — PO + shipping */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h2 className="text-lg font-bold text-slate-900 mb-3">4. Purchase order & shipping</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Your PO number
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-2026-04-115"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              PO document URL (optional)
            </label>
            <input
              type="text"
              value={poDocumentUrl}
              onChange={(e) => setPoDocumentUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Shipping address
            </label>
            <input
              type="text"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              City
            </label>
            <input
              type="text"
              value={shippingCity}
              onChange={(e) => setShippingCity(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Country
            </label>
            <input
              type="text"
              value={shippingCountry}
              onChange={(e) => setShippingCountry(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Production run note (optional)
            </label>
            <textarea
              value={purposeNote}
              onChange={(e) => setPurposeNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </section>

      {submitError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {submitError}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting || !quote}
        className="w-full px-6 py-3.5 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#00b4c3]/30 disabled:opacity-50"
      >
        {submitting ? "Submitting order…" : "Submit order to distributor"}
      </button>
    </div>
  );
}
