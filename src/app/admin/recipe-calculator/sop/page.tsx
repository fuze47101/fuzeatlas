// @ts-nocheck
"use client";

/**
 * FUZE Lab — Bench Test SOP (printable)
 *
 * Standard Operating Procedure for conducting a bench test with the
 * FUZE lab mini pad bath (4 bar). Print-optimized — fits on a single
 * letter/A4 page when set to Save as PDF.
 */
export default function RecipeSOPPage() {
  return (
    <div className="min-h-screen bg-white p-8 print:p-0">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          @page { margin: 0.5in; }
        }
      `}</style>

      {/* Print control (hidden on print) */}
      <div className="no-print max-w-4xl mx-auto mb-4 flex items-center justify-between">
        <a href="/admin/recipe-calculator" className="text-sm text-[#00b4c3] font-semibold">← Back to calculator</a>
        <button onClick={() => window.print()} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800">
          🖨 Print / Save as PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white print:max-w-none">
        {/* Header */}
        <header className="border-b-4 border-[#00b4c3] pb-4 mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-[#00b4c3] tracking-widest uppercase">FUZE Biotech · Lab SOP</p>
            <h1 className="text-3xl font-black text-slate-900 mt-1">Bench Test Procedure</h1>
            <p className="text-sm text-slate-600 mt-1">FUZE Recipe Calculator — Pad-Dry-Cure Pickup Rate & Dilution</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Doc: SOP-FUZE-LAB-001</p>
            <p>Rev: 1.0 · {new Date().toLocaleDateString()}</p>
          </div>
        </header>

        {/* Purpose + Equipment */}
        <section className="mb-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <h2 className="font-black text-slate-900 mb-1 text-sm uppercase tracking-wide">Purpose</h2>
            <p className="text-slate-700 leading-snug">
              Determine the pad pickup rate of a fabric sample and compute the
              correct FUZE bath concentration and dilution for each of the four
              treatment tiers (F1 / F2 / F3 / F4).
            </p>
          </div>
          <div>
            <h2 className="font-black text-slate-900 mb-1 text-sm uppercase tracking-wide">Equipment</h2>
            <ul className="text-slate-700 leading-snug list-disc pl-4">
              <li>FUZE mini pad bath (HTAI P-B0) — <strong>4 bar squeeze (0.4 MPa)</strong>, 41 cm roller circumference</li>
              <li>VFD calibration: <strong>m/min ≈ Hz × 0.295</strong>, e.g. 10 Hz = ~3.0 m/min, 20 Hz = ~5.9 m/min</li>
              <li>100 cm² fabric cutter · Analytical balance (0.01 g)</li>
              <li>Analytical balance (0.01 g precision or better)</li>
              <li>Clean deionized water</li>
              <li>Fabric sample (10 × 10 cm recommended)</li>
              <li>Disposable tongs / gloves</li>
            </ul>
          </div>
        </section>

        {/* Key chemistry callout */}
        <section className="mb-5 bg-slate-50 border-l-4 border-[#00b4c3] px-4 py-3 text-xs">
          <h2 className="font-black text-slate-900 mb-1 uppercase tracking-wide">FUZE Chemistry Reference</h2>
          <div className="grid grid-cols-4 gap-2">
            <div><strong>Stock concentration</strong><br />30 mg/L metamaterial</div>
            <div><strong>F1</strong>: 1.0 mg/kg OWF<br />(max performance)</div>
            <div><strong>F2</strong>: 0.75 mg/kg OWF<br /><strong>F3</strong>: 0.5 mg/kg OWF</div>
            <div><strong>F4</strong>: 0.25 mg/kg OWF<br />(light performance)</div>
          </div>
        </section>

        {/* Critical protocol rules */}
        <section className="mb-5 bg-amber-50 border-l-4 border-amber-500 px-4 py-3 text-xs">
          <h2 className="font-black text-slate-900 mb-2 uppercase tracking-wide">⚠ Critical Protocol Rules</h2>
          <ol className="space-y-1 pl-5 list-decimal text-slate-700">
            <li><strong>Single pass, 4 bar, weigh within 10 seconds.</strong> Do NOT re-pad to lower the wet weight — that measures squeezer over-squeeze, not pickup.</li>
            <li><strong>Squeezer consistency check:</strong> if a 2nd pass drops mass by more than 5%, flag the squeezer — it isn't at equilibrium on the first pass.</li>
            <li><strong>Run each fabric in triplicate</strong> (3 separate samples), record each run's pickup, report the mean. Flag the batch if any run deviates &gt;10% from the mean.</li>
            <li><strong>Dry-to-wet vs wet-to-wet:</strong> dry-to-wet is the lab default. Wet-to-wet requires a fresh sample, pre-wetted with <em>water only</em> and padded first, THEN dipped into the treatment bath. Net pickup = (W_final − W_prewet) / W_dry × 100.</li>
            <li><strong>Temperature:</strong> bath and fabric conditioned to 20–25 °C before weighing. Cold fabric ≠ ambient pickup.</li>
            <li><strong>Weigh fast:</strong> every 10 seconds of delay after padding, water evaporates and your pickup reading drops.</li>
          </ol>
        </section>

        {/* Procedure */}
        <section className="mb-5">
          <h2 className="font-black text-slate-900 mb-3 text-sm uppercase tracking-wide">Procedure</h2>
          <ol className="space-y-3 text-sm">
            {[
              {
                t: "Prepare the sample",
                d: "Cut a clean fabric sample (≈10×10 cm). Condition at ambient lab temperature for at least 5 minutes. Record fabric ID, type, fiber content, and measured weight in g/m².",
              },
              {
                t: "Weigh the dry sample",
                d: "Place on the analytical balance. Record weight to 0.01 g. This is the Dry Sample Weight (W_dry).",
              },
              {
                t: "Dip in clean water",
                d: "Fully submerge the sample in clean DI water for 10 seconds. Allow excess water to drain for 3 seconds from one corner.",
              },
              {
                t: "Pad at 4 bar",
                d: "Feed the sample through the mini pad bath at 4 bar pressure. Do not repeat-pad.",
              },
              {
                t: "Weigh immediately",
                d: "Weigh within 10 seconds of padding to minimize evaporation. Record this as the Wet Weight After Pad (W_wet).",
              },
              {
                t: "Enter values in the calculator",
                d: "Open /admin/recipe-calculator. Enter fabric details, set method = Pad-Dry-Cure, squeeze pressure = 4 bar. Enter W_dry and W_wet. The calculator computes pickup %, bath concentration, and dilution for F1–F4 live.",
              },
              {
                t: "(Optional) Wet-to-wet run",
                d: "If the fabric will be treated wet-on-wet in production: pre-wet a fresh sample, weigh (W_preWet), dip-and-pad, weigh again (W_wet2). Enter both in the optional wet-to-wet fields.",
              },
              {
                t: "Review sanity warnings",
                d: "Check the yellow/red banners. Fix any errors (impossible numbers) and verify warnings (unusual pickup, pressure, etc.) before saving.",
              },
              {
                t: "(Optional) Scale to production",
                d: "Enter target fabric mass (kg). The calculator shows total FUZE liters needed per tier and total bath volume for the run.",
              },
              {
                t: "Save the bench test",
                d: "Click Save Bench Test. The record is stamped with a FUZE-BT-YYYYMMDD-XXXX number.",
              },
              {
                t: "Graduate or print",
                d: "From the Recent Bench Tests table: Print Test Card for the bench, or Graduate to publish F1/F2/F3/F4 FabricRecipes to the factory recipe library.",
              },
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#00b4c3] text-white text-xs font-black flex items-center justify-center">{i + 1}</span>
                <div>
                  <p className="font-bold text-slate-900">{step.t}</p>
                  <p className="text-slate-700 text-xs leading-snug">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Formulas reference card */}
        <section className="mb-4 border border-slate-300 rounded p-3 text-xs bg-slate-50">
          <h2 className="font-black text-slate-900 mb-2 uppercase tracking-wide">Formulas (for QC cross-check)</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono">
            <span>Pickup % (dry-to-wet)</span>
            <span>= (W_wet − W_dry) / W_dry × 100</span>
            <span>Pickup % (wet-to-wet)</span>
            <span>= (W_wet2 − W_preWet) / W_dry × 100</span>
            <span>Bath concentration (mg/L)</span>
            <span>= tier_mg_per_kg / (pickup/100)</span>
            <span>Dilution ratio</span>
            <span>= 1 : (stock/bath_conc − 1)</span>
            <span>FUZE mL / L bath</span>
            <span>= (bath_conc / stock) × 1000</span>
            <span>FUZE L for run</span>
            <span>= (fabric_kg × tier_mg_per_kg) / stock</span>
          </div>
        </section>

        {/* Acceptance criteria */}
        <section className="mb-4 text-xs">
          <h2 className="font-black text-slate-900 mb-1 uppercase tracking-wide">Sanity Check Ranges</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-slate-700">
            <span>Pickup for woven pad</span><span>50–80 %</span>
            <span>Pickup for knit pad</span><span>60–100 %</span>
            <span>Pickup for nonwoven</span><span>can exceed 120 %</span>
            <span>Squeeze pressure (mini pad)</span><span>4 bar (standard)</span>
            <span>Stock concentration</span><span>30 mg/L (verify each lot)</span>
          </div>
        </section>

        <footer className="mt-6 pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>FUZE Biotech · 1895 West 2100 South, Salt Lake City, UT 84119 USA</span>
          <span>Questions: andrew@fuze47.com</span>
        </footer>
      </div>
    </div>
  );
}
