"use client";

/**
 * Brand spec setup page (KUIU promise May 2026 — Andrew → Joseph:
 * "you stipulate in the setup ... we will have this document included
 * with your profile so they can reference it").
 *
 * Brand managers + sales reps + admins can:
 *   - Set the required FUZE tier (F1/F2/F3/F4)
 *   - Set ICP cadence by batch count
 *   - Set ICP cadence by volume consumed (alternative)
 *   - Attach the protocol document URL
 *
 * Read-only for plain BRAND_USER role — they see the spec but can't
 * flip it. The PATCH endpoint enforces the same rule server-side.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface BrandSpec {
  id: string;
  name: string;
  requiredFuzeTier: string | null;
  icpCadenceEveryNBatches: number | null;
  icpCadenceEveryLitersConsumed: number | null;
  protocolDocUrl: string | null;
  brandSpecUpdatedAt: string | null;
}

const TIERS = [
  { code: "F1", label: "F1 Full Spectrum (1.0 mg/kg)" },
  { code: "F2", label: "F2 Advanced Performance (0.75 mg/kg)" },
  { code: "F3", label: "F3 Core Performance (0.5 mg/kg)" },
  { code: "F4", label: "F4 Essential Protection (0.25 mg/kg)" },
];

export default function BrandSpecPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [spec, setSpec] = useState<BrandSpec | null>(null);
  const [form, setForm] = useState({
    requiredFuzeTier: "",
    icpCadenceEveryNBatches: "",
    icpCadenceEveryLitersConsumed: "",
    protocolDocUrl: "",
  });

  useEffect(() => {
    fetch("/api/brand-portal/spec")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load spec");
        setSpec(j.brand);
        setForm({
          requiredFuzeTier: j.brand.requiredFuzeTier || "",
          icpCadenceEveryNBatches: j.brand.icpCadenceEveryNBatches?.toString() || "",
          icpCadenceEveryLitersConsumed: j.brand.icpCadenceEveryLitersConsumed?.toString() || "",
          protocolDocUrl: j.brand.protocolDocUrl || "",
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-portal/spec", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requiredFuzeTier: form.requiredFuzeTier || null,
          icpCadenceEveryNBatches: form.icpCadenceEveryNBatches
            ? parseInt(form.icpCadenceEveryNBatches, 10)
            : null,
          icpCadenceEveryLitersConsumed: form.icpCadenceEveryLitersConsumed
            ? parseFloat(form.icpCadenceEveryLitersConsumed)
            : null,
          protocolDocUrl: form.protocolDocUrl || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Save failed");
      setSpec(j.brand);
      setSavedAt(new Date().toISOString());
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">Loading spec…</div>
    );
  }
  if (!spec) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error || "Unable to load brand spec"}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            Brand Portal
          </Link>
          <span>›</span>
          <span>Brand Spec</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          Brand Spec — {spec.name}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          The stipulated FUZE specification for your account. Determines order validation
          tolerances and ICP cadence checks across your supply chain.
        </p>
        {spec.brandSpecUpdatedAt ? (
          <p className="text-xs text-slate-400 mt-2">
            Last updated {new Date(spec.brandSpecUpdatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        {/* Required FUZE tier */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-1">
            Required FUZE tier
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Every order placed by a factory in your supply chain must use this tier. Off-tier
            orders are flagged for review and a notification is sent to your team.
          </p>
          <select
            value={form.requiredFuzeTier}
            onChange={(e) => setForm({ ...form, requiredFuzeTier: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
          >
            <option value="">— No tier requirement —</option>
            {TIERS.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h2 className="text-sm font-bold text-slate-900 mb-1">ICP cadence</h2>
          <p className="text-xs text-slate-500 mb-4">
            Set one or both. The daily cadence cron flags a factory as overdue for an ICP
            submission once <em>either</em> threshold is exceeded since their last test.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Every N production orders
              </label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 5"
                value={form.icpCadenceEveryNBatches}
                onChange={(e) =>
                  setForm({ ...form, icpCadenceEveryNBatches: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              />
              <p className="text-xs text-slate-400 mt-1">
                One ICP per N FuzeOrder rows since the last passing ICP.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Every X liters consumed
              </label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 200"
                value={form.icpCadenceEveryLitersConsumed}
                onChange={(e) =>
                  setForm({ ...form, icpCadenceEveryLitersConsumed: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              />
              <p className="text-xs text-slate-400 mt-1">
                One ICP per X liters of FuzeConsumption since the last passing ICP.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <label className="block text-sm font-bold text-slate-900 mb-1">
            Protocol document URL
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Public link (or Atlas-hosted document URL) to your stipulated protocol PDF. Surfaces
            on your supply chain dashboard so every factory can reference it.
          </p>
          <input
            type="url"
            placeholder="https://…/protocol.pdf"
            value={form.protocolDocUrl}
            onChange={(e) => setForm({ ...form, protocolDocUrl: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
          />
          {form.protocolDocUrl ? (
            <a
              href={form.protocolDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-[#00b4c3] hover:underline"
            >
              Preview document →
            </a>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {savedAt ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            Saved at {new Date(savedAt).toLocaleTimeString()}.
          </div>
        ) : null}

        <div className="flex justify-end pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[#00b4c3] hover:bg-[#009ba8] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 text-sm font-bold transition-colors"
          >
            {saving ? "Saving…" : "Save spec"}
          </button>
        </div>
      </div>
    </div>
  );
}
