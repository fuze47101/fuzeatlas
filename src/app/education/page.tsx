"use client";

/**
 * /education — the FUZE technology basics page.
 *
 * Andrew (2026-05-04): a single landing page that any audience (brand,
 * factory, distributor, customer, internal rep) can be sent to and walk
 * away understanding (1) how little chemistry FUZE uses vs competitors,
 * (2) the leaching vs contact-kill mechanism difference, (3) which test
 * matches which mechanism, and (4) what that means for their brand.
 *
 * Pure SVG animations — no GIF dependency, prints clean to PDF, scales
 * sharp on mobile and projector. Everything is declarative.
 *
 * Accessibility: all roles can hit /education (added to middleware
 * EXTERNAL_ALLOWED_PATHS).
 */

import Link from "next/link";
import { listSegments } from "@/lib/education-segments";

// ─────────────────────────────────────────────────────────────
//  Segment picker — quick links to /education/[segment] pitch pages
// ─────────────────────────────────────────────────────────────

function SegmentPicker() {
  const segments = listSegments();
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
      <div className="mb-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          Pitch by segment
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">
          FUZE for your specific industry
        </h2>
        <p className="text-sm text-slate-600 mt-2 max-w-3xl">
          The science above is universal. Each segment below has the recommended FUZE tier ladder,
          test stack, regulatory checkmarks, and an outreach hook tailored to that audience.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {segments.map((s) => (
          <Link
            key={s.slug}
            href={`/education/${s.slug}`}
            className="group rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 p-4 transition-colors"
          >
            <div className="text-base font-black text-slate-900 group-hover:text-emerald-800">
              {s.title}
            </div>
            <p className="text-xs text-slate-500 group-hover:text-emerald-700 leading-snug mt-1">
              {s.audience}
            </p>
            <div className="text-[11px] text-emerald-700 font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              Open segment page →
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Section 1: Dosage hero — show the mass of chemistry to scale
// ─────────────────────────────────────────────────────────────

type DosageRow = {
  id: string;
  label: string;
  sublabel: string;
  activeMgPerKg: number; // mg of active agent per kg of fabric
  binderGPerKg: number;  // grams of binder polymer per kg of fabric
  tone: "fuze" | "competitor" | "competitor-strong";
  comparator: string;    // human-scale comparator
};

const DOSAGE_ROWS: DosageRow[] = [
  {
    id: "fuze-f4",
    label: "FUZE F4 Essential Protection",
    sublabel: "Permanent metamaterial · no binder · no curing",
    activeMgPerKg: 0.25,
    binderGPerKg: 0,
    tone: "fuze",
    comparator: "0.25 mg per kg fabric — about 1/280th of a single human eyelash",
  },
  {
    id: "fuze-f1",
    label: "FUZE F1 Full Spectrum",
    sublabel: "Highest FUZE tier · still no binder · still no curing",
    activeMgPerKg: 1.0,
    binderGPerKg: 0,
    tone: "fuze",
    comparator: "1 mg per kg fabric — about 1/70th of a single human eyelash",
  },
  {
    id: "silvadur",
    label: "Silvadur 930 Flex (silver-ion)",
    sublabel: "+ acrylic binder · + formaldehyde crosslinker · + 160°C curing",
    activeMgPerKg: 100,
    binderGPerKg: 15,
    tone: "competitor",
    comparator: "100 mg silver + 15 g binder per kg fabric — roughly a sugar packet of polymer per kilogram",
  },
  {
    id: "polygiene",
    label: "Polygiene StayFresh (silver chloride)",
    sublabel: "+ acrylic binder · + formaldehyde crosslinker · + 150°C curing",
    activeMgPerKg: 100,
    binderGPerKg: 15,
    tone: "competitor",
    comparator: "100 mg AgCl + 15 g binder per kg fabric",
  },
  {
    id: "zinc-pyrithione",
    label: "Zinc pyrithione textile finish (ZPT)",
    sublabel: "EU-classified H400/H410 (very toxic to aquatic life) · + binder · + curing",
    activeMgPerKg: 200,
    binderGPerKg: 15,
    tone: "competitor-strong",
    comparator: "200 mg zinc + 15 g binder per kg fabric — 800× more active chemistry than FUZE F4, plus polymer load",
  },
];

function DosageHero() {
  // For the bar chart, total chemical mass = active + binder*1000 (mg).
  // Scale so the heaviest row fills 100% of the bar.
  const maxMass = Math.max(...DOSAGE_ROWS.map((r) => r.activeMgPerKg + r.binderGPerKg * 1000));

  return (
    <section id="dosage" className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-6 md:p-8 scroll-mt-24">
      <div className="mb-5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Section 1 — Footprint</div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">
          FUZE puts a fraction of a milligram of <span className="text-emerald-700">metamaterial</span> on your fabric.
          Competitors pile on grams of <span className="text-red-700">chemistry</span>.
        </h2>
        <p className="text-sm text-slate-600 mt-2 max-w-3xl">
          The bars below are drawn to scale. <span className="text-emerald-700 font-semibold">FUZE metamaterial</span>{" "}
          and <span className="text-red-700 font-semibold">competitor active chemistry</span> in the colored bars,
          required acrylic / formaldehyde binder polymer <span className="text-amber-700 font-semibold">stacked in amber</span>,
          per kg of finished fabric.
        </p>
      </div>

      <div className="space-y-4">
        {DOSAGE_ROWS.map((r) => {
          const totalMass = r.activeMgPerKg + r.binderGPerKg * 1000;
          const widthPct = Math.max(0.4, (totalMass / maxMass) * 100); // floor so FUZE F4 is at least visible
          const activeWidthPct = Math.max(0.2, (r.activeMgPerKg / maxMass) * 100);
          const binderWidthPct = Math.max(0, (r.binderGPerKg * 1000 / maxMass) * 100);
          const isFuze = r.tone === "fuze";
          return (
            <div key={r.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className={`text-sm font-bold ${isFuze ? "text-emerald-800" : "text-slate-800"}`}>{r.label}</div>
                  <div className="text-[11px] text-slate-500 leading-tight">{r.sublabel}</div>
                </div>
                <div className={`text-sm font-mono font-bold ${isFuze ? "text-emerald-700" : "text-red-700"} shrink-0`}>
                  {r.activeMgPerKg} mg{r.binderGPerKg > 0 ? ` + ${r.binderGPerKg} g binder` : ""}
                </div>
              </div>
              <div className="h-7 w-full bg-slate-100 rounded-md overflow-hidden flex">
                <div
                  className={`h-full ${isFuze ? "bg-emerald-500" : "bg-red-600"}`}
                  style={{ width: `${activeWidthPct}%`, minWidth: "2px" }}
                  title={isFuze ? `FUZE metamaterial: ${r.activeMgPerKg} mg/kg` : `Active chemistry: ${r.activeMgPerKg} mg/kg`}
                />
                {r.binderGPerKg > 0 && (
                  <div
                    className="h-full bg-amber-500 border-l border-amber-700/30"
                    style={{ width: `${binderWidthPct}%` }}
                    title={`Binder: ${r.binderGPerKg} g/kg`}
                  />
                )}
              </div>
              <div className={`text-[11px] italic ${isFuze ? "text-emerald-700/80" : "text-slate-500"}`}>{r.comparator}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="font-bold text-emerald-800">FUZE F4 — 0.25 mg/kg metamaterial</div>
          <div className="text-emerald-700 mt-1">No binder. No curing oven. No formaldehyde. The metamaterial bonds directly to the fiber — that&apos;s why we need so little of it.</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="font-bold text-amber-900">Why their chemistry needs a binder</div>
          <div className="text-amber-800 mt-1">Silver-ion, AgCl, QAC, and zinc chemistries don&apos;t bond to fiber. They&apos;re glued on with acrylic polymer and crosslinked at 150-170°C. The glue is the only thing keeping their chemistry on the fabric — and it leaches over time.</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="font-bold text-red-800">800× more chemistry</div>
          <div className="text-red-700 mt-1">A zinc-pyrithione textile finish puts 800× more active chemistry per kg fabric than FUZE F4 — plus 15 g of polymer per kg. That&apos;s before you count the wash water it leaches into.</div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Section 2: Mechanism — leaching vs contact-kill (animated)
// ─────────────────────────────────────────────────────────────

function MechanismCompare() {
  return (
    <section id="mechanism" className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 scroll-mt-24">
      <div className="mb-5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Section 2 — Mechanism</div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">Leaching ions vs non-ionic contact-kill</h2>
        <p className="text-sm text-slate-600 mt-2 max-w-3xl">
          The animations below loop in real time. They show what physically happens to the antimicrobial across the wash life of a garment.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* LEACHING — silver-ion / AgCl / QAC / zinc */}
        <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-black text-red-800">Silver-ion / AgCl / Zinc / QAC</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Ion-release · leaches over time</span>
          </div>
          <svg viewBox="0 0 320 200" className="w-full h-auto bg-white rounded-md border border-red-200">
            {/* Fabric fiber */}
            <defs>
              <pattern id="comp-fiber" x="0" y="0" width="20" height="200" patternUnits="userSpaceOnUse">
                <line x1="10" y1="0" x2="10" y2="200" stroke="#94a3b8" strokeWidth="2" />
              </pattern>
            </defs>
            <rect x="0" y="80" width="320" height="60" fill="url(#comp-fiber)" />
            <rect x="0" y="80" width="320" height="60" fill="none" stroke="#64748b" strokeWidth="1" />
            <text x="6" y="76" fontSize="9" fill="#64748b">Treated fabric (cross-section)</text>

            {/* Ion clouds drifting up & down (loop) */}
            {[...Array(8)].map((_, i) => {
              const x = 30 + i * 36;
              const delay = (i % 4) * 0.7;
              return (
                <g key={i}>
                  {/* Ion that escapes upward into wash water */}
                  <circle r="4" fill="#dc2626" opacity="0.7">
                    <animate
                      attributeName="cy"
                      values="110;30"
                      dur="3.5s"
                      begin={`${delay}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cx"
                      values={`${x};${x + 6};${x - 4};${x}`}
                      dur="3.5s"
                      begin={`${delay}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.9;0.6;0"
                      dur="3.5s"
                      begin={`${delay}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                  {/* Ion that escapes downward */}
                  <circle r="3" fill="#ef4444" opacity="0.6">
                    <animate
                      attributeName="cy"
                      values="115;180"
                      dur="4s"
                      begin={`${delay + 0.4}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cx"
                      values={`${x};${x - 3};${x + 5};${x}`}
                      dur="4s"
                      begin={`${delay + 0.4}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.8;0.4;0"
                      dur="4s"
                      begin={`${delay + 0.4}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              );
            })}
            {/* Bacteria getting killed in the ion cloud */}
            <circle cx="80" cy="55" r="6" fill="#475569">
              <animate attributeName="opacity" values="1;1;0" dur="3.5s" begin="0.5s" repeatCount="indefinite" />
              <animate attributeName="r" values="6;7;3" dur="3.5s" begin="0.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="200" cy="60" r="6" fill="#475569">
              <animate attributeName="opacity" values="1;1;0" dur="3.5s" begin="1.8s" repeatCount="indefinite" />
              <animate attributeName="r" values="6;7;3" dur="3.5s" begin="1.8s" repeatCount="indefinite" />
            </circle>
            {/* Wash-water label */}
            <text x="6" y="20" fontSize="10" fill="#dc2626" fontWeight="700">Wash water — fills with metal ions</text>
            <text x="6" y="195" fontSize="9" fill="#dc2626">Leaches into garment + into laundry effluent</text>
          </svg>
          <ul className="mt-3 space-y-1.5 text-xs text-red-800">
            <li>• Ions detach from binder under each wash cycle</li>
            <li>• Active agent count on the fabric drops with every wash</li>
            <li>• Wash water carries silver / zinc / QAC into laundry effluent → municipal water</li>
            <li>• Efficacy ends when chemistry is depleted — and reapplication is impossible (garment is in market)</li>
          </ul>
        </div>

        {/* CONTACT-KILL — FUZE */}
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/40 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-black text-emerald-800">FUZE metamaterial</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Non-leaching · contact-kill</span>
          </div>
          <svg viewBox="0 0 320 200" className="w-full h-auto bg-white rounded-md border border-emerald-200">
            <defs>
              <pattern id="fuze-fiber" x="0" y="0" width="20" height="200" patternUnits="userSpaceOnUse">
                <line x1="10" y1="0" x2="10" y2="200" stroke="#10b981" strokeWidth="2" />
              </pattern>
            </defs>
            <rect x="0" y="80" width="320" height="60" fill="url(#fuze-fiber)" />
            <rect x="0" y="80" width="320" height="60" fill="none" stroke="#059669" strokeWidth="1" />
            {/* FUZE particles bonded into fiber — they DON'T move */}
            {[...Array(16)].map((_, i) => (
              <circle key={i} cx={20 + i * 18} cy={100 + (i % 2 === 0 ? 0 : 20)} r="2.5" fill="#059669" />
            ))}
            <text x="6" y="76" fontSize="9" fill="#059669">FUZE bonded into fiber — permanent</text>

            {/* Bacteria approach the fabric and get dismantled on contact */}
            {[
              { startX: 60, startY: 30, contactX: 70, contactY: 90, delay: 0 },
              { startX: 160, startY: 25, contactX: 170, contactY: 90, delay: 1.2 },
              { startX: 250, startY: 35, contactX: 240, contactY: 90, delay: 2.4 },
            ].map((b, i) => (
              <g key={i}>
                <circle r="6" fill="#475569">
                  <animate
                    attributeName="cx"
                    values={`${b.startX};${b.contactX};${b.contactX}`}
                    keyTimes="0;0.6;1"
                    dur="3.6s"
                    begin={`${b.delay}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cy"
                    values={`${b.startY};${b.contactY};${b.contactY}`}
                    keyTimes="0;0.6;1"
                    dur="3.6s"
                    begin={`${b.delay}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="r"
                    values="6;6;3;0"
                    keyTimes="0;0.6;0.8;1"
                    dur="3.6s"
                    begin={`${b.delay}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;1;0.6;0"
                    keyTimes="0;0.6;0.8;1"
                    dur="3.6s"
                    begin={`${b.delay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            ))}
            {/* Wash-water label — clean */}
            <text x="6" y="20" fontSize="10" fill="#059669" fontWeight="700">Wash water — stays clean</text>
            <text x="6" y="195" fontSize="9" fill="#059669">Nothing leaches. Fabric stays protected.</text>
          </svg>
          <ul className="mt-3 space-y-1.5 text-xs text-emerald-800">
            <li>• Metamaterial particles bond directly into the fiber surface</li>
            <li>• Bacteria are dismantled on physical contact with the surface</li>
            <li>• Active agent count on the fabric stays constant — no leaching</li>
            <li>• Wash water carries no metal ions out of the garment</li>
            <li>• Efficacy persists for the validated wash life of the tier</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Section 2.5: Performance Stack — F4 → F1 benefit ladder
//  (Andrew, 2026-05-04: every tier is permanent. Going up the
//  ladder doesn't add wash count — it adds STACKED FUZE benefits.
//  F4 dominates natural fibers; F3 adds active fabric performance;
//  F2 adds color & UV; F1 adds microfiber + detergent catalysis.)
// ─────────────────────────────────────────────────────────────

type StackTier = {
  id: string;
  name: string;
  dose: string;
  pillColor: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  hero: string;
  whatItAdds: string;
  benefits: { icon: string; text: string }[];
};

const STACK_TIERS: StackTier[] = [
  {
    id: "F4",
    name: "Essential Protection",
    dose: "0.25 mg/kg",
    pillColor: "from-sky-500 to-sky-600",
    cardBg: "bg-sky-50",
    cardBorder: "border-sky-200",
    textPrimary: "text-sky-900",
    hero: "Where FUZE dominates natural fibers",
    whatItAdds: "Antimicrobial baseline + cotton/cellulose dominance. No competitor approaches our performance on natural fibers at this dose.",
    benefits: [
      { icon: "🦠", text: "Permanent antimicrobial bond" },
      { icon: "👑", text: "Cotton & natural-fiber dominance — beats every silver-ion / QAC / zinc / chitosan competitor on cellulose" },
    ],
  },
  {
    id: "F3",
    name: "Core Performance",
    dose: "0.5 mg/kg",
    pillColor: "from-cyan-500 to-cyan-600",
    cardBg: "bg-cyan-50",
    cardBorder: "border-cyan-200",
    textPrimary: "text-cyan-900",
    hero: "+ Active fabric performance",
    whatItAdds: "Adds moisture wicking, faster drying, and improved evaporation on top of the F4 baseline.",
    benefits: [
      { icon: "💧", text: "Enhanced moisture wicking" },
      { icon: "🌬️", text: "Faster drying time" },
      { icon: "♨️", text: "Improved evaporation rate" },
    ],
  },
  {
    id: "F2",
    name: "Advanced Performance",
    dose: "0.75 mg/kg",
    pillColor: "from-teal-500 to-teal-600",
    cardBg: "bg-teal-50",
    cardBorder: "border-teal-200",
    textPrimary: "text-teal-900",
    hero: "+ Color hold & UV protection",
    whatItAdds: "Adds color fastness improvement and UVA/UVB fiber protection on top of the active fabric performance gains.",
    benefits: [
      { icon: "🎨", text: "Color fastness improvement" },
      { icon: "☀️", text: "UVA fiber protection" },
      { icon: "🛡️", text: "UVB fiber protection" },
    ],
  },
  {
    id: "F1",
    name: "Full Spectrum",
    dose: "1.0 mg/kg",
    pillColor: "from-emerald-500 to-emerald-600",
    cardBg: "bg-emerald-50",
    cardBorder: "border-emerald-300",
    textPrimary: "text-emerald-900",
    hero: "Full benefit stack",
    whatItAdds: "Adds microfiber shielding (reduces wash-water shedding) and catalyzes home laundry detergent chemistry — every benefit FUZE delivers, layered.",
    benefits: [
      { icon: "🧵", text: "Microfiber shielding — reduces shedding into wash water" },
      { icon: "✨", text: "Catalyzes home laundry detergent chemistry" },
    ],
  },
];

function PerformanceStack() {
  return (
    <section id="performance-stack" className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 scroll-mt-24">
      <div className="mb-5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Section 3 — Performance Stack (F1 → F4)</div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">Every tier is permanent. Each step adds a new layer of FUZE.</h2>
        <p className="text-sm text-slate-600 mt-2 max-w-3xl">
          FUZE&apos;s tier ladder isn&apos;t a wash-count ladder — it&apos;s a benefit-stack ladder. F4 dominates
          natural fibers at the lowest dose. F3 adds active fabric performance. F2 adds color & UV. F1 stacks
          microfiber shielding and detergent-chemistry catalysis on top. Each level is permanent for its rated
          wash life — no per-wash pricing, no re-application.
        </p>
      </div>

      <div className="space-y-4">
        {STACK_TIERS.map((t, i) => (
          <div key={t.id} className={`relative rounded-2xl border-2 ${t.cardBorder} ${t.cardBg} p-5`}>
            {/* Step number on the left */}
            <div className="flex items-start gap-4">
              <div className="shrink-0 flex flex-col items-center">
                <span className={`inline-flex w-12 h-12 rounded-xl bg-gradient-to-br ${t.pillColor} text-white text-base font-black items-center justify-center shadow-lg`}>
                  {t.id}
                </span>
                {i < STACK_TIERS.length - 1 && (
                  <div className="w-0.5 h-8 bg-slate-200 my-2" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <div>
                    <h3 className={`text-lg font-black ${t.textPrimary}`}>{t.id} — {t.name}</h3>
                    <div className="text-[11px] font-mono text-slate-500">{t.dose} of FUZE metamaterial</div>
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${t.textPrimary}`}>{t.hero}</span>
                </div>
                <p className={`text-sm ${t.textPrimary} mb-3`}>{t.whatItAdds}</p>
                <div className="flex flex-wrap gap-2">
                  {t.benefits.map((b, bi) => (
                    <div key={bi} className="inline-flex items-start gap-1.5 bg-white/70 border border-white rounded-lg px-2.5 py-1.5 text-[12px] text-slate-800 shadow-sm">
                      <span className="shrink-0">{b.icon}</span>
                      <span className="leading-snug">{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl bg-slate-900 text-white p-4">
        <p className="text-xs leading-relaxed">
          <strong>Read this top-down for the brand pitch:</strong> at the F4 dose where competitors aren&apos;t even
          competitive on cotton, FUZE already dominates. Stepping up the ladder doesn&apos;t buy you more washes —
          it buys you more <em>performance benefits stacked on top of the antimicrobial</em>. That&apos;s why a
          performance brand might pay for F1: not because it lasts longer, but because it ALSO does color
          fastness, UV protection, and microfiber control in the same one-time mill application.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Section 4 (was 3): The 5 tests — and which one matches the chemistry
// ─────────────────────────────────────────────────────────────

type TestCard = {
  id: string;
  name: string;
  body: string;
  designedFor: "leaching" | "non-leaching" | "qualitative" | "either";
  designedForLabel: string;
  description: string;
  fuzeFit: string;
  diagram: "stacked-layer" | "shake-flask" | "streak-plate" | "transfer";
};

const TESTS: TestCard[] = [
  {
    id: "astm-e2149",
    name: "ASTM E2149",
    body: "ASTM International (USA, 2001+)",
    designedFor: "non-leaching",
    designedForLabel: "Non-leaching, contact-kill antimicrobials",
    description: "Dynamic shake flask. The treated fabric is shaken in a buffered bacterial suspension, then surviving CFUs are counted after a defined contact period. Bacteria physically encounter the treated surface — there is no ion cloud, no leaching pathway, just direct contact.",
    fuzeFit: "This is the test designed for FUZE's mechanism. F4 Essential and F3 Core peak-perform here; F2 and F1 also pass.",
    diagram: "shake-flask",
  },
  {
    id: "aatcc-100",
    name: "AATCC 100",
    body: "AATCC (USA, 1961+)",
    designedFor: "leaching",
    designedForLabel: "Leaching antimicrobials (silver-ion, AgCl, QAC, zinc)",
    description: "Multiple fabric layers stacked around an inoculated coupon. Surviving CFUs counted after a contact period. The stacked-layer geometry works WITH leaching chemistries — released ions saturate the inter-layer space and kill bacteria there.",
    fuzeFit: "FUZE has no ion cloud (and we don't want one), so the inter-layer geometry slows our contact-kill mechanism. F2 and F1 pass at higher metamaterial density; F4/F3 perform poorly here vs E2149.",
    diagram: "stacked-layer",
  },
  {
    id: "iso-20743",
    name: "ISO 20743",
    body: "ISO (international, 2007+)",
    designedFor: "leaching",
    designedForLabel: "Leaching antimicrobials — internationalized JIS L 1902",
    description: "Three methods (Absorption / Transfer / Printing). Quantitative bacterial reduction. The standard is essentially the international version of JIS L 1902 — the same layered geometry that advantages leaching chemistries.",
    fuzeFit: "Similar geometric bias as AATCC 100. FUZE passes at higher tiers (F1/F2). For natural-fiber dominance at F4 dose, ASTM E2149 is the right test.",
    diagram: "transfer",
  },
  {
    id: "jis-l-1902",
    name: "JIS L 1902",
    body: "JISC (Japan, 1998)",
    designedFor: "leaching",
    designedForLabel: "Leaching antimicrobials (Japanese textile standard)",
    description: "Quantitative bacterial reduction test for antibacterial textiles. Three methods analogous to ISO 20743. Requires layered fabric arrangement and inoculation — same geometric bias.",
    fuzeFit: "Same as AATCC 100 / ISO 20743. Useful when a Japanese brand requires JIS validation; FUZE delivers on it at F1/F2.",
    diagram: "transfer",
  },
  {
    id: "aatcc-147",
    name: "AATCC 147",
    body: "AATCC (USA)",
    designedFor: "qualitative",
    designedForLabel: "Qualitative — diffusing / leaching chemistries only",
    description: "Parallel streak / agar diffusion test. A streak of bacteria is placed across the fabric on agar; a 'zone of inhibition' is measured around it. Like an antibiotic disc test — only chemistries that DIFFUSE off the fabric show a zone.",
    fuzeFit: "This test does not measure contact-kill antimicrobials. FUZE shows little or no zone of inhibition because we don't diffuse — we kill on contact. Don't run AATCC 147 on FUZE; it's the wrong tool.",
    diagram: "streak-plate",
  },
];

function TestDiagram({ kind }: { kind: TestCard["diagram"] }) {
  if (kind === "stacked-layer") {
    return (
      <svg viewBox="0 0 200 120" className="w-full h-auto">
        {/* 3 layers of fabric stacked */}
        {[0, 1, 2].map((i) => (
          <rect key={i} x="40" y={30 + i * 18} width="120" height="14" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
        ))}
        {/* Inoculation drop */}
        <circle cx="100" cy="55" r="4" fill="#7c3aed">
          <animate attributeName="r" values="0;4;4" dur="2s" repeatCount="indefinite" />
        </circle>
        {/* Ion cloud diffusing between layers */}
        {[40, 70, 100, 130, 160].map((x, i) => (
          <circle key={i} cx={x} cy={66} r="2" fill="#dc2626">
            <animate
              attributeName="opacity"
              values="0;0.7;0"
              dur="2.4s"
              begin={`${i * 0.3}s`}
              repeatCount="indefinite"
            />
            <animate attributeName="r" values="0;6;0" dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <text x="100" y="105" fontSize="8" fill="#475569" textAnchor="middle">Stacked-layer geometry · ion cloud fills voids</text>
      </svg>
    );
  }
  if (kind === "shake-flask") {
    return (
      <svg viewBox="0 0 200 120" className="w-full h-auto">
        {/* Erlenmeyer flask */}
        <path
          d="M 80 25 L 80 50 L 60 100 Q 60 110 70 110 L 130 110 Q 140 110 140 100 L 120 50 L 120 25 Z"
          fill="#ecfdf5"
          stroke="#059669"
          strokeWidth="1.5"
        >
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            values="-3 100 110;3 100 110;-3 100 110"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </path>
        {/* Fabric piece tumbling */}
        <rect x="85" y="80" width="30" height="20" fill="#10b981" stroke="#047857" strokeWidth="1">
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            values="0 100 90;30 100 90;-20 100 90;0 100 90"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </rect>
        {/* Bacteria getting killed */}
        {[75, 95, 115, 130].map((x, i) => (
          <circle key={i} cx={x} cy={75 + (i % 2) * 20} r="2" fill="#475569">
            <animate
              attributeName="opacity"
              values="1;1;0"
              dur="2s"
              begin={`${i * 0.4}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        <text x="100" y="22" fontSize="8" fill="#059669" textAnchor="middle">Dynamic shake · direct contact</text>
      </svg>
    );
  }
  if (kind === "streak-plate") {
    return (
      <svg viewBox="0 0 200 120" className="w-full h-auto">
        {/* Petri dish */}
        <circle cx="100" cy="60" r="50" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
        {/* Fabric square in center */}
        <rect x="80" y="40" width="40" height="40" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
        {/* Streak lines */}
        {[40, 50, 60, 70, 80].map((y) => (
          <line key={y} x1="60" y1={y} x2="140" y2={y} stroke="#7c3aed" strokeWidth="0.6" strokeDasharray="2 2" />
        ))}
        {/* Zone of inhibition (only appears for diffusing chemistries) */}
        <ellipse cx="100" cy="60" rx="30" ry="28" fill="none" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5">
          <animate attributeName="opacity" values="0;0.5;0" dur="3s" repeatCount="indefinite" />
        </ellipse>
        <text x="100" y="108" fontSize="8" fill="#475569" textAnchor="middle">Zone of inhibition · diffusion-dependent</text>
      </svg>
    );
  }
  // transfer / general layered
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto">
      <rect x="40" y="40" width="120" height="20" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
      <rect x="40" y="65" width="120" height="20" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
      <text x="100" y="20" fontSize="8" fill="#475569" textAnchor="middle">Inoculate top layer</text>
      <text x="100" y="105" fontSize="8" fill="#475569" textAnchor="middle">Count CFUs after contact period</text>
      {/* Bacteria transfer */}
      {[60, 90, 120, 140].map((x, i) => (
        <circle key={i} cx={x} cy={50} r="2" fill="#7c3aed">
          <animate
            attributeName="cy"
            values="50;75"
            dur="2.5s"
            begin={`${i * 0.4}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;0.4;0"
            dur="2.5s"
            begin={`${i * 0.4}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

function TestMethodologies() {
  return (
    <section id="testing" className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 scroll-mt-24">
      <div className="mb-5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Section 4 — The five tests</div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">Five tests on the market — only one is designed for FUZE&apos;s mechanism</h2>
        <p className="text-sm text-slate-600 mt-2 max-w-3xl">
          Most antimicrobial textile tests in widespread use were designed in the 1960s-1990s around <em>leaching</em> chemistries
          (silver-ion, AgCl, QAC, zinc). The test geometry rewards diffusion and ion-release. ASTM E2149 is the modern
          dynamic-contact test built for non-leaching, immobilized antimicrobials like FUZE.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TESTS.map((t) => {
          const isFuzeFit = t.designedFor === "non-leaching";
          return (
            <div
              key={t.id}
              className={`rounded-xl border p-4 ${
                isFuzeFit
                  ? "border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200"
                  : "border-slate-200 bg-slate-50/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className={`text-base font-black ${isFuzeFit ? "text-emerald-800" : "text-slate-900"}`}>{t.name}</div>
                  <div className="text-[11px] text-slate-500">{t.body}</div>
                </div>
                <span
                  className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isFuzeFit
                      ? "bg-emerald-600 text-white"
                      : t.designedFor === "qualitative"
                      ? "bg-slate-500 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {isFuzeFit ? "FUZE fit ✓" : t.designedFor}
                </span>
              </div>
              <div className="bg-white rounded-md p-2 border border-slate-200 mb-3">
                <TestDiagram kind={t.diagram} />
              </div>
              <div className="text-[11px] font-bold text-slate-700 mb-1">Designed for</div>
              <div className="text-xs text-slate-700 mb-2">{t.designedForLabel}</div>
              <div className="text-[11px] font-bold text-slate-700 mb-1">How it works</div>
              <p className="text-xs text-slate-700 mb-2 leading-snug">{t.description}</p>
              <div className={`text-[11px] font-bold ${isFuzeFit ? "text-emerald-800" : "text-amber-800"} mb-1`}>FUZE fit</div>
              <p className={`text-xs leading-snug ${isFuzeFit ? "text-emerald-800" : "text-slate-700"}`}>{t.fuzeFit}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 p-4 rounded-xl bg-slate-900 text-white">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">The competitive jab</div>
        <p className="text-sm leading-relaxed">
          We test on <strong>ASTM E2149</strong> because it&apos;s the test designed for non-leaching antimicrobials.
          Silvadur and Polygiene rely on AATCC 100 because it was designed around their leaching chemistry — the
          test geometry helps their ions saturate the layers. <strong>FUZE doesn&apos;t leach, by design.
          Meet us on the right test.</strong>
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Section 4: What this means for your brand
// ─────────────────────────────────────────────────────────────

function Synthesis() {
  return (
    <section className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-2xl p-6 md:p-8">
      <div className="mb-5">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Section 5 — What this means for your brand</div>
        <h2 className="text-2xl md:text-3xl font-black">Three things to walk into every supply-chain meeting with</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/10 rounded-xl p-4 border border-white/20">
          <div className="text-3xl font-black mb-1">1</div>
          <div className="text-sm font-bold mb-1">A smaller footprint on the fabric</div>
          <p className="text-xs text-emerald-50/90 leading-snug">
            FUZE F4 puts 0.25 mg of metamaterial per kg of fabric and zero binder. Silver-ion competitors put
            100 mg of silver chemistry and 15 g of acrylic binder polymer per kg, then crosslink with
            formaldehyde at 150-170°C. We deliver protection with 60,000× less total mass on the fabric than
            the competitive chemistry stack.
          </p>
        </div>
        <div className="bg-white/10 rounded-xl p-4 border border-white/20">
          <div className="text-3xl font-black mb-1">2</div>
          <div className="text-sm font-bold mb-1">Nothing leaches into wash water</div>
          <p className="text-xs text-emerald-50/90 leading-snug">
            FUZE bonds permanently to the fiber. Bacteria are dismantled on physical contact — no ion cloud, no
            metal in the laundry effluent, no contribution to municipal water-treatment burden. Brands citing
            FUZE in their ESG reports can defend zero-leaching with documented testing.
          </p>
        </div>
        <div className="bg-white/10 rounded-xl p-4 border border-white/20">
          <div className="text-3xl font-black mb-1">3</div>
          <div className="text-sm font-bold mb-1">Validated by the right test</div>
          <p className="text-xs text-emerald-50/90 leading-snug">
            FUZE peak-performs on ASTM E2149 — the dynamic-contact test designed for non-leaching antimicrobials.
            We share the third-party reports for your selected tier with you on request. Competitors rely on
            AATCC 100, the layered ion-release test built around their leaching chemistry — and don&apos;t publish
            their AATCC 100 reports.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/pricing"
          className="inline-flex items-center px-4 py-2.5 rounded-lg bg-white text-emerald-800 text-sm font-bold hover:bg-emerald-50 shadow"
        >
          See cost vs a specific competitor
        </Link>
        <Link
          href="/sustainability"
          className="inline-flex items-center px-4 py-2.5 rounded-lg bg-emerald-900/40 text-white text-sm font-bold hover:bg-emerald-900/60 border border-white/20"
        >
          See sustainability impact
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Page shell
// ─────────────────────────────────────────────────────────────

export default function EducationPage() {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Page header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">FUZE Basics</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">How FUZE actually works — and why it&apos;s different</h1>
        <p className="mt-3 text-sm md:text-base text-slate-300 max-w-3xl">
          A four-section primer on what FUZE puts on a fabric, how it kills bacteria, which tests measure it correctly,
          and what that means when a brand is choosing between us and a silver-ion / zinc / QAC competitor.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">For brands</span>
          <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">For factories</span>
          <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">For distributors</span>
          <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">For sales reps</span>
        </div>
      </div>

      <SegmentPicker />
      <DosageHero />
      <MechanismCompare />
      <PerformanceStack />
      <TestMethodologies />
      <Synthesis />
    </div>
  );
}
