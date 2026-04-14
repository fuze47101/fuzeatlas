// @ts-nocheck
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Printable bench test card — single page, optimized for lab bench
 * posting. "Save as PDF" via browser print.
 */
export default function PrintTestCardPage() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/recipe-bench-tests/${id}`)
      .then((r) => r.json())
      .then((d) => setTest(d.test))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-10 text-slate-500">Loading...</div>;
  if (!test) return <div className="p-10 text-slate-500">Not found</div>;

  const pickupUsed = test.pickupWetToWetPct ?? test.pickupDryToWetPct;
  const fmt = (n: any, p = 2) => (n === null || n === undefined ? "—" : Number(n).toFixed(p));

  return (
    <div className="min-h-screen bg-white p-6 print:p-0">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          @page { margin: 0.4in; }
        }
      `}</style>

      <div className="no-print max-w-4xl mx-auto mb-4 flex items-center justify-between">
        <a href="/admin/recipe-calculator" className="text-sm text-[#00b4c3] font-semibold">← Back</a>
        <button onClick={() => window.print()} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800">
          🖨 Print / Save as PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white">
        {/* Header */}
        <header className="border-b-4 border-[#00b4c3] pb-3 mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-[#00b4c3] tracking-widest uppercase">FUZE Bench Test</p>
            <h1 className="text-3xl font-black font-mono text-slate-900 mt-1">{test.testNumber}</h1>
            <p className="text-sm text-slate-600">{new Date(test.testDate).toLocaleString()}</p>
          </div>
          <div className="text-right">
            {test.qcPassed ? (
              <span className="inline-block px-3 py-1 text-sm font-bold bg-emerald-100 text-emerald-800 rounded-full">✓ QC Passed</span>
            ) : (
              <span className="inline-block px-3 py-1 text-sm font-bold bg-red-100 text-red-800 rounded-full">⚠ QC Failed</span>
            )}
            {test.graduatedRecipeId && (
              <p className="text-xs text-slate-500 mt-1">⭐ Graduated to FabricRecipe</p>
            )}
          </div>
        </header>

        {/* Fabric + Method */}
        <section className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="border border-slate-200 rounded p-3">
            <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-2">Fabric</h2>
            <p className="font-bold text-slate-900">{test.fabric?.fuzeNumber || test.fabricLabel}</p>
            {test.fabric?.name && <p className="text-xs text-slate-600">{test.fabric.name}</p>}
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-xs text-slate-700">
              <span>Type</span><span>{test.fabricType || "—"}</span>
              <span>Fiber</span><span>{test.fiberContent || "—"}</span>
              <span>Weight</span><span>{test.fabricWeightGsm ? `${test.fabricWeightGsm} g/m²` : "—"}</span>
            </div>
          </div>
          <div className="border border-slate-200 rounded p-3">
            <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-2">Method</h2>
            <p className="font-bold text-slate-900">{test.applicationMethod.replace(/_/g, "-")}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-xs text-slate-700">
              <span>Squeeze pressure</span><span>{test.squeezePressure ? `${test.squeezePressure} bar` : "—"}</span>
              {test.vfdFrequencyHz && (
                <>
                  <span>VFD frequency</span><span>{test.vfdFrequencyHz} Hz</span>
                  <span>Line speed</span><span>{fmt(test.lineSpeedMPerMin ?? test.vfdFrequencyHz * 0.295, 2)} m/min</span>
                </>
              )}
              <span>Drying</span><span>{test.dryingTemp ? `${test.dryingTemp}°C × ${test.dryingTime || "—"} min` : "—"}</span>
              <span>Curing</span><span>{test.curingTemp ? `${test.curingTemp}°C × ${test.curingTime || "—"} min` : "—"}</span>
              {test.liquorRatio && <><span>Liquor ratio</span><span>{test.liquorRatio}</span></>}
            </div>
          </div>
        </section>

        {/* Measurements */}
        <section className="mb-4 border border-slate-300 rounded bg-slate-50 p-3 text-sm">
          <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-2">Measurements</h2>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-slate-500">Dry sample</p>
              <p className="font-bold font-mono text-lg">{fmt(test.drySampleWeight, 2)} g</p>
            </div>
            <div>
              <p className="text-slate-500">Wet after pad</p>
              <p className="font-bold font-mono text-lg">{fmt(test.wetAfterBathWeight, 2)} g</p>
            </div>
            <div>
              <p className="text-slate-500">Pickup (dry → wet)</p>
              <p className="font-bold font-mono text-lg text-[#00b4c3]">{fmt(test.pickupDryToWetPct, 1)} %</p>
            </div>
            {test.preWetSampleWeight && (
              <>
                <div>
                  <p className="text-slate-500">Pre-wet sample</p>
                  <p className="font-bold font-mono">{fmt(test.preWetSampleWeight, 2)} g</p>
                </div>
                <div>
                  <p className="text-slate-500">Wet after pad (from pre-wet)</p>
                  <p className="font-bold font-mono">{fmt(test.wetAfterBathFromPreWet, 2)} g</p>
                </div>
                <div>
                  <p className="text-slate-500">Pickup (wet → wet)</p>
                  <p className="font-bold font-mono text-[#00b4c3]">{fmt(test.pickupWetToWetPct, 1)} %</p>
                </div>
              </>
            )}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Pickup used for dilution calc: <strong>{test.pickupWetToWetPct ? "Wet-to-wet" : "Dry-to-wet"}</strong> ({fmt(pickupUsed, 1)} %) ·
            Stock FUZE: {test.stockMgPerL} mg/L
          </p>
        </section>

        {/* Tier recipe cards */}
        <section className="mb-4">
          <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-2">Bath Recipe — All Tiers</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { tier: "F1", mg: 1.0 },
              { tier: "F2", mg: 0.75 },
              { tier: "F3", mg: 0.5 },
              { tier: "F4", mg: 0.25 },
            ].map((t) => {
              const bath = (test as any)[`${t.tier.toLowerCase()}BathMgPerL`];
              const ml = (test as any)[`${t.tier.toLowerCase()}FuzeMlPerLBath`];
              const ratio = (test as any)[`${t.tier.toLowerCase()}DilutionRatio`];
              const prodL = (test as any)[`${t.tier.toLowerCase()}FuzeLitersForTarget`];
              return (
                <div key={t.tier} className="border-2 border-[#00b4c3] rounded p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-xl text-[#00b4c3]">{t.tier}</span>
                    <span className="text-[10px] text-slate-500">{t.mg} mg/kg OWF</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase">Bath conc</p>
                      <p className="font-mono font-bold">{fmt(bath, 2)} mg/L</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase">Dilution</p>
                      <p className="font-mono font-bold">1 : {fmt(ratio, 1)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase">FUZE / L bath</p>
                      <p className="font-mono font-bold">{fmt(ml, 1)} mL</p>
                    </div>
                    {prodL && (
                      <div className="pt-1 border-t border-slate-200">
                        <p className="text-slate-500 text-[10px] uppercase">For {test.targetProductionKg} kg</p>
                        <p className="font-mono font-bold text-[#00b4c3]">{fmt(prodL, 2)} L</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {test.targetBathVolumeL && (
            <p className="mt-2 text-xs text-slate-600">
              Target production: <strong>{test.targetProductionKg} kg</strong> fabric · Total bath volume: <strong>{fmt(test.targetBathVolumeL, 1)} L</strong>
            </p>
          )}
        </section>

        {/* Quick bath reference */}
        {pickupUsed && (
          <section className="mb-4">
            <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-2">Quick bath reference — FUZE stock per bath</h2>
            <div className="border border-slate-300 rounded">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-2 py-1">Bath</th>
                    <th className="text-right px-2 py-1">F1</th>
                    <th className="text-right px-2 py-1">F2</th>
                    <th className="text-right px-2 py-1">F3</th>
                    <th className="text-right px-2 py-1">F4</th>
                  </tr>
                </thead>
                <tbody>
                  {[50, 100, 200, 300, 400].map((bathL) => {
                    const conc = (tier: number) => tier / (pickupUsed / 100);
                    const lFuze = (tier: number) => (conc(tier) * bathL) / (test.stockMgPerL || 30);
                    return (
                      <tr key={bathL} className="border-t border-slate-200">
                        <td className="px-2 py-1 font-mono">{bathL} L</td>
                        <td className="px-2 py-1 text-right font-mono">{lFuze(1.0) >= 1 ? lFuze(1.0).toFixed(2) + " L" : (lFuze(1.0) * 1000).toFixed(0) + " mL"}</td>
                        <td className="px-2 py-1 text-right font-mono">{lFuze(0.75) >= 1 ? lFuze(0.75).toFixed(2) + " L" : (lFuze(0.75) * 1000).toFixed(0) + " mL"}</td>
                        <td className="px-2 py-1 text-right font-mono">{lFuze(0.5) >= 1 ? lFuze(0.5).toFixed(2) + " L" : (lFuze(0.5) * 1000).toFixed(0) + " mL"}</td>
                        <td className="px-2 py-1 text-right font-mono">{lFuze(0.25) >= 1 ? lFuze(0.25).toFixed(2) + " L" : (lFuze(0.25) * 1000).toFixed(0) + " mL"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] text-slate-500 mt-1">Pickup {pickupUsed.toFixed(1)}% · Stock {test.stockMgPerL} mg/L · Top up with water to reach bath volume.</p>
          </section>
        )}

        {test.notes && (
          <section className="mb-4 text-sm">
            <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-1">Notes</h2>
            <p className="text-slate-700 italic">{test.notes}</p>
          </section>
        )}

        <footer className="pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>FUZE Biotech · Salt Lake City, UT · andrew@fuze47.com</span>
          <span>Printed {new Date().toLocaleString()}</span>
        </footer>
      </div>
    </div>
  );
}
