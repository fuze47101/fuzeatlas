"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

interface Lab {
  id: string;
  name: string;
}
interface Template {
  id: string;
  name: string;
  fields: any[];
}
interface FabricOption {
  id: string;
  label: string;
}

const ALLOWED = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "BRAND_USER",
  "BRAND_MANAGER",
  "FACTORY_USER",
  "FACTORY_LEAD",
  "FACTORY_MANAGER",
  "DISTRIBUTOR_USER",
]);

function confidenceBadge(c: number | undefined) {
  if (c == null) return { label: "Blank", style: "bg-slate-100 text-slate-500" };
  if (c >= 0.9) return { label: "Auto", style: "bg-emerald-100 text-emerald-700" };
  if (c >= 0.6) return { label: "Review", style: "bg-amber-100 text-amber-700" };
  return { label: "Guess", style: "bg-rose-100 text-rose-700" };
}

export default function CustomerWizardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [fabrics, setFabrics] = useState<FabricOption[]>([]);

  const [selectedLabId, setSelectedLabId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedFabricId, setSelectedFabricId] = useState("");
  const [template, setTemplate] = useState<Template | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ id: string; poNumber: string } | null>(null);

  // Role gate
  useEffect(() => {
    if (loading) return;
    if (!user || !ALLOWED.has(user.role)) router.replace("/home");
  }, [user, loading, router]);

  // Load labs
  useEffect(() => {
    fetch("/api/labs")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.labs || []).filter((l: any) => l.active !== false);
        setLabs(list.map((l: any) => ({ id: l.id, name: l.name })));
      })
      .catch(() => {});
  }, []);

  // Load templates when lab selected
  useEffect(() => {
    if (!selectedLabId) return;
    fetch(`/api/admin/labs/${selectedLabId}/form-templates`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d?.templates)
          ? d.templates
          : Array.isArray(d?.formTemplates)
            ? d.formTemplates
            : [];
        setTemplates(list);
      })
      .catch(() => setTemplates([]));
  }, [selectedLabId]);

  // Load fabrics for step 3
  useEffect(() => {
    if (step !== 3) return;
    fetch("/api/fabrics?pageSize=200")
      .then((r) => r.json())
      .then((d) => {
        const items = d.fabrics || d.items || [];
        setFabrics(
          items.map((f: any) => ({
            id: f.id,
            label: `FUZE-${f.fuzeNumber ?? "—"} · ${f.customerCode || ""} ${f.brand?.name ? `(${f.brand.name})` : ""}`,
          })),
        );
      })
      .catch(() => setFabrics([]));
  }, [step]);

  const startPrefill = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/lab-portal/wizard/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTemplateId: selectedTemplateId,
          labId: selectedLabId,
          fabricId: selectedFabricId,
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Prefill failed");
        return;
      }
      setTemplate(d.template);
      setValues(d.fields || {});
      setConfidence(d.confidence || {});
      setNotes(d.notes || []);
      setStep(4);
    } catch (e: any) {
      setError(e?.message || "Prefill failed");
    } finally {
      setBusy(false);
    }
  }, [selectedTemplateId, selectedLabId, selectedFabricId]);

  const submit = useCallback(async () => {
    if (!template) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/test-requests/wizard/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTemplateId: template.id,
          labId: selectedLabId,
          fabricId: selectedFabricId,
          formResponses: values,
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Submit failed");
        return;
      }
      setSubmitted({ id: d.testRequest.id, poNumber: d.testRequest.poNumber });
    } catch (e: any) {
      setError(e?.message || "Submit failed");
    } finally {
      setBusy(false);
    }
  }, [template, selectedLabId, selectedFabricId, values]);

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <h1 className="text-xl font-semibold text-emerald-900">Test request submitted</h1>
          <p className="mt-2 text-sm text-emerald-800">
            PO <strong className="font-mono">{submitted.poNumber}</strong> has been sent to the
            lab. The lab + regional approver have been notified.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href={`/test-requests/${submitted.id}`}
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
            >
              Open request
            </Link>
            <Link
              href={`/api/test-requests/${submitted.id}/wizard-pdf`}
              target="_blank"
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm rounded-md hover:bg-slate-50"
            >
              Print form
            </Link>
            <button
              onClick={() => {
                setSubmitted(null);
                setStep(1);
                setSelectedLabId("");
                setSelectedTemplateId("");
                setSelectedFabricId("");
                setTemplate(null);
                setValues({});
              }}
              className="px-3 py-1.5 text-slate-700 text-sm hover:underline"
            >
              Start another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New Test Request — Wizard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Step {step} of 5 — {step === 1 ? "Pick lab" : step === 2 ? "Pick form" : step === 3 ? "Pick fabric" : step === 4 ? "AI-assisted fill" : "Review + submit"}
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Lab</label>
          <select
            value={selectedLabId}
            onChange={(e) => setSelectedLabId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">Select a lab…</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!selectedLabId}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Form template</label>
          {templates.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              This lab hasn't published any digital forms yet. Ask the lab to drop their PDF on
              /lab-portal/forms.
            </p>
          ) : (
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-3 py-1.5 text-slate-700 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!selectedTemplateId}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Fabric</label>
          <select
            value={selectedFabricId}
            onChange={(e) => setSelectedFabricId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">Select a fabric…</option>
            {fabrics.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-3 py-1.5 text-slate-700 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={startPrefill}
              disabled={!selectedFabricId || busy}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "Prefilling…" : "AI Pre-fill"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && template && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
          <p className="text-xs text-slate-500 mb-3">
            Confidence: 🟢 auto-filled · 🟡 review · 🔴 guess · ⚪ blank
          </p>
          {notes.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              {notes.map((n, i) => (
                <div key={i}>• {n}</div>
              ))}
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {(template.fields || []).map((f: any) => {
              const c = confidence[f.key];
              const badge = confidenceBadge(c);
              const val = values[f.key];
              return (
                <div key={f.key} className="py-2 grid grid-cols-[1fr_auto] items-start gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {f.label}
                      {f.required && <span className="text-rose-500 ml-1">*</span>}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        rows={3}
                        value={val ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    ) : f.type === "select" ? (
                      <select
                        value={val ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                      >
                        <option value="">—</option>
                        {(f.options || []).map((o: string) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "checkbox" ? (
                      <input
                        type="checkbox"
                        checked={!!val}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.key]: e.target.checked }))
                        }
                      />
                    ) : (
                      <input
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                        value={val ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    )}
                    {f.hint && <p className="text-[10px] text-slate-500 mt-0.5">{f.hint}</p>}
                  </div>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.style}`}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between pt-3">
            <button
              onClick={() => setStep(3)}
              className="px-3 py-1.5 text-slate-700 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep(5)}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {step === 5 && template && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Review</h2>
          <dl className="divide-y divide-slate-100">
            {(template.fields || []).map((f: any) => (
              <div key={f.key} className="py-1.5 grid grid-cols-[200px_1fr] text-sm">
                <dt className="text-slate-600">{f.label}</dt>
                <dd className="text-slate-900">{String(values[f.key] ?? "—")}</dd>
              </div>
            ))}
          </dl>
          <div className="flex justify-between pt-3">
            <button
              onClick={() => setStep(4)}
              className="px-3 py-1.5 text-slate-700 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="px-4 py-1.5 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit to lab"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
