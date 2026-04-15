// @ts-nocheck
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Full FUZE Recipe Report — the polished, factory-facing version of
 * a bench test. Meant to print to 2 pages (letter/A4), hand to a
 * factory or brand. Save-as-PDF from the browser.
 */

const TIER_MG_PER_KG: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };
const STANDARD_BATHS_L = [50, 100, 200, 300, 400];

function fuzeLitersForBath(bathL: number, pickupPct: number, mgPerKg: number, stock: number) {
  if (!pickupPct || !bathL) return 0;
  return (mgPerKg / (pickupPct / 100) * bathL) / stock;
}

export default function RecipeReportPage() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetch(`/api/admin/recipe-bench-tests/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (d.ok) setTest(d.test);
        else setError(d.error || `HTTP ${r.status}`);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-10 text-slate-500">Loading bench test {id}…</div>;
  if (!test) return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-2">Bench test not loaded</h1>
      <p className="text-sm text-slate-600">ID: <code>{id}</code></p>
      {error && <p className="text-sm text-red-700 mt-2">Error: {error}</p>}
      <a href="/admin/recipe-calculator" className="inline-block mt-4 text-[#00b4c3] font-semibold">← Back to calculator</a>
    </div>
  );

  const pickupUsed = test.pickupWetToWetPct ?? test.pickupDryToWetPct;
  const stock = test.stockMgPerL || 30;
  const fmt = (n: any, p = 2) => (n === null || n === undefined ? "—" : Number(n).toFixed(p));
  const runs = Array.isArray(test.sampleRuns) ? test.sampleRuns : [];

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          @page { margin: 0.4in; size: letter; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div className="no-print max-w-4xl mx-auto px-6 pt-6 flex items-center justify-between">
        <a href="/admin/recipe-calculator" className="text-sm text-[#00b4c3] font-semibold">← Back</a>
        <button onClick={() => window.print()} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800">
          🖨 Print / Save as PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6 print:p-0">
        {/* COVER HEADER */}
        <header className="mb-6 pb-5 border-b-4 border-[#00b4c3]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-full bg-[#00b4c3] text-white flex items-center justify-center font-black text-xl">F</div>
                <div>
                  <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase">FUZE Biotech · Recipe Report</p>
                  <p className="text-sm text-slate-500">Antimicrobial textile treatment</p>
                </div>
              </div>
              <h1 className="text-3xl font-black text-slate-900 mt-3">Bench Test <span className="font-mono">{test.testNumber}</span></h1>
              <p className="text-sm text-slate-600 mt-1">Prepared {new Date(test.testDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · FUZE Lab · Salt Lake City, UT</p>
            </div>
            <div className="text-right">
              {test.qcPassed ? (
                <span className="inline-block px-3 py-1 text-sm font-bold bg-emerald-100 text-emerald-800 rounded-full">✓ QC Passed</span>
              ) : (
                <span className="inline-block px-3 py-1 text-sm font-bold bg-red-100 text-red-800 rounded-full">⚠ QC Failed</span>
              )}
              {test.graduatedRecipeId && <p className="text-xs text-amber-700 mt-1">⭐ Graduated to FabricRecipe</p>}
            </div>
          </div>
        </header>

        {/* EXECUTIVE SUMMARY */}
        <section className="mb-6 p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl text-white">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#00b4c3] mb-2">Executive Summary</p>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-white/60">Fabric</p>
              <p className="font-bold text-lg">{test.fabric?.fuzeNumber || test.fabricLabel}</p>
              <p className="text-xs text-white/70">{test.fabricType}{test.fabricWeightGsm ? ` · ${test.fabricWeightGsm} g/m²` : ""}</p>
              <p className="text-xs text-white/70">{test.fiberContent || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Method</p>
              <p className="font-bold text-lg">{test.applicationMethod.replace(/_/g, "-")}</p>
              <p className="text-xs text-white/70">{test.squeezePressure ? `${test.squeezePressure} bar` : "—"}{test.vfdFrequencyHz ? ` · ${test.vfdFrequencyHz} Hz · ${(test.vfdFrequencyHz * 0.295).toFixed(2)} m/min` : ""}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Measured pickup</p>
              <p className="font-black text-3xl text-[#00b4c3]">{fmt(pickupUsed, 1)}%</p>
              <p className="text-xs text-white/70">{test.pickupWetToWetPct ? "wet-to-wet basis" : "dry-to-wet basis"}</p>
            </div>
          </div>
        </section>

        {/* FOUR-TIER RECIPE */}
        <section className="mb-6">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">Four-tier Bath Recipe</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { tier: "F1", mg: 1.0, perf: "Maximum" },
              { tier: "F2", mg: 0.75, perf: "High" },
              { tier: "F3", mg: 0.5, perf: "Standard" },
              { tier: "F4", mg: 0.25, perf: "Light" },
            ].map((t) => {
              const bath = (test as any)[`${t.tier.toLowerCase()}BathMgPerL`];
              const ml = (test as any)[`${t.tier.toLowerCase()}FuzeMlPerLBath`];
              const ratio = (test as any)[`${t.tier.toLowerCase()}DilutionRatio`];
              return (
                <div key={t.tier} className="border-2 border-[#00b4c3] rounded-lg overflow-hidden">
                  <div className="bg-[#00b4c3] text-white p-2 text-center">
                    <p className="font-black text-2xl">{t.tier}</p>
                    <p className="text-[10px] uppercase tracking-wide opacity-90">{t.perf}</p>
                    <p className="text-[10px] opacity-75">{t.mg} mg/kg OWF</p>
                  </div>
                  <div className="p-3 text-xs space-y-2">
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase">Bath concentration</p>
                      <p className="font-mono font-bold">{fmt(bath, 2)} mg/L</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase">Per liter of bath</p>
                      <p className="font-mono font-bold">{fmt(ml, 1)} mL FUZE</p>
                      <p className="font-mono text-slate-500">≈ {fmt(ml, 1)} g</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase">Dilution ratio</p>
                      <p className="font-mono font-bold">1 : {fmt(ratio, 1)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* BATH VOLUME QUICK-REFERENCE */}
        {pickupUsed && (
          <section className="mb-6">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">Production Bath Cookbook</h2>
            <div className="border-2 border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs uppercase text-slate-600">Bath Volume</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F1 (mL / g)</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F2 (mL / g)</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F3 (mL / g)</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F4 (mL / g)</th>
                  </tr>
                </thead>
                <tbody>
                  {STANDARD_BATHS_L.map((bathL) => (
                    <tr key={bathL} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-mono font-bold">{bathL} L</td>
                      {[1.0, 0.75, 0.5, 0.25].map((mg, i) => {
                        const l = fuzeLitersForBath(bathL, pickupUsed, mg, stock);
                        const mL = l * 1000;
                        const g = mL; // water-based FUZE ≈ 1 g/mL
                        return (
                          <td key={i} className="px-3 py-2 text-right font-mono text-[#00b4c3] font-bold">
                            {mL >= 1000 ? (mL / 1000).toFixed(2) + " L" : Math.round(mL) + " mL"}
                            <span className="text-slate-500 text-[10px]"> · {g >= 1000 ? (g / 1000).toFixed(2) + " kg" : Math.round(g) + " g"}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">Pickup {fmt(pickupUsed, 1)}% · Stock FUZE {stock} mg/L · Top up to the bath volume with DI water. Values are per tier for the complete bath.</p>
          </section>
        )}

        {/* PAGE BREAK */}
        <div className="page-break" />

        {/* MEASUREMENTS */}
        <section className="mb-6">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">Measurements</h2>

          {runs.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">Triplicate sample runs</p>
              <table className="w-full text-sm border border-slate-200 rounded overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-xs">Run</th>
                    <th className="text-right px-3 py-1.5 text-xs">Dry (g)</th>
                    <th className="text-right px-3 py-1.5 text-xs">Wet after pad (g)</th>
                    <th className="text-right px-3 py-1.5 text-xs">Pickup %</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r: any) => (
                    <tr key={r.run} className="border-t border-slate-200">
                      <td className="px-3 py-1.5 font-semibold">#{r.run}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt(r.dry, 3)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt(r.wet, 3)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold">{fmt(r.pickup, 1)}%</td>
                    </tr>
                  ))}
                  <tr className="bg-cyan-50 border-t-2 border-[#00b4c3]">
                    <td className="px-3 py-1.5 font-black">Mean</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">{fmt(test.drySampleWeight, 3)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">{fmt(test.wetAfterBathWeight, 3)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-black text-[#00b4c3]">{fmt(test.pickupDryToWetPct, 1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {test.pickupWetToWetPct && (
            <div className="grid grid-cols-3 gap-3 text-xs mb-2">
              <div className="border border-slate-200 rounded p-2">
                <p className="text-slate-500">Pre-wet weight (water only)</p>
                <p className="font-mono font-bold">{fmt(test.preWetSampleWeight, 3)} g</p>
              </div>
              <div className="border border-slate-200 rounded p-2">
                <p className="text-slate-500">Wet after treatment pad</p>
                <p className="font-mono font-bold">{fmt(test.wetAfterBathFromPreWet, 3)} g</p>
              </div>
              <div className="border border-[#00b4c3] bg-cyan-50 rounded p-2">
                <p className="text-slate-500">Wet-to-wet pickup</p>
                <p className="font-mono font-black text-[#00b4c3]">{fmt(test.pickupWetToWetPct, 1)}%</p>
              </div>
            </div>
          )}
        </section>

        {/* PROCESS PARAMETERS */}
        <section className="mb-6">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">Process Parameters</h2>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">Sample area</td><td className="py-1.5 text-right font-mono">{test.sampleAreaCm2 || 100} cm²</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">Squeeze pressure</td><td className="py-1.5 text-right font-mono">{test.squeezePressure} bar ({(test.squeezePressure * 0.1).toFixed(2)} MPa)</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">VFD frequency</td><td className="py-1.5 text-right font-mono">{test.vfdFrequencyHz || "—"} Hz</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">Line speed</td><td className="py-1.5 text-right font-mono">{fmt(test.lineSpeedMPerMin, 2)} m/min</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">Drying</td><td className="py-1.5 text-right font-mono">{test.dryingTemp ? `${test.dryingTemp}°C × ${test.dryingTime || "—"} min` : "—"}</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">Curing</td><td className="py-1.5 text-right font-mono">{test.curingTemp ? `${test.curingTemp}°C × ${test.curingTime || "—"} min` : "—"}</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">FUZE stock</td><td className="py-1.5 text-right font-mono">{stock} mg/L</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">Liquor ratio (exhaust)</td><td className="py-1.5 text-right font-mono">{test.liquorRatio || "—"}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* TEST BATH + ICP */}
        {test.testedAtTier && (
          <section className="mb-6">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">Bench Test Bath + ICP Validation</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-[#00b4c3] rounded p-3 text-xs">
                <p className="text-slate-500 uppercase text-[10px] mb-1">Test bath applied</p>
                <p className="font-bold text-slate-900">Tier {test.testedAtTier} · {fmt(test.testBathVolumeL, 2)} L reservoir</p>
                <p className="font-mono mt-1">FUZE stock: <strong>{fmt(test.testBathFuzeMl, 1)} mL</strong> · Water: <strong>{fmt(test.testBathWaterMl, 0)} mL</strong></p>
              </div>
              <div className="border border-slate-300 rounded p-3 text-xs">
                <p className="text-slate-500 uppercase text-[10px] mb-1">ICP verification</p>
                <p className="font-mono"><span className="text-slate-500">Expected:</span> <strong>{fmt(test.icpExpectedPpm, 0)} ppm Ag</strong></p>
                {test.icpMeasuredPpm ? (
                  <>
                    <p className="font-mono"><span className="text-slate-500">Measured:</span> <strong className="text-[#00b4c3]">{fmt(test.icpMeasuredPpm, 1)} ppm</strong></p>
                    {test.affinityPct && <p className="font-mono"><span className="text-slate-500">Affinity:</span> <strong className={test.affinityPct >= 90 && test.affinityPct <= 110 ? "text-emerald-700" : "text-amber-700"}>{fmt(test.affinityPct, 1)}%</strong></p>}
                  </>
                ) : (
                  <p className="text-amber-700 italic mt-0.5">Result pending</p>
                )}
                {test.icpLab && <p className="text-[10px] text-slate-500 mt-1">{test.icpLab}{test.icpSampleId ? ` · ${test.icpSampleId}` : ""}</p>}
              </div>
            </div>
          </section>
        )}

        {/* METHODOLOGY */}
        <section className="mb-6 p-4 bg-slate-50 border-l-4 border-[#00b4c3] text-xs">
          <h2 className="font-black text-slate-900 uppercase tracking-wide mb-2">Methodology</h2>
          <p className="text-slate-700">
            Pickup rate measured per <strong>AATCC / ASTM</strong> pad application method on the FUZE lab <strong>vertical padder</strong> (HTAI P-B0, 41 cm roller circumference) — fabric passes upward through a bath held in the reservoir between two pads pressed at 4 bar. Samples cut at 100 cm² on a FUZE cutter, conditioned at 20–25 °C. Dry-to-wet run: dry sample submerged in clean DI water 10 s, drained 3 s, padded at {test.squeezePressure} bar / {test.vfdFrequencyHz} Hz (single pass), weighed within 10 s. Measurements performed in triplicate; reported pickup is the arithmetic mean. Bench test bath prepared at the target tier concentration from 30 mg/L FUZE stock and pad-applied through the same reservoir for ICP verification. Dilution recipe derived from pickup mean using FUZE stock concentration {stock} mg/L and tier OWF targets (F1 1.0 mg/kg · F2 0.75 mg/kg · F3 0.5 mg/kg · F4 0.25 mg/kg).
          </p>
        </section>

        {/* NOTES + SIGNATURE */}
        {test.notes && (
          <section className="mb-4 text-sm">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">Lab Notes</h2>
            <p className="text-slate-700 italic border-l-4 border-slate-200 pl-3">{test.notes}</p>
          </section>
        )}

        <footer className="pt-4 mt-6 border-t-2 border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>FUZE Biotech · 1895 West 2100 South · Salt Lake City, UT 84119 USA · andrew@fuze47.com</span>
          <span>Report generated {new Date().toLocaleString()}</span>
        </footer>
      </div>
    </div>
  );
}
