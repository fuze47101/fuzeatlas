"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { calcQuote, money, CURRENCIES, type WidthUnit, type CostAdder } from "@/lib/fuze-calc";
import { COMPETITORS, FUZE, calcEnvironmentalScore, calcCostComparison, applyOverrides, type Competitor, type PriceOverride } from "@/lib/competitors";

// ─── Helpers ──────────────────────────────────
function uid() { return Math.random().toString(16).slice(2); }
function num(n: number, digits = 4) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

// FUZE application tiers — each tier maps to a wash durability target for apples-to-apples comparison
const FUZE_TIERS = [
  { id: "F1", name: "Full Spectrum Integration", dose: 1.0, washes: 100, color: "from-emerald-500 to-emerald-600", desc: "99.99% antimicrobial · 100+ washes · EPA certified lifetime" },
  { id: "F2", name: "Advanced Integration", dose: 0.75, washes: 75, color: "from-teal-500 to-teal-600", desc: "99.99% antimicrobial · 75+ washes · High durability" },
  { id: "F3", name: "Core Integration", dose: 0.5, washes: 50, color: "from-cyan-500 to-cyan-600", desc: "99.99% antimicrobial · 50+ washes · Cost-optimized" },
  { id: "F4", name: "Foundation Integration", dose: 0.25, washes: 25, color: "from-sky-500 to-sky-600", desc: "Effective antimicrobial · 25+ washes · Entry level" },
] as const;

function Gradebadge({ grade, score }: { grade: string; score: number }) {
  const color =
    score >= 90 ? "bg-emerald-500" :
    score >= 70 ? "bg-emerald-400" :
    score >= 50 ? "bg-yellow-500" :
    score >= 30 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${color} text-white font-black text-2xl shadow-lg`}>
      {grade}
    </div>
  );
}

// ─── Main Page ────────────────────────────────
export default function PricingPage() {
  // Admin price overrides (fetched from DB)
  const [priceOverrides, setPriceOverrides] = useState<PriceOverride[]>([]);
  const competitors = useMemo(() => applyOverrides([...COMPETITORS], priceOverrides), [priceOverrides]);

  useEffect(() => {
    fetch("/api/admin/competitor-pricing")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.overrides) setPriceOverrides(data.overrides);
      })
      .catch(() => {}); // silent — use guesstimates if fetch fails
  }, []);

  // Quote inputs
  const [gsm, setGsm] = useState(150);
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

  // Competitor selection
  const [competitorId, setCompetitorId] = useState("");
  const competitor = competitors.find(c => c.id === competitorId) || null;

  // Target washes locked to selected tier
  const activeTier = FUZE_TIERS.find(t => t.dose === dose) || FUZE_TIERS[0];
  const targetWashes = activeTier.washes;

  // Calculate FUZE quote
  const outputs = useMemo(() => calcQuote({
    gsm, width, widthUnit, doseMgPerKg: dose,
    stockMgPerL: 30, pricePerLiter, discountPercent,
    lengthMeters: typeof lengthMeters === "number" ? lengthMeters : undefined,
    adders,
  }), [gsm, width, widthUnit, dose, pricePerLiter, discountPercent, lengthMeters, adders]);

  const fx = currency === "USD" ? 1 : fxRate;

  // Environmental score
  const envScore = useMemo(() => {
    if (!competitor) return null;
    const fabricWeightKg = outputs.kgPerLinearMeter || 0.15;
    return calcEnvironmentalScore(competitor, fabricWeightKg, targetWashes);
  }, [competitor, outputs.kgPerLinearMeter, targetWashes]);

  // Apples-to-apples cost comparison across ALL tiers
  const costComparisons = useMemo(() => {
    if (!competitor) return null;
    const fabricWeightKg = outputs.kgPerLinearMeter || 0.15;
    return FUZE_TIERS.map(tier => {
      const tierOutputs = calcQuote({
        gsm, width, widthUnit, doseMgPerKg: tier.dose,
        stockMgPerL: 30, pricePerLiter, discountPercent,
        adders,
      });
      return calcCostComparison(
        competitor,
        tierOutputs.totalCostPerLinearMeter,
        tier.dose,
        tier.washes,
        fabricWeightKg,
      );
    });
  }, [competitor, gsm, width, widthUnit, pricePerLiter, discountPercent, adders, outputs.kgPerLinearMeter]);

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
          <Link href="/dashboard" className="hover:text-[#00b4c3]">Dashboard</Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Pricing & Environmental Comparison</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">FUZE Pricing & Environmental Score</h1>
        <p className="text-sm text-slate-500 mt-1">
          Calculate FUZE application cost, compare against competitors, and generate environmental impact scores.
        </p>
      </div>

      {/* ═══ TOP SECTION: FUZE Quote Calculator ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Inputs */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">FUZE Quote Calculator</h2>

          {/* Currency & Units */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Currency</label>
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
                <label className="block text-xs font-medium text-slate-500 mb-1">1 USD =</label>
                <input
                  type="number"
                  value={fxRate}
                  onChange={(e) => setFxRate(Number(e.target.value) || 1)}
                  className="h-9 w-24 rounded-lg border border-slate-300 px-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Width unit</label>
              <div className="flex gap-1">
                <button onClick={() => setWidthUnit("in")}
                  className={`px-3 py-1.5 text-sm rounded-lg ${widthUnit === "in" ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>
                  Inches
                </button>
                <button onClick={() => setWidthUnit("m")}
                  className={`px-3 py-1.5 text-sm rounded-lg ${widthUnit === "m" ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>
                  Meters
                </button>
              </div>
            </div>
          </div>

          {/* FUZE Application Tier */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-600 mb-2">FUZE Application Tier</label>
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
                      <span className="text-lg font-bold text-slate-800">{tier.dose} mg</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-700 leading-tight">{tier.name}</div>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Fabric Weight (GSM)</label>
              <input type="number" value={gsm} min={0} onChange={(e) => setGsm(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Width ({widthUnit === "in" ? "inches" : "meters"})</label>
              <input type="number" value={width} min={0} step="0.01" onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">FUZE Price ($/L)</label>
              <input type="number" value={pricePerLiter} min={0} step={0.01} onChange={(e) => setPricePerLiter(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Discount (%)</label>
              <input type="number" value={discountPercent} min={0} max={100} step={0.5} onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Job Length (m)</label>
              <input type="number" value={lengthMeters} min={0} placeholder="Optional"
                onChange={(e) => setLengthMeters(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
          </div>

          {/* Factory Adders */}
          <div className="border-t border-slate-100 pt-4 mt-4">
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm font-semibold text-slate-700">Factory Adders (¢/linear meter)</div>
              <button onClick={addRow} className="text-xs text-[#00b4c3] hover:text-[#009ba8] font-medium">+ Add row</button>
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
          <h2 className="text-lg font-semibold text-slate-800 mb-1">FUZE Quote</h2>
          <div className="text-xs text-slate-500 mb-4">{FUZE_TIERS.find(t => t.dose === dose)?.id || "Custom"} — {FUZE_TIERS.find(t => t.dose === dose)?.name || `${dose} mg/kg`} · {dose} mg/kg</div>
          <div className="bg-gradient-to-br from-[#00b4c3]/5 to-[#009ba8]/5 rounded-xl border border-[#00b4c3]/20 p-5 mb-4">
            <div className="text-xs text-slate-500 mb-1">Total Quoted Cost</div>
            <div className="text-3xl font-bold text-slate-900">{money(outputs.totalCostPerLinearMeter, currency, fx)}<span className="text-sm font-normal text-slate-500"> /m</span></div>
            <div className="text-2xl font-semibold text-slate-700 mt-2">{money(outputs.costPerYard, currency, fx)}<span className="text-sm font-normal text-slate-500"> /yd</span></div>
            <div className="text-2xl font-semibold text-slate-700">{money(outputs.costPerKg, currency, fx)}<span className="text-sm font-normal text-slate-500"> /kg</span></div>
            <div className="text-2xl font-semibold text-slate-700">{money(outputs.costPerLb, currency, fx)}<span className="text-sm font-normal text-slate-500"> /lb</span></div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{FUZE_TIERS.find(t => t.dose === dose)?.id || "FUZE"} cost</span><span className="font-medium">{money(outputs.fuzeCostPerLinearMeter, currency, fx)}/m</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Adders</span><span className="font-medium">{money(outputs.addersPerLinearMeter, currency, fx)}/m</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Fabric weight</span><span className="font-medium">{num(outputs.kgPerLinearMeter, 4)} kg/m</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Stock/meter</span><span className="font-medium">{num(outputs.litersStockPerLinearMeter, 6)} L</span></div>
            {outputs.bottles19L !== undefined && (
              <>
                <div className="border-t border-slate-100 pt-2 mt-2" />
                <div className="flex justify-between"><span className="text-slate-500">Total F1 stock</span><span className="font-medium">{num(outputs.totalLitersStock!, 2)} L</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Bottles (19L)</span><span className="font-medium">{outputs.bottles19L}</span></div>
              </>
            )}
          </div>

          {/* Performance note */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
            {(() => {
              const tier = FUZE_TIERS.find(t => t.dose === dose);
              if (!tier) return <><span className="font-semibold text-slate-600">Custom dose:</span> {dose} mg/kg</>;
              return <><span className={`font-semibold ${
                tier.id === "F1" ? "text-emerald-600" : tier.id === "F2" ? "text-teal-600" : tier.id === "F3" ? "text-cyan-600" : "text-sky-600"
              }`}>{tier.id} — {tier.name}:</span> {tier.desc}</>;
            })()}
          </div>

          <div className="mt-3 text-[10px] text-slate-400">FUZE stock: 30 ppm · Bottle: 19 L</div>
        </div>
      </div>

      {/* ═══ BOTTOM SECTION: Competitor Comparison ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-slate-800">Competitor Displacement Analysis</h2>
          <Link href="/admin/competitor-pricing" className="text-xs text-[#00b4c3] hover:underline font-medium">
            Edit Competitor Pricing →
          </Link>
        </div>
        <p className="text-sm text-slate-500 mb-6">Select the antimicrobial your customer currently uses to see environmental and cost savings.{priceOverrides.length > 0 && <span className="ml-2 text-emerald-600 font-medium">({priceOverrides.length} with real intel)</span>}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Current Competitor Product</label>
            <select
              value={competitorId}
              onChange={(e) => setCompetitorId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">Select competitor...</option>
              {competitors.map(c => (
                <option key={c.id} value={c.id}>{c.company} — {c.product}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Wash Target (locked to tier)</label>
            <div className="h-10 rounded-lg bg-slate-50 border border-slate-200 px-3 flex items-center text-sm font-medium text-slate-700">
              {activeTier.id} = {targetWashes} washes — each tier maps to its rated durability for apples-to-apples comparison
            </div>
          </div>
        </div>

        {/* Competitor Info + Env Score */}
        {competitor && envScore && costComparisons && (
          <div className="space-y-6">

            {/* ═══ APPLES-TO-APPLES COST COMPARISON TABLE ═══ */}
            <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-base font-bold text-slate-800 mb-1">True Cost Comparison: FUZE vs {competitor.product}</h3>
              <p className="text-xs text-slate-500 mb-4">
                &ldquo;I pay {money(competitor.estimatedCostPerMeterTypical, currency, fx)}/m for {competitor.product}&rdquo; — but that only covers {competitor.maxWashClaim} washes.
                Here&apos;s what it <span className="font-semibold">actually costs</span> to match FUZE at each durability level.
              </p>

              {/* Table header */}
              <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-200 mb-1">
                <div className="col-span-1">Tier</div>
                <div className="col-span-1 text-right">Washes</div>
                <div className="col-span-1 text-right">FUZE Cost</div>
                <div className="col-span-1 text-center">{competitor.product.split(" ")[0]} Apps</div>
                <div className="col-span-1 text-right">{competitor.product.split(" ")[0]} Cost</div>
                <div className="col-span-1 text-right">You Save</div>
                <div className="col-span-1 text-right">Env. Impact</div>
              </div>

              {/* Table rows */}
              {costComparisons.map((cc, idx) => {
                const tier = FUZE_TIERS[idx];
                const isActive = tier.dose === dose;
                const compMoreExpensive = cc.competitorTotalCostPerMeter > cc.fuzeCostPerMeter;
                return (
                  <div key={tier.id}
                    className={`grid grid-cols-7 gap-2 py-3 text-sm items-center rounded-lg transition-colors ${
                      isActive ? "bg-[#00b4c3]/5 border border-[#00b4c3]/20 -mx-2 px-2" : "border-b border-slate-100"
                    }`}>
                    <div className="col-span-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex w-7 h-7 rounded-lg bg-gradient-to-br ${tier.color} text-white text-[10px] font-black items-center justify-center`}>
                          {tier.id}
                        </span>
                        <div className="hidden md:block">
                          <div className="text-xs font-semibold text-slate-700 leading-tight">{tier.name}</div>
                          <div className="text-[10px] text-slate-400">{tier.dose} mg/kg</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-1 text-right font-semibold text-slate-700">{tier.washes}</div>
                    <div className="col-span-1 text-right">
                      <div className="font-bold text-emerald-600">{money(cc.fuzeCostPerMeter, currency, fx)}</div>
                      <div className="text-[10px] text-slate-400">1 application</div>
                    </div>
                    <div className="col-span-1 text-center">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        cc.competitorApplicationsNeeded > 1 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {cc.competitorApplicationsNeeded}×
                      </div>
                    </div>
                    <div className="col-span-1 text-right">
                      <div className={`font-bold ${compMoreExpensive ? "text-red-600" : "text-slate-700"}`}>{money(cc.competitorTotalCostPerMeter, currency, fx)}</div>
                      {cc.competitorApplicationsNeeded > 1 && (
                        <div className="text-[10px] text-red-500">{money(cc.competitorCostPerApplication, currency, fx)} × {cc.competitorApplicationsNeeded} apps</div>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      {cc.fuzeSavingsPerMeter > 0 ? (
                        <>
                          <div className="font-bold text-emerald-600">{money(cc.fuzeSavingsPerMeter, currency, fx)}</div>
                          <div className="text-[10px] text-emerald-500">{cc.fuzeSavingsPct.toFixed(0)}% cheaper</div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold text-amber-600">{money(Math.abs(cc.fuzeSavingsPerMeter), currency, fx)}</div>
                          <div className="text-[10px] text-amber-500">premium for lifetime</div>
                        </>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      <div className="text-xs font-semibold text-red-600">{num(cc.competitorTotalChemistryMg, 0)} mg</div>
                      <div className="text-[10px] text-slate-400">chemistry used</div>
                      {cc.competitorTotalBinderG > 0 && (
                        <div className="text-[10px] text-red-400">+{num(cc.competitorTotalBinderG, 1)}g binder</div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Explainer */}
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-xs font-semibold text-amber-800 mb-1">Why this matters</div>
                <p className="text-xs text-amber-700">
                  {competitor.product} only lasts {competitor.maxWashClaim} washes.
                  {competitor.maxWashClaim < 100 && (<> To reach 100 washes, a factory would need to treat the fabric {Math.ceil(100 / competitor.maxWashClaim)} separate times — each re-treatment
                  adds cost, binder, curing energy, and more leachable chemistry. </>)}
                  FUZE is applied once and lasts the lifetime of the textile. When you compare actual cost-to-performance, FUZE is the clear winner.
                </p>
              </div>
            </div>

            {/* Chemistry + Cost side-by-side for ACTIVE tier */}
            {(() => {
              const cc = costComparisons.find(c => c.fuzeDose === dose);
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-red-50/50 border border-red-200/50 rounded-xl p-4">
                    <div className="text-xs font-semibold text-red-800/60 uppercase tracking-wider mb-2">
                      {competitor.product} — to reach {targetWashes} washes
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Chemistry</span><span className="font-medium text-slate-700">{competitor.chemistryLabel}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Est. chemical price</span><span className="font-medium text-slate-700">${competitor.chemicalPricePerKg}/kg</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Single app dosage</span><span className="font-medium text-slate-700">{competitor.dosageTypical} ppm</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Max per application</span><span className="font-medium text-red-600">{competitor.maxWashClaim} washes</span></div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Applications needed</span>
                        <span className="font-bold text-red-600">{cc?.competitorApplicationsNeeded || 1}× treatments</span>
                      </div>
                      <div className="border-t border-red-200/50 my-1 pt-1" />
                      <div className="text-[10px] font-semibold text-red-700/60 uppercase tracking-wider">Binder Additive Required</div>
                      <div className="flex justify-between"><span className="text-slate-500">Binder type</span><span className="font-medium text-red-600 text-xs">{competitor.binderType}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Binder per treatment</span><span className="font-medium text-red-600">{competitor.binderGPerKg} g/kg fabric</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Total binder applied</span><span className="font-bold text-red-600">{num(cc?.competitorTotalBinderG || 0, 2)} g</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Binder leaches</span><span className="font-medium text-red-600">{competitor.binderLeachPctLifetime}% over lifetime</span></div>
                      {competitor.binderFormaldehyde && (
                        <div className="flex justify-between"><span className="text-slate-500">Formaldehyde</span><span className="font-medium text-red-600">Contains crosslinker</span></div>
                      )}
                      {competitor.binderVOC && (
                        <div className="flex justify-between"><span className="text-slate-500">VOC during curing</span><span className="font-medium text-red-600">Yes ({competitor.curingTempC}°C cure)</span></div>
                      )}
                      <div className="border-t border-red-200/50 my-1 pt-1" />
                      <div className="text-[10px] font-semibold text-red-700/60 uppercase tracking-wider">Total Environmental Discharge</div>
                      <div className="flex justify-between"><span className="text-slate-500">Active agent leached</span><span className="font-bold text-red-600">{num(cc?.competitorTotalLeachMg || 0, 1)} mg</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Binder leached</span><span className="font-bold text-red-600">{num((cc?.competitorBinderLeachG || 0) * 1000, 0)} mg</span></div>
                      <div className="flex justify-between bg-red-100/50 -mx-1 px-1 rounded">
                        <span className="text-slate-600 font-semibold">TOTAL to water</span>
                        <span className="font-black text-red-700">{num(cc?.competitorTotalDischargeToWaterMg || 0, 0)} mg</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-200/50 rounded-xl p-4">
                    <div className="text-xs font-semibold text-emerald-800/60 uppercase tracking-wider mb-2">FUZE {activeTier.id} — {activeTier.name}</div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Chemistry</span><span className="font-medium text-slate-700">Silver Allotrope (Non-ionic)</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Dosage</span><span className="font-medium text-emerald-600">{dose} mg/kg ({(competitor.dosageTypical / dose).toFixed(0)}× less)</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Wash durability</span><span className="font-medium text-emerald-600">Lifetime (100+) — EPA verified</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Applications needed</span><span className="font-bold text-emerald-600">1× (lifetime)</span></div>
                      <div className="border-t border-emerald-200/50 my-1 pt-1" />
                      <div className="text-[10px] font-semibold text-emerald-700/60 uppercase tracking-wider">No Binder Required</div>
                      <div className="flex justify-between"><span className="text-slate-500">Binder type</span><span className="font-medium text-emerald-600">None — No additive needed</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Binder applied</span><span className="font-medium text-emerald-600">0 g</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Formaldehyde</span><span className="font-medium text-emerald-600">None</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">VOC emissions</span><span className="font-medium text-emerald-600">None — No curing</span></div>
                      <div className="border-t border-emerald-200/50 my-1 pt-1" />
                      <div className="text-[10px] font-semibold text-emerald-700/60 uppercase tracking-wider">Total Environmental Discharge</div>
                      <div className="flex justify-between"><span className="text-slate-500">Active agent leached</span><span className="font-bold text-emerald-600">0 mg</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Binder leached</span><span className="font-bold text-emerald-600">0 mg</span></div>
                      <div className="flex justify-between bg-emerald-100/50 -mx-1 px-1 rounded">
                        <span className="text-slate-600 font-semibold">TOTAL to water</span>
                        <span className="font-black text-emerald-700">0 mg</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Environmental Score Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Environmental Impact Score</div>
                  <div className="text-xl font-bold mt-1">FUZE vs {competitor.product}</div>
                  <div className="text-sm text-slate-400 mt-0.5">Per linear meter of fabric · {targetWashes} wash lifecycle</div>
                </div>
                <Gradebadge grade={envScore.compositeGrade} score={envScore.compositeScore} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {(() => {
                  const cc = costComparisons.find(c => c.fuzeDose === dose);
                  return (<>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl font-bold text-emerald-400">{num(cc ? cc.competitorTotalChemistryMg - cc.fuzeChemistryMg : envScore.chemistrySavedMg, 1)}<span className="text-sm font-normal text-slate-400"> mg</span></div>
                      <div className="text-xs text-slate-400 mt-1">Active agent eliminated</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {cc && cc.competitorApplicationsNeeded > 1
                          ? `Across ${cc.competitorApplicationsNeeded} competitor re-treatments`
                          : "Antimicrobial chemistry not manufactured or applied"}
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl font-bold text-amber-400">{num(cc ? cc.competitorTotalBinderG : envScore.binderSavedG, 2)}<span className="text-sm font-normal text-slate-400"> g</span></div>
                      <div className="text-xs text-slate-400 mt-1">Binder eliminated</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {competitor.binderType}
                        {competitor.binderFormaldehyde ? " + formaldehyde" : ""}
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl font-bold text-blue-400">{num(cc ? cc.competitorTotalLeachMg : envScore.metalToWaterMg, 1)}<span className="text-sm font-normal text-slate-400"> mg</span></div>
                      <div className="text-xs text-slate-400 mt-1">Active agent kept from water</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{competitor.heavyMetalReleased} not discharged</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl font-bold text-purple-400">{num((cc?.competitorBinderLeachG || 0) * 1000, 0)}<span className="text-sm font-normal text-slate-400"> mg</span></div>
                      <div className="text-xs text-slate-400 mt-1">Binder kept from water</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Petrochemical polymer microplastics not shed</div>
                    </div>
                    <div className="bg-red-500/20 rounded-xl p-4 border border-red-500/30">
                      <div className="text-2xl font-bold text-red-400">{num(cc?.competitorTotalDischargeToWaterMg || 0, 0)}<span className="text-sm font-normal text-slate-400"> mg</span></div>
                      <div className="text-xs text-red-300 mt-1 font-semibold">Total discharge eliminated</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Active agent + binder combined — all kept from water</div>
                    </div>
                  </>);
                })()}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-2xl font-bold text-green-400">{num(envScore.carbonReductionKg, 3)}<span className="text-sm font-normal text-slate-400"> kg CO₂</span></div>
                  <div className="text-xs text-slate-400 mt-1">Estimated carbon footprint reduction</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">From eliminated binder production, curing energy, and reduced chemistry manufacturing</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-xs text-slate-400 mb-2">Environmental Composite Score</div>
                  <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-500"
                      style={{ width: `${envScore.compositeScore}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-slate-500">0</span>
                    <span className="text-sm font-bold text-emerald-400">{envScore.compositeScore}/100</span>
                    <span className="text-[10px] text-slate-500">100</span>
                  </div>
                </div>
              </div>

              {/* Toxicity notes */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mt-4">
                <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Competitor Aquatic & Environmental Toxicity</div>
                <p className="text-sm text-slate-300">{competitor.aquaticToxicityNote}</p>
                <p className="text-sm text-slate-400 mt-2">{competitor.endOfLifeNote}</p>
              </div>
            </div>

            {/* Wash Durability Visual */}
            {(() => {
              const cc = costComparisons.find(c => c.fuzeDose === dose);
              const apps = cc?.competitorApplicationsNeeded || 1;
              return (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="text-sm font-semibold text-slate-700 mb-4">Wash Protection Timeline — {targetWashes} Washes</div>
                  <div className="space-y-4">
                    {/* FUZE bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-emerald-600">FUZE {activeTier.id} — 1 Application</span>
                        <span className="text-slate-500">{targetWashes}/{targetWashes} washes — {money(outputs.totalCostPerLinearMeter, currency, fx)}/m</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-7 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full flex items-center justify-center" style={{ width: "100%" }}>
                          <span className="text-[11px] font-bold text-white">Lifetime EPA Protection — Single Application</span>
                        </div>
                      </div>
                    </div>
                    {/* Competitor bar — segmented by re-treatments */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-red-600">{competitor.product} — {apps} Application{apps > 1 ? "s" : ""} Required</span>
                        <span className="text-slate-500">{money(cc?.competitorTotalCostPerMeter || 0, currency, fx)}/m total</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-7 overflow-hidden flex">
                        {Array.from({ length: apps }).map((_, i) => {
                          const segWidth = Math.min(competitor.maxWashClaim, targetWashes - i * competitor.maxWashClaim);
                          const pct = (segWidth / targetWashes) * 100;
                          const isLast = i === apps - 1;
                          const colors = ["from-red-500 to-red-400", "from-orange-500 to-orange-400", "from-amber-500 to-amber-400", "from-yellow-500 to-yellow-400"];
                          return (
                            <div key={i}
                              className={`h-full bg-gradient-to-r ${colors[i % colors.length]} flex items-center justify-center border-r border-white/30 ${i === 0 ? "rounded-l-full" : ""} ${isLast ? "rounded-r-full" : ""}`}
                              style={{ width: `${pct}%` }}
                            >
                              <span className="text-[9px] font-bold text-white whitespace-nowrap px-1">
                                App {i + 1}{i > 0 ? ` (+${Math.round((competitor.retreatmentCostMultiplier - 1) * 100)}% cost)` : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {apps > 1 && (
                        <div className="text-[10px] text-red-500 mt-1 text-center">
                          Each re-treatment requires stripping, re-applying chemistry + binder, and curing again — increasing factory cost, waste, and environmental discharge
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Customer-Facing Messages */}
            {(() => {
              const cc = costComparisons.find(c => c.fuzeDose === dose);
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl p-4">
                    <div className="text-emerald-700 font-semibold text-sm mb-2">
                      {cc && cc.fuzeSavingsPerMeter > 0
                        ? `Save ${money(cc.fuzeSavingsPerMeter, currency, fx)}/m`
                        : "True Cost Winner"}
                    </div>
                    <p className="text-xs text-emerald-600/80">
                      {competitor.product} at {money(competitor.estimatedCostPerMeterTypical, currency, fx)}/m sounds cheap — but that&apos;s only {competitor.maxWashClaim} washes.
                      {cc && cc.competitorApplicationsNeeded > 1 && (<> To match {activeTier.id}&apos;s {targetWashes}-wash durability, you&apos;d need {cc.competitorApplicationsNeeded} treatments costing {money(cc.competitorTotalCostPerMeter, currency, fx)}/m total.</>)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-4">
                    <div className="text-blue-700 font-semibold text-sm mb-2">
                      {cc ? `${num(cc.competitorTotalChemistryMg - cc.fuzeChemistryMg, 0)} mg` : `${(competitor.dosageTypical / dose).toFixed(0)}×`} Less Chemistry
                    </div>
                    <p className="text-xs text-blue-600/80">
                      {cc && cc.competitorApplicationsNeeded > 1
                        ? <>{cc.competitorApplicationsNeeded} applications of {competitor.product} dumps {num(cc.competitorTotalChemistryMg, 0)} mg of {competitor.chemistryLabel.toLowerCase()} into the fabric. FUZE uses just {num(cc.fuzeChemistryMg, 1)} mg.</>
                        : <>FUZE uses {dose} mg/kg vs {competitor.product}&apos;s {competitor.dosageTypical} ppm. That&apos;s {(competitor.dosageTypical / dose).toFixed(0)}× less active material per kilogram of fabric.</>}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200 rounded-xl p-4">
                    <div className="text-rose-700 font-semibold text-sm mb-2">
                      {cc ? `${num(cc.competitorTotalDischargeToWaterMg, 0)} mg` : ""} Total Discharge Eliminated
                    </div>
                    <p className="text-xs text-rose-600/80">
                      {competitor.product} leaches {competitor.heavyMetalReleased.toLowerCase() !== "none" ? competitor.heavyMetalReleased.toLowerCase() : "toxic compounds"} plus
                      {" "}{competitor.binderType.toLowerCase()} binder into factory wastewater and your customer&apos;s home laundry.
                      {cc && (<> That&apos;s {num(cc.competitorTotalLeachMg, 0)} mg of active agent + {num(cc.competitorBinderLeachG * 1000, 0)} mg of binder polymer = {num(cc.competitorTotalDischargeToWaterMg, 0)} mg total per meter.</>)}
                      {" "}FUZE discharges zero. No active agent. No binder. Nothing.
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-4">
                    <div className="text-amber-700 font-semibold text-sm mb-2">The Only Lifetime Approval</div>
                    <p className="text-xs text-amber-600/80">
                      {competitor.product} is limited to {competitor.maxWashClaim} washes — not EPA-approved beyond that.
                      Only FUZE has EPA-verified lifetime durability. One application. No re-treatment. No gaps in protection.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {!competitor && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">🧪</div>
            <div className="text-sm">Select a competitor product above to generate the environmental displacement analysis</div>
          </div>
        )}
      </div>
    </div>
  );
}
