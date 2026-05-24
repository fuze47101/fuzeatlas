/**
 * /education/compliance — Compliance & Certifications stack
 *
 * Andrew (2026-05-04, expert-marketer note): "Brands want one screenshot
 * they can paste into a vendor questionnaire." This is that page.
 */

import Link from "next/link";
import { getServerTranslations } from "@/i18n/server";

export const metadata = {
  title: "Compliance & Certifications",
};

const CERTS = [
  {
    id: "epa-fed",
    label: "EPA Federal Registration",
    body: "Active ingredient registered as a pesticide for textile-treatment use.",
    status: "active" as const,
    detail: "FUZE active agent is federally EPA-registered. EPA reviews and registers the chemistry; brands citing FUZE in marketing should reference 'EPA-registered antimicrobial chemistry.'",
  },
  {
    id: "ca-epa",
    label: "California EPA Approval",
    body: "California-specific approval received Q1 2026.",
    status: "active" as const,
    detail: "California's pesticide regulator (DPR) requires separate state-level approval. We have it. Stack this with federal EPA registration when selling into California-domiciled brands or any product distributed in California (Lululemon, PFAS-pressure brands).",
  },
  {
    id: "oeko-tex",
    label: "OEKO-TEX Standard 100 — Class I",
    body: "Skin-contact-safe certification at the strictest infant/baby-product class.",
    status: "active" as const,
    detail: "OEKO-TEX Class I means safe for direct skin contact in infant products under 36 months. Class I is stricter than Class II (skin-touching) or Class III (incidental skin). FUZE-treated fabric carries this rating.",
  },
  {
    id: "bluesign",
    label: "bluesign® approved",
    body: "End-to-end sustainability certification — production, chemistry, supply-chain.",
    status: "active" as const,
    detail: "bluesign is the highest-bar textile sustainability certification. It audits the chemistry, the production process, the worker safety, the water discharge, and the energy use. FUZE is bluesign approved — brands committed to bluesign-only inputs can specify FUZE without compatibility review.",
  },
  {
    id: "pfas-free",
    label: "PFAS-free",
    body: "Zero PFAS, zero forever-chemical content.",
    status: "active" as const,
    detail: "FUZE contains no per- or polyfluoroalkyl substances. Critical for brands navigating California SB 707, the Texas AG investigation into Lululemon, and the broader PFAS regulatory wave. Statement available for vendor questionnaires.",
  },
  {
    id: "iso-18184",
    label: "ISO 18184 Antiviral",
    body: "ISO standard for antiviral activity testing.",
    status: "active" as const,
    detail: "FUZE F1 has documented ISO 18184 antiviral test data. Brands wanting an antiviral claim on a hangtag need ISO 18184 evidence — we have it.",
  },
  {
    id: "aatcc-100",
    label: "AATCC 100 Antibacterial",
    body: "F1 / F2 — third-party validated.",
    status: "active" as const,
    detail: "AATCC 100 wash-cycle antibacterial efficacy data through 75-100 washes for F1 Full Spectrum and F2 Advanced Performance. Reports available on request.",
  },
  {
    id: "astm-e2149",
    label: "ASTM E2149 Antibacterial",
    body: "F4 / F3 / F2 / F1 — primary test for non-leaching FUZE.",
    status: "active" as const,
    detail: "ASTM E2149 dynamic-contact antibacterial test. The mechanism-correct test for FUZE — our metamaterial kills bacteria on direct contact, which is exactly what E2149 measures. All four tiers validated; reports on request.",
  },
  {
    id: "aatcc-30",
    label: "AATCC 30 Antifungal",
    body: "Antifungal efficacy documented.",
    status: "active" as const,
    detail: "AATCC 30 antifungal test data available. For brands wanting mildew/mold-resistance claims.",
  },
  {
    id: "iso-20743",
    label: "ISO 20743",
    body: "International antibacterial efficacy standard.",
    status: "active" as const,
    detail: "ISO 20743 (the international version of JIS L 1902) test data available for F1 / F2 tiers. Required for some Japanese / EU brand specifications.",
  },
  {
    id: "zdhc",
    label: "ZDHC MRSL alignment",
    body: "Supply-chain restricted-substance compliance.",
    status: "active" as const,
    detail: "FUZE chemistry aligns with ZDHC Manufacturing Restricted Substances List requirements. Audit-ready statement available.",
  },
  {
    id: "no-formaldehyde",
    label: "Formaldehyde-free",
    body: "No formaldehyde crosslinker. Ever.",
    status: "active" as const,
    detail: "Silver-ion / AgCl / QAC chemistries depend on acrylic + formaldehyde crosslinkers to bond to fiber. FUZE bonds directly. Zero formaldehyde in our chemistry, zero formaldehyde required at the factory.",
  },
];

export default async function CompliancePage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).educationCompliance;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8">
        <Link href="/education" className="text-xs text-emerald-300 hover:text-emerald-200">{T.backLink}</Link>
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mt-2 mb-1">{T.kicker}</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">{T.heroTitle}</h1>
        <p className="mt-3 text-sm md:text-base text-slate-300 max-w-3xl">
          {T.heroBody}
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CERTS.map((c) => (
          <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h2 className="text-sm font-black text-slate-900">{c.label}</h2>
              <span className="shrink-0 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white">
                {T.activeBadge}
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-700 mb-2">{c.body}</div>
            <p className="text-[12px] text-slate-600 leading-snug">{c.detail}</p>
          </div>
        ))}
      </section>

      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
        <h2 className="text-xl font-black text-emerald-900 mb-2">{T.docCopiesTitle}</h2>
        <p className="text-sm text-emerald-800 mb-4">
          {T.docCopiesBody}
        </p>
        <Link
          href="/compliance-library"
          className="inline-flex items-center px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
        >
          {T.docCenterCta}
        </Link>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/education" className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">{T.backBasicsBtn}</Link>
        <Link href="/education/claims" className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">{T.whatYouCanClaimBtn}</Link>
      </div>
    </div>
  );
}
