"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { calcQuote, money, CURRENCIES, type WidthUnit, type CostAdder } from "@/lib/fuze-calc";
import { COMPETITORS, FUZE, calcEnvironmentalScore, type Competitor } from "@/lib/competitors";

// ─── Helpers ──────────────────────────────────
function uid() { return Math.random().toString(16).slice(2); }
function num(n: number, digits = 4) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

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
  const [targetWashes, setTargetWashes] = useState(50);
  const competitor = COMPETITORS.find(c => c.id === competitorId) || null;

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
    // Approximate fabric weight for 1 meter of fabric
    const fabricWeightKg = outputs.kgPerLinearMeter || 0.15;
    return calcEnvironmentalScore(competitor, fabricWeightKg, targetWashes);
  }, [competitor, outputs.kgPerLinearMeter, targetWashes]);

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
              <label className="block text-xs font-medium text-slate-600 mb-1">Target F1 (mg/kg)</label>
              <input type="number" value={dose} min={0.1} max={2.0} step={0.05} onChange={(e) => setDose(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">F1 Price ($/L)</label>
              <input type="number" value={pricePerLiter} min={0} step={0.01} onChange={(e) => setPricePerLiter(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Discount (%)</label>
              <input type="number" value={discountPercent} min={0} max={100} step={0.5} onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Job Length (m)</label>
              <input type="number" value={lengthMeters} min={0} placeholder="Optional"
                onChange={(e) => setLengthMeters(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
          </div>

          {/* Dose slider */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-slate-600">Application Level</label>
              <span className="text-sm font-semibold text-[#00b4c3]">{dose.toFixed(2)} mg/kg</span>
            </div>
            <input type="range" min={0.2} max={2.0} step={0.05} value={dose}
              onChange={(e) => setDose(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#00b4c3]" />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0.20</span>
              <span>0.50 (cost-opt)</span>
              <span>1.00 (recommended)</span>
              <span>2.00</span>
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
          <h2 className="text-lg font-semibold text-slate-800 mb-4">FUZE Quote</h2>
          <div className="bg-gradient-to-br from-[#00b4c3]/5 to-[#009ba8]/5 rounded-xl border border-[#00b4c3]/20 p-5 mb-4">
            <div className="text-xs text-slate-500 mb-1">Total Quoted Cost</div>
            <div className="text-3xl font-bold text-slate-900">{money(outputs.totalCostPerLinearMeter, currency, fx)}<span className="text-sm font-normal text-slate-500"> /m</span></div>
            <div className="text-2xl font-semibold text-slate-700 mt-2">{money(outputs.costPerYard, currency, fx)}<span className="text-sm font-normal text-slate-500"> /yd</span></div>
            <div className="text-2xl font-semibold text-slate-700">{money(outputs.costPerKg, currency, fx)}<span className="text-sm font-normal text-slate-500"> /kg</span></div>
            <div className="text-2xl font-semibold text-slate-700">{money(outputs.costPerLb, currency, fx)}<span className="text-sm font-normal text-slate-500"> /lb</span></div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">F1 cost</span><span className="font-medium">{money(outputs.fuzeCostPerLinearMeter, currency, fx)}/m</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Adders</span><span className="font-medium">{money(outputs.addersPerLinearMeter, currency, fx)}/m</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Fabric weight</span><span className="font-medium">{num(outputs.kgPerLinearMeter, 4)} kg/m</span></div>
            <div className="flex justify-between"><span className="text-slate-500">F1 stock/meter</span><span className="font-medium">{num(outputs.litersStockPerLinearMeter, 6)} L</span></div>
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
            {dose >= 1.0 ? (
              <><span className="font-semibold text-emerald-600">Premium level:</span> 99.99% antimicrobial, 100+ washes. Eligible for FUZE certification.</>
            ) : dose >= 0.5 ? (
              <><span className="font-semibold text-amber-600">Cost-optimized:</span> 99.99% antimicrobial, up to 50 washes. Tighter process control recommended.</>
            ) : (
              <><span className="font-semibold text-orange-600">Below standard:</span> Effective but reduced durability. Validate for program requirements.</>
            )}
          </div>

          <div className="mt-3 text-[10px] text-slate-400">F1 stock: 30 ppm · Bottle: 19 L</div>
        </div>
      </div>

      {/* ═══ BOTTOM SECTION: Competitor Comparison ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Competitor Displacement Analysis</h2>
        <p className="text-sm text-slate-500 mb-6">Select the antimicrobial your customer currently uses to see environmental and cost savings.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Current Competitor Product</label>
            <select
              value={competitorId}
              onChange={(e) => setCompetitorId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">Select competitor...</option>
              {COMPETITORS.map(c => (
                <option key={c.id} value={c.id}>{c.company} — {c.product}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Target Wash Durability</label>
            <div className="flex gap-2">
              {[30, 50, 75, 100].map(w => (
                <button key={w} onClick={() => setTargetWashes(w)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    targetWashes === w
                      ? "bg-[#00b4c3] text-white shadow"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Or enter custom washes</label>
            <input type="number" value={targetWashes} min={1} max={200}
              onChange={(e) => setTargetWashes(Number(e.target.value) || 50)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
        </div>

        {/* Competitor Info + Env Score */}
        {competitor && envScore && (
          <div className="space-y-6">
            {/* Competitor Profile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-50/50 border border-red-200/50 rounded-xl p-4">
                <div className="text-xs font-semibold text-red-800/60 uppercase tracking-wider mb-2">Competitor: {competitor.product}</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Chemistry</span><span className="font-medium text-slate-700">{competitor.chemistryLabel}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Typical dosage</span><span className="font-medium text-slate-700">{competitor.dosageTypical} ppm</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Max wash claim</span><span className="font-medium text-red-600">{competitor.maxWashClaim} washes</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Binder required</span><span className="font-medium text-red-600">{competitor.binderRequired ? `Yes (${competitor.binderGPerKg} g/kg)` : "No"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Curing required</span><span className="font-medium text-red-600">{competitor.curingRequired ? "Yes" : "No"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Leach rate (10 washes)</span><span className="font-medium text-red-600">{competitor.leachRateFirst10Washes}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Heavy metals released</span><span className="font-medium text-red-600">{competitor.heavyMetalReleased}</span></div>
                </div>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-200/50 rounded-xl p-4">
                <div className="text-xs font-semibold text-emerald-800/60 uppercase tracking-wider mb-2">FUZE F1</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Chemistry</span><span className="font-medium text-slate-700">Silver Allotrope (Non-ionic)</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Dosage</span><span className="font-medium text-emerald-600">{dose} mg/kg ({(competitor.dosageTypical / dose).toFixed(0)}× less)</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Wash durability</span><span className="font-medium text-emerald-600">Lifetime (100+) — EPA verified</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Binder required</span><span className="font-medium text-emerald-600">No</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Curing required</span><span className="font-medium text-emerald-600">No</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Leach rate</span><span className="font-medium text-emerald-600">0% — Zero ion emissions</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Heavy metals released</span><span className="font-medium text-emerald-600">None</span></div>
                </div>
              </div>
            </div>

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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-2xl font-bold text-emerald-400">{num(envScore.chemistrySavedMg, 1)}<span className="text-sm font-normal text-slate-400"> mg</span></div>
                  <div className="text-xs text-slate-400 mt-1">Chemistry eliminated</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Active agent not manufactured, shipped, or applied</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-2xl font-bold text-blue-400">{num(envScore.metalToWaterMg, 1)}<span className="text-sm font-normal text-slate-400"> mg</span></div>
                  <div className="text-xs text-slate-400 mt-1">Metals/toxins kept from water</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Over {targetWashes} home laundry cycles</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-2xl font-bold text-amber-400">{num(envScore.binderSavedG, 2)}<span className="text-sm font-normal text-slate-400"> g</span></div>
                  <div className="text-xs text-slate-400 mt-1">Binder chemistry saved</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Petrochemical polymer not needed</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-2xl font-bold text-rose-400">{envScore.unprotectedWashes}<span className="text-sm font-normal text-slate-400"> washes</span></div>
                  <div className="text-xs text-slate-400 mt-1">Unprotected gap</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Washes where competitor fails but customer expects protection</div>
                </div>
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
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-sm font-semibold text-slate-700 mb-4">Wash Protection Timeline — {targetWashes} Washes</div>
              <div className="space-y-3">
                {/* FUZE bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-emerald-600">FUZE F1</span>
                    <span className="text-slate-500">{targetWashes}/{targetWashes} washes protected</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full flex items-center justify-end pr-2" style={{ width: "100%" }}>
                      <span className="text-[10px] font-bold text-white">100%</span>
                    </div>
                  </div>
                </div>
                {/* Competitor bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-red-600">{competitor.product}</span>
                    <span className="text-slate-500">{Math.min(competitor.maxWashClaim, targetWashes)}/{targetWashes} washes</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-6 overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-l-full flex items-center justify-end pr-2"
                      style={{ width: `${Math.min(100, (competitor.maxWashClaim / targetWashes) * 100)}%` }}
                    >
                      <span className="text-[10px] font-bold text-white">{Math.round((Math.min(competitor.maxWashClaim, targetWashes) / targetWashes) * 100)}%</span>
                    </div>
                    {envScore.unprotectedWashes > 0 && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-red-600">
                        {envScore.unprotectedWashes} washes unprotected
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer-Facing Messages */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl p-4">
                <div className="text-emerald-700 font-semibold text-sm mb-2">Zero Chemistry in Your Water</div>
                <p className="text-xs text-emerald-600/80">
                  Every wash with {competitor.product} releases {competitor.heavyMetalReleased.toLowerCase() !== "none" ? competitor.heavyMetalReleased.toLowerCase() : "toxic compounds"} into
                  your local water system. With FUZE, your water stays clean.
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-4">
                <div className="text-blue-700 font-semibold text-sm mb-2">{(competitor.dosageTypical / dose).toFixed(0)}× Less Chemistry</div>
                <p className="text-xs text-blue-600/80">
                  FUZE uses {dose} mg/kg vs {competitor.product}&apos;s {competitor.dosageTypical} ppm.
                  That&apos;s {(competitor.dosageTypical / dose).toFixed(0)} times less active material per kilogram of fabric.
                </p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-4">
                <div className="text-amber-700 font-semibold text-sm mb-2">The Only Lifetime Approval</div>
                <p className="text-xs text-amber-600/80">
                  {competitor.product} is limited to {competitor.maxWashClaim} washes. Your customer wants {targetWashes}.
                  Only FUZE has EPA-verified lifetime durability. No re-treatment needed.
                </p>
              </div>
            </div>
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
