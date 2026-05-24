// @ts-nocheck
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

/**
 * Printable ICP submission form — goes in the bag with the treated
 * fabric sample. Captures everything the lab needs to run the test
 * and report back to FUZE.
 */
export default function IcpFormPage() {
  const { t } = useI18n();
  const T = t.recipeCalcIcpForm;
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

  if (loading) return <div className="p-10 text-slate-500">{T.loadingPrefix} {id}…</div>;
  if (!test) return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-2">{T.notLoaded}</h1>
      <p className="text-sm text-slate-600">{T.idLabel} <code>{id}</code></p>
      {error && <p className="text-sm text-red-700 mt-2">{T.errorPrefix} {error}</p>}
      <a href="/admin/recipe-calculator" className="inline-block mt-4 text-[#00b4c3] font-semibold">{T.backToCalculator}</a>
    </div>
  );

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
        <a href="/admin/recipe-calculator" className="text-sm text-[#00b4c3] font-semibold">{T.backShort}</a>
        <button onClick={() => window.print()} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg">
          {T.printSavePdf}
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6 print:p-0">
        <header className="mb-5 pb-4 border-b-4 border-[#00b4c3] flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase">{T.headerBadge}</p>
            <h1 className="text-3xl font-black text-slate-900 mt-1">{T.headerTitle}</h1>
            <p className="text-sm text-slate-500 mt-1">{T.benchTestPrefix} <span className="font-mono font-bold">{test.testNumber}</span> · {T.submittedPrefix} {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          </div>
          <div className="text-right">
            <div className="w-20 h-20 rounded-full bg-[#00b4c3] text-white flex items-center justify-center text-4xl font-black">F</div>
          </div>
        </header>

        <section className="mb-5">
          <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">{T.section1}</h2>
          <div className="border border-slate-300 rounded p-3 text-sm grid grid-cols-2 gap-3">
            <div>
              <p className="text-slate-500 text-xs">{T.requesterLabel}</p>
              <p className="font-semibold">{T.requesterName}</p>
              <p className="text-xs">{T.requesterAddr1}</p>
              <p className="text-xs">{T.requesterAddr2}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">{T.contactLabel}</p>
              <p className="font-semibold">{T.contactName}</p>
              <p className="text-xs">{T.contactEmail}</p>
              <p className="text-xs">{T.reportToPrefix} {T.contactEmail}</p>
            </div>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">{T.section2}</h2>
          <div className="border border-slate-300 rounded p-3 text-sm">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-slate-500 text-xs">{T.sampleIdLabel}</p>
                <p className="font-mono font-black text-lg">{test.testNumber}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">{T.treatedDateLabel}</p>
                <p className="font-mono font-bold">{new Date(test.testDate).toLocaleDateString()}</p>
              </div>
            </div>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600 w-1/3">{T.rowFabric}</td><td className="py-1 font-semibold">{test.fabric?.fuzeNumber || test.fabricLabel}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowFabricType}</td><td className="py-1">{test.fabricType || "—"}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowFiberContent}</td><td className="py-1">{test.fiberContent || "—"}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowWeightGsm}</td><td className="py-1 font-mono">{fmt(test.fabricWeightGsm, 0)}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowSampleArea}</td><td className="py-1 font-mono">{test.sampleAreaCm2 || 100} cm²</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">{T.section3}</h2>
          <div className="border border-slate-300 rounded p-3 text-sm">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600 w-1/3">{T.rowActiveIngredient}</td><td className="py-1">{T.activeIngredientValue}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowMethod}</td><td className="py-1">{T.methodValue}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowSqueeze}</td><td className="py-1 font-mono">{test.squeezePressure} bar ({(test.squeezePressure * 0.1).toFixed(2)} MPa)</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowLineSpeed}</td><td className="py-1 font-mono">{test.vfdFrequencyHz} Hz → {fmt(test.lineSpeedMPerMin, 2)} m/min</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowMeasuredPickup}</td><td className="py-1 font-mono font-bold text-[#00b4c3]">{fmt(test.pickupWetToWetPct ?? test.pickupDryToWetPct, 1)}%</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowStockConc}</td><td className="py-1 font-mono">{test.stockMgPerL} mg/L</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowTierApplied}</td><td className="py-1 font-mono font-bold text-lg">{test.testedAtTier || "—"}</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowBathConc}</td><td className="py-1 font-mono">{test.testedAtTier ? fmt((test as any)[`${test.testedAtTier.toLowerCase()}BathMgPerL`], 2) : "—"} mg/L</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowBathVolume}</td><td className="py-1 font-mono">{fmt(test.testBathVolumeL, 2)} L</td></tr>
                <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowBathSplit}</td><td className="py-1 font-mono">{T.rowBathSplitFormat.replace("{fuze}", fmt(test.testBathFuzeMl, 1)).replace("{water}", fmt(test.testBathWaterMl, 0))}</td></tr>
                {test.dryingTemp && <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowDrying}</td><td className="py-1 font-mono">{test.dryingTemp}°C × {test.dryingTime || "—"} min</td></tr>}
                {test.curingTemp && <tr className="border-b border-slate-200"><td className="py-1 text-slate-600">{T.rowCuring}</td><td className="py-1 font-mono">{test.curingTemp}°C × {test.curingTime || "—"} min</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-5 bg-amber-50 border-l-4 border-amber-500 p-3 text-xs">
          <h2 className="font-black uppercase tracking-wide text-slate-900 mb-2">{T.section4}</h2>
          <p className="text-slate-700 mb-2"><strong>{T.requestBody1}</strong></p>
          <p className="text-slate-700">{T.requestBody2Prefix} <strong>{T.requestBody2Bold}</strong>{T.requestBody2Suffix}</p>
          <p className="mt-2 font-bold text-slate-900">{T.expectedPrefix} <span className="font-mono">~{fmt(test.icpExpectedPpm, 0)} {T.expectedPpmSuffix}</span></p>
          <p className="text-slate-700">{T.expectedFormatPrefix} {test.testedAtTier || "F1"} {T.expectedFormatSuffix}</p>
        </section>

        <section className="mb-5">
          <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">{T.section5}</h2>
          <div className="border-2 border-slate-300 rounded p-3 text-sm">
            <div className="space-y-2">
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">{T.returnReturnTo}</span><span className="font-semibold">{T.returnEmail}</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">{T.returnFormat}</span><span>{T.returnFormatValue}</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">{T.returnLabSampleId}</span><span className="border-b-2 border-slate-400 flex-1">&nbsp;</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">{T.returnReceived}</span><span className="border-b-2 border-slate-400 flex-1">&nbsp;</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">{T.returnCompleted}</span><span className="border-b-2 border-slate-400 flex-1">&nbsp;</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">{T.returnMeasured}</span><span className="border-b-2 border-slate-400 flex-1 font-mono font-bold">&nbsp;</span></div>
              <div className="flex gap-2 items-baseline"><span className="text-slate-600 w-32">{T.returnTech}</span><span className="border-b-2 border-slate-400 flex-1">&nbsp;</span></div>
            </div>
          </div>
        </section>

        <footer className="pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>{T.footerCompany}</span>
          <span>{T.footerGenerated} {new Date().toLocaleString()} · {T.returnEmail}</span>
        </footer>
      </div>
    </div>
  );
}
