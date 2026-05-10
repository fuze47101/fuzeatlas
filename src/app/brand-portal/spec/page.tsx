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
import { useI18n } from "@/i18n";

interface BrandSpec {
  id: string;
  name: string;
  requiredFuzeTier: string | null;
  icpCadenceEveryNBatches: number | null;
  icpCadenceEveryLitersConsumed: number | null;
  protocolDocUrl: string | null;
  brandSpecUpdatedAt: string | null;
}

export default function BrandSpecPage() {
  const { t } = useI18n();
  const tx = t.brandPortal.spec;
  const TIERS = [
    { code: "F1", label: tx.tierF1 },
    { code: "F2", label: tx.tierF2 },
    { code: "F3", label: tx.tierF3 },
    { code: "F4", label: tx.tierF4 },
  ];
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
        if (!j.ok) throw new Error(j.error || tx.loadFailed);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!j.ok) throw new Error(j.error || tx.saveFailed);
      setSpec(j.brand);
      setSavedAt(new Date().toISOString());
    } catch (e: any) {
      setError(e?.message || tx.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }
  if (!spec) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error || tx.unableToLoad}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            {t.brandPortal.crumb}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {tx.pageTitleWithBrand.replace("{brand}", spec.name)}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
        {spec.brandSpecUpdatedAt ? (
          <p className="text-xs text-slate-400 mt-2">
            {tx.lastUpdated.replace("{date}", new Date(spec.brandSpecUpdatedAt).toLocaleString())}
          </p>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        {/* Required FUZE tier */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-1">{tx.tierLabel}</label>
          <p className="text-xs text-slate-500 mb-3">{tx.tierBlurb}</p>
          <select
            value={form.requiredFuzeTier}
            onChange={(e) => setForm({ ...form, requiredFuzeTier: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
          >
            <option value="">{tx.tierPlaceholder}</option>
            {TIERS.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h2 className="text-sm font-bold text-slate-900 mb-1">{tx.cadenceHeader}</h2>
          <p className="text-xs text-slate-500 mb-4">{tx.cadenceBlurb}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {tx.cadenceNBatchesLabel}
              </label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder={tx.cadenceNBatchesPlaceholder}
                value={form.icpCadenceEveryNBatches}
                onChange={(e) =>
                  setForm({ ...form, icpCadenceEveryNBatches: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              />
              <p className="text-xs text-slate-400 mt-1">{tx.cadenceNBatchesHint}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {tx.cadenceLitersLabel}
              </label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder={tx.cadenceLitersPlaceholder}
                value={form.icpCadenceEveryLitersConsumed}
                onChange={(e) =>
                  setForm({ ...form, icpCadenceEveryLitersConsumed: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              />
              <p className="text-xs text-slate-400 mt-1">{tx.cadenceLitersHint}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <label className="block text-sm font-bold text-slate-900 mb-1">{tx.protocolUrlLabel}</label>
          <p className="text-xs text-slate-500 mb-3">{tx.protocolUrlBlurb}</p>
          <input
            type="url"
            placeholder={tx.protocolUrlPlaceholder}
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
              {tx.protocolPreview}
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
            {tx.savedAt.replace("{time}", new Date(savedAt).toLocaleTimeString())}
          </div>
        ) : null}

        <div className="flex justify-end pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[#00b4c3] hover:bg-[#009ba8] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 text-sm font-bold transition-colors"
          >
            {saving ? tx.saving : tx.save}
          </button>
        </div>
      </div>
    </div>
  );
}
