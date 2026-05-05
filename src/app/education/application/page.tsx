/**
 * /education/application — Application Methods
 *
 * Andrew (2026-05-04, expert-marketer note): "Will I need new equipment?" is
 * the #1 unspoken factory question. This page answers it. Three methods,
 * standard finishing equipment, no curing oven required for F4.
 */

import Link from "next/link";

export const metadata = {
  title: "Application Methods",
};

const METHODS = [
  {
    id: "exhaust",
    name: "Exhaust (dyebath)",
    icon: "🛁",
    description:
      "Add FUZE to the dyebath. The metamaterial bonds during the existing dye exhaust process. No new tank, no new vessel, no new line.",
    whenToUse: "Best for high-volume continuous dyeing. The metamaterial integrates with the dye-fixation step.",
  },
  {
    id: "pdc",
    name: "Pad-Dry-Cure",
    icon: "🧻",
    description:
      "Run the fabric through a standard padder loaded with diluted FUZE bath. Squeeze, dry, cure as you normally would. Cure temperature 150-170°C.",
    whenToUse: "Most common application path. Compatible with every textile finishing line in operation today.",
  },
  {
    id: "spray",
    name: "Spray (head-spaced)",
    icon: "🌫️",
    description:
      "6-inch head spacing, 15 m/min line speed. Atomizes diluted FUZE onto the fabric surface, then dry/cure. Ideal for finished garments or non-woven substrates.",
    whenToUse: "Garments already cut/sewn, or specialty substrates where exhaust/PDC don't apply.",
  },
];

export default function ApplicationPage() {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8">
        <Link href="/education" className="text-xs text-emerald-300 hover:text-emerald-200">← Back to FUZE Basics</Link>
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mt-2 mb-1">Application Methods</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">FUZE works in your existing finishing line</h1>
        <p className="mt-3 text-sm md:text-base text-slate-300 max-w-3xl">
          You don&apos;t need a new tank, a new oven, or a new piece of equipment to apply FUZE. Three application
          paths cover every textile production setup in operation today. F4 Essential Protection requires no curing
          oven at all on many substrates.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {METHODS.map((m) => (
          <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="text-3xl mb-2">{m.icon}</div>
            <h2 className="text-base font-black text-slate-900 mb-1">{m.name}</h2>
            <p className="text-sm text-slate-700 mb-3 leading-snug">{m.description}</p>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">When to use</div>
            <p className="text-xs text-slate-600 leading-snug">{m.whenToUse}</p>
          </div>
        ))}
      </section>

      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
        <h2 className="text-xl font-black text-emerald-900 mb-3">Why this matters to a factory operator</h2>
        <ul className="space-y-2 text-sm text-emerald-800">
          <li>✓ <strong>No new capital equipment.</strong> FUZE drops into your existing pad/dye/spray line.</li>
          <li>✓ <strong>No binder, no crosslinker, no formaldehyde.</strong> Less inventory to manage, no carcinogenic-substance handling protocols.</li>
          <li>✓ <strong>No curing-oven dependency at F4.</strong> Lower-tier applications can air-dry; F1-F3 use 150-170°C, the same range as standard PDC finishing.</li>
          <li>✓ <strong>No shelf life on stored FUZE.</strong> Drums and carboys can sit in your finishing room indefinitely without degrading.</li>
          <li>✓ <strong>Standard 19L carboy is the smallest order unit.</strong> Order custom volumes (47L, 285L, 1300L) when you need an exact match.</li>
        </ul>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-xl font-black text-slate-900 mb-3">Run your numbers</h2>
        <p className="text-sm text-slate-700 mb-4">
          The application calculator computes exact FUZE volume needed per square meter of fabric at your tier of choice.
          Plug in fabric weight (gsm), width, and target tier — get back liters of FUZE bath, mL of stock concentrate, and
          dollars per linear meter.
        </p>
        <Link
          href="/pricing/calculator"
          className="inline-flex items-center px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
        >
          Open the application calculator →
        </Link>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/education" className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">Back to FUZE Basics</Link>
        <Link href="/pricing" className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">See pricing & tiers</Link>
      </div>
    </div>
  );
}
