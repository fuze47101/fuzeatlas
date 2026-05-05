/**
 * /education/story — The FUZE Story / Origin
 *
 * Andrew (2026-05-04, expert-marketer note): brands DO NOT KNOW we
 * upcycle e-waste into antimicrobial. Multi-million-dollar ESG
 * narrative sitting unused. This page is the consumer-facing version
 * of how FUZE is actually made.
 */

import Link from "next/link";

export const metadata = {
  title: "The FUZE Story",
};

export default function FuzeStoryPage() {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8">
        <Link href="/education" className="text-xs text-emerald-300 hover:text-emerald-200">← Back to FUZE Basics</Link>
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mt-2 mb-1">The FUZE Story</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">From recycled electronics to permanent antimicrobial</h1>
        <p className="mt-3 text-sm md:text-base text-slate-300 max-w-3xl">
          FUZE metamaterial is produced via <strong>liquid laser ablation</strong>: a 30-amp laser, a 1m² production
          table, and a feedstock of recycled electronics. The entire production cell can be powered by solar.
          We&apos;re not just antimicrobial — we&apos;re an e-waste upcycling operation that ends in your fabric.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-3xl mb-2">♻️</div>
          <h2 className="text-base font-black text-slate-900 mb-1">Recycled feedstock</h2>
          <p className="text-sm text-slate-600 leading-snug">
            Every gram of FUZE active agent originates from elemental precious metal recovered from end-of-life
            electronics. We don&apos;t mine. We don&apos;t refine virgin material. We pull metal that would
            otherwise sit in a landfill or get incinerated.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-3xl mb-2">⚡</div>
          <h2 className="text-base font-black text-slate-900 mb-1">Liquid laser ablation</h2>
          <p className="text-sm text-slate-600 leading-snug">
            A 30-amp laser pulse vaporizes the metal feedstock submerged in 99.998% ultrapure 18-megaohm DI water.
            What condenses out is FUZE metamaterial — a high-density elemental allotrope, 20 ppm in the delivered
            stock concentration. No solvents. No precursor chemistry. No surfactants.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-3xl mb-2">☀️</div>
          <h2 className="text-base font-black text-slate-900 mb-1">Solar-capable production</h2>
          <p className="text-sm text-slate-600 leading-snug">
            The 1m² production cell runs on roughly the electricity a residential solar array produces in a sunny
            day. Brands committing to FUZE are committing to an antimicrobial supply chain that can be net-zero
            at the production step — something no silver-ion / zinc / QAC competitor can claim.
          </p>
        </div>
      </section>

      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
        <h2 className="text-xl font-black text-emerald-900 mb-3">What this means in your ESG report</h2>
        <ul className="space-y-2 text-sm text-emerald-800">
          <li>✓ <strong>Circular feedstock claim</strong> — FUZE is produced from end-of-life electronics, supporting your circular-economy commitments.</li>
          <li>✓ <strong>Net-zero-capable production</strong> — the production cell is solar-compatible. Pair with renewable supply contracts and the antimicrobial step contributes zero scope-2 emissions.</li>
          <li>✓ <strong>Zero virgin-mining contribution</strong> — no coordination required with conflict-mineral or mining-derived supply chains.</li>
          <li>✓ <strong>PFAS-free, formaldehyde-free, binder-free, curing-oven-free</strong> — every petrochemical input that competitors require, FUZE eliminates.</li>
          <li>✓ <strong>Documented water cleanliness</strong> — FUZE leaches nothing into wash water. Your downstream contribution to municipal water treatment burden = 0.</li>
        </ul>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-xl font-black text-slate-900 mb-3">A different kind of antimicrobial company</h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Most antimicrobial textile companies are chemical companies. They blend, dilute, formulate, and ship
          drums of synthesized chemistry to mills. We&apos;re a materials-science operation: we ablate metal in
          water and ship the result. The simplicity is the differentiator. Less chemistry on the fabric. Less
          chemistry in the wash water. Less chemistry in the production line. Less chemistry in your ESG report.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/education" className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">Back to FUZE Basics</Link>
        <Link href="/sustainability" className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">See sustainability impact</Link>
      </div>
    </div>
  );
}
