"use client";

/**
 * /admin/inventory — Phase 4D.
 *
 * Central FUZE HQ inventory dashboard. Per-SKU rows with on-hand,
 * reserved, available (computed), reorder threshold, last-count
 * date. Low-stock rows (onHand < reorderThreshold) highlighted.
 * Inline "Add SKU" + "Adjust" affordances.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Row {
  id: string;
  sku: string;
  description: string;
  onHandLiters: number;
  reservedLiters: number;
  reorderThreshold: number | null;
  lastInventoryAt: string;
  notes: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function AdminInventoryPage() {
  const { t } = useI18n();
  const tx = t.admin.inventory;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adjusting, setAdjusting] = useState<Row | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    sku: "",
    description: "",
    onHandLiters: "",
    reservedLiters: "",
    reorderThreshold: "",
    notes: "",
  });
  const [adjustForm, setAdjustForm] = useState({
    onHandLiters: "",
    reservedLiters: "",
    reorderThreshold: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const j = await fetch("/api/admin/inventory").then((r) => r.json());
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setRows(j.rows || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitAdd() {
    setSubmitting(true);
    setError(null);
    try {
      const j = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.saveFailed);
      setShowAdd(false);
      setAddForm({
        sku: "",
        description: "",
        onHandLiters: "",
        reservedLiters: "",
        reorderThreshold: "",
        notes: "",
      });
      await load();
    } catch (e: any) {
      setError(e.message || tx.saveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAdjust() {
    if (!adjusting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: any = { id: adjusting.id };
      if (adjustForm.onHandLiters !== "") body.onHandLiters = adjustForm.onHandLiters;
      if (adjustForm.reservedLiters !== "") body.reservedLiters = adjustForm.reservedLiters;
      if (adjustForm.reorderThreshold !== "") body.reorderThreshold = adjustForm.reorderThreshold;
      if (adjustForm.notes !== "") body.notes = adjustForm.notes;

      const j = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.saveFailed);
      setAdjusting(null);
      await load();
    } catch (e: any) {
      setError(e.message || tx.saveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-4 sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009ba8]"
        >
          {tx.addSku}
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <div className="text-5xl mb-3">📦</div>
          <div className="text-base font-bold text-slate-900 mb-1">{tx.emptyTitle}</div>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{tx.emptyBlurb}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">{tx.colSku}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colDescription}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colOnHand}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colReserved}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colAvailable}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colReorder}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colLastCount}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const available = r.onHandLiters - r.reservedLiters;
                  const lowStock =
                    r.reorderThreshold !== null && r.onHandLiters < r.reorderThreshold;
                  return (
                    <tr
                      key={r.id}
                      className={lowStock ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-slate-50"}
                    >
                      <td className="px-4 py-3 font-mono text-slate-900 font-semibold">
                        {r.sku}
                        {lowStock ? (
                          <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-600 text-white">
                            {tx.lowStockBadge}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.description}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {r.onHandLiters.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {r.reservedLiters.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {available.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {r.reorderThreshold !== null
                          ? r.reorderThreshold.toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(r.lastInventoryAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setAdjusting(r);
                            setAdjustForm({
                              onHandLiters: String(r.onHandLiters),
                              reservedLiters: String(r.reservedLiters),
                              reorderThreshold:
                                r.reorderThreshold !== null ? String(r.reorderThreshold) : "",
                              notes: r.notes || "",
                            });
                          }}
                          className="text-xs font-semibold text-[#00b4c3] hover:underline"
                        >
                          {tx.adjust}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{tx.addModalTitle}</h2>
            </div>
            <div className="p-6 space-y-3">
              <input
                type="text"
                value={addForm.sku}
                onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })}
                placeholder={tx.skuPlaceholder}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              />
              <input
                type="text"
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                placeholder={tx.descriptionPlaceholder}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={addForm.onHandLiters}
                  onChange={(e) => setAddForm({ ...addForm, onHandLiters: e.target.value })}
                  placeholder={tx.onHandPlaceholder}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                />
                <input
                  type="number"
                  value={addForm.reservedLiters}
                  onChange={(e) => setAddForm({ ...addForm, reservedLiters: e.target.value })}
                  placeholder={tx.reservedPlaceholder}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                />
                <input
                  type="number"
                  value={addForm.reorderThreshold}
                  onChange={(e) => setAddForm({ ...addForm, reorderThreshold: e.target.value })}
                  placeholder={tx.reorderPlaceholder}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                />
              </div>
              <textarea
                value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                placeholder={tx.notesPlaceholder}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] resize-none"
              />
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                {tx.cancel}
              </button>
              <button
                onClick={submitAdd}
                disabled={submitting || !addForm.sku || !addForm.description}
                className="px-5 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8] disabled:opacity-50"
              >
                {submitting ? tx.adding : tx.add}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Adjust modal */}
      {adjusting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {tx.adjustTitle.replace("{sku}", adjusting.sku)}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tx.onHandLabel}
                </label>
                <input
                  type="number"
                  value={adjustForm.onHandLiters}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, onHandLiters: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tx.reservedLabel}
                </label>
                <input
                  type="number"
                  value={adjustForm.reservedLiters}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, reservedLiters: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tx.reorderLabel}
                </label>
                <input
                  type="number"
                  value={adjustForm.reorderThreshold}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, reorderThreshold: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                />
                <p className="text-xs text-slate-500 mt-1">{tx.reorderHint}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tx.notesLabel}
                </label>
                <textarea
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setAdjusting(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                {tx.cancel}
              </button>
              <button
                onClick={submitAdjust}
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8] disabled:opacity-50"
              >
                {submitting ? tx.saving : tx.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
