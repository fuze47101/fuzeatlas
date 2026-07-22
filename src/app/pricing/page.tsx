"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { calcQuote, money, CURRENCIES, type WidthUnit, type CostAdder } from "@/lib/fuze-calc";
import { useI18n } from "@/i18n";
// Item 5 — the competitor comparison + Environmental Score moved to
// /environmental-score. The pricing page is pricing-only now; it just needs
// the tier ladder + number/uid helpers, shared from pricing-tiers.
import { FUZE_TIERS, num, uid } from "@/lib/pricing-tiers";

// ─── Main Page ────────────────────────────────
export default function PricingPage() {
  const { t } = useI18n();
  const T = t.pricingPage;

  // Quote inputs
  const [gsm, setGsm] = useState<number | "">(150);
  const [widthUnit, setWidthUnit] = useState<WidthUnit>("in");
  const [width, setWidth] = useState(60);
  const [dose, setDose] = useState(1.0);
  const [pricePerLiter, setPricePerLiter] = useState(36);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [lengthMeters, setLengthMeters] = useState<number | "">("");

  // Currency
  const [currency, setCurrency] = useState("USD");
  const [fxRate, setFxRate] = useState(1);

  // Factory adders
  const [adders, setAdders] = useState<CostAdder[]>([
    { id: "moq", label: "Below MOQ", centsPerMeter: 0, enabled: true },
    { id: "waste", label: "Waste in application bath", centsPerMeter: 0, enabled: true },
    { id: "process", label: "Additional processing", centsPerMeter: 0, enabled: true },
  ]);

  // Target washes locked to selected tier
  const activeTier = FUZE_TIERS.find(t => t.dose === dose) || FUZE_TIERS[0];

  // Calculate FUZE quote
  const outputs = useMemo(() => calcQuote({
    gsm: gsm || 0, width, widthUnit, doseMgPerKg: dose,
    stockMgPerL: 30, pricePerLiter, discountPercent,
    lengthMeters: typeof lengthMeters === "number" ? lengthMeters : undefined,
    adders,
  }), [gsm, width, widthUnit, dose, pricePerLiter, discountPercent, lengthMeters, adders]);

  const fx = currency === "USD" ? 1 : fxRate;

  // Item 9 — surface a direct-pricing prompt at very large volumes. Purely
  // informational; it does NOT alter the computed quote.
  const showVolumePrompt = typeof lengthMeters === "number" && lengthMeters > 1_000_000;

  // Adder helpers
  const addRow = () => setAdders(prev => [...prev, { id: uid(), label: "Custom", centsPerMeter: 0, enabled: true }]);
  const removeRow = (id: string) => setAdders(prev => prev.filter(a => a.id !== id));
  const updateAdder = (id: string, patch: Partial<CostAdder>) => {
    setAdders(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/dashboard" className="hover:text-[#00b4c3]">{T.crumbDashboard}</Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">{T.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{T.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {T.pageSubtitle}
        </p>
      </div>

      {/* ═══ TOP SECTION: FUZE Quote Calculator ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Inputs */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{T.calculatorTitle}</h2>

          {/* Currency & Units */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{T.currencyLabel}</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            {currency !== "USD" && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{T.fxRateLabel}</label>
                <input
                  type="number"
                  value={fxRate}
                  onChange={(e) => setFxRate(Number(e.target.value) || 1)}
                  className="h-9 w-24 rounded-lg border border-slate-300 px-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{T.widthUnitLabel}</label>
              <div className="flex gap-1">
                <button onClick={() => setWidthUnit("in")}
                  className={`px-3 py-1.5 text-sm rounded-lg ${widthUnit === "in" ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>
                  {T.widthUnitInches}
                </button>
                <button onClick={() => setWidthUnit("m")}
                  className={`px-3 py-1.5 text-sm rounded-lg ${widthUnit === "m" ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>
                  {T.widthUnitMeters}
                </button>
              </div>
            </div>
          </div>

          {/* FUZE Application Tier */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-600 mb-2">{T.tierSectionLabel}</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {FUZE_TIERS.map(tier => {
                const selected = dose === tier.dose;
                return (
                  <button
                    key={tier.id}
                    onClick={() => setDose(tier.dose)}
                    className={`relative rounded-xl p-3 text-left transition-all border-2 ${
                      selected
                        ? "border-[#00b4c3] bg-gradient-to-br from-[#00b4c3]/5 to-[#009ba8]/10 shadow-md ring-1 ring-[#00b4c3]/30"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className={`inline-flex items-center gap-1.5 mb-1.5`}>
                      <span className={`inline-block w-8 h-8 rounded-lg bg-gradient-to-br ${tier.color} text-white text-xs font-black flex items-center justify-center shadow-sm`}>
                        {tier.id}
                      </span>
                      <span className="text-sm font-bold text-slate-800">{tier.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 leading-snug">{tier.desc}</div>
                    {selected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#00b4c3] flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fabric Inputs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{T.fabricWeightLabel}</label>
              <input type="number" value={gsm} min={0} onChange={(e) => setGsm(e.target.value === "" ? "" : Number(e.target.value))}
                onBlur={() => { if (gsm === "") setGsm(0); }}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{widthUnit === "in" ? T.widthInchesLabel : T.widthMetersLabel}</label>
              <input type="number" value={width} min={0} step="0.01" onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{T.priceLabel}</label>
              <input type="number" value={pricePerLiter} min={0} step={0.01} onChange={(e) => setPricePerLiter(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{T.discountLabel}</label>
              <input type="number" value={discountPercent} min={0} max={100} step={0.5} onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{T.jobLengthLabel}</label>
              <input type="number" value={lengthMeters} min={0} placeholder={T.optionalPlaceholder}
                onChange={(e) => setLengthMeters(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
          </div>

          {/* Item 9 — direct-pricing prompt at very large volumes. Does not
              change the computed number above; just surfaces the AM path. */}
          {showVolumePrompt && (
            <div className="mb-4 rounded-xl border-2 border-[#00b4c3] bg-[#00b4c3]/5 p-4 flex items-start gap-3">
              <span className="text-2xl leading-none">📞</span>
              <div>
                <div className="text-sm font-bold text-slate-800">{T.volumePromptTitle}</div>
                <p className="text-xs text-slate-600 mt-0.5">{T.volumePromptBody}</p>
              </div>
            </div>
          )}

          {/* Factory Adders */}
          <div className="border-t border-slate-100 pt-4 mt-4">
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm font-semibold text-slate-700">{T.addersTitle}</div>
              <button onClick={addRow} className="text-xs text-[#00b4c3] hover:text-[#009ba8] font-medium">{T.addRow}</button>
            </div>
            <div className="space-y-2">
              {adders.map(a => (
                <div key={a.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={a.enabled} onChange={(e) => updateAdder(a.id, { enabled: e.target.checked })} className="w-4 h-4 rounded" />
                  <input value={a.label} onChange={(e) => updateAdder(a.id, { label: e.target.value })}
                    className="flex-1 h-8 rounded-lg border border-slate-300 px-2 text-sm" />
                  <input type="number" value={a.centsPerMeter} step={1} onChange={(e) => updateAdder(a.id, { centsPerMeter: Number(e.target.value) })}
                    className="w-20 h-8 rounded-lg border border-slate-300 px-2 text-sm" />
                  <button onClick={() => removeRow(a.id)} className="text-slate-400 hover:text-red-500 text-lg">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quote Output */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">{T.quoteTitle}</h2>
          <div className="text-xs text-slate-500 mb-4">{FUZE_TIERS.find(ti => ti.dose === dose)?.id || T.customTier} — {FUZE_TIERS.find(ti => ti.dose === dose)?.name || T.customTierName}</div>
          <div className="bg-gradient-to-br from-[#00b4c3]/5 to-[#009ba8]/5 rounded-xl border border-[#00b4c3]/20 p-5 mb-4">
            <div className="text-xs text-slate-500 mb-1">{T.totalCostLabel}</div>
            <div className="text-3xl font-bold text-slate-900">{money(outputs.totalCostPerLinearMeter, currency, fx)}<span className="text-sm font-normal text-slate-500"> /m</span></div>
            <div className="text-2xl font-semibold text-slate-700 mt-2">{money(outputs.costPerYard, currency, fx)}<span className="text-sm font-normal text-slate-500"> /yd</span></div>
            <div className="text-2xl font-semibold text-slate-700">{money(outputs.costPerKg, currency, fx)}<span className="text-sm font-normal text-slate-500"> /kg</span></div>
            <div className="text-2xl font-semibold text-slate-700">{money(outputs.costPerLb, currency, fx)}<span className="text-sm font-normal text-slate-500"> /lb</span></div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">FUZE {FUZE_TIERS.find(ti => ti.dose === dose)?.id || ""} {T.fuzeCostLabel}</span><span className="font-medium">{money(outputs.fuzeCostPerLinearMeter, currency, fx)}/m</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{T.addersLabel}</span><span className="font-medium">{money(outputs.addersPerLinearMeter, currency, fx)}/m</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{T.fabricWeightFieldLabel}</span><span className="font-medium">{num(outputs.kgPerLinearMeter, 4)} kg/m</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{T.stockPerMeterLabel}</span><span className="font-medium">{num(outputs.litersStockPerLinearMeter, 6)} L</span></div>
            {outputs.bottles19L !== undefined && (
              <>
                <div className="border-t border-slate-100 pt-2 mt-2" />
                <div className="flex justify-between"><span className="text-slate-500">{T.totalStockLabel}</span><span className="font-medium">{num(outputs.totalLitersStock!, 2)} L</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{T.bottlesLabel}</span><span className="font-medium">{outputs.bottles19L}</span></div>
              </>
            )}
          </div>

          {/* Performance note */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
            {(() => {
              const tier = FUZE_TIERS.find(ti => ti.dose === dose);
              if (!tier) return <><span className="font-semibold text-slate-600">{T.customTierNote}</span></>;
              return <><span className={`font-semibold ${
                tier.id === "F1" ? "text-emerald-600" : tier.id === "F2" ? "text-teal-600" : tier.id === "F3" ? "text-cyan-600" : "text-sky-600"
              }`}>{tier.id} — {tier.name}:</span> {tier.desc} · {T.permanentNote}</>;
            })()}
          </div>

          <div className="mt-3 text-[10px] text-slate-400">{T.stockFooter}</div>
        </div>
      </div>
    </div>
  );
}
