// @ts-nocheck
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n, LOCALES } from "@/i18n";
import type { Locale } from "@/i18n";

/**
 * Full FUZE Recipe Report — the polished, factory-facing version of
 * a bench test. Meant to print to 2 pages (letter/A4), hand to a
 * factory or brand. Save-as-PDF from the browser.
 *
 * Strings now flow through the global useI18n() under recipeReport.*
 * — every locale that has translations renders this report natively.
 * Set the global locale (header switcher) OR override locally for
 * print-in-different-language via the in-page selector.
 */

const TIER_MG_PER_KG: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };
const STANDARD_BATHS_L = [50, 100, 200, 300, 400];

function fuzeLitersForBath(bathL: number, pickupPct: number, mgPerKg: number, stock: number) {
  if (!pickupPct || !bathL) return 0;
  return ((mgPerKg / (pickupPct / 100)) * bathL) / stock;
}

// Map our locale codes to BCP-47 codes for Intl date formatting.
const DATE_LOCALE: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  tr: "tr-TR",
  it: "it-IT",
  ja: "ja-JP",
  ko: "ko-KR",
  vi: "vi-VN",
  ms: "ms-MY",
  hi: "hi-IN",
  ta: "ta-IN",
  th: "th-TH",
  id: "id-ID",
  bn: "bn-BD",
  ur: "ur-PK",
  km: "km-KH",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
};

export default function RecipeReportPage() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<any>(null);
  const [narration, setNarration] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const { t, locale: globalLocale, setLocale } = useI18n();
  // Print-overridable local locale — defaults to the user's global locale
  // but a recipient picking "print in Indonesian for Hi-Goal" can change it
  // here without affecting their Atlas-wide language.
  const [printLocale, setPrintLocale] = useState<Locale | null>(null);
  const locale = (printLocale ?? globalLocale) as Locale;
  const T = t.recipeReport;
  const dateLocale = DATE_LOCALE[locale as string] || "en-US";

  useEffect(() => {
    fetch(`/api/admin/recipe-bench-tests/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (d.ok) {
          setTest(d.test);
          setNarration(d.narration || null);
        } else {
          setError(d.error || `HTTP ${r.status}`);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-10 text-slate-500">Loading bench test {id}…</div>;
  if (!test)
    return (
      <div className="p-10 max-w-xl mx-auto">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Bench test not loaded</h1>
        <p className="text-sm text-slate-600">
          ID: <code>{id}</code>
        </p>
        {error && <p className="text-sm text-red-700 mt-2">Error: {error}</p>}
        <a
          href="/admin/recipe-calculator"
          className="inline-block mt-4 text-[#00b4c3] font-semibold"
        >
          ← Back to calculator
        </a>
      </div>
    );

  // We always use dry-to-wet. Wet-to-wet mass pickup is meaningless for FUZE
  // (99.998% DI water), so it was removed from the measurement flow. Legacy
  // tests that have only wetToWet stored fall through to null and surface a
  // warning banner.
  const pickupUsed = test.pickupDryToWetPct;
  const stock = test.stockMgPerL || 30;
  const fmt = (n: any, p = 2) => (n === null || n === undefined ? "—" : Number(n).toFixed(p));
  const runs = Array.isArray(test.sampleRuns) ? test.sampleRuns : [];

  // Recompute tier values from the chosen pickup so legacy DB rows with
  // negative-basis stored values don't leak through.
  // FUZE ≈ 1 g/mL (water base), so g/L of stock added ≈ mL/L of stock added.
  const TIER_MG = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 } as const;
  const tierRecipe = (tier: keyof typeof TIER_MG) => {
    if (!pickupUsed || pickupUsed <= 0) return { bathConc: null, gPerL: null, ratio: null };
    const bathConc = TIER_MG[tier] / (pickupUsed / 100); // mg/L in bath
    const gPerL = (bathConc / stock) * 1000; // g of FUZE stock per L of final bath (≈ mL because FUZE ≈ 1 g/mL)
    const ratio = stock / bathConc - 1; // 1 : N water
    return { bathConc, gPerL, ratio };
  };

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

      <div className="no-print max-w-4xl mx-auto px-6 pt-6 flex items-center justify-between gap-3 flex-wrap">
        <a href="/admin/recipe-calculator" className="text-sm text-[#00b4c3] font-semibold">
          {T.back}
        </a>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{T.language}:</span>
          <select
            value={locale}
            onChange={(e) => setPrintLocale(e.target.value as Locale)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700"
            aria-label={T.language}
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800"
          >
            {T.printBtn}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 print:p-0">
        {/* BAD-DATA BANNER */}
        {(pickupUsed == null || pickupUsed <= 0) && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg print:border print:border-red-400">
            <p className="font-black text-red-800 text-sm">{T.pickupDataUnusable}</p>
            <p className="text-xs text-red-700 mt-1">
              {T.pickupRerun} ({fmt(pickupUsed, 1)}%)
            </p>
          </div>
        )}

        {/* COVER HEADER */}
        <header className="mb-6 pb-5 border-b-4 border-[#00b4c3]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <img src="/fuze-logo-horizontal.png" alt="FUZE Biotech" className="h-10 w-auto" />
                <div className="border-l border-slate-200 pl-3 ml-1">
                  <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase">
                    {T.recipeReport}
                  </p>
                  <p className="text-sm text-slate-500">{T.subtitle}</p>
                </div>
              </div>
              <h1 className="text-3xl font-black text-slate-900 mt-3">
                {T.benchTest} <span className="font-mono">{test.testNumber}</span>
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {T.prepared}{" "}
                {new Date(test.testDate).toLocaleDateString(dateLocale, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                · {T.fuzeLab}
              </p>
              {/* "Prepared for" attribution line — Andrew (#93): "I email
                  this report to brands and factories. It needs to identify
                  who it's for at first glance." */}
              {(test.fabric?.brand?.name || test.fabric?.factory?.name) && (
                <p className="text-sm text-slate-700 mt-1">
                  <span className="text-slate-500">{T.preparedFor}:</span>{" "}
                  {test.fabric?.brand?.name && (
                    <b className="text-slate-900">{test.fabric.brand.name}</b>
                  )}
                  {test.fabric?.brand?.name && test.fabric?.factory?.name && (
                    <span className="text-slate-400"> · </span>
                  )}
                  {test.fabric?.factory?.name && (
                    <b className="text-slate-900">{test.fabric.factory.name}</b>
                  )}
                </p>
              )}
            </div>
            <div className="text-right">
              {test.qcPassed ? (
                <span className="inline-block px-3 py-1 text-sm font-bold bg-emerald-100 text-emerald-800 rounded-full">
                  {T.qcPassed}
                </span>
              ) : (
                <span className="inline-block px-3 py-1 text-sm font-bold bg-red-100 text-red-800 rounded-full">
                  {T.qcFailed}
                </span>
              )}
              {test.graduatedRecipeId && (
                <p className="text-xs text-amber-700 mt-1">{T.graduated}</p>
              )}
            </div>
          </div>
        </header>

        {/* EXECUTIVE SUMMARY */}
        <section className="mb-6 p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl text-white">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#00b4c3] mb-2">
            {T.execSummary}
          </p>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-white/60">{T.fabric}</p>
              <p className="font-bold text-lg">
                {test.fabric?.fuzeNumber ? `FUZE #${test.fabric.fuzeNumber}` : test.fabricLabel}
              </p>
              <p className="text-xs text-white/70">
                {test.fabricType || test.fabric?.fabricCategory || ""}
                {test.fabricWeightGsm ? ` · ${test.fabricWeightGsm} g/m²` : ""}
              </p>
              <p className="text-xs text-white/70">{test.fiberContent || "—"}</p>
              {/* Customer / factory item codes — without these the recipient
                  can't reconcile this report against their own SKU records. */}
              {test.fabric?.customerCode && (
                <p className="text-xs text-white/80 mt-1">
                  <span className="text-white/50">{T.brandItemNo}:</span>{" "}
                  <span className="font-mono">{test.fabric.customerCode}</span>
                </p>
              )}
              {test.fabric?.factoryCode && (
                <p className="text-xs text-white/80">
                  <span className="text-white/50">{T.factoryItemNo}:</span>{" "}
                  <span className="font-mono">{test.fabric.factoryCode}</span>
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-white/60">{T.method}</p>
              <p className="font-bold text-lg">
                {(test.applicationMethod || "—").replace(/_/g, "-")}
              </p>
              <p className="text-xs text-white/70">
                {test.squeezePressure != null ? `${test.squeezePressure} bar` : "—"}
                {test.vfdFrequencyHz != null
                  ? ` · ${test.vfdFrequencyHz} Hz · ${(test.vfdFrequencyHz * 0.295).toFixed(2)} m/min`
                  : ""}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">{T.measuredPickup}</p>
              <p
                className={`font-black text-3xl ${pickupUsed > 0 ? "text-[#00b4c3]" : "text-red-400"}`}
              >
                {fmt(pickupUsed, 1)}%
              </p>
              <p className="text-xs text-white/70">{T.dryToWetBasis}</p>
            </div>
          </div>
        </section>

        {/* MB-3 — Plain-English narration. Pulled from the most
            recent brand-visible TestRun for this fabric. Hidden when
            no narration exists yet (fabric never tested + stamped) so
            the report doesn't render an empty stub. */}
        {narration?.text ? (
          <section className="mb-6 p-5 rounded-xl bg-cyan-50 border border-cyan-200 print:bg-white print:border-slate-300">
            <p className="text-[10px] font-bold tracking-widest uppercase text-cyan-800 mb-2">
              Plain-English Summary
            </p>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {narration.text}
            </p>
            <p className="text-[10px] text-slate-500 mt-2">
              Auto-generated by FUZE Atlas from lab data
              {narration.generatedAt
                ? ` · ${new Date(narration.generatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : ""}
              .
            </p>
          </section>
        ) : null}

        {/* FOUR-TIER RECIPE */}
        <section className="mb-6">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">
            {T.fourTierTitle}
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { tier: "F1" as const, perf: T.tierPerfMax },
              { tier: "F2" as const, perf: T.tierPerfHigh },
              { tier: "F3" as const, perf: T.tierPerfStd },
              { tier: "F4" as const, perf: T.tierPerfLight },
            ].map((t) => {
              const r = tierRecipe(t.tier);
              return (
                <div key={t.tier} className="border-2 border-[#00b4c3] rounded-lg overflow-hidden">
                  <div className="bg-[#00b4c3] text-white p-2 text-center">
                    <p className="font-black text-2xl">{t.tier}</p>
                    <p className="text-[10px] uppercase tracking-wide opacity-90">{t.perf}</p>
                    <p className="text-[10px] opacity-75">{TIER_MG[t.tier]} mg/kg OWF</p>
                  </div>
                  <div className="p-3 text-xs space-y-2">
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase">{T.fuzePerL}</p>
                      <p className="font-mono font-black text-xl text-slate-900">
                        {r.gPerL != null ? fmt(r.gPerL, 1) : "—"}{" "}
                        <span className="text-xs font-normal">{T.gPerL}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase">{T.bathConc}</p>
                      <p className="font-mono font-bold">
                        {r.bathConc != null ? fmt(r.bathConc, 2) : "—"} mg/L
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase">{T.dilution}</p>
                      <p className="font-mono font-bold">
                        1 : {r.ratio != null ? fmt(r.ratio, 1) : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">{T.tierNote}</p>
        </section>

        {/* BATH VOLUME QUICK-REFERENCE */}
        {pickupUsed > 0 && (
          <section className="mb-6">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">
              {T.cookbookTitle}
            </h2>
            <div className="border-2 border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs uppercase text-slate-600">
                      {T.bathVol}
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">
                      F1 {T.total}
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">
                      F2 {T.total}
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">
                      F3 {T.total}
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">
                      F4 {T.total}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {STANDARD_BATHS_L.map((bathL) => (
                    <tr key={bathL} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-mono font-bold">{bathL} L</td>
                      {(["F1", "F2", "F3", "F4"] as const).map((tier, i) => {
                        const r = tierRecipe(tier);
                        if (r.gPerL == null)
                          return (
                            <td key={i} className="px-3 py-2 text-right text-slate-300">
                              —
                            </td>
                          );
                        const totalG = r.gPerL * bathL; // grams of FUZE stock
                        return (
                          <td
                            key={i}
                            className="px-3 py-2 text-right font-mono text-[#00b4c3] font-bold"
                          >
                            {totalG >= 1000
                              ? (totalG / 1000).toFixed(2) + " kg"
                              : totalG.toFixed(0) + " g"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              {T.cookbookNote1} <strong>{T.cookbookNote2}</strong> {T.cookbookNote3} {T.pickupShort}{" "}
              {fmt(pickupUsed, 1)}% · {T.stockShort} {stock} mg/L.
            </p>
          </section>
        )}

        {/* WET-ON-WET PRODUCTION ADJUSTMENT */}
        {pickupUsed > 0 && (
          <section className="mb-6">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">
              {T.adjustmentTitle}
            </h2>
            <p className="text-xs text-slate-600 mb-3">
              {T.adjustmentIntro1} <strong>{T.adjustmentIntro2}</strong> {T.adjustmentIntro3}{" "}
              <strong>{T.adjustmentIntro4}</strong> {T.adjustmentIntro5} {T.effectivePickupFormula}{" "}
              ({fmt(pickupUsed, 1)}%) {T.minusMoisture}.
            </p>
            <div className="border-2 border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs uppercase text-slate-600">
                      {T.incomingMoisture}
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">
                      {T.effectivePickup}
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">
                      F1 {T.gPerL} · 1:N
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">
                      F2 {T.gPerL} · 1:N
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">
                      F3 {T.gPerL} · 1:N
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">
                      F4 {T.gPerL} · 1:N
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 10, 15, 20].map((r) => {
                    const pEff = pickupUsed - r;
                    const row = [1.0, 0.75, 0.5, 0.25].map((mg) => {
                      if (pEff <= 0) return null;
                      const bathConc = mg / (pEff / 100);
                      const gPerL = (bathConc / stock) * 1000;
                      const ratio = stock / bathConc - 1;
                      return { bathConc, gPerL, ratio };
                    });
                    return (
                      <tr
                        key={r}
                        className={`border-t border-slate-200 ${r === 0 ? "bg-slate-50" : ""}`}
                      >
                        <td className="px-3 py-2 font-mono font-bold">
                          {r === 0 ? T.dryLabel : `${r}%`}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">
                          {pEff > 0 ? fmt(pEff, 1) + "%" : "—"}
                        </td>
                        {row.map((v, i) => (
                          <td
                            key={i}
                            className="px-3 py-2 text-right font-mono text-[#00b4c3] font-bold"
                          >
                            {v ? (
                              <>
                                {fmt(v.gPerL, 1)} {T.gPerL}{" "}
                                <span className="text-slate-500 text-[10px]">
                                  · 1:{fmt(v.ratio, 1)}
                                </span>
                              </>
                            ) : (
                              <span className="text-red-600">{T.tooWet}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">{T.adjustmentFooter}</p>
          </section>
        )}

        {/* PAGE BREAK */}
        <div className="page-break" />

        {/* MEASUREMENTS */}
        <section className="mb-6">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">
            {T.measurements}
          </h2>

          {runs.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">{T.triplicateRuns}</p>
              <table className="w-full text-sm border border-slate-200 rounded overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-xs">{T.run}</th>
                    <th className="text-right px-3 py-1.5 text-xs">{T.dryG}</th>
                    <th className="text-right px-3 py-1.5 text-xs">{T.wetG}</th>
                    <th className="text-right px-3 py-1.5 text-xs">{T.pickupCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r: any) => (
                    <tr key={r.run} className="border-t border-slate-200">
                      <td className="px-3 py-1.5 font-semibold">#{r.run}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt(r.dry, 3)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt(r.wet, 3)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold">
                        {fmt(r.pickup, 1)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-cyan-50 border-t-2 border-[#00b4c3]">
                    <td className="px-3 py-1.5 font-black">{T.mean}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">
                      {fmt(test.drySampleWeight, 3)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">
                      {fmt(test.wetAfterBathWeight, 3)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-black text-[#00b4c3]">
                      {fmt(test.pickupDryToWetPct, 1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* PROCESS PARAMETERS */}
        <section className="mb-6">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">
            {T.processParams}
          </h2>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 text-slate-600">{T.sampleArea}</td>
                    <td className="py-1.5 text-right font-mono">{test.sampleAreaCm2 || 100} cm²</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 text-slate-600">{T.squeezePressure}</td>
                    <td className="py-1.5 text-right font-mono">
                      {test.squeezePressure != null
                        ? `${test.squeezePressure} bar (${(test.squeezePressure * 0.1).toFixed(2)} MPa)`
                        : "—"}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 text-slate-600">{T.vfdFreq}</td>
                    <td className="py-1.5 text-right font-mono">{test.vfdFrequencyHz || "—"} Hz</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 text-slate-600">{T.lineSpeed}</td>
                    <td className="py-1.5 text-right font-mono">
                      {fmt(test.lineSpeedMPerMin, 2)} m/min
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 text-slate-600">{T.drying}</td>
                    <td className="py-1.5 text-right font-mono">
                      {test.dryingTemp
                        ? `${test.dryingTemp}°C × ${test.dryingTime || "—"} min`
                        : "—"}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 text-slate-600">{T.curing}</td>
                    <td className="py-1.5 text-right font-mono">
                      {test.curingTemp
                        ? `${test.curingTemp}°C × ${test.curingTime || "—"} min`
                        : "—"}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 text-slate-600">{T.fuzeStock}</td>
                    <td className="py-1.5 text-right font-mono">{stock} mg/L</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 text-slate-600">{T.liquorRatio}</td>
                    <td className="py-1.5 text-right font-mono">{test.liquorRatio || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* TEST BATH + ICP */}
        {test.testedAtTier && (
          <section className="mb-6">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">
              {T.testBathTitle}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-[#00b4c3] rounded p-3 text-xs">
                <p className="text-slate-500 uppercase text-[10px] mb-1">{T.testBathApplied}</p>
                <p className="font-bold text-slate-900">
                  {T.tier} {test.testedAtTier} · {fmt(test.testBathVolumeL, 2)} L {T.reservoir}
                </p>
                <p className="font-mono mt-1">
                  {T.fuzeStockLabel}: <strong>{fmt(test.testBathFuzeMl, 1)} mL</strong> · {T.water}:{" "}
                  <strong>{fmt(test.testBathWaterMl, 0)} mL</strong>
                </p>
              </div>
              <div className="border border-slate-300 rounded p-3 text-xs">
                <p className="text-slate-500 uppercase text-[10px] mb-1">{T.icpVerification}</p>
                <p className="font-mono">
                  <span className="text-slate-500">{T.expected}:</span>{" "}
                  <strong>{fmt(test.icpExpectedPpm, 0)} ppm Ag</strong>
                </p>
                {test.icpMeasuredPpm ? (
                  <>
                    <p className="font-mono">
                      <span className="text-slate-500">{T.measured}:</span>{" "}
                      <strong className="text-[#00b4c3]">{fmt(test.icpMeasuredPpm, 1)} ppm</strong>
                    </p>
                    {test.affinityPct && (
                      <p className="font-mono">
                        <span className="text-slate-500">{T.affinity}:</span>{" "}
                        <strong
                          className={
                            test.affinityPct >= 90 && test.affinityPct <= 110
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }
                        >
                          {fmt(test.affinityPct, 1)}%
                        </strong>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-amber-700 italic mt-0.5">{T.resultPending}</p>
                )}
                {test.icpLab && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    {test.icpLab}
                    {test.icpSampleId ? ` · ${test.icpSampleId}` : ""}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* METHODOLOGY */}
        <section className="mb-6 p-4 bg-slate-50 border-l-4 border-[#00b4c3] text-xs">
          <h2 className="font-black text-slate-900 uppercase tracking-wide mb-2">
            {T.methodology}
          </h2>
          <p className="text-slate-700">
            {T.methodologyBody
              .replace("{p}", test.squeezePressure ?? "—")
              .replace("{hz}", test.vfdFrequencyHz ?? "—")
              .replace("{stock}", String(stock))}
          </p>
        </section>

        {/* NOTES + SIGNATURE */}
        {test.notes && (
          <section className="mb-4 text-sm">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">
              {T.labNotes}
            </h2>
            <p className="text-slate-700 italic border-l-4 border-slate-200 pl-3">{test.notes}</p>
          </section>
        )}

        <footer className="pt-4 mt-6 border-t-2 border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>{T.footerLeft}</span>
          <span>
            {T.footerRight} {new Date().toLocaleString(dateLocale)}
          </span>
        </footer>
      </div>
    </div>
  );
}
