// @ts-nocheck
"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/i18n";

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
  const { t } = useI18n();
  const T = t.distributorPricingAdmin;

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
        setError(j.error || T.errorLoad);
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
      toast.error(T.errorPriceRequired);
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
        toast.error(T.errorFactoryRequired);
        setSaving(false);
        return;
      }
      if (form.scope === "COUNTRY" && !payload.country) {
        toast.error(T.errorCountryRequired);
        setSaving(false);
        return;
      }
      if (form.scope === "REGION" && !payload.region) {
        toast.error(T.errorRegionRequired);
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
        toast.error(j.error || T.errorCreateTier);
        return;
      }
      toast.success(T.toastTierCreated);
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
        toast.error(j.error || T.errorUpdateTier);
        return;
      }
      toast.success(T.toastTierUpdated);
      setEditingId(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tier: PricingTier) {
    if (!confirm(T.confirmDelete.replace("{scope}", describeScope(tier, T)))) return;
    try {
      const res = await fetch(
        `/api/distributor-portal/pricing?tierId=${encodeURIComponent(tier.id)}`,
        { method: "DELETE" },
      );
      const j = await res.json();
      if (!j.ok) {
        toast.error(j.error || T.errorDeleteTier);
        return;
      }
      toast.success(T.toastTierDeleted);
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
      <div className="flex items-center justify-center h-64 text-slate-400">{T.loading}</div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/distributors" className="text-sm text-cyan-700 hover:underline">
            {T.crumbDistributors}
          </Link>
          <h1 className="text-2xl font-black text-slate-900 mt-2">
            {distributor?.name || T.pageTitleDistributor} {T.pageTitleSuffix}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {distributor?.country || "—"}
            {coverage.length > 0 && <> · {T.coveragePrefix} {coverage.join(", ")}</>}
            {distributor?.localCurrency && <> · {T.localCurrencyPrefix} {distributor.localCurrency}</>}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-bold hover:bg-cyan-700"
        >
          {showAdd ? T.btnCancel : T.btnAddTier}
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
          <h2 className="text-sm font-bold text-slate-900">{T.formHeading}</h2>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">{T.fieldScope}</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { v: "DEFAULT", label: T.scopeDefaultLabel, desc: T.scopeDefaultDesc },
                { v: "FACTORY", label: T.scopeFactoryLabel, desc: T.scopeFactoryDesc },
                { v: "COUNTRY", label: T.scopeCountryLabel, desc: T.scopeCountryDesc },
                { v: "REGION", label: T.scopeRegionLabel, desc: T.scopeRegionDesc },
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
              <span className="text-xs font-semibold text-slate-700 block mb-1">{T.fieldFactoryRequired}</span>
              <select
                value={form.factoryId}
                onChange={(e) => setForm({ ...form, factoryId: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              >
                <option value="">{T.placeholderSelectFactory}</option>
                {factoriesByBucket.assigned.length > 0 && (
                  <optgroup label={T.optgroupYourFactories}>
                    {factoriesByBucket.assigned.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.country ? ` (${f.country})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {factoriesByBucket.coverage.length > 0 && (
                  <optgroup label={T.optgroupInTerritory}>
                    {factoriesByBucket.coverage.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.country ? ` (${f.country})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {factoriesByBucket.other.length > 0 && (
                  <optgroup label={T.optgroupOther}>
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
              <span className="text-xs font-semibold text-slate-700 block mb-1">{T.fieldCountryRequired}</span>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder={T.placeholderCountry}
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
              <span className="text-xs font-semibold text-slate-700 block mb-1">{T.fieldRegionRequired}</span>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm bg-white"
              >
                <option value="">{T.placeholderSelectRegion}</option>
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
                {T.fieldPricePerLiter}
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
              <span className="text-xs font-semibold text-slate-700 block mb-1">{T.fieldCurrency}</span>
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
              <span className="text-xs font-semibold text-slate-700 block mb-1">{T.fieldMinOrder}</span>
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
                {T.fieldLeadDays}
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
                {T.fieldHangtagPrice}
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
                {T.fieldHangtagMin}
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
            <span className="text-xs font-semibold text-slate-700 block mb-1">{T.fieldNotes}</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm"
              placeholder={T.notesPlaceholder}
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
              {T.btnCancel}
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.pricePerLiter}
              className="px-4 py-1.5 rounded-lg text-sm font-bold bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-40"
            >
              {saving ? T.btnCreating : T.btnCreate}
            </button>
          </div>
        </div>
      )}

      {/* Tier list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left">{T.colScope}</th>
              <th className="px-4 py-2 text-right">{T.colPriceL}</th>
              <th className="px-4 py-2 text-right">{T.colMinOrder}</th>
              <th className="px-4 py-2 text-right">{T.colLead}</th>
              <th className="px-4 py-2 text-right">{T.colHangtag}</th>
              <th className="px-4 py-2 text-center">{T.colActive}</th>
              <th className="px-4 py-2 text-right">{T.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {tiers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">
                  {T.emptyPrefix}{" "}
                  <button
                    onClick={() => setShowAdd(true)}
                    className="text-cyan-700 hover:underline"
                  >
                    {T.emptyAddLink}
                  </button>{" "}
                  {T.emptySuffix}
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
                          {T.badgeDefault}
                        </span>
                      )}
                      <span className="font-medium text-slate-900">{describeScope(t, T)}</span>
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
                          {T.rowSave}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                        >
                          {T.btnCancel}
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
                          {T.rowEdit}
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                        >
                          {T.rowDelete}
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
        {T.resolutionOrder} <b>{T.resolutionFactory}</b> →{" "}
        <b>{T.resolutionCountry}</b> → <b>{T.resolutionRegion}</b> → <b>{T.resolutionDefault}</b>.
      </div>
    </div>
  );
}

function describeScope(t: PricingTier, T?: any) {
  if (t.factoryId && t.factory) {
    return `🏭 ${t.factory.name}${t.factory.country ? ` (${t.factory.country})` : ""}`;
  }
  if (t.country) return `🌐 ${t.country}`;
  if (t.region) return `🗺️ ${t.region}`;
  if (t.isDefault) return T?.scopeFallback || "Default";
  return "—";
}
