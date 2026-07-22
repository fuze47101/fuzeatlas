"use client";

/**
 * Brand Claims (brand-portal item 13).
 *
 * Shows the defensible claim language a brand may use for FUZE-treated goods,
 * strictly within the EPA Treated-Article Exemption framework (PR Notice
 * 2000-1). "Claims you can make" (allowed) vs "Claims that require
 * product-specific registration" (restricted). Certifications + tier are
 * pulled from the brand's spec (Brand.requiredFuzeTier).
 *
 * The compliance bullet content is intentionally kept inline (and English) —
 * EPA claim language is legally load-bearing and should not be machine-
 * translated. Section chrome is i18n'd.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

// EPA Treated-Article-safe claims (per CLAUDE.md compliance discipline).
const ALLOWED_CLAIMS = [
  "Inhibits the growth of odor-causing bacteria on the fabric",
  "Inhibits the growth of mildew and mold that cause product deterioration, staining, and odors",
  "Keeps fabric fresher for longer between washes",
  "Odor control / freshness technology built into the fiber",
  "Durable, long-lasting finish — bonded to the fiber, not a spray-on coating",
  "PFAS-free, non-leaching antimicrobial finish",
  "Treated with FUZE metamaterial — a proprietary antimicrobial textile treatment",
  "Factual certification statements (OEKO-TEX Standard 100 Class I, bluesign® approved, EPA-registered active, PFAS-free)",
];

// Claims that need product-specific public-health pesticide registration.
const RESTRICTED_CLAIMS = [
  "“Antibacterial”, “antimicrobial protection”, “bactericidal”, or “germicidal” as a product benefit",
  "“Kills 99.9% of bacteria” or any specific kill-rate / log-reduction percentage",
  "Named-pathogen claims — kills or protects against MRSA, Staph, E. coli, Salmonella, etc.",
  "Any human-health or disease claim (prevents infection, protects your health, hospital-grade, etc.)",
  "“Antiviral” / “kills viruses” as a consumer product claim",
  "Implying the garment protects the wearer rather than the fabric",
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

      {/* Allowed vs Restricted */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Allowed */}
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">✅</span>
            <h2 className="font-black text-emerald-900">{tx.allowedTitle}</h2>
          </div>
          <p className="text-xs text-emerald-800/80 mb-3">{tx.allowedBlurb}</p>
          <ul className="space-y-2">
            {ALLOWED_CLAIMS.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm text-slate-800">
                <span className="text-emerald-600 mt-0.5">✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Restricted */}
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⛔</span>
            <h2 className="font-black text-red-900">{tx.restrictedTitle}</h2>
          </div>
          <p className="text-xs text-red-800/80 mb-3">{tx.restrictedBlurb}</p>
          <ul className="space-y-2">
            {RESTRICTED_CLAIMS.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm text-slate-800">
                <span className="text-red-600 mt-0.5">✕</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
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

      {/* EPA framework note */}
      <div className="rounded-xl bg-slate-900 text-white p-5">
        <h3 className="font-black mb-2">{tx.frameworkTitle}</h3>
        <p className="text-sm text-white/85 leading-relaxed">{tx.frameworkBody}</p>
        <p className="text-xs text-white/60 mt-3">
          {tx.frameworkFootnote}{" "}
          <Link href="/claims" className="underline hover:text-white">
            {tx.publicClaimsLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
