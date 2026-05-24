/**
 * /education/lifecycle — FUZE Life Cycle Analysis (cradle-to-grave).
 *
 * Source: PVH-deliverable LCA document drafted May 2026
 * (deliverables/FUZE_Lifecycle_Analysis_PVH.docx). This page is the
 * brand-facing version of that document, structured as a scrollable
 * education page following the same template as /education/story
 * and /education/application.
 *
 * Voice locked per CLAUDE.md: FUZE / metamaterial / F1–F4 only. Never
 * silver / nano / nanoparticle in customer-facing copy.
 *
 * Accessibility: /education/* is in middleware EXTERNAL_ALLOWED_PATHS
 * so brand / factory / distributor / lab users all reach it.
 */

import Link from "next/link";
import { getServerTranslations } from "@/i18n/server";

export const metadata = {
  title: "FUZE Life Cycle Analysis",
  description:
    "Cradle-to-grave LCA for FUZE antimicrobial textile treatment — production, distribution, application, use phase, end-of-life.",
};

interface Stage {
  number: string;
  label: string;
  icon: string;
  headline: string;
  bullets: string[];
}

const STAGES: Stage[] = [
  {
    number: "01",
    label: "Production",
    icon: "⚛",
    headline: "Solar-capable laser ablation from recycled electronics",
    bullets: [
      "Feedstock is recovered metallic content from end-of-life electronics — a closed-loop input from the e-waste recovery supply chain. No virgin mining inputs.",
      "30-amp laser ablation on a 1 m² production table, in 99.998% ultrapure 18-megaohm DI water. No volatile solvents, no acid leaches, no formaldehyde, no toxic intermediates.",
      "Production cell is solar-capable. At commercial scale, 100% renewable energy supports Scope 3 reductions upstream of the brand's supply chain.",
      "No process effluent. No air emissions. The carrier solution IS the deliverable.",
    ],
  },
  {
    number: "02",
    label: "Distribution",
    icon: "📦",
    headline: "Standard textile-finish freight profile",
    bullets: [
      "19 L HDPE carboy → 608 L gaylord (32 carboys) → 6,080 L per 20-ft container → 12,160 L per 40-ft container.",
      "Regional distributor network across North America, Asia-Pacific, Europe, and Central America. Factory purchase routed through the nearest distributor to minimize freight.",
      "No shelf-life constraint. Distributors and mills can hold stock indefinitely — no spoilage-driven repurchase cycles.",
    ],
  },
  {
    number: "03",
    label: "Application",
    icon: "🏭",
    headline: "Existing mill equipment, no capex required",
    bullets: [
      "Three application methods: exhaust bath (jet/jig/beam dyeing machines), pad-dry-cure (continuous line), or spray (nonwoven and composite substrates).",
      "Cure temperature 150–170 °C uses the mill's existing oven infrastructure. Incremental energy approximately 0.05–0.10 kWh per square meter when run as a standalone pass.",
      "Bath chemistry at F1 Full Spectrum is approximately 0.04–0.10% active on weight of bath — 50–500× lower than incumbent silver-ion, silver-chloride, and quaternary ammonium finishes.",
      "No formaldehyde-releasing crosslinkers. No PFAS. No cationic binders. No acid pH adjusters. No heavy-metal mordants. Bath runs at near-neutral pH.",
    ],
  },
  {
    number: "04",
    label: "Use Phase",
    icon: "👕",
    headline: "Non-leaching contact-kill — durability through 100 washes",
    bullets: [
      "F1 Full Spectrum (1.0 mg/kg, 100 washes), F2 Advanced (0.75 mg/kg, 75 washes), F3 Core (0.5 mg/kg, 50 washes), F4 Foundation (0.25 mg/kg, 25 washes).",
      "Active mechanism is contact-kill: bacteria are physically dismantled when they touch the metamaterial-bonded fiber surface — not by released ions in the wash water.",
      "Zero wash-effluent metallic release. Eliminates the municipal-wastewater contribution pathway that incumbent silver-ion and silver-chloride finishes impose.",
      "Third-party validated under AATCC 100, ASTM E2149 (dynamic-contact), AATCC 30 (antifungal), and ISO 20743 / ISO 18184 protocols. Reports shared with brand partners on request.",
    ],
  },
  {
    number: "05",
    label: "End of Life",
    icon: "♻",
    headline: "Recyclability preserved, no environmental persistence",
    bullets: [
      "Compatible with mechanical recycling (shredding, carding, re-spinning) without process modifications. Metamaterial represents <0.001% of fiber mass.",
      "Compatible with chemical recycling: does not participate in glycolysis (PET depolymerization), enzymatic hydrolysis, or solvent-based fiber regeneration chemistries.",
      "Landfill: bonded metamaterial does not leach from fiber. No groundwater contamination pathway. No environmental persistence concerns at <0.001% loading.",
      "FUZE-treated articles can re-enter closed-loop circularity programs without contamination of recovered fiber streams.",
    ],
  },
];

interface CompareRow {
  attribute: string;
  fuze: string;
  silvadur: string;
  polygiene: string;
  qac: string;
}

const COMPARE: CompareRow[] = [
  {
    attribute: "Active loading on fabric",
    fuze: "0.25–1.0 mg/kg",
    silvadur: "50–500 mg/kg",
    polygiene: "50–300 mg/kg",
    qac: "500–5,000 mg/kg",
  },
  {
    attribute: "Mechanism",
    fuze: "Non-leaching contact-kill",
    silvadur: "Leaching ion release",
    polygiene: "Leaching ion release",
    qac: "Leaching surfactant kill",
  },
  {
    attribute: "Wash effluent metallic release",
    fuze: "Not detected",
    silvadur: "5–20% / cycle early",
    polygiene: "5–20% / cycle early",
    qac: "N/A (organic)",
  },
  {
    attribute: "Wash durability claim",
    fuze: "100 (F1) / 75 / 50 / 25",
    silvadur: "50 (self-published)",
    polygiene: "50–100 (varies)",
    qac: "20–40",
  },
  {
    attribute: "Third-party AATCC 100 wash reports",
    fuze: "Shared on request",
    silvadur: "Not published",
    polygiene: "Not published",
    qac: "Inconsistent",
  },
  {
    attribute: "PFAS-free",
    fuze: "Yes",
    silvadur: "Typically yes",
    polygiene: "Typically yes",
    qac: "Yes",
  },
  {
    attribute: "Formaldehyde crosslinker required",
    fuze: "No",
    silvadur: "Sometimes (DMDHEU)",
    polygiene: "Varies",
    qac: "No",
  },
  {
    attribute: "Recycled-content feedstock",
    fuze: "Yes (e-waste)",
    silvadur: "No (virgin/refined)",
    polygiene: "No (virgin/refined)",
    qac: "Petrochemical",
  },
  {
    attribute: "OEKO-TEX Std 100 Class I",
    fuze: "Yes",
    silvadur: "Yes (most)",
    polygiene: "Yes (most)",
    qac: "Limited",
  },
  {
    attribute: "bluesign® approved",
    fuze: "Yes",
    silvadur: "Varies",
    polygiene: "Varies",
    qac: "Limited",
  },
  {
    attribute: "Chemical recycling compatible",
    fuze: "Yes",
    silvadur: "Yes",
    polygiene: "Yes",
    qac: "Limited",
  },
];

export default async function FuzeLifecyclePage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).educationLifecycle;
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white rounded-2xl p-6 md:p-8">
        <Link href="/education" className="text-xs text-emerald-300 hover:text-emerald-200">
          {T.backLink}
        </Link>
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mt-2 mb-1">
          {T.heroEyebrow}
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          {T.heroTitle}
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
          {T.heroBlurbPrefix} <strong className="text-white">{T.heroBlurbStandard}</strong>{T.heroBlurbSuffix}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-bold border border-emerald-400/30">
            {T.badgeBrandTeams}
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-bold border border-emerald-400/30">
            {T.badgeFramework}
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-bold border border-emerald-400/30">
            {T.badgeCradle}
          </span>
        </div>
      </div>

      {/* ── 5-stage horizontal flow ────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
        <div className="mb-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            {T.atAGlanceLabel}
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">
            {T.fiveStagesTitle}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {STAGES.map((s) => (
            <a
              key={s.number}
              href={`#stage-${s.number}`}
              className="group flex flex-col rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors overflow-hidden"
            >
              <div className="bg-[#00b4c3] text-white px-3 py-1.5 flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wider">{s.number}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {s.label}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="text-3xl mb-2 text-[#00b4c3]">{s.icon}</div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-900 leading-snug">
                  {s.headline}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── Detailed per-stage sections ────────────────────────── */}
      {STAGES.map((s, idx) => (
        <section
          key={s.number}
          id={`stage-${s.number}`}
          className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 scroll-mt-6"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="shrink-0 w-14 h-14 rounded-xl bg-[#00b4c3] text-white flex items-center justify-center text-2xl font-black">
              {s.number}
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#00b4c3] mb-1">
                {T.stageOfTemplate.replace("{n}", String(idx + 1)).replace("{label}", s.label)}
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900">
                {s.headline}
              </h2>
            </div>
            <div className="text-4xl text-slate-300">{s.icon}</div>
          </div>
          <ul className="space-y-2.5 mt-4">
            {s.bullets.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-relaxed">
                <span className="text-[#00b4c3] font-black shrink-0 mt-0.5">→</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* ── Comparative table ──────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
        <div className="mb-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            {T.compareEyebrow}
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">
            {T.compareTitle}
          </h2>
          <p className="text-sm text-slate-600 mt-2 max-w-3xl leading-relaxed">
            {T.compareBlurb}
          </p>
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs md:text-sm border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="text-left px-3 py-3 font-bold border-b-2 border-[#00b4c3]">
                  {T.compareColAttribute}
                </th>
                <th className="text-left px-3 py-3 font-bold border-b-2 border-[#00b4c3] bg-emerald-700">
                  {T.compareColFUZE}
                </th>
                <th className="text-left px-3 py-3 font-bold border-b-2 border-[#00b4c3]">
                  {T.compareColSilvadur}
                </th>
                <th className="text-left px-3 py-3 font-bold border-b-2 border-[#00b4c3]">
                  {T.compareColPolygiene}
                </th>
                <th className="text-left px-3 py-3 font-bold border-b-2 border-[#00b4c3]">
                  {T.compareColQAC}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr
                  key={row.attribute}
                  className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
                >
                  <td className="px-3 py-2.5 font-semibold text-slate-900 border-b border-slate-200">
                    {row.attribute}
                  </td>
                  <td className="px-3 py-2.5 text-emerald-900 font-semibold bg-emerald-50 border-b border-emerald-200">
                    {row.fuze}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 border-b border-slate-200">
                    {row.silvadur}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 border-b border-slate-200">
                    {row.polygiene}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 border-b border-slate-200">
                    {row.qac}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-500 italic leading-relaxed">
          {T.compareFooter}
        </p>
      </section>

      {/* ── Headline claim band ────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 to-emerald-900 text-white rounded-2xl p-6 md:p-8">
        <div className="grid md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">
              {T.headlineEyebrow}
            </div>
            <p className="text-2xl md:text-3xl font-black leading-tight">
              <span className="text-emerald-300">{T.headlineNumber}</span>{T.headlineMid}<span className="text-emerald-300">{T.headlineEquivalent}</span>{T.headlineSuffix}
            </p>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              {T.headlineBlurb}
            </p>
          </div>
          <div className="space-y-2">
            <ComplianceBadge label={T.badgeOekoTex} />
            <ComplianceBadge label={T.badgeBluesign} />
            <ComplianceBadge label={T.badgeEPA} />
            <ComplianceBadge label={T.badgePFASfree} />
          </div>
        </div>
      </section>

      {/* ── ESG framing ────────────────────────────────────────── */}
      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-black text-emerald-900 mb-3">
          {T.esgTitle}
        </h2>
        <ul className="space-y-2.5 text-sm text-emerald-900">
          <li className="flex gap-2.5">
            <span className="text-emerald-700 font-black shrink-0">✓</span>
            <span>
              <strong>{T.esgBullet1Title}</strong>{T.esgBullet1Text}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-emerald-700 font-black shrink-0">✓</span>
            <span>
              <strong>{T.esgBullet2Title}</strong>{T.esgBullet2Text}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-emerald-700 font-black shrink-0">✓</span>
            <span>
              <strong>{T.esgBullet3Title}</strong>{T.esgBullet3Text}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-emerald-700 font-black shrink-0">✓</span>
            <span>
              <strong>{T.esgBullet4Title}</strong>{T.esgBullet4Text}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-emerald-700 font-black shrink-0">✓</span>
            <span>
              <strong>{T.esgBullet5Title}</strong>{T.esgBullet5Text}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-emerald-700 font-black shrink-0">✓</span>
            <span>
              <strong>{T.esgBullet6Title}</strong>{T.esgBullet6Text}
            </span>
          </li>
        </ul>
      </section>

      {/* ── Methodology note ───────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          {T.methodologyEyebrow}
        </div>
        <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-3">
          {T.methodologyTitle}
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed mb-3">
          {T.methodologyPara1}
        </p>
        <p className="text-sm text-slate-700 leading-relaxed mb-3">
          {T.methodologyPara2Lead}<em>{T.methodologyPara2Em}</em>{T.methodologyPara2Suffix}
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">
          {T.methodologyPara3}
        </p>
      </section>

      {/* ── CTAs ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/education"
          className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
        >
          {T.ctaBack}
        </Link>
        <Link
          href="/education/story"
          className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
        >
          {T.ctaStory}
        </Link>
        <Link
          href="/education/application"
          className="px-4 py-2.5 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8]"
        >
          {T.ctaApplication}
        </Link>
        <Link
          href="/sustainability"
          className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50"
        >
          {T.ctaSustainability}
        </Link>
      </div>
    </div>
  );
}

function ComplianceBadge({ label }: { label: string }) {
  return (
    <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-3 py-2 text-xs font-bold text-emerald-100 text-center">
      {label}
    </div>
  );
}
