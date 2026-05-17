// @ts-nocheck
"use client";

/**
 * Distributor fabric portfolio page.
 *
 * Tina (and other distributor users) maintain a portfolio of
 * fabrics they're testing independently or sponsoring through
 * co-op programs (multi-brand pilots, exploratory development,
 * etc). Distinct from factory-owned or brand-owned fabrics.
 *
 * Capabilities:
 *  - List + search portfolio
 *  - Create new portfolio fabric (form)
 *  - Delete (only if no test history attached — server enforces)
 *  - Jump to "Test this fabric" → pre-fills the test-request flow
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";

interface Fabric {
  id: string;
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  customerReference: string | null;
  construction: string | null;
  color: string | null;
  weightGsm: number | null;
  widthInches: number | null;
  yarnType: string | null;
  finishNote: string | null;
  note: string | null;
  endUse: string | null;
  targetFuzeTier: string | null;
  fabricCategory: string | null;
  labStatus: string | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string; country: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

const initialForm = {
  customerReference: "",
  customerCode: "",
  factoryCode: "",
  construction: "",
  color: "",
  weightGsm: "",
  widthInches: "",
  yarnType: "",
  fabricCategory: "",
  endUse: "",
  targetFuzeTier: "",
  finishNote: "",
  note: "",
};

export default function DistributorFabricPortfolioPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.distributorPortal.fabricsList;
  const router = useRouter();

  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...initialForm });

  // Phase 15 NEED-FB-1 — inline-edit a row's fabric metadata after
  // submission. FUZE number stays immutable; everything else in the
  // initialForm shape is editable.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...initialForm });
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit(f: Fabric) {
    setEditingId(f.id);
    setEditForm({
      customerReference: f.customerReference || "",
      customerCode: f.customerCode || "",
      factoryCode: f.factoryCode || "",
      construction: f.construction || "",
      color: f.color || "",
      weightGsm: f.weightGsm != null ? String(f.weightGsm) : "",
      widthInches: f.widthInches != null ? String(f.widthInches) : "",
      yarnType: f.yarnType || "",
      fabricCategory: f.fabricCategory || "",
      endUse: f.endUse || "",
      targetFuzeTier: f.targetFuzeTier || "",
      finishNote: f.finishNote || "",
      note: f.note || "",
    });
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    setError(null);
    try {
      const payload: any = {};
      for (const [k, v] of Object.entries(editForm)) {
        payload[k] = v === "" ? null : v;
      }
      const res = await fetch(`/api/distributor-portal/fabrics/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setFabrics((rows) => rows.map((r) => (r.id === id ? json.fabric : r)));
      setEditingId(null);
      setSuccess("Fabric updated");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setSavingEdit(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    if (user.role !== "DISTRIBUTOR_USER" && !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      router.push("/home");
      return;
    }
    loadFabrics();
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!user) return;
    loadFabrics();
  }, [debouncedSearch]);

  async function loadFabrics() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await fetch(`/api/distributor-portal/fabrics?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Failed to load fabrics");
      } else {
        setFabrics(json.fabrics || []);
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/distributor-portal/fabrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`);
      } else {
        setFabrics([json.fabric, ...fabrics]);
        setShowCreate(false);
        setForm({ ...initialForm });
        setSuccess(
          `Added "${json.fabric.customerReference || json.fabric.customerCode || "fabric"}" to your portfolio`,
        );
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(fabric: Fabric) {
    const label =
      fabric.customerReference ||
      fabric.customerCode ||
      fabric.factoryCode ||
      `fabric ${fabric.id.slice(0, 8)}`;
    if (!confirm(`Delete "${label}" from your portfolio?\n\nCannot be undone.`)) return;
    try {
      const res = await fetch(
        `/api/distributor-portal/fabrics?id=${encodeURIComponent(fabric.id)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(json.error || `HTTP ${res.status}`);
      } else {
        setFabrics(fabrics.filter((f) => f.id !== fabric.id));
        setSuccess(`Deleted "${label}"`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/distributor-portal" className="hover:text-[#00b4c3]">
              {t.distributorPortal.crumb}
            </Link>
            <span>/</span>
            <span className="font-medium text-slate-800">{tx.crumbCurrent}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{tx.pageTitle}</h1>
          <p className="text-slate-500 mt-1 max-w-2xl text-sm">
            Fabrics you own or are testing independently — co-op programs,
            multi-brand pilots, exploratory development. These are
            available in your test-request flow alongside factory and
            brand fabrics.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-[#00b4c3] hover:bg-[#009aa8] text-white rounded-lg text-sm font-bold whitespace-nowrap"
        >
          {showCreate ? "Cancel" : "+ Add fabric"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800">
          {success}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 bg-white border border-slate-200 rounded-xl p-5"
        >
          <h2 className="font-bold text-slate-900 mb-3">New portfolio fabric</h2>
          <p className="text-xs text-slate-500 mb-4">
            Provide at least one identifier — customer reference, customer code,
            factory code, color, or construction. Other fields can be filled later.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field
              label="Customer reference"
              hint="how the customer refers to it"
              value={form.customerReference}
              onChange={(v) => setForm({ ...form, customerReference: v })}
            />
            <Field
              label="Customer code"
              value={form.customerCode}
              onChange={(v) => setForm({ ...form, customerCode: v })}
            />
            <Field
              label="Factory code"
              value={form.factoryCode}
              onChange={(v) => setForm({ ...form, factoryCode: v })}
            />
            <Field
              label="Construction"
              hint="e.g. jersey, twill, plain weave"
              value={form.construction}
              onChange={(v) => setForm({ ...form, construction: v })}
            />
            <Field
              label="Color"
              value={form.color}
              onChange={(v) => setForm({ ...form, color: v })}
            />
            <Field
              label="Weight (gsm)"
              type="number"
              value={form.weightGsm}
              onChange={(v) => setForm({ ...form, weightGsm: v })}
            />
            <Field
              label="Width (inches)"
              type="number"
              value={form.widthInches}
              onChange={(v) => setForm({ ...form, widthInches: v })}
            />
            <Field
              label="Yarn type"
              hint="e.g. 100% cotton, 95% poly / 5% spandex"
              value={form.yarnType}
              onChange={(v) => setForm({ ...form, yarnType: v })}
            />
            <SelectField
              label="Fabric category"
              value={form.fabricCategory}
              onChange={(v) => setForm({ ...form, fabricCategory: v })}
              options={["", "knit", "woven", "nonwoven"]}
            />
            <Field
              label="End use"
              hint="t-shirt, athletic, bedding, towel…"
              value={form.endUse}
              onChange={(v) => setForm({ ...form, endUse: v })}
            />
            <SelectField
              label="Target FUZE tier"
              value={form.targetFuzeTier}
              onChange={(v) => setForm({ ...form, targetFuzeTier: v })}
              options={["", "F1", "F2", "F3", "F4"]}
            />
            <Field
              label="Finish notes"
              value={form.finishNote}
              onChange={(v) => setForm({ ...form, finishNote: v })}
            />
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-sm"
              placeholder="Co-op program details, why you're testing, etc."
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-[#00b4c3] hover:bg-[#009aa8] text-white rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {creating ? "⏳ Creating…" : "Add to portfolio"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by reference, code, color, construction, FUZE#…"
          className="w-full max-w-lg px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-8">Loading portfolio…</div>
      ) : fabrics.length === 0 ? (
        <div className="text-center bg-white border border-slate-200 rounded-xl p-8">
          <p className="text-slate-600 font-semibold">
            {search ? "No fabrics match your search." : "No fabrics in your portfolio yet."}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {search
              ? "Try a different term or clear the search."
              : "Click + Add fabric above to start your portfolio."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600 tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Reference / FUZE#</th>
                <th className="text-left px-4 py-3">Construction · Color</th>
                <th className="text-left px-4 py-3">Specs</th>
                <th className="text-left px-4 py-3">End use · Target tier</th>
                <th className="text-left px-4 py-3">Linked</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fabrics.map((f) => {
                const isEditing = editingId === f.id;
                if (isEditing) {
                  return (
                    <tr key={f.id} className="bg-cyan-50/50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Edit fabric
                            {f.fuzeNumber && (
                              <span className="ml-2 font-mono text-slate-500">
                                FUZE-{f.fuzeNumber}
                              </span>
                            )}
                            <span className="ml-2 font-normal normal-case text-[11px] text-slate-400">
                              · FUZE number is immutable post-submission
                            </span>
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveEdit(f.id)}
                              disabled={savingEdit}
                              className="px-3 py-1.5 bg-[#00b4c3] hover:bg-[#009aa8] text-white rounded text-xs font-bold disabled:opacity-50"
                            >
                              {savingEdit ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <Field
                            label="Customer reference"
                            value={editForm.customerReference}
                            onChange={(v) =>
                              setEditForm({ ...editForm, customerReference: v })
                            }
                          />
                          <Field
                            label="Customer code"
                            value={editForm.customerCode}
                            onChange={(v) => setEditForm({ ...editForm, customerCode: v })}
                          />
                          <Field
                            label="Factory code"
                            value={editForm.factoryCode}
                            onChange={(v) => setEditForm({ ...editForm, factoryCode: v })}
                          />
                          <Field
                            label="Construction"
                            value={editForm.construction}
                            onChange={(v) => setEditForm({ ...editForm, construction: v })}
                          />
                          <Field
                            label="Color"
                            value={editForm.color}
                            onChange={(v) => setEditForm({ ...editForm, color: v })}
                          />
                          <Field
                            label="Weight (gsm)"
                            type="number"
                            value={editForm.weightGsm}
                            onChange={(v) => setEditForm({ ...editForm, weightGsm: v })}
                          />
                          <Field
                            label="Width (inches)"
                            type="number"
                            value={editForm.widthInches}
                            onChange={(v) => setEditForm({ ...editForm, widthInches: v })}
                          />
                          <Field
                            label="Yarn type"
                            value={editForm.yarnType}
                            onChange={(v) => setEditForm({ ...editForm, yarnType: v })}
                          />
                          <SelectField
                            label="Fabric category"
                            value={editForm.fabricCategory}
                            onChange={(v) =>
                              setEditForm({ ...editForm, fabricCategory: v })
                            }
                            options={["", "knit", "woven", "nonwoven"]}
                          />
                          <Field
                            label="End use"
                            value={editForm.endUse}
                            onChange={(v) => setEditForm({ ...editForm, endUse: v })}
                          />
                          <SelectField
                            label="Target FUZE tier"
                            value={editForm.targetFuzeTier}
                            onChange={(v) =>
                              setEditForm({ ...editForm, targetFuzeTier: v })
                            }
                            options={["", "F1", "F2", "F3", "F4"]}
                          />
                          <Field
                            label="Finish notes"
                            value={editForm.finishNote}
                            onChange={(v) => setEditForm({ ...editForm, finishNote: v })}
                          />
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Notes
                          </label>
                          <textarea
                            value={editForm.note}
                            onChange={(e) =>
                              setEditForm({ ...editForm, note: e.target.value })
                            }
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-sm"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">
                        {f.customerReference || f.customerCode || f.factoryCode || "—"}
                      </p>
                      {f.fuzeNumber && (
                        <p className="text-xs font-mono text-slate-500">FUZE-{f.fuzeNumber}</p>
                      )}
                      {(f.customerCode || f.factoryCode) && f.customerReference && (
                        <p className="text-[11px] text-slate-400">
                          {f.customerCode && <>cust: {f.customerCode}</>}
                          {f.customerCode && f.factoryCode && <> · </>}
                          {f.factoryCode && <>fac: {f.factoryCode}</>}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p className="font-semibold text-slate-800">{f.construction || "—"}</p>
                      <p>{f.color || ""}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {f.weightGsm && <p>{f.weightGsm} gsm</p>}
                      {f.widthInches && <p>{f.widthInches}"</p>}
                      {f.yarnType && <p className="text-slate-500">{f.yarnType}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p>{f.endUse || "—"}</p>
                      {f.targetFuzeTier && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 font-bold text-[10px] mt-1">
                          {f.targetFuzeTier}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {f.brand && (
                        <p className="text-slate-700">
                          🏷{" "}
                          <Link
                            href={`/brands/${f.brand.id}`}
                            className="hover:underline text-blue-600"
                          >
                            {f.brand.name}
                          </Link>
                        </p>
                      )}
                      {f.factory && (
                        <p className="text-slate-700">
                          🏭 {f.factory.name}
                          {f.factory.country && (
                            <span className="text-slate-400"> · {f.factory.country}</span>
                          )}
                        </p>
                      )}
                      {!f.brand && !f.factory && (
                        <span className="text-slate-400 italic">no links yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                      <Link
                        href={`/distributor-portal/test-request?fabricId=${f.id}`}
                        className="inline-block px-2.5 py-1 bg-[#00b4c3] hover:bg-[#009aa8] text-white rounded font-bold mr-1"
                      >
                        🧪 Test
                      </Link>
                      <button
                        onClick={() => startEdit(f)}
                        className="inline-block px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium border border-slate-200 mr-1"
                        title="Edit fabric metadata"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(f)}
                        className="inline-block px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded font-medium border border-red-200"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label}
        {hint && <span className="text-slate-400 font-normal"> · {hint}</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-sm"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || "—"}
          </option>
        ))}
      </select>
    </div>
  );
}
