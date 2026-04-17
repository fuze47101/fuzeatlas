// @ts-nocheck
"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

interface PricingTier {
  id: string;
  distributorId: string;
  factoryId: string | null;
  factory: { id: string; name: string; country: string | null } | null;
  country: string | null;
  region: string | null;
  pricePerLiter: number;
  currency: string;
  minOrderLiters: number | null;
  leadTimeDays: number | null;
  hangtagPricePerUnit: number | null;
  hangtagMinOrder: number | null;
  volumeDiscounts: any;
  isDefault: boolean;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FactoryOpt {
  id: string;
  name: string;
  country: string | null;
  assigned: boolean;
  inCoverage: boolean;
}

interface DistributorInfo {
  id: string;
  name: string;
  country: string | null;
  region: string | null;
  coverageCountries: any;
  localCurrency: string | null;
}

const EMPTY_NEW = {
  scope: "DEFAULT" as "DEFAULT" | "FACTORY" | "COUNTRY" | "REGION",
  factoryId: "",
  country: "",
  region: "",
  pricePerLiter: "",
  currency: "USD",
  minOrderLiters: "",
  leadTimeDays: "",
  hangtagPricePerUnit: "",
  hangtagMinOrder: "",
  isDefault: false,
  notes: "",
};

export default function DistributorPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: distributorId } = use(params);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [factories, setFactories] = useState<FactoryOpt[]>([]);
  const [distributor, setDistributor] = useState<DistributorInfo | null>(null);
  const [coverage, setCoverage] = useState<string[]>([]);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_NEW });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/distributor-portal/pricing?distributorId=${distributorId}`);
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Failed to load pricing");
        return;
      }
      setTiers(j.pricing || []);
      setFactories(j.factories || []);
      setDistributor(j.distributor || null);
      setCoverage(j.coverage || []);
      if (j.distributor?.localCurrency && !form.currency) {
        setForm((p) => ({ ...p, currency: j.distributor.localCurrency }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributorId]);

  async function handleCreate() {
    if (!form.pricePerLiter) {
      toast.error("Price per liter is required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        distributorId,
        pricePerLiter: Number(form.pricePerLiter),
        currency: form.currency || "USD",
        minOrderLiters: form.minOrderLiters ? Number(form.minOrderLiters) : null,
        leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : null,
        hangtagPricePerUnit: form.hangtagPricePerUnit ? Number(form.hangtagPricePerUnit) : null,
        hangtagMinOrder: form.hangtagMinOrder ? Number(form.hangtagMinOrder) : null,
        isDefault: form.scope === "DEFAULT" ? true : form.isDefault,
        notes: form.notes || null,
      };
      // Scope
      if (form.scope === "FACTORY") payload.factoryId = form.factoryId || null;
      else if (form.scope === "COUNTRY") payload.country = form.country.trim() || null;
      else if (form.scope === "REGION") payload.region = form.region.trim() || null;

      if (form.scope === "FACTORY" && !payload.factoryId) {
        toast.error("Factory is required for factory-scoped pricing");
        setSaving(false);
        return;
      }
      if (form.scope === "COUNTRY" && !payload.country) {
        toast.error("Country is required for country-scoped pricing");
        setSaving(false);
        return;
      }
      if (form.scope === "REGION" && !payload.region) {
        toast.error("Region is required for region-scoped pricing");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/distributor-portal/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) {
        toast.error(j.error || "Failed to create tier");
        return;
      }
      toast.success("Pricing tier created");
      setShowAdd(false);
      setForm({ ...EMPTY_NEW });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(t: PricingTier) {
    setEditingId(t.id);
    setEditForm({
      pricePerLiter: String(t.pricePerLiter ?? ""),
      currency: t.currency,
      minOrderLiters: t.minOrderLiters ?? "",
      leadTimeDays: t.leadTimeDays ?? "",
      hangtagPricePerUnit: t.hangtagPricePerUnit ?? "",
      hangtagMinOrder: t.hangtagMinOrder ?? "",
      active: t.active,
      isDefault: t.isDefault,
      notes: t.notes || "",
    });
  }

  async function handleSaveEdit(t: PricingTier) {
    setSaving(true);
    try {
      const payload: any = { tierId: t.id };
      for (const k of Object.keys(editForm)) {
        const v = editForm[k];
        payload[k] = v === "" ? null : v;
      }
      const res = await fetch("/api/distributor-portal/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) {
        toast.error(j.error || "Failed to update");
        return;
      }
      toast.success("Tier updated");
      setEditingId(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: PricingTier) {
    if (!confirm(`Delete ${describeScope(t)} pricing tier? This cannot be undone.`)) return;
    try {
      const res = await fetch(
        `/api/distributor-portal/pricing?tierId=${encodeURIComponent(t.id)}`,
        { method: "DELETE" },
      );
      const j = await res.json();
      if (!j.ok) {
        toast.error(j.error || "Failed to delete");
        return;
      }
      toast.success("Tier deleted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const factoriesByBucket = useMemo(() => {
    return {
      assigned: factories.filter((f) => f.assigned),
      coverage: factories.filter((f) => f.inCoverage),
      other: factories.filter((f) => !f.assigned && !f.inCoverage),
    };
  }, [factories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">Loading pricing…</div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/distributors" className="text-sm text-cyan-700 hover:underline">
            ← Distributors
          </Link>
          <h1 className="text-2xl font-black text-slate-900 mt-2">
            {distributor?.name || "Distributor"} — Pricing Tiers
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {distributor?.country || "—"}
            {coverage.length > 0 && <> · Coverage: {coverage.join(", ")}</>}
            {distributor?.localCurrency && <> · Local currency: {distributor.localCurrency}</>}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-bold hover:bg-cyan-700"
        >
          {showAdd ? "Cancel" : "+ Add Pricing Tier"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900">New Pricing Tier</h2>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">Scope</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { v: "DEFAULT", label: "Default", desc: "Fallback for all" },
                { v: "FACTORY", label: "Factory", desc: "Single mill" },
                { v: "COUNTRY", label: "Country", desc: "Territory per-country" },
                { v: "REGION", label: "Region", desc: "APAC / EMEA / etc." },
              ].map((s) => (
                <button
                  key={s.v}
                  type="button"
                  onClick={() => setForm({ ...form, scope: s.v as any })}
                  className={`p-3 border rounded-lg text-left text-xs ${
                    form.scope === s.v
                      ? "border-cyan-500 bg-cyan-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-bold text-slate-900">{s.label}</div>
                  <div className="text-slate-500">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {form.scope === "FACTORY" && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">Factory *</span>
              <select
                value={form.factoryId}
                onChange={(e) => setForm({ ...form, factoryId: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              >
                <option value="">— Select factory —</option>
                {factoriesByBucket.assigned.length > 0 && (
                  <optgroup label="Your Factories">
                    {factoriesByBucket.assigned.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.country ? ` (${f.country})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {factoriesByBucket.coverage.length > 0 && (
                  <optgroup label="In Territory">
                    {factoriesByBucket.coverage.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.country ? ` (${f.country})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {factoriesByBucket.other.length > 0 && (
                  <optgroup label="Other">
                    {factoriesByBucket.other.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.country ? ` (${f.country})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
          )}

          {form.scope === "COUNTRY" && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">Country *</span>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="e.g. India"
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm"
              />
              {coverage.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {coverage.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, country: c })}
                      className="px-2 py-0.5 text-xs bg-slate-100 hover:bg-cyan-100 rounded"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </label>
          )}

          {form.scope === "REGION" && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">Region *</span>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm bg-white"
              >
                <option value="">— Select region —</option>
                {[
                  "APAC",
                  "EMEA",
                  "LATAM",
                  "NAM",
                  "South Asia",
                  "Middle East",
                  "East Asia",
                  "Europe",
                  "Latin America",
                ].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Price / Liter *
              </span>
              <input
                type="number"
                step="0.01"
                value={form.pricePerLiter}
                onChange={(e) => setForm({ ...form, pricePerLiter: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">Currency</span>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm bg-white"
              >
                {["USD", "EUR", "GBP", "INR", "CNY", "AED", "TWD", "BRL", "HKD"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">Min Order (L)</span>
              <input
                type="number"
                value={form.minOrderLiters}
                onChange={(e) => setForm({ ...form, minOrderLiters: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Lead time (days)
              </span>
              <input
                type="number"
                value={form.leadTimeDays}
                onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Hangtag $ / unit
              </span>
              <input
                type="number"
                step="0.01"
                value={form.hangtagPricePerUnit}
                onChange={(e) => setForm({ ...form, hangtagPricePerUnit: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Hangtag min order
              </span>
              <input
                type="number"
                value={form.hangtagMinOrder}
                onChange={(e) => setForm({ ...form, hangtagMinOrder: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm"
              placeholder="Payment terms, notes, special conditions…"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setShowAdd(false);
                setForm({ ...EMPTY_NEW });
              }}
              disabled={saving}
              className="px-3 py-1.5 border border-slate-200 rounded text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.pricePerLiter}
              className="px-4 py-1.5 rounded-lg text-sm font-bold bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-40"
            >
              {saving ? "Creating…" : "Create Tier"}
            </button>
          </div>
        </div>
      )}

      {/* Tier list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left">Scope</th>
              <th className="px-4 py-2 text-right">Price / L</th>
              <th className="px-4 py-2 text-right">Min Order</th>
              <th className="px-4 py-2 text-right">Lead (d)</th>
              <th className="px-4 py-2 text-right">Hangtag</th>
              <th className="px-4 py-2 text-center">Active</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tiers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">
                  No pricing tiers yet. Click{" "}
                  <button
                    onClick={() => setShowAdd(true)}
                    className="text-cyan-700 hover:underline"
                  >
                    + Add Pricing Tier
                  </button>{" "}
                  to start.
                </td>
              </tr>
            )}
            {tiers.map((t) => {
              const editing = editingId === t.id;
              return (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {t.isDefault && (
                        <span className="px-1.5 py-0.5 bg-cyan-100 text-cyan-800 text-[10px] rounded font-bold">
                          DEFAULT
                        </span>
                      )}
                      <span className="font-medium text-slate-900">{describeScope(t)}</span>
                    </div>
                    {t.notes && <div className="text-xs text-slate-500 mt-1">{t.notes}</div>}
                  </td>

                  {editing ? (
                    <>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.pricePerLiter}
                          onChange={(e) =>
                            setEditForm({ ...editForm, pricePerLiter: e.target.value })
                          }
                          className="w-24 px-2 py-1 border border-slate-200 rounded text-right text-sm"
                        />
                        <select
                          value={editForm.currency}
                          onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                          className="ml-1 px-1 py-1 border border-slate-200 rounded text-xs bg-white"
                        >
                          {["USD", "EUR", "GBP", "INR", "CNY", "AED", "TWD", "BRL", "HKD"].map(
                            (c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={editForm.minOrderLiters}
                          onChange={(e) =>
                            setEditForm({ ...editForm, minOrderLiters: e.target.value })
                          }
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-right text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={editForm.leadTimeDays}
                          onChange={(e) =>
                            setEditForm({ ...editForm, leadTimeDays: e.target.value })
                          }
                          className="w-16 px-2 py-1 border border-slate-200 rounded text-right text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.hangtagPricePerUnit}
                          onChange={(e) =>
                            setEditForm({ ...editForm, hangtagPricePerUnit: e.target.value })
                          }
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-right text-sm"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(editForm.active)}
                          onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                        />
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => handleSaveEdit(t)}
                          disabled={saving}
                          className="px-2 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {t.pricePerLiter?.toFixed(2)} {t.currency}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                        {t.minOrderLiters ? `${t.minOrderLiters} L` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                        {t.leadTimeDays ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                        {t.hangtagPricePerUnit
                          ? `${t.hangtagPricePerUnit.toFixed(2)} ${t.currency}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            t.active ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => startEdit(t)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500">
        Pricing resolution order when a distributor creates an order: <b>Factory-scoped</b> →{" "}
        <b>Country-scoped</b> → <b>Region-scoped</b> → <b>Default</b>.
      </div>
    </div>
  );
}

function describeScope(t: PricingTier) {
  if (t.factoryId && t.factory) {
    return `🏭 ${t.factory.name}${t.factory.country ? ` (${t.factory.country})` : ""}`;
  }
  if (t.country) return `🌐 ${t.country}`;
  if (t.region) return `🗺️ ${t.region}`;
  if (t.isDefault) return "Default";
  return "—";
}
