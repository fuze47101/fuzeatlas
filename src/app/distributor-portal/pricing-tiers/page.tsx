// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Distributor Portal Ordering — 5-tier price ladder editor.
 *
 * Distributors set up to 5 pricing tiers in their local currency
 * (NTD, RMB, TRY, INR, …). Each factory under them gets assigned
 * to a tier (via Factory.distributorTierIndex). The quote endpoint
 * reads `pricePerLiter` from the matching rung when a factory
 * places an order.
 */

const CURRENCY_OPTIONS = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "CNY",
  "TWD",
  "TRY",
  "JPY",
  "KRW",
  "VND",
  "BDT",
  "MXN",
  "BRL",
];

export default function PricingTiersPage() {
  const { user } = useAuth();
  const router = useRouter();

  const isDistributor = user?.role === "DISTRIBUTOR_USER";
  const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user?.role || "");
  const canEdit = isDistributor || ["ADMIN", "EMPLOYEE"].includes(user?.role || "");

  const [ladder, setLadder] = useState<any[]>([]);
  const [distributor, setDistributor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<number, any>>({});

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
      const res = await fetch("/api/distributor-portal/pricing-tiers");
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Failed to load tiers");
        return;
      }
      setLadder(j.ladder || []);
      setDistributor(j.distributor || null);
      const d: Record<number, any> = {};
      (j.ladder || []).forEach((rung: any) => {
        d[rung.tierIndex] = rung.row
          ? {
              tierName: rung.row.tierName || `Tier ${rung.tierIndex}`,
              pricePerLiter: rung.row.pricePerLiter,
              currency: rung.row.currency || j.distributor?.localCurrency || "USD",
              minVolumeLiters: rung.row.minOrderLiters || "",
              active: rung.row.active !== false,
              notes: rung.row.notes || "",
            }
          : {
              tierName: `Tier ${rung.tierIndex}`,
              pricePerLiter: "",
              currency: j.distributor?.localCurrency || "USD",
              minVolumeLiters: "",
              active: true,
              notes: "",
            };
      });
      setDrafts(d);
    } catch (e: any) {
      setError(e?.message || "Failed to load tiers");
    } finally {
      setLoading(false);
    }
  }

  function setDraft(tierIndex: number, patch: any) {
    setDrafts((prev) => ({ ...prev, [tierIndex]: { ...prev[tierIndex], ...patch } }));
  }

  async function save(tierIndex: number) {
    const d = drafts[tierIndex];
    if (!d) return;
    if (!d.pricePerLiter || Number(d.pricePerLiter) <= 0) {
      setError(`Tier ${tierIndex}: price per liter must be > 0`);
      return;
    }
    setSaving(tierIndex);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/distributor-portal/pricing-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierIndex,
          tierName: d.tierName,
          pricePerLiter: Number(d.pricePerLiter),
          currency: d.currency,
          minVolumeLiters: d.minVolumeLiters ? Number(d.minVolumeLiters) : null,
          active: d.active,
          notes: d.notes,
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || `Failed to save tier ${tierIndex}`);
        return;
      }
      setSuccess(`Tier ${tierIndex} saved.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function remove(rungId: string, tierIndex: number) {
    if (!confirm(`Delete pricing tier ${tierIndex}?`)) return;
    setSaving(tierIndex);
    setError(null);
    try {
      const res = await fetch(`/api/distributor-portal/pricing-tiers?id=${rungId}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Delete failed");
        return;
      }
      setSuccess(`Tier ${tierIndex} deleted.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <p className="text-slate-500">Loading pricing tiers…</p>
      </div>
    );
  }

  // Surface explicit error state (never silent zeros — standing rule).
  if (error && !ladder.length) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p className="font-bold mb-1">Couldn't load pricing tiers</p>
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
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/distributor-portal" className="hover:text-[#00b4c3]">
            Distributor Portal
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Pricing Tiers</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Factory Pricing Tiers</h1>
        <p className="text-slate-500 text-sm mt-1">
          {distributor?.name ? (
            <>
              {distributor.name}'s 5-tier ladder. Default currency:{" "}
              <span className="font-mono font-semibold">{distributor.localCurrency || "USD"}</span>.
              Each factory you supply gets assigned to one tier; the quote engine reads that tier's
              price when the factory orders.
            </>
          ) : (
            <>Set up to 5 pricing tiers for the factories you supply.</>
          )}
        </p>
      </div>

      {success && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm">
          {success}
        </div>
      )}
      {error && ladder.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {ladder.map((rung) => {
          const d = drafts[rung.tierIndex] || {};
          const isSaving = saving === rung.tierIndex;
          return (
            <div
              key={rung.tierIndex}
              className={`rounded-2xl border-2 p-5 transition-shadow ${
                rung.row
                  ? "border-[#00b4c3] bg-cyan-50/20 shadow-sm"
                  : "border-dashed border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-black">
                    {rung.tierIndex}
                  </div>
                  <input
                    type="text"
                    value={d.tierName || ""}
                    onChange={(e) => setDraft(rung.tierIndex, { tierName: e.target.value })}
                    disabled={!canEdit}
                    placeholder={`Tier ${rung.tierIndex} label`}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 disabled:opacity-60 disabled:bg-slate-50"
                  />
                </div>
                {rung.row && canEdit && (
                  <button
                    onClick={() => remove(rung.row.id, rung.tierIndex)}
                    disabled={isSaving}
                    className="text-xs text-red-600 font-semibold hover:underline disabled:opacity-50"
                  >
                    Remove tier
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Price / Liter
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={d.pricePerLiter || ""}
                    onChange={(e) => setDraft(rung.tierIndex, { pricePerLiter: e.target.value })}
                    disabled={!canEdit}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Currency
                  </label>
                  <select
                    value={d.currency || "USD"}
                    onChange={(e) => setDraft(rung.tierIndex, { currency: e.target.value })}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-60"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Min Volume (L)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={d.minVolumeLiters || ""}
                    onChange={(e) => setDraft(rung.tierIndex, { minVolumeLiters: e.target.value })}
                    disabled={!canEdit}
                    placeholder="optional"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Notes (visible only inside your distributor team)
                </label>
                <input
                  type="text"
                  value={d.notes || ""}
                  onChange={(e) => setDraft(rung.tierIndex, { notes: e.target.value })}
                  disabled={!canEdit}
                  placeholder="e.g. North India yarn mills, top-volume strategic partners"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-60"
                />
              </div>

              {canEdit && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.active !== false}
                      onChange={(e) => setDraft(rung.tierIndex, { active: e.target.checked })}
                    />
                    Active
                  </label>
                  <button
                    onClick={() => save(rung.tierIndex)}
                    disabled={isSaving}
                    className="ml-auto px-4 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg hover:bg-[#009aa8] disabled:opacity-50"
                  >
                    {isSaving ? "Saving…" : rung.row ? "Update tier" : "Save tier"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!ladder.length && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-600">No ladder rungs available.</p>
        </div>
      )}
    </div>
  );
}
