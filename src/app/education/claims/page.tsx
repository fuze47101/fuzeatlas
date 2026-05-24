/**
 * /education/claims — What You Can Legally Claim
 *
 * Andrew (2026-05-04, expert-marketer note): Compliance teams ask
 * constantly. Today nobody has it written down on the platform.
 * This page is a brand-facing reference of FIFRA-defensible claims.
 */

import Link from "next/link";
import { getServerTranslations } from "@/i18n/server";
import type { Translations } from "@/i18n";

export const metadata = {
  title: "What You Can Claim",
};

type ClaimRow = {
  id: string;
  claim: string;
  defensibility: "ok" | "with-data" | "avoid";
  why: string;
};

const PRODUCT_CLAIMS: ClaimRow[] = [
  {
    id: "antimicrobial-treated",
    claim: "Antimicrobial-treated fabric",
    defensibility: "ok",
    why: "FUZE active agent is EPA-registered as an antimicrobial pesticide. The treated article is allowed to carry the descriptive 'antimicrobial-treated' label as long as no specific public-health claim is made.",
  },
  {
    id: "permanent-antimicrobial",
    claim: "Permanent antimicrobial protection",
    defensibility: "with-data",
    why: "Defensible at FUZE F1/F2 with the AATCC 100 wash-test reports we can share. 'Permanent' here means 'persists through the documented wash count' — pair the claim with the tier-specific data sheet.",
  },
  {
    id: "kills-bacteria",
    claim: "Kills X% of bacteria",
    defensibility: "with-data",
    why: "Allowed only when paired with the specific tested organism, the test method, and the % reduction from your selected tier's report. Generic 'kills bacteria' without specifics is a FIFRA risk.",
  },
  {
    id: "odor-control",
    claim: "Odor control / freshness",
    defensibility: "ok",
    why: "Treated-article exemption typically permits odor-control language. FUZE's mechanism (preventing bacterial growth on the fabric) directly addresses the bacterial source of textile odor.",
  },
  {
    id: "antiviral",
    claim: "Antiviral / kills viruses",
    defensibility: "with-data",
    why: "Only with ISO 18184 antiviral test data. We have it for F1. Do not deploy this claim at lower tiers without explicit ISO 18184 evidence for that tier.",
  },
  {
    id: "antifungal",
    claim: "Antifungal / mildew resistance",
    defensibility: "with-data",
    why: "Backed by AATCC 30 antifungal test data. Available for the higher tiers; cite the tier-specific report.",
  },
  {
    id: "kills-covid",
    claim: "Kills COVID / SARS-CoV-2",
    defensibility: "avoid",
    why: "Specific virus claims require EPA List N registration, which textile-treatment products typically don't carry. Avoid naming specific pathogens.",
  },
];

const SUSTAINABILITY_CLAIMS: ClaimRow[] = [
  {
    id: "pfas-free",
    claim: "PFAS-free",
    defensibility: "ok",
    why: "FUZE contains zero per- or polyfluoroalkyl substances. Statement available for vendor questionnaires.",
  },
  {
    id: "formaldehyde-free",
    claim: "Formaldehyde-free finish",
    defensibility: "ok",
    why: "FUZE doesn't require a binder, so there's no acrylic/formaldehyde crosslinker on the fabric — unlike silver-ion / AgCl / QAC competitors.",
  },
  {
    id: "binder-free",
    claim: "Binder-free / no acrylic polymer",
    defensibility: "ok",
    why: "FUZE bonds directly to the fiber. No acrylic / polyurethane binder is added. Reduces microplastic shedding in the consumer wash.",
  },
  {
    id: "non-leaching",
    claim: "Non-leaching antimicrobial",
    defensibility: "ok",
    why: "FUZE kills on contact, not via ion release. Validated by ASTM E2149. This is a defensible technical claim — pair with the test report when challenged.",
  },
  {
    id: "circular",
    claim: "Made from recycled-electronics feedstock",
    defensibility: "ok",
    why: "Production input is end-of-life electronics. Defensible factual claim about the FUZE supply chain — pair with our story page when used in marketing.",
  },
  {
    id: "carbon-neutral",
    claim: "Carbon-neutral antimicrobial",
    defensibility: "avoid",
    why: "Avoid blanket carbon-neutral claims unless your specific finished-goods supply chain has a third-party-verified offset program. The FUZE production step is solar-capable, but the full chain depends on factory choices we don't control. Use 'low-carbon production' or quantified CO₂ savings vs a specific competitor instead.",
  },
  {
    id: "zero-water-impact",
    claim: "Zero water impact / zero-discharge antimicrobial",
    defensibility: "ok",
    why: "Defensible because FUZE doesn't leach. The downstream wash water carries no metal ions out of the FUZE-treated garment. Pair with leaching-rate data when challenged.",
  },
];

const CERT_CLAIMS: ClaimRow[] = [
  {
    id: "epa-registered",
    claim: "EPA-registered antimicrobial chemistry",
    defensibility: "ok",
    why: "Active ingredient is federally EPA-registered as a pesticide. Use this exact phrasing — do NOT say 'EPA-approved' (EPA doesn't 'approve,' they register).",
  },
  {
    id: "oeko-tex",
    claim: "OEKO-TEX Standard 100 Class I",
    defensibility: "ok",
    why: "Skin-contact-safe at the strictest infant/baby-product class. Cite the certification number we provide on a per-batch basis.",
  },
  {
    id: "bluesign",
    claim: "bluesign® approved",
    defensibility: "ok",
    why: "End-to-end sustainability certification. Use the registered ® symbol when citing. bluesign approval covers chemistry, production process, water discharge, and worker safety.",
  },
];

function ClaimSection({ title, rows, T }: { title: string; rows: ClaimRow[]; T: Translations["educationClaims"] }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6">
      <h2 className="text-lg font-black text-slate-900 mb-4">{title}</h2>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="flex gap-3 items-start border-b border-slate-100 pb-3 last:border-0 last:pb-0">
            <span
              className={`shrink-0 mt-0.5 inline-block w-20 text-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                r.defensibility === "ok"
                  ? "bg-emerald-600 text-white"
                  : r.defensibility === "with-data"
                  ? "bg-amber-500 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {r.defensibility === "ok" ? T.badgeCiteFreely : r.defensibility === "with-data" ? T.badgeWithData : T.badgeAvoid}
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-900">{r.claim}</div>
              <p className="text-xs text-slate-600 mt-0.5 leading-snug">{r.why}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function ClaimsPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).educationClaims;
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8">
        <Link href="/education" className="text-xs text-emerald-300 hover:text-emerald-200">{T.backLink}</Link>
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mt-2 mb-1">{T.eyebrow}</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">{T.pageTitle}</h1>
        <p className="mt-3 text-sm md:text-base text-slate-300 max-w-3xl">
          {T.pageIntro} <strong>{T.introCiteFreely}</strong>,
          <strong> {T.introWithData}</strong>, or <strong>{T.introAvoid}</strong> {T.introTail}
        </p>
      </div>

      <ClaimSection title={T.productClaimsTitle} rows={PRODUCT_CLAIMS} T={T} />
      <ClaimSection title={T.sustainabilityClaimsTitle} rows={SUSTAINABILITY_CLAIMS} T={T} />
      <ClaimSection title={T.certClaimsTitle} rows={CERT_CLAIMS} T={T} />

      <section className="bg-amber-50 border border-amber-300 rounded-2xl p-6">
        <h2 className="text-lg font-black text-amber-900 mb-2">{T.fifraTitle}</h2>
        <p className="text-sm text-amber-800 leading-relaxed">
          {T.fifraBody}
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/education" className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">{T.backToBasics}</Link>
        <Link href="/education/compliance" className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">{T.seeCerts}</Link>
      </div>
    </div>
  );
}
