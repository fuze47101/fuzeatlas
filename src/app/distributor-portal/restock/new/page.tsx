// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Focused single-purpose restock create page. Mirrors the inline
 * order form on /distributor-portal/restock — split out so distributors
 * can deep-link a rep at the form directly without scrolling past
 * the open order list.
 *
 * Posts to the same /api/distributor-portal/restock endpoint the
 * inline form does. On success, navigates back to /restock with the
 * new order in the list.
 */

const UNITS: Array<{
  id: string;
  label: string;
  liters: number;
  desc: string;
  sample?: boolean;
}> = [
  { id: "SAMPLE_500ML", label: "500 mL Sample", liters: 0.5, desc: "Half-liter R&D bottle · courier ship", sample: true },
  { id: "SAMPLE_1L", label: "1 L Sample", liters: 1, desc: "1L R&D bottle · courier ship", sample: true },
  { id: "CARBOY", label: "Carboy", liters: 19, desc: "19L bottle · USA only for production" },
  { id: "GAYLORD", label: "Gaylord", liters: 608, desc: "32 carboys · 608L — international minimum" },
  { id: "CONTAINER_20", label: "20' Container", liters: 6080, desc: "10 gaylords · 6,080L" },
  { id: "CONTAINER_40", label: "40' Container", liters: 12160, desc: "20 gaylords · 12,160L" },
];

export default function DistributorRestockNewPage() {
  const { user } = useAuth();
  const router = useRouter();

  const isDistributor = user?.role === "DISTRIBUTOR_USER";
  const isInternal = ["ADMIN", "EMPLOYEE"].includes(user?.role || "");

  const [distributor, setDistributor] = useState<any>(null);
  const [effective, setEffective] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedUnit, setSelectedUnit] = useState("GAYLORD");
  const [quantity, setQuantity] = useState(1);
  const [useDefaultShipping, setUseDefaultShipping] = useState(true);
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingCountry, setShippingCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [isFOC, setIsFOC] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      setLoadError(null);
      const res = await fetch("/api/distributor-portal/restock");
      const j = await res.json();
      if (!j.ok) {
        setLoadError(j.error || "Failed to load restock context");
        return;
      }
      setDistributor(j.distributor || null);
      setEffective(j.effective || null);
    } catch (e: any) {
      setLoadError(e?.message || "Failed to load restock context");
    } finally {
      setLoading(false);
    }
  }

  const unit = UNITS.find((u) => u.id === selectedUnit) || UNITS[0];
  const totalLiters = unit.liters * quantity;
  const pricePerLiter = effective?.pricePerLiter ?? null;
  const currency = effective?.currency || distributor?.localCurrency || "USD";
  const totalPrice = pricePerLiter != null ? totalLiters * pricePerLiter : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: any = {
        unitType: selectedUnit,
        unitQuantity: quantity,
        notes,
        orderCategory: unit.sample ? "SAMPLE" : "PRODUCTION",
        isFOC: unit.sample ? isFOC : false,
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
      const j = await res.json();
      if (!j.ok) {
        setSubmitError(j.error || "Failed to submit order");
        return;
      }
      router.push(`/distributor-portal/restock?new=${j.order.orderNumber}`);
    } catch (e: any) {
      setSubmitError(e?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-slate-500">Loading restock context…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p className="font-bold mb-1">Couldn't load restock context</p>
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
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/distributor-portal" className="hover:text-[#00b4c3]">
            Distributor Portal
          </Link>
          <span>/</span>
          <Link href="/distributor-portal/restock" className="hover:text-[#00b4c3]">
            Restock
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">New</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">New Restock Order</h1>
        <p className="text-slate-500 text-sm mt-1">
          Order raw FUZE from FUZE Direct in Salt Lake City. International orders ship by gaylord
          minimum (32 × 19L = 608L) or container.
        </p>
      </div>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Unit type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {UNITS.map((u) => (
              <label
                key={u.id}
                className={`cursor-pointer rounded-xl border p-3 ${
                  selectedUnit === u.id
                    ? "border-[#00b4c3] bg-cyan-50/30"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="unit"
                  value={u.id}
                  checked={selectedUnit === u.id}
                  onChange={() => setSelectedUnit(u.id)}
                  className="hidden"
                />
                <p className="font-bold text-slate-900">{u.label}</p>
                <p className="text-xs text-slate-500 mt-1">{u.desc}</p>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Quantity ({unit.label.toLowerCase()})
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Total liters
            </label>
            <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900">
              {totalLiters.toLocaleString()} L
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#00b4c3] bg-cyan-50/30 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">FUZE quote</p>
          {pricePerLiter != null ? (
            <>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {currency} {totalPrice!.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {currency} {pricePerLiter}/L
              </p>
            </>
          ) : (
            <p className="text-amber-700 mt-1 text-sm">
              No FUZE restock price set for your distributor yet. The order will go to FUZE for a
              quote before approval.
            </p>
          )}
        </div>

        {unit.sample && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isFOC} onChange={(e) => setIsFOC(e.target.checked)} />
            Free of charge (samples only)
          </label>
        )}

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
            <input
              type="checkbox"
              checked={useDefaultShipping}
              onChange={(e) => setUseDefaultShipping(e.target.checked)}
            />
            Ship to my distributor address on file
          </label>
          {!useDefaultShipping && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Address"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="sm:col-span-3 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="City"
                value={shippingCity}
                onChange={(e) => setShippingCity(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Country"
                value={shippingCountry}
                onChange={(e) => setShippingCountry(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Notes (optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything FUZE Ops should know about this restock…"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {submitError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-6 py-3 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#00b4c3]/30 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit restock order"}
        </button>
      </form>
    </div>
  );
}
