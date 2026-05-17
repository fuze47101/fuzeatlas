"use client";

/**
 * /lab-portal/wizard/[formTemplateId] — Phase 10C.
 *
 * AI-assisted lab form intake. Three steps:
 *   1. Pick fabric / brand / factory
 *   2. Review AI-suggested fills with per-field confidence indicator
 *   3. Submit → creates a TestRequest
 */
import { use, useState } from "react";
import { useI18n } from "@/i18n";

interface FormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface StartPayload {
  ok: boolean;
  template: { id: string; name: string; fields: FormField[] };
  fields: Record<string, any>;
  confidence: Record<string, number>;
  notes: string[];
}

function confidenceBadge(c: number | undefined) {
  if (c == null) return { label: "blank", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  if (c >= 0.95) return { label: "auto", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  if (c >= 0.7) return { label: "review", cls: "bg-amber-100 text-amber-800 border-amber-200" };
  return { label: "guess", cls: "bg-red-100 text-red-800 border-red-200" };
}

export default function LabWizardPage({
  params,
}: {
  params: Promise<{ formTemplateId: string }>;
}) {
  const { formTemplateId } = use(params);
  const { t } = useI18n();
  const tx = t.labPortal.wizardPage;
  const [step, setStep] = useState(1);
  const [fabricId, setFabricId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [data, setData] = useState<StartPayload | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startWizard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lab-portal/wizard/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formTemplateId, fabricId, brandId, factoryId }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Wizard start failed");
      setData(j);
      setValues(j.fields || {});
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/test-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fabricId,
          brandId,
          factoryId,
          formTemplateId,
          formData: values,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Submit failed");
      setStep(3);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-black text-slate-900 mb-2">
        {tx.pageTitle}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Step {step} of 3. The AI auto-fills fields from what Atlas already
        knows about the fabric / brand / factory; you review + edit.
      </p>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      {step === 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Fabric ID</label>
            <input
              type="text"
              value={fabricId}
              onChange={(e) => setFabricId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              placeholder="cuid…"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Brand ID (optional)</label>
            <input
              type="text"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Factory ID (optional)</label>
            <input
              type="text"
              value={factoryId}
              onChange={(e) => setFactoryId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>
          <button
            onClick={startWizard}
            disabled={loading || !fabricId}
            className="px-5 py-2 bg-[#00b4c3] text-white rounded font-bold disabled:opacity-50"
          >
            {loading ? "Loading…" : "Auto-fill with AI →"}
          </button>
        </div>
      )}

      {step === 2 && data && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">{data.template.name}</h2>
          {data.notes.length > 0 && (
            <div className="rounded bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              {data.notes.map((n, i) => (
                <p key={i}>· {n}</p>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {data.template.fields.map((f) => {
              const c = data.confidence[f.key];
              const badge = confidenceBadge(c);
              return (
                <div key={f.key}>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
                    <span>{f.label || f.key}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase border ${badge.cls}`}
                    >
                      {badge.label}
                      {c != null && c < 1 && <> · {(c * 100).toFixed(0)}%</>}
                    </span>
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : "text"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-slate-300 rounded text-sm hover:bg-slate-50"
            >
              ← Back
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="px-5 py-2 bg-[#00b4c3] text-white rounded font-bold disabled:opacity-50"
            >
              {loading ? "Submitting…" : "Submit test request →"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-lg font-bold text-emerald-900">✓ Submitted</p>
          <p className="text-sm text-emerald-800 mt-2">
            Test request created. Check /lab-portal/queue for status.
          </p>
        </div>
      )}
    </div>
  );
}
