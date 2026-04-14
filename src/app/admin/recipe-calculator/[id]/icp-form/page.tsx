// @ts-nocheck
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Printable ICP submission form — goes in the bag with the treated
 * fabric sample. Captures everything the lab needs to run the test
 * and report back to FUZE.
 */
export default function IcpFormPage() {
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

  const fmt = (n: any, p = 2) => (n === null || n === undefined ? "—" : Number(n).toFixed(p));

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          @page { margin: 0.5in; size: letter; }
        }
      `}</style>

      <div className="no-print max-w-4xl mx-auto px-6 pt-6 flex items-center justify-between">
        <a href="/admin/recipe-calculator" className="text-sm text-[#00b4c3] font-semibold">← Back</a>
        <button onClick={() => window.print()} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg">
          🖨 Print / Save as PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6 print:p-0">
        <header className="mb-5 pb-4 border-b-4 border-[#00b4c3] flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase">FUZE Biotech · ICP Submission Form</p>
            <h1 className="text-3xl font-black text-slate-900 mt-1">ICP Silver Verification Request</h1>
            <p className="text-sm text-slate-500 mt-1">Bench test <span className="font-mono font-bold">{test.testNumber}</span> · submitted {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          </div>
          <div className="text-right">
            <div className="w-20 h-20 rounded-full bg-[#00b4c3] text-white flex items-center justify-center text-4xl font-black">F</div>
          </div>
        </header>

        <section className="mb-5">
          <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">1. Requesting Organization</h2>
          <div className="border border-slate-300 rounded p-3 text-sm grid grid-cols-2 gap-3">
            <div>
              <p className="text-slate-500 text-xs">Requester</p>
              <p className="font-semibold">FUZE Biotech</p>
              <p className="text-xs">1895 West 2100 South</p>
              <p className="text-xs">Salt Lake City, UT 84119 USA</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Contact</p>
              <p className="font-semibold">Andrew Peterson</p>
              <p className="text-xs">andrew@fuze47.com</p>
              <p className="text-xs">Report to: andrew@fuze47.com</p>
            </div>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">2. Sample Information</h2>
          <div className="border border-slate-300 rounded p-3 text-sm">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-slate-500 text-xs">Sample ID</p>
                <p className="font-mono font-black text-lg">{test.testNumber}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Treated date</p>
                <p className="font-mono font-bold">{new Date(test.testDate).toLocaleDateString()}</p>
              </div>
            </div>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600 w-1/3">Fabric</td><td className="py-1 font-semibold">{test.fabric?.fuzeNumber || test.fabricLabel}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Fabric type</td><td className="py-1">{test.fabricType || "—"}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Fiber content</td><td className="py-1">{test.fiberContent || "—"}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Weight (g/m²)</td><td className="py-1 font-mono">{fmt(test.fabricWeightGsm, 0)}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Sample area</td><td className="py-1 font-mono">{test.sampleAreaCm2 || 100} cm²</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">3. Treatment Applied</h2>
          <div className="border border-slate-300 rounded p-3 text-sm">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600 w-1/3">Active ingredient</td><td className="py-1">FUZE metamaterial (elemental silver, CAS 7440-22-4)</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Method</td><td className="py-1">Pad-Dry-Cure · vertical mini padder (HTAI P-B0)</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Squeeze pressure</td><td className="py-1 font-mono">{test.squeezePressure} bar ({(test.squeezePressure * 0.1).toFixed(2)} MPa)</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Line speed</td><td className="py-1 font-mono">{test.vfdFrequencyHz} Hz → {fmt(test.lineSpeedMPerMin, 2)} m/min</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Measured pickup (mean of triplicate)</td><td className="py-1 font-mono font-bold text-[#00b4c3]">{fmt(test.pickupWetToWetPct ?? test.pickupDryToWetPct, 1)}%</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">FUZE stock concentration</td><td className="py-1 font-mono">{test.stockMgPerL} mg/L</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Tier applied</td><td className="py-1 font-mono font-bold text-lg">{test.testedAtTier || "—"}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Bath concentration</td><td className="py-1 font-mono">{test.testedAtTier ? fmt((test as any)[`${test.testedAtTier.toLowerCase()}BathMgPerL`], 2) : "—"} mg/L</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Bath volume</td><td className="py-1 font-mono">{fmt(test.testBathVolumeL, 2)} L</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">FUZE / water in bath</td><td className="py-1 font-mono">{fmt(test.testBathFuzeMl, 1)} mL FUZE + {fmt(test.testBathWaterMl, 0)} mL water</td></tr>
                {test.dryingTemp && <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Drying</td><td className="py-1 font-mono">{test.dryingTemp}°C × {test.dryingTime || "—"} min</td></tr>}
                {test.curingTemp && <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">Curing</td><td className="py-1 font-mono">{test.curingTemp}°C × {test.curingTime || "—"} min</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-5 bg-amber-50 border-l-4 border-amber-500 p-3 text-xs">
          <h2 className="font-black uppercase tracking-wide text-slate-900 mb-2">4. Requested Test</h2>
          <p className="text-slate-700 mb-2"><strong>ICP-OES / ICP-MS quantitative determination of silver (Ag) on treated fabric.</strong></p>
          <p className="text-slate-700">Report silver content in <strong>ppm (mg/kg) on fabric weight basis</strong>. Acid digest per lab standard.</p>
          <p className="mt-2 font-bold text-slate-900">Expected result: <span className="font-mono">~{fmt(test.icpExpectedPpm, 0)} ppm Ag</span></p>
          <p className="text-slate-700">(= {test.testedAtTier || "F1"} target × pickup efficiency)</p>
        </section>

        <section className="mb-5">
          <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">5. Return Reporting</h2>
          <div className="border-2 border-slate-300 rounded p-3 text-sm">
            <div className="space-y-2">
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">Return to:</span><span className="font-semibold">andrew@fuze47.com</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">Report format:</span><span>PDF with measured ppm and digest method</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">Lab sample ID:</span><span className="border-b-2 border-slate-400 flex-1">&nbsp;</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">Received date:</span><span className="border-b-2 border-slate-400 flex-1">&nbsp;</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">Completed date:</span><span className="border-b-2 border-slate-400 flex-1">&nbsp;</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">Measured Ag ppm:</span><span className="border-b-2 border-slate-400 flex-1 font-mono font-bold">&nbsp;</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">Technician:</span><span className="border-b-2 border-slate-400 flex-1">&nbsp;</span></div>
            </div>
          </div>
        </section>

        <footer className="pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>FUZE Biotech · 1895 West 2100 South · Salt Lake City, UT 84119 USA</span>
          <span>Form generated {new Date().toLocaleString()} · andrew@fuze47.com</span>
        </footer>
      </div>
    </div>
  );
}
