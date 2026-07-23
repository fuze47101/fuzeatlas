"use client";

/**
 * Brand Claims (brand-portal item 13).
 *
 * A positive "you can say this" list of the claims a brand may make for
 * FUZE-treated goods, using the registered odor / article-protection language
 * (EPA Reg. No. 90890-1 textile / 90890-2 surfaces). Certifications + tier are
 * pulled from the brand's spec (Brand.requiredFuzeTier). Intentionally shows
 * NO restricted / "cannot say" content on the brand-facing page.
 *
 * The claim bullet content is intentionally kept inline (and English) — EPA
 * claim language is legally load-bearing and should not be machine-translated.
 * Section chrome is i18n'd.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

// Registered odor / article-protection claims a brand may make.
const ALLOWED_CLAIMS = [
  "Inhibits the growth of odor-causing bacteria on the fabric",
  "Guards against odors caused by bacteria, mold, and mildew",
  "Contains an antimicrobial agent that controls odors",
  "Inhibits the growth of mildew that causes product deterioration and staining",
  "Keeps fabric fresher for longer between washes",
  "Bonded to last — FUZE bonds permanently into the fiber and won't wash out, so the protection stays wash after wash",
  "Durable, long-lasting freshness — bonded to the fiber, not a spray-on coating",
  "PFAS-free, non-leaching finish",
  "Factual certification statements (OEKO-TEX Standard 100 Class I, bluesign® approved, EPA-registered active, PFAS-free)",
];

const CERTS = [
  { t: "EPA registered (federal)", d: "The FUZE active is EPA-registered as an antimicrobial pesticide." },
  { t: "California EPA approved (Q1 2026)", d: "State-level approval stacks with the federal registration." },
  { t: "OEKO-TEX Standard 100 Class I", d: "Safe for products for babies and young children — the strictest class." },
  { t: "bluesign® approved", d: "Meets bluesign® criteria for responsible textile chemistry." },
  { t: "PFAS-free", d: "No per- or polyfluoroalkyl substances. Zero binders, zero curing chemistry." },
  { t: "Test standards", d: "Validated to AATCC 100 / ASTM E2149 / AATCC 30 / ISO 18184 / ISO 20743." },
];

export default function BrandClaimsPage() {
  const { t } = useI18n();
  const tx = (t.brandPortal as any).claims;
  const [tier, setTier] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/brand-portal/spec")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.brand) {
          setTier(j.brand.requiredFuzeTier || null);
          setBrandName(j.brand.name || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            {t.brandPortal.crumb}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {/* Tier / certification strip */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
          {tx.yourProgram}
        </span>
        <span className="px-3 py-1 rounded-full bg-[#00b4c3]/10 text-[#00b4c3] text-sm font-bold">
          {loading ? "…" : tier ? tx.tierLabel.replace("{tier}", tier) : tx.tierUnset}
        </span>
        {CERTS.slice(0, 5).map((c) => (
          <span key={c.t} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
            {c.t}
          </span>
        ))}
      </div>

      {/* Approved claims — "you can say this" */}
      <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">✅</span>
          <h2 className="font-black text-emerald-900">{tx.allowedTitle}</h2>
        </div>
        <p className="text-sm text-emerald-800/80 mb-4">{tx.allowedBlurb}</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {ALLOWED_CLAIMS.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm text-slate-800">
              <span className="text-emerald-600 mt-0.5">✓</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Certifications you can cite */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
        <h2 className="font-bold text-slate-900 mb-3">{tx.certsTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CERTS.map((c) => (
            <div key={c.t} className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900 text-sm">{c.t}</h3>
              <p className="text-xs text-slate-600 mt-1">{c.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* EPA registration footer */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-700 leading-relaxed">{tx.epaRegNote}</p>
        <p className="text-xs text-slate-500 mt-2">
          {tx.epaRegLine}{" "}
          <Link href="/claims" className="text-[#00b4c3] underline hover:text-[#009ba8]">
            {tx.publicClaimsLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
