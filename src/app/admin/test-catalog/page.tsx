// @ts-nocheck
"use client";
import { useState, useEffect } from "react";

interface CatalogItem {
  id: string;
  dbId: string | null;
  name: string;
  description: string;
  category: string;
  moqMeters: number;
  controlRequired: boolean;
  controlNote: string | null;
  turnaroundDays: number;
  estimatedCostUsd: number | null;
  methods: string[];
  active: boolean;
  sortOrder: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  recipe_build: "Recipe Build",
  performance: "Performance",
  quality: "Quality",
  certification: "Certification",
};

export default function TestCatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CatalogItem>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchCatalog = async () => {
    try {
      const res = await fetch("/api/admin/test-catalog");
      const d = await res.json();
      if (d.ok) {
        setItems(d.catalog);
        setSource(d.source);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCatalog(); }, []);

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      description: item.description,
      estimatedCostUsd: item.estimatedCostUsd,
      turnaroundDays: item.turnaroundDays,
      moqMeters: item.moqMeters,
      controlRequired: item.controlRequired,
      active: item.active,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveItem = async (testKey: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/test-catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            testKey,
            ...editForm,
            estimatedCostUsd: editForm.estimatedCostUsd ? Number(editForm.estimatedCostUsd) : null,
            turnaroundDays: editForm.turnaroundDays ? Number(editForm.turnaroundDays) : 7,
            moqMeters: editForm.moqMeters ? Number(editForm.moqMeters) : 1,
          }],
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setMessage({ type: "success", text: "Test updated successfully" });
        setEditingId(null);
        setEditForm({});
        fetchCatalog();
      } else {
        setMessage({ type: "error", text: d.error || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Test Catalog & Pricing</h1>
        <p className="text-slate-500 text-sm">
          Manage test types, pricing, turnaround times, and sample requirements. Changes are reflected
          immediately on the factory test request form.
        </p>
        {source && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded text-xs text-slate-500">
            Source: <span className="font-medium">{source === "database" ? "Database (admin-managed)" : "Static defaults"}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      {/* Catalog Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Test Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Category</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Price (USD)</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Turnaround</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Min. Sample</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Control?</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Active</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className={`hover:bg-slate-50 ${!item.active ? "opacity-50" : ""}`}>
                  {editingId === item.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editForm.name || ""}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                        <textarea
                          value={editForm.description || ""}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-xs"
                          rows={2}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">$</span>
                          <input
                            type="number"
                            value={editForm.estimatedCostUsd ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, estimatedCostUsd: e.target.value ? Number(e.target.value) : null })}
                            className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={editForm.turnaroundDays ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, turnaroundDays: Number(e.target.value) })}
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                          />
                          <span className="text-xs text-slate-400">days</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.25"
                            value={editForm.moqMeters ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, moqMeters: Number(e.target.value) })}
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                          />
                          <span className="text-xs text-slate-400">m</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={editForm.controlRequired || false}
                          onChange={(e) => setEditForm({ ...editForm, controlRequired: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={editForm.active !== false}
                          onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => saveItem(item.id)}
                            disabled={saving}
                            className="px-3 py-1 bg-[#00b4c3] text-white text-xs font-medium rounded hover:bg-[#009aa8] disabled:opacity-50"
                          >
                            {saving ? "..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded hover:bg-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.description}</div>
                        {item.methods?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.methods.map((m, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {item.estimatedCostUsd ? `$${item.estimatedCostUsd.toLocaleString()}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {item.turnaroundDays} days
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {item.moqMeters}m
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.controlRequired ? (
                          <span className="text-orange-500 font-bold">Yes</span>
                        ) : (
                          <span className="text-slate-300">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.active ? (
                          <span className="inline-flex w-2 h-2 bg-emerald-400 rounded-full" />
                        ) : (
                          <span className="inline-flex w-2 h-2 bg-slate-300 rounded-full" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => startEdit(item)}
                          className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded hover:bg-slate-200"
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer with last updated info */}
        {items.some((i) => i.updatedBy) && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
            Last updated by {items.find((i) => i.updatedBy)?.updatedBy} on{" "}
            {items.find((i) => i.updatedAt) ? new Date(items.find((i) => i.updatedAt)!.updatedAt!).toLocaleDateString() : "—"}
          </div>
        )}
      </div>
    </div>
  );
}
