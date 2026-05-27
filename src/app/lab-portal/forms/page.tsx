"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Field {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  hint?: string;
}
interface Template {
  id: string;
  name: string;
  fields: Field[];
  active: boolean;
  updatedAt: string;
}

const FIELD_TYPES = ["text", "number", "date", "select", "checkbox", "textarea"];

export default function LabFormsPage() {
  const [lab, setLab] = useState<any>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Extract pipeline state
  const [extracting, setExtracting] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftFields, setDraftFields] = useState<Field[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [labRes, tplRes] = await Promise.all([
        fetch("/api/lab-portal").then((r) => r.json()),
        fetch("/api/lab-portal/form-templates").then((r) => r.json()),
      ]);
      if (labRes.ok) setLab(labRes.lab);
      if (tplRes.ok) setTemplates(tplRes.templates || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleFile(file: File) {
    setExtractError(null);
    setExtracting(true);
    setDraftFields([]);
    setDraftName("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/lab-portal/forms/extract", { method: "POST", body: fd });
      const d = await r.json();
      if (!d.ok) {
        setExtractError(d.error || "Extract failed");
      } else {
        setDraftName(d.suggested?.templateName || "Lab Intake Form");
        setDraftFields(d.suggested?.fields || []);
      }
    } catch (e: any) {
      setExtractError(e?.message || "Extract failed");
    } finally {
      setExtracting(false);
    }
  }

  function updateField(i: number, patch: Partial<Field>) {
    setDraftFields((arr) => arr.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function removeField(i: number) {
    setDraftFields((arr) => arr.filter((_, idx) => idx !== i));
  }
  function addField() {
    setDraftFields((arr) => [
      ...arr,
      { key: `field_${arr.length + 1}`, label: "New field", type: "text", required: false },
    ]);
  }

  async function saveTemplate() {
    if (!draftName.trim() || draftFields.length === 0) return;
    setSaving(true);
    try {
      const r = await fetch("/api/lab-portal/form-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName.trim(), fields: draftFields }),
      });
      const d = await r.json();
      if (!d.ok) {
        setExtractError(d.error || "Save failed");
      } else {
        setDraftName("");
        setDraftFields([]);
        await loadAll();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>;
  if (!lab)
    return <div className="flex items-center justify-center h-64 text-red-400">Unable to load</div>;

  return (
    <div className="max-w-[1100px] mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Test Request Forms</h1>
        <p className="text-sm text-slate-500 mt-1">
          {lab.name} — drop a PDF intake form, AI extracts the field schema, you review + save.
        </p>
      </div>

      {/* Drop zone */}
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 mb-6 text-center">
        <div className="text-4xl mb-2">📄</div>
        <p className="text-sm text-slate-700 font-medium mb-2">Drop a PDF intake form here</p>
        <p className="text-xs text-slate-500 mb-3">
          The AI extracts each fillable field. You can edit before saving.
        </p>
        <label className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 cursor-pointer">
          {extracting ? "Extracting…" : "Choose PDF"}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={extracting}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {extractError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {extractError}
          </div>
        )}
      </div>

      {/* Review extracted fields */}
      {draftFields.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Review extracted fields</h2>
            <button onClick={addField} className="text-xs text-indigo-600 hover:underline">
              + Add field
            </button>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Template name</label>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold text-slate-600">Key</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-slate-600">Label</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-slate-600">Type</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-slate-600">Req</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-slate-600">
                    Hint / Options
                  </th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draftFields.map((f, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">
                      <input
                        value={f.key}
                        onChange={(e) => updateField(i, { key: e.target.value })}
                        className="w-32 px-1.5 py-1 border border-slate-200 rounded text-xs font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={f.label}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                        className="w-full min-w-[200px] px-1.5 py-1 border border-slate-200 rounded text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={f.type}
                        onChange={(e) => updateField(i, { type: e.target.value })}
                        className="px-1.5 py-1 border border-slate-200 rounded text-xs"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateField(i, { required: e.target.checked })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={f.type === "select" ? (f.options || []).join(", ") : f.hint || ""}
                        onChange={(e) =>
                          updateField(
                            i,
                            f.type === "select"
                              ? {
                                  options: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }
                              : { hint: e.target.value },
                          )
                        }
                        placeholder={f.type === "select" ? "option1, option2" : "helper text"}
                        className="w-full min-w-[200px] px-1.5 py-1 border border-slate-200 rounded text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={() => removeField(i)}
                        className="text-rose-600 hover:underline text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setDraftFields([]);
                setDraftName("");
              }}
              className="px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Discard
            </button>
            <button
              onClick={saveTemplate}
              disabled={saving || !draftName.trim() || draftFields.length === 0}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save template"}
            </button>
          </div>
        </div>
      )}

      {/* Saved templates */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Saved templates ({templates.length})
        </h2>
        {templates.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No templates yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-sm text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-500">
                    {Array.isArray(t.fields) ? t.fields.length : 0} fields · updated{" "}
                    {new Date(t.updatedAt).toLocaleString()}
                  </div>
                </div>
                <Link
                  href={`/lab-portal/wizard/${t.id}?preview=true`}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Preview customer view →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
