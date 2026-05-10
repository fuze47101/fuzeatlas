"use client";

/**
 * /admin/labs/[id]/form-templates — Phase 4E.
 *
 * Per-lab form template editor. List of templates with active toggle,
 * delete affordance, "Add Template" CTA opening a modal that lets
 * the admin define the field schema (key/label/type/required/options).
 *
 * The fields array is what the ICP sample-prep wizard renders when
 * this lab is selected as the destination.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/i18n";

type FieldType = "text" | "number" | "select" | "textarea" | "date" | "file";

interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
}

interface Template {
  id: string;
  labId: string;
  name: string;
  fields: FormField[];
  active: boolean;
  updatedAt: string;
}

const EMPTY_FIELD: FormField = {
  key: "",
  label: "",
  type: "text",
  required: false,
  options: undefined,
};

export default function AdminLabFormTemplatesPage() {
  const params = useParams<{ id: string }>();
  const labId = params?.id;

  const { t } = useI18n();
  const tx = t.admin.labFormTemplates;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lab, setLab] = useState<{ id: string; name: string } | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ name: string; fields: FormField[] }>({
    name: "",
    fields: [],
  });

  async function load() {
    if (!labId) return;
    setLoading(true);
    setError(null);
    try {
      const j = await fetch(
        `/api/admin/labs/${encodeURIComponent(String(labId))}/form-templates`,
      ).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setLab(j.lab);
      setTemplates(j.templates || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId]);

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setForm({ name: "", fields: [{ ...EMPTY_FIELD }] });
  }

  function startEdit(tmpl: Template) {
    setCreating(false);
    setEditing(tmpl);
    setForm({
      name: tmpl.name,
      fields: Array.isArray(tmpl.fields) ? (tmpl.fields as FormField[]) : [],
    });
  }

  function cancel() {
    setCreating(false);
    setEditing(null);
    setForm({ name: "", fields: [] });
  }

  function setField(i: number, patch: Partial<FormField>) {
    const next = [...form.fields];
    next[i] = { ...next[i], ...patch };
    setForm({ ...form, fields: next });
  }

  function addField() {
    setForm({ ...form, fields: [...form.fields, { ...EMPTY_FIELD }] });
  }

  function removeField(i: number) {
    const next = [...form.fields];
    next.splice(i, 1);
    setForm({ ...form, fields: next });
  }

  async function save() {
    if (!labId) return;
    setSubmitting(true);
    setError(null);
    try {
      // Strip empty options arrays so they serialize cleanly.
      const cleanedFields = form.fields.map((f) => {
        const out: FormField = { ...f };
        if (f.type === "select") {
          out.options = (f.options || []).filter((o) => o.trim().length > 0);
        } else {
          delete out.options;
        }
        return out;
      });
      const body = creating
        ? { name: form.name, fields: cleanedFields }
        : { id: editing!.id, name: form.name, fields: cleanedFields };
      const j = await fetch(
        `/api/admin/labs/${encodeURIComponent(String(labId))}/form-templates`,
        {
          method: creating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.saveFailed);
      cancel();
      await load();
    } catch (e: any) {
      setError(e.message || tx.saveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(tmpl: Template) {
    setError(null);
    try {
      const j = await fetch(
        `/api/admin/labs/${encodeURIComponent(String(labId!))}/form-templates`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tmpl.id, active: !tmpl.active }),
        },
      ).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.saveFailed);
      await load();
    } catch (e: any) {
      setError(e.message || tx.saveFailed);
    }
  }

  async function del(tmpl: Template) {
    if (!confirm(tx.delConfirm.replace("{name}", tmpl.name))) return;
    setError(null);
    try {
      const j = await fetch(
        `/api/admin/labs/${encodeURIComponent(String(labId!))}/form-templates?id=${encodeURIComponent(tmpl.id)}`,
        { method: "DELETE" },
      ).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.saveFailed);
      await load();
    } catch (e: any) {
      setError(e.message || tx.saveFailed);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }
  if (!lab) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error || "Lab not found"}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/home" className="hover:text-[#00b4c3]">
            Home
          </Link>
          <span>›</span>
          <Link href={`/labs/${lab.id}`} className="hover:text-[#00b4c3]">
            {lab.name}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <Link
          href={`/labs/${lab.id}`}
          className="inline-flex items-center gap-1 text-sm text-[#00b4c3] hover:underline mb-3"
        >
          ← Back to {lab.name}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              {tx.pageTitleWithLab.replace("{lab}", lab.name)}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
          </div>
          {!creating && !editing ? (
            <button
              onClick={startCreate}
              className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009ba8] shrink-0"
            >
              {tx.addButton}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Editor */}
      {(creating || editing) ? (
        <div className="bg-white rounded-xl border border-[#00b4c3]/40 shadow-sm p-6 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{tx.nameLabel}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={tx.namePlaceholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
          </div>

          <div className="space-y-3">
            {form.fields.map((f, i) => (
              <div key={i} className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={f.key}
                    onChange={(e) => setField(i, { key: e.target.value })}
                    placeholder={tx.fieldKey}
                    className="col-span-3 px-2 py-1.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  />
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) => setField(i, { label: e.target.value })}
                    placeholder={tx.fieldLabel}
                    className="col-span-4 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  />
                  <select
                    value={f.type}
                    onChange={(e) => setField(i, { type: e.target.value as FieldType })}
                    className="col-span-3 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  >
                    <option value="text">{tx.typeText}</option>
                    <option value="number">{tx.typeNumber}</option>
                    <option value="select">{tx.typeSelect}</option>
                    <option value="textarea">{tx.typeTextarea}</option>
                    <option value="date">{tx.typeDate}</option>
                    <option value="file">{tx.typeFile}</option>
                  </select>
                  <label className="col-span-1 inline-flex items-center justify-center text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => setField(i, { required: e.target.checked })}
                      className="mr-1"
                    />
                    {tx.fieldRequired.charAt(0)}
                  </label>
                  <button
                    onClick={() => removeField(i)}
                    className="col-span-1 text-xs text-red-600 hover:underline"
                    type="button"
                  >
                    {tx.removeField}
                  </button>
                </div>
                {f.type === "select" ? (
                  <input
                    type="text"
                    value={(f.options || []).join(", ")}
                    onChange={(e) =>
                      setField(i, {
                        options: e.target.value.split(",").map((s) => s.trim()),
                      })
                    }
                    placeholder={tx.fieldOptions}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  />
                ) : null}
              </div>
            ))}
            <button
              onClick={addField}
              className="text-xs text-[#00b4c3] hover:underline font-semibold"
              type="button"
            >
              {tx.addField}
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={cancel} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
              {tx.cancel}
            </button>
            <button
              onClick={save}
              disabled={submitting || !form.name || form.fields.length === 0}
              className="px-5 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8] disabled:opacity-50"
            >
              {submitting ? tx.saving : tx.save}
            </button>
          </div>
        </div>
      ) : null}

      {/* List */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <div className="text-5xl mb-3">📋</div>
          <div className="text-base font-bold text-slate-900 mb-1">{tx.emptyTitle}</div>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{tx.emptyBlurb}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-900">{tmpl.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      tmpl.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {tmpl.active ? tx.activeBadge : tx.inactiveBadge}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {Array.isArray(tmpl.fields) ? tmpl.fields.length : 0} field
                  {(Array.isArray(tmpl.fields) ? tmpl.fields.length : 0) === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button
                  onClick={() => toggleActive(tmpl)}
                  className="text-slate-600 hover:underline font-medium"
                >
                  {tmpl.active ? tx.deactivate : tx.activate}
                </button>
                <button
                  onClick={() => startEdit(tmpl)}
                  className="text-[#00b4c3] hover:underline font-semibold"
                >
                  {tx.edit}
                </button>
                <button onClick={() => del(tmpl)} className="text-red-600 hover:underline">
                  {tx.del}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
