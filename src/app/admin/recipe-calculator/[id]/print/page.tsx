// @ts-nocheck
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

/**
 * Printable bench test card — single page, optimized for lab bench
 * posting. "Save as PDF" via browser print.
 */
export default function PrintTestCardPage() {
  const { t } = useI18n();
  const T = t.recipeCalcPrint;
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

  if (loading) return <div className="p-10 text-slate-500">{T.loadingTpl.replace("{id}", String(id))}</div>;
  if (!test)
    return (
      <div className="p-10 max-w-xl mx-auto">
        <h1 className="text-xl font-bold text-slate-900 mb-2">{T.notLoadedTitle}</h1>
        <p className="text-sm text-slate-600">
          {T.idLabel} <code>{id}</code>
        </p>
        {error && <p className="text-sm text-red-700 mt-2">{T.errorPrefix}{error}</p>}
        <a
          href="/admin/recipe-calculator"
          className="inline-block mt-4 text-[#00b4c3] font-semibold"
        >
          {T.backToCalc}
        </a>
      </div>
    );

  const pickupUsed = test.pickupWetToWetPct ?? test.pickupDryToWetPct;
  const fmt = (n: any, p = 2) => (n === null || n === undefined ? "—" : Number(n).toFixed(p));

  // Externally-safe gate. Before we email this PDF to a brand/factory it
  // needs enough customer context to actually identify what it's about.
  // Missing any of these → render a loud red banner so Ashlee doesn't
  // accidentally ship a context-less report (the Penfabric complaint).
  const missingForExternal: string[] = [];
  if (!test.fabric?.brand?.name) missingForExternal.push(T.missingBrand);
  if (!test.fabric?.customerReference && !test.fabric?.customerCode)
    missingForExternal.push(T.missingCustomerRef);
  if (!test.fabric?.factoryCode) missingForExternal.push(T.missingFactoryItem);
  if (!test.fabric?.fabricCategory && !test.fabric?.construction && !test.fabricType)
    missingForExternal.push(T.missingConstruction);
  if (!test.fiberContent && !test.fabric?.yarnType)
    missingForExternal.push(T.missingFiber);
  const safeForExternal = missingForExternal.length === 0;

  // Plain-English recipe paragraph derived from the bench test. Production
  // techs read this once and know exactly what to do — no tier matrix
  // decoding required. Defaults to F1 (1.0 mg/kg) because that's what we
  // ship as the recommended tier on full-spectrum reports.
  const recommendedTier = test.targetTier || "F1";
  const tierMg: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };
  const recTierMg = tierMg[recommendedTier] ?? 1.0;
  const recBathMgPerL = pickupUsed
    ? recTierMg / (pickupUsed / 100)
    : null;
  const recFuzeMlPer100L =
    recBathMgPerL && test.stockMgPerL
      ? (recBathMgPerL * 100) / test.stockMgPerL
      : null;
  const prettyMl = (ml: number | null) => {
    if (ml == null || !Number.isFinite(ml)) return "—";
    if (ml >= 1000) return `${(ml / 1000).toFixed(2)} L`;
    return `${ml.toFixed(1)} mL`;
  };

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
        <a href="/admin/recipe-calculator" className="text-sm text-[#00b4c3] font-semibold">
          {T.backShort}
        </a>
        <button
          onClick={() => window.print()}
          className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800"
        >
          {T.printButton}
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white">
        {/* External-sharing safety gate — red banner when customer
            context is missing. Visible on screen AND on print so Ashlee
            cannot accidentally send a context-less PDF to a customer. */}
        {!safeForExternal && (
          <div className="mb-4 border-2 border-red-600 bg-red-50 rounded p-3">
            <p className="text-xs font-black text-red-800 uppercase tracking-widest">
              {T.unsafeBadge}
            </p>
            <p className="text-sm text-red-900 mt-1 leading-snug">
              {T.unsafeIntro}
            </p>
            <ul className="mt-1 text-sm text-red-900 list-disc list-inside">
              {missingForExternal.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="text-xs text-red-700 mt-2">
              {T.unsafeEditPrefix}
              {test.fabric?.id ? (
                <a href={`/fabrics/${test.fabric.id}`} className="underline font-semibold">
                  /fabrics/{test.fabric.id}
                </a>
              ) : (
                T.unsafeOpenLink
              )}
            </p>
          </div>
        )}

        {/* Customer identification block — the first thing a recipient
            should see. Only shown when we have something to show; falls
            back silently otherwise (the banner above already warns). */}
        {(test.fabric?.customerReference ||
          test.fabric?.customerCode ||
          test.fabric?.factoryCode ||
          test.fabric?.brand?.name) && (
          <div className="mb-4 border border-slate-300 rounded bg-slate-50 p-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {T.preparedFor}
              </p>
              <p className="text-lg font-black text-slate-900 leading-tight mt-0.5">
                {test.fabric?.brand?.name || "—"}
                {test.fabric?.factory?.name && (
                  <span className="text-sm font-semibold text-slate-600 ml-2">
                    · {test.fabric.factory.name}
                  </span>
                )}
              </p>
              {test.fabric?.customerReference && (
                <p className="text-sm text-slate-800 mt-1">
                  <span className="text-slate-500 uppercase text-[10px] tracking-widest mr-1">
                    {T.customerRefLabel}
                  </span>
                  <span className="font-mono font-bold text-base">
                    {test.fabric.customerReference}
                  </span>
                </p>
              )}
              <div className="flex gap-4 mt-1 text-xs text-slate-700">
                {test.fabric?.customerCode && (
                  <span>
                    <span className="text-slate-500">{T.brandItemLabel}</span>{" "}
                    <span className="font-mono font-bold">{test.fabric.customerCode}</span>
                  </span>
                )}
                {test.fabric?.factoryCode && (
                  <span>
                    <span className="text-slate-500">{T.factoryItemLabel}</span>{" "}
                    <span className="font-mono font-bold">{test.fabric.factoryCode}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {T.fuzeRefLabel}
              </p>
              <p className="text-lg font-mono font-bold text-[#00b4c3]">
                {test.fabric?.fuzeNumber ? `#${test.fabric.fuzeNumber}` : "—"}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="border-b-4 border-[#00b4c3] pb-3 mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-[#00b4c3] tracking-widest uppercase">
              {T.benchTestKicker}
            </p>
            <h1 className="text-3xl font-black font-mono text-slate-900 mt-1">{test.testNumber}</h1>
            <p className="text-sm text-slate-600">{new Date(test.testDate).toLocaleString()}</p>
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
              <p className="text-xs text-slate-500 mt-1">{T.graduatedNote}</p>
            )}
          </div>
        </header>

        {/* Recommended Recipe — plain English paragraph a production
            tech can read once and execute. Sits above the detailed
            matrix so it's the headline takeaway of the PDF. */}
        {pickupUsed && recFuzeMlPer100L != null && (
          <section className="mb-4 border-2 border-[#00b4c3] rounded bg-cyan-50/40 p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-black text-xs uppercase tracking-widest text-[#00b4c3]">
                {T.recommendedRecipeTitle}
              </h2>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                {T.tierHeaderTpl
                  .replace("{tier}", String(recommendedTier))
                  .replace("{mg}", recTierMg.toFixed(2))}
              </span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">
              For every <b>100 L</b> of bath, mix{" "}
              <b className="text-[#00b4c3]">{prettyMl(recFuzeMlPer100L)}</b> of{" "}
              FUZE stock ({test.stockMgPerL || 30} mg/L) with DI water to reach
              a total bath volume of 100 L. This yields a bath concentration of{" "}
              <b>{fmt(recBathMgPerL, 3)} mg/L</b>, which — at this fabric's
              measured pickup of <b>{fmt(pickupUsed, 1)}%</b> — deposits{" "}
              <b>{recTierMg.toFixed(2)} mg of FUZE metamaterial per kg</b> of
              fabric (Tier {recommendedTier}).
            </p>
            <p className="text-sm text-slate-800 leading-relaxed mt-2">
              Apply by{" "}
              <b>
                {(test.applicationMethod || "pad-dry-cure")
                  .toString()
                  .replace(/_/g, "-")
                  .toLowerCase()}
              </b>
              {test.squeezePressure
                ? ` at ${test.squeezePressure} bar squeeze pressure`
                : ""}
              {test.vfdFrequencyHz
                ? `, ${test.vfdFrequencyHz} Hz VFD (≈${fmt(test.lineSpeedMPerMin ?? test.vfdFrequencyHz * 0.295, 1)} m/min line speed)`
                : ""}
              . Dry at{" "}
              <b>
                {test.dryingTemp ? `${test.dryingTemp}°C` : "150°C"} for{" "}
                {test.dryingTime || 2} min
              </b>
              , cure at{" "}
              <b>
                {test.curingTemp ? `${test.curingTemp}°C` : "170°C"} for{" "}
                {test.curingTime || 2} min
              </b>
              . No binder, no auxiliary, no rinse.
            </p>
          </section>
        )}

        {/* Fabric + Method */}
        <section className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="border border-slate-200 rounded p-3">
            <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-2">
              {T.fabricSectionTitle}
            </h2>
            <p className="font-bold text-slate-900">
              {test.fabric?.fuzeNumber ? `FUZE #${test.fabric.fuzeNumber}` : test.fabricLabel}
            </p>
            {/* Brand / factory ownership — required when this card gets emailed
                out so the recipient can see at a glance whose fabric it is. */}
            {(test.fabric?.brand?.name || test.fabric?.factory?.name) && (
              <p className="text-xs text-slate-600 mt-0.5">
                {test.fabric?.brand?.name && (
                  <>
                    {T.brandColon} <b className="text-slate-800">{test.fabric.brand.name}</b>
                  </>
                )}
                {test.fabric?.brand?.name && test.fabric?.factory?.name && " · "}
                {test.fabric?.factory?.name && (
                  <>
                    {T.factoryColon} <b className="text-slate-800">{test.fabric.factory.name}</b>
                  </>
                )}
              </p>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-xs text-slate-700">
              {test.fabric?.customerCode && (
                <>
                  <span>{T.brandItemLabel}</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {test.fabric.customerCode}
                  </span>
                </>
              )}
              {test.fabric?.factoryCode && (
                <>
                  <span>{T.factoryItemLabel}</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {test.fabric.factoryCode}
                  </span>
                </>
              )}
              <span>{T.typeLabel}</span>
              <span>{test.fabricType || test.fabric?.fabricCategory || "—"}</span>
              <span>{T.fiberLabel}</span>
              <span>{test.fiberContent || "—"}</span>
              <span>{T.weightLabel}</span>
              <span>
                {test.fabricWeightGsm
                  ? `${test.fabricWeightGsm} g/m²`
                  : test.fabric?.weightGsm
                    ? `${test.fabric.weightGsm} g/m²`
                    : "—"}
              </span>
              {test.fabric?.color && (
                <>
                  <span>{T.colorLabel}</span>
                  <span>{test.fabric.color}</span>
                </>
              )}
            </div>
          </div>
          <div className="border border-slate-200 rounded p-3">
            <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-2">
              {T.methodSectionTitle}
            </h2>
            <p className="font-bold text-slate-900">
              {(test.applicationMethod || "—").replace(/_/g, "-")}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-xs text-slate-700">
              <span>{T.squeezeLabel}</span>
              <span>{test.squeezePressure ? `${test.squeezePressure} bar` : "—"}</span>
              {test.vfdFrequencyHz && (
                <>
                  <span>{T.vfdLabel}</span>
                  <span>{test.vfdFrequencyHz} Hz</span>
                  <span>{T.lineSpeedLabel}</span>
                  <span>{fmt(test.lineSpeedMPerMin ?? test.vfdFrequencyHz * 0.295, 2)} m/min</span>
                </>
              )}
              <span>{T.dryingLabel}</span>
              <span>
                {test.dryingTemp ? `${test.dryingTemp}°C × ${test.dryingTime || "—"} min` : "—"}
              </span>
              <span>{T.curingLabel}</span>
              <span>
                {test.curingTemp ? `${test.curingTemp}°C × ${test.curingTime || "—"} min` : "—"}
              </span>
              {test.liquorRatio && (
                <>
                  <span>{T.liquorRatioLabel}</span>
                  <span>{test.liquorRatio}</span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Measurements */}
        <section className="mb-4 border border-slate-300 rounded bg-slate-50 p-3 text-sm">
          <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-2">
            {T.measurementsTitle}
          </h2>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-slate-500">{T.drySampleLabel}</p>
              <p className="font-bold font-mono text-lg">{fmt(test.drySampleWeight, 2)} g</p>
            </div>
            <div>
              <p className="text-slate-500">{T.wetAfterPadLabel}</p>
              <p className="font-bold font-mono text-lg">{fmt(test.wetAfterBathWeight, 2)} g</p>
            </div>
            <div>
              <p className="text-slate-500">{T.pickupDryWetLabel}</p>
              <p className="font-bold font-mono text-lg text-[#00b4c3]">
                {fmt(test.pickupDryToWetPct, 1)} %
              </p>
            </div>
            {test.preWetSampleWeight && (
              <>
                <div>
                  <p className="text-slate-500">{T.preWetLabel}</p>
                  <p className="font-bold font-mono">{fmt(test.preWetSampleWeight, 2)} g</p>
                </div>
                <div>
                  <p className="text-slate-500">{T.wetFromPreWetLabel}</p>
                  <p className="font-bold font-mono">{fmt(test.wetAfterBathFromPreWet, 2)} g</p>
                </div>
                <div>
                  <p className="text-slate-500">{T.pickupWetWetLabel}</p>
                  <p className="font-bold font-mono text-[#00b4c3]">
                    {fmt(test.pickupWetToWetPct, 1)} %
                  </p>
                </div>
              </>
            )}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            {T.pickupUsedTpl
              .replace("{kind}", test.pickupWetToWetPct ? T.pickupWetToWet : T.pickupDryToWet)
              .replace("{pct}", String(fmt(pickupUsed, 1)))
              .replace("{stock}", String(test.stockMgPerL))}
          </p>
        </section>

        {/* Tier recipe cards */}
        <section className="mb-4">
          <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-2">
            {T.bathRecipeTitle}
          </h2>
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
                      <p className="text-slate-500 text-[10px] uppercase">{T.bathConcLabel}</p>
                      <p className="font-mono font-bold">{fmt(bath, 2)} mg/L</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase">{T.dilutionLabel}</p>
                      <p className="font-mono font-bold">1 : {fmt(ratio, 1)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase">{T.fuzePerLLabel}</p>
                      <p className="font-mono font-bold">{fmt(ml, 1)} mL</p>
                    </div>
                    {prodL && (
                      <div className="pt-1 border-t border-slate-200">
                        <p className="text-slate-500 text-[10px] uppercase">
                          {T.forKgPrefixTpl.replace("{kg}", String(test.targetProductionKg))}
                        </p>
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
              {T.targetProdTpl
                .replace("{kg}", String(test.targetProductionKg))
                .replace("{volume}", String(fmt(test.targetBathVolumeL, 1)))}
            </p>
          )}
        </section>

        {/* Quick bath reference */}
        {pickupUsed && (
          <section className="mb-4">
            <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-2">
              {T.quickBathTitle}
            </h2>
            <div className="border border-slate-300 rounded">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-2 py-1">{T.colBath}</th>
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
                        <td className="px-2 py-1 text-right font-mono">
                          {lFuze(1.0) >= 1
                            ? lFuze(1.0).toFixed(2) + " L"
                            : (lFuze(1.0) * 1000).toFixed(0) + " mL"}
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {lFuze(0.75) >= 1
                            ? lFuze(0.75).toFixed(2) + " L"
                            : (lFuze(0.75) * 1000).toFixed(0) + " mL"}
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {lFuze(0.5) >= 1
                            ? lFuze(0.5).toFixed(2) + " L"
                            : (lFuze(0.5) * 1000).toFixed(0) + " mL"}
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {lFuze(0.25) >= 1
                            ? lFuze(0.25).toFixed(2) + " L"
                            : (lFuze(0.25) * 1000).toFixed(0) + " mL"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] text-slate-500 mt-1">
              {T.quickBathFootTpl
                .replace("{pickup}", pickupUsed.toFixed(1))
                .replace("{stock}", String(test.stockMgPerL))}
            </p>
          </section>
        )}

        {test.notes && (
          <section className="mb-4 text-sm">
            <h2 className="font-black text-xs uppercase tracking-wide text-slate-500 mb-1">
              {T.notesTitle}
            </h2>
            <p className="text-slate-700 italic">{test.notes}</p>
          </section>
        )}

        <footer className="pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>{T.footerCompany}</span>
          <span>{T.footerPrintedTpl.replace("{when}", new Date().toLocaleString())}</span>
        </footer>
      </div>
    </div>
  );
}
