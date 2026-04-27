// @ts-nocheck
"use client";

/**
 * /admin/distributors/[id]/tiers
 *
 * Five-tier pricing editor for a distributor. Each distributor sets up
 * up to 5 pricing tiers driven by geography / shipping / tariffs /
 * end-use margin. Factories that this distributor serves can then be
 * placed in any of the 5 tiers.
 *
 * Bulk-save pattern — the whole 5-row table posts in one PUT so the
 * downstream pricing resolver always sees a consistent view.
 *
 * Below the tier editor is a factory assignment table — every factory
 * linked to this distributor with a dropdown to set their tier index.
 * Saves per-row to the factory PATCH endpoint.
 */

import { use, useEffect, useState } from "react";
import Link from "next/link";

interface TierRow {
  tierIndex: number;
  tierName: string;
  pricePerLiter: number | null | string;
  currency: string;
  minOrderLiters: number | null | string;
  leadTimeDays: number | null | string;
  hangtagPricePerUnit: number | null | string;
  hangtagMinOrder: number | null | string;
  notes: string | null;
  rowId: string | null;
}

interface FactoryRow {
  id: string;
  name: string;
  country: string | null;
  distributorTierIndex: number | null;
}

export default function DistributorTiersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [distributor, setDistributor] = useState<any>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [factories, setFactories] = useState<FactoryRow[]>([]);
  const [tierFactoryCounts, setTierFactoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/distributor-tiers/${id}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "load failed");
      setDistributor(json.distributor);
      setTiers(json.tiers);
      setFactories(json.factories);
      setTierFactoryCounts(json.tierFactoryCounts || {});
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function setTier(idx: number, patch: Partial<TierRow>) {
    setTiers((rows) =>
      rows.map((r) => (r.tierIndex === idx ? { ...r, ...patch } : r)),
    );
  }

  async function saveTiers() {
    setSaving(true);
    setSavedMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/distributor-tiers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "save failed");
      setSavedMsg("Saved.");
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 3000);
    }
  }

  async function setFactoryTier(factoryId: string, tierIndex: number | null) {
    try {
      const res = await fetch(`/api/factories/${factoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distributorTierIndex: tierIndex }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "factory save failed");
      // Optimistic in-place update
      setFactories((fs) =>
        fs.map((f) =>
          f.id === factoryId ? { ...f, distributorTierIndex: tierIndex } : f,
        ),
      );
      // Refresh aggregate counts
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!distributor) {
    return <div className="p-8 text-red-600">Distributor not found.</div>;
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/admin/distributors" className="hover:text-[#00b4c3]">
            Admin
          </Link>
          <span>/</span>
          <Link href="/admin/distributors" className="hover:text-[#00b4c3]">
            Distributors
          </Link>
          <span>/</span>
          <span>{distributor.name}</span>
          <span>/</span>
          <span>Tiers</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900">
          Pricing Tiers — {distributor.name}
        </h1>
        <p className="text-slate-600 mt-1 max-w-3xl">
          Set up to 5 pricing tiers for this distributor. Tiers are
          generic by name (Tier 1…Tier 5); the distributor decides what
          each tier means — geography, shipping/tariff bands, end-use
          margin, position in the chain. Factories assigned to this
          distributor get placed into a tier below.
        </p>
        {distributor.parentDistributor && (
          <p className="text-sm text-slate-500 mt-2">
            Note: this distributor is a sub of{" "}
            <strong>{distributor.parentDistributor.name}</strong>. Their
            restocks order from the master, not from FUZE.
          </p>
        )}
      </div>

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {err}
        </div>
      )}
      {savedMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700">
          {savedMsg}
        </div>
      )}

      {/* ─── Tier table ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-3 w-16">Tier</th>
              <th className="text-left px-3 py-3">Name</th>
              <th className="text-right px-3 py-3 w-32">$/L</th>
              <th className="text-left px-3 py-3 w-24">Currency</th>
              <th className="text-right px-3 py-3 w-28">Min order (L)</th>
              <th className="text-right px-3 py-3 w-24">Lead (days)</th>
              <th className="text-right px-3 py-3 w-28">Hangtag $/unit</th>
              <th className="text-left px-3 py-3">Notes</th>
              <th className="text-right px-3 py-3 w-20">Factories</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.tierIndex} className="border-t border-slate-100">
                <td className="px-3 py-2 text-base font-black text-slate-900">
                  {t.tierIndex}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={t.tierName}
                    onChange={(e) =>
                      setTier(t.tierIndex, { tierName: e.target.value })
                    }
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={t.pricePerLiter ?? ""}
                    onChange={(e) =>
                      setTier(t.tierIndex, { pricePerLiter: e.target.value })
                    }
                    placeholder="—"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={t.currency}
                    onChange={(e) =>
                      setTier(t.tierIndex, { currency: e.target.value })
                    }
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm bg-white"
                  >
                    <option>USD</option>
                    <option>EUR</option>
                    <option>CNY</option>
                    <option>INR</option>
                    <option>AED</option>
                    <option>TRY</option>
                    <option>NTD</option>
                    <option>MXN</option>
                    <option>GBP</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    value={t.minOrderLiters ?? ""}
                    onChange={(e) =>
                      setTier(t.tierIndex, {
                        minOrderLiters: e.target.value,
                      })
                    }
                    placeholder="—"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    value={t.leadTimeDays ?? ""}
                    onChange={(e) =>
                      setTier(t.tierIndex, { leadTimeDays: e.target.value })
                    }
                    placeholder="—"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={t.hangtagPricePerUnit ?? ""}
                    onChange={(e) =>
                      setTier(t.tierIndex, {
                        hangtagPricePerUnit: e.target.value,
                      })
                    }
                    placeholder="—"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={t.notes ?? ""}
                    onChange={(e) =>
                      setTier(t.tierIndex, { notes: e.target.value })
                    }
                    placeholder="optional"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">
                  {tierFactoryCounts[t.tierIndex] || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={saveTiers}
          disabled={saving}
          className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "💾 Save Tier Table"}
        </button>
        <span className="text-xs text-slate-500">
          Empty $/L clears that tier. Factories assigned to a cleared
          tier will fall back to the default pricing row.
        </span>
      </div>

      {/* ─── Factory assignment ──────────────────────────── */}
      <h2 className="text-xl font-black text-slate-900 mb-2">
        Assign Factories to Tiers
      </h2>
      <p className="text-sm text-slate-600 mb-3">
        {factories.length === 0
          ? "No factories are linked to this distributor yet — assign them on the factory edit page."
          : `${factories.length} factor${factories.length === 1 ? "y is" : "ies are"} linked to ${distributor.name}. Pick a tier for each.`}
      </p>

      {factories.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-3">Factory</th>
                <th className="text-left px-3 py-3 w-32">Country</th>
                <th className="text-left px-3 py-3 w-40">Tier</th>
              </tr>
            </thead>
            <tbody>
              {factories.map((f) => (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Link
                      href={`/factories/${f.id}`}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {f.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {f.country || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={f.distributorTierIndex ?? ""}
                      onChange={(e) =>
                        setFactoryTier(
                          f.id,
                          e.target.value === ""
                            ? null
                            : parseInt(e.target.value),
                        )
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm bg-white"
                    >
                      <option value="">(default — no tier)</option>
                      {tiers.map((t) => (
                        <option
                          key={t.tierIndex}
                          value={t.tierIndex}
                          disabled={t.pricePerLiter == null || t.pricePerLiter === ""}
                        >
                          Tier {t.tierIndex} —{" "}
                          {t.pricePerLiter != null && t.pricePerLiter !== ""
                            ? `${t.tierName} (${t.currency} ${Number(t.pricePerLiter).toFixed(2)}/L)`
                            : `${t.tierName} — not configured`}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
