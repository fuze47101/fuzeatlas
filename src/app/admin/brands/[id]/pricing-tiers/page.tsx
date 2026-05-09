"use client";

/**
 * Admin UI for the per-brand pricing tier ladder.
 *
 * Lets AMs configure the discount rungs that show up on the brand's
 * /brand-portal/pricing page. Pure CRUD against the existing
 * /api/admin/brand-pricing-tiers endpoint — no schema changes.
 *
 * Built May 2026 — companion to the cross-factory volume rollup
 * shipped in commit 8c1a872. That commit gave us the ladder model
 * and the read API; this is the missing AM-side write surface.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Tier {
  id: string;
  brandId: string;
  thresholdLiters: number;
  discountPct: number;
  label: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BrandSummary {
  id: string;
  name: string;
}

interface FormState {
  thresholdLiters: string;
  discountPct: string;
  label: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  thresholdLiters: "",
  discountPct: "",
  label: "",
  active: true,
};

function fmtLiters(n: number) {
  if (!n) return "0 L";
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k L`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k L`;
  return `${n.toFixed(0)} L`;
}

export default function AdminBrandPricingTiersPage() {
  const params = useParams<{ id: string }>();
  const brandId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandSummary | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.thresholdLiters - b.thresholdLiters),
    [tiers],
  );

  async function loadAll() {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const [tiersRes, brandRes] = await Promise.all([
        fetch(`/api/admin/brand-pricing-tiers?brandId=${brandId}`).then((r) => r.json()),
        fetch(`/api/brands/${brandId}`).then((r) => r.json()),
      ]);
      if (!tiersRes.ok) throw new Error(tiersRes.error || "Failed to load tiers");
      setTiers(tiersRes.tiers || []);
      // Brand endpoint shape varies; tolerate either { brand } or top-level fields.
      const b = brandRes.brand || brandRes;
      if (b?.id) setBrand({ id: b.id, name: b.name || b.id });
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  function startEdit(t: Tier) {
    setEditingId(t.id);
    setForm({
      thresholdLiters: String(t.thresholdLiters),
      discountPct: String(t.discountPct),
      label: t.label || "",
      active: t.active,
    });
    setFlash(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFlash(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId) return;

    const threshold = parseFloat(form.thresholdLiters);
    const discount = parseFloat(form.discountPct);
    if (!Number.isFinite(threshold) || threshold < 0) {
      setFlash({ kind: "error", msg: "Threshold liters must be ≥ 0" });
      return;
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      setFlash({ kind: "error", msg: "Discount % must be 0–100" });
      return;
    }

    setSubmitting(true);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/brand-pricing-tiers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? {
                id: editingId,
                thresholdLiters: threshold,
                discountPct: discount,
                label: form.label || null,
                active: form.active,
              }
            : {
                brandId,
                thresholdLiters: threshold,
                discountPct: discount,
                label: form.label || null,
                active: form.active,
              },
        ),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Save failed");
      setFlash({
        kind: "ok",
        msg: editingId ? "Tier updated." : "Tier added.",
      });
      cancelEdit();
      await loadAll();
    } catch (e: any) {
      setFlash({ kind: "error", msg: e?.message || "Save failed" });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(t: Tier) {
    if (!confirm(`Delete tier ${t.discountPct}% off at ${fmtLiters(t.thresholdLiters)}? This can't be undone.`)) {
      return;
    }
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/brand-pricing-tiers?id=${t.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Delete failed");
      setFlash({ kind: "ok", msg: "Tier deleted." });
      await loadAll();
    } catch (e: any) {
      setFlash({ kind: "error", msg: e?.message || "Delete failed" });
    }
  }

  async function toggleActive(t: Tier) {
    setFlash(null);
    try {
      const res = await fetch("/api/admin/brand-pricing-tiers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, active: !t.active }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Update failed");
      await loadAll();
    } catch (e: any) {
      setFlash({ kind: "error", msg: e?.message || "Update failed" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading pricing tiers…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">{error}</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/home" className="hover:text-[#00b4c3]">
            Home
          </Link>
          <span>›</span>
          {brand ? (
            <Link href={`/brands/${brand.id}`} className="hover:text-[#00b4c3]">
              {brand.name}
            </Link>
          ) : null}
          <span>›</span>
          <span>Pricing Tiers</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          Pricing Tier Ladder
          {brand?.name ? <span className="text-slate-400 font-normal"> — {brand.name}</span> : null}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Cumulative consumption thresholds and the discount the brand qualifies for once they
          cross each rung. Surfaces on the brand&apos;s{" "}
          <Link href={`/brand-portal/pricing`} className="text-[#00b4c3] hover:underline">
            /brand-portal/pricing
          </Link>{" "}
          dashboard. Pricing changes are contractual — only ADMIN / EMPLOYEE / SALES_MANAGER can
          edit.
        </p>
      </div>

      {/* Add / edit form */}
      <form
        onSubmit={submitForm}
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6"
      >
        <h2 className="text-base font-bold text-slate-900 mb-4">
          {editingId ? "Edit tier" : "Add a new tier"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Threshold liters
            </label>
            <input
              type="number"
              min={0}
              step={1}
              required
              placeholder="e.g. 1000"
              value={form.thresholdLiters}
              onChange={(e) => setForm({ ...form, thresholdLiters: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            <p className="text-xs text-slate-400 mt-1">Cumulative consumption to qualify.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Discount %</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              required
              placeholder="e.g. 5"
              value={form.discountPct}
              onChange={(e) => setForm({ ...form, discountPct: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            <p className="text-xs text-slate-400 mt-1">0–100. Off the list price per liter.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Label (optional)
            </label>
            <input
              type="text"
              placeholder="Bronze / Silver / Gold"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            <p className="text-xs text-slate-400 mt-1">Shown as a chip beside the discount.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <input
            id="tier-active"
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
          />
          <label htmlFor="tier-active" className="text-sm text-slate-700">
            Active — surface on the brand portal
          </label>
        </div>

        {flash ? (
          <div
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${
              flash.kind === "ok"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {flash.msg}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 text-sm font-bold"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#00b4c3] hover:bg-[#009ba8] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 text-sm font-bold transition-colors"
          >
            {submitting ? "Saving…" : editingId ? "Save changes" : "Add tier"}
          </button>
        </div>
      </form>

      {/* Existing rungs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-bold text-slate-900">Configured rungs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sorted by threshold ascending. Click <strong>Edit</strong> to load a row into the form
            above.
          </p>
        </div>

        {sortedTiers.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-sm font-bold text-slate-900 mb-1">No tiers configured yet</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Add the first rung above. Brands without any active tiers see a friendly empty
              state on their pricing page.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase tracking-wider">
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-2 font-bold">Threshold</th>
                <th className="text-right px-5 py-2 font-bold">Discount</th>
                <th className="text-left px-5 py-2 font-bold">Label</th>
                <th className="text-left px-5 py-2 font-bold">Status</th>
                <th className="text-right px-5 py-2 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTiers.map((t) => (
                <tr
                  key={t.id}
                  className={`hover:bg-slate-50 ${editingId === t.id ? "bg-amber-50" : ""}`}
                >
                  <td className="px-5 py-3 font-mono text-slate-700">
                    {fmtLiters(t.thresholdLiters)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-[#00b4c3]">
                    {t.discountPct}%
                  </td>
                  <td className="px-5 py-3 text-slate-600">{t.label || "—"}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActive(t)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 transition-colors ${
                        t.active
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200"
                      }`}
                      title="Click to toggle"
                    >
                      {t.active ? "● Active" : "○ Inactive"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => startEdit(t)}
                        className="text-xs font-semibold text-[#00b4c3] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(t)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
