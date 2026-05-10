"use client";

/**
 * Admin counterpart to /brand-portal/profile (Phase 4B).
 *
 * Lets AMs / admins edit a brand's customer-facing profile — logo,
 * primary colour, hero copy, support contacts, public slug — without
 * having to log in as the brand. Mirrors the spec page pattern in
 * /admin/brands/[id]/spec.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/i18n";

interface BrandProfile {
  id?: string;
  brandId?: string;
  logoUrl: string | null;
  primaryColor: string | null;
  heroHeadline: string | null;
  heroSubhead: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  publicSlug: string | null;
  updatedAt?: string;
}

export default function AdminBrandProfilePage() {
  const params = useParams<{ id: string }>();
  const brandId = params?.id;

  const { t } = useI18n();
  const tx = t.brandPortal.profile;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [brand, setBrand] = useState<{ id: string; name: string } | null>(null);
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [form, setForm] = useState({
    logoUrl: "",
    primaryColor: "",
    heroHeadline: "",
    heroSubhead: "",
    supportEmail: "",
    supportPhone: "",
    publicSlug: "",
  });

  useEffect(() => {
    if (!brandId) return;
    fetch(`/api/admin/brands/${encodeURIComponent(String(brandId))}/profile`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || tx.loadFailed);
        setBrand(j.brand);
        setProfile(j.profile || null);
        setForm({
          logoUrl: j.profile?.logoUrl || "",
          primaryColor: j.profile?.primaryColor || "",
          heroHeadline: j.profile?.heroHeadline || "",
          heroSubhead: j.profile?.heroSubhead || "",
          supportEmail: j.profile?.supportEmail || "",
          supportPhone: j.profile?.supportPhone || "",
          publicSlug: j.profile?.publicSlug || "",
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  async function save() {
    if (!brandId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/brands/${encodeURIComponent(String(brandId))}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: form.logoUrl || null,
          primaryColor: form.primaryColor || null,
          heroHeadline: form.heroHeadline || null,
          heroSubhead: form.heroSubhead || null,
          supportEmail: form.supportEmail || null,
          supportPhone: form.supportPhone || null,
          publicSlug: form.publicSlug || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || tx.saveFailed);
      setProfile(j.profile);
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
  if (!brand) {
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
          <Link href="/home" className="hover:text-[#00b4c3]">
            Home
          </Link>
          <span>›</span>
          <Link href={`/brands/${brand.id}`} className="hover:text-[#00b4c3]">
            {brand.name}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <Link
          href={`/brands/${brand.id}`}
          className="inline-flex items-center gap-1 text-sm text-[#00b4c3] hover:underline mb-3"
        >
          ← Back to {brand.name}
        </Link>
        <h1 className="text-2xl font-black text-slate-900">
          {tx.pageTitleWithBrand.replace("{brand}", brand.name)}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {tx.pageSubtitle.replace("{brand}", brand.name).replace("{brand}", brand.name)}
        </p>
        {profile?.updatedAt ? (
          <p className="text-xs text-slate-400 mt-2">
            {tx.lastUpdated.replace("{date}", new Date(profile.updatedAt).toLocaleString())}
          </p>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        {/* Logo */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-1">{tx.logoUrlLabel}</label>
          <p className="text-xs text-slate-500 mb-2">{tx.logoUrlHint}</p>
          <input
            type="url"
            placeholder={tx.logoUrlPlaceholder}
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
          />
          {form.logoUrl ? (
            <a
              href={form.logoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-[#00b4c3] hover:underline"
            >
              {tx.logoPreview}
            </a>
          ) : null}
        </div>

        {/* Primary colour */}
        <div className="border-t border-slate-100 pt-6">
          <label className="block text-sm font-bold text-slate-900 mb-1">
            {tx.primaryColorLabel}
          </label>
          <p className="text-xs text-slate-500 mb-2">{tx.primaryColorHint}</p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder={tx.primaryColorPlaceholder}
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            {form.primaryColor ? (
              <span
                className="h-9 w-9 rounded-lg border border-slate-300 shrink-0"
                style={{ backgroundColor: form.primaryColor }}
                aria-hidden="true"
              />
            ) : null}
          </div>
        </div>

        {/* Hero copy */}
        <div className="border-t border-slate-100 pt-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              {tx.heroHeadlineLabel}
            </label>
            <p className="text-xs text-slate-500 mb-2">{tx.heroHeadlineHint}</p>
            <input
              type="text"
              placeholder={tx.heroHeadlinePlaceholder}
              value={form.heroHeadline}
              onChange={(e) => setForm({ ...form, heroHeadline: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              {tx.heroSubheadLabel}
            </label>
            <p className="text-xs text-slate-500 mb-2">{tx.heroSubheadHint}</p>
            <input
              type="text"
              placeholder={tx.heroSubheadPlaceholder}
              value={form.heroSubhead}
              onChange={(e) => setForm({ ...form, heroSubhead: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
          </div>
        </div>

        {/* Support contacts */}
        <div className="border-t border-slate-100 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              {tx.supportEmailLabel}
            </label>
            <input
              type="email"
              placeholder={tx.supportEmailPlaceholder}
              value={form.supportEmail}
              onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              {tx.supportPhoneLabel}
            </label>
            <input
              type="text"
              placeholder={tx.supportPhonePlaceholder}
              value={form.supportPhone}
              onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
          </div>
        </div>

        {/* Public slug */}
        <div className="border-t border-slate-100 pt-6">
          <label className="block text-sm font-bold text-slate-900 mb-1">
            {tx.publicSlugLabel}
          </label>
          <p className="text-xs text-slate-500 mb-2">{tx.publicSlugHint}</p>
          <input
            type="text"
            placeholder={tx.publicSlugPlaceholder}
            value={form.publicSlug}
            onChange={(e) => setForm({ ...form, publicSlug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
          />
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
