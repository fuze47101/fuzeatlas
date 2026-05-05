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

// FUZE application tiers — permanent integration at different concentration levels.
// Internal: dose drives pricing math. Customer-facing: tier name only, no mg references.
//
// Andrew (2026-05-04): every tier is permanent. The dose ladder is NOT a wash-count
// ladder — it's a BENEFIT-STACKING ladder. F4 is where FUZE dominates natural fibers
// (no competitor approaches us on cellulose at this dose). Each step up adds another
// fabric-performance benefit on top of the antimicrobial baseline:
//   F4  → antimicrobial + cotton/natural-fiber dominance
//   F3  → + moisture wicking + faster drying + improved evaporation
//   F2  → + color fastness + UVA/UVB fiber protection
//   F1  → + microfiber shielding (reduces wash shedding) + detergent-chemistry catalysis
type TierBenefit = { icon: string; text: string };

const FUZE_TIERS: ReadonlyArray<{
  id: string;
  name: string;
  dose: number;
  washes: number;
  color: string;
  desc: string;
  pitch: string;
  benefits: ReadonlyArray<TierBenefit>;
  /** True if FUZE outperforms the entire competitive set on natural fibers
   *  at this dose. Used to surface a "cotton dominance" callout. */
  naturalFiberDomination: boolean;
  /** Primary efficacy test where this tier peak-performs. F4/F3 use
   *  ASTM E2149 (dynamic contact, designed for non-leaching antimicrobials)
   *  because that's the mechanism FUZE uses. F1/F2 also pass AATCC 100
   *  (the layered ion-release test that historically advantages leaching
   *  competitors) thanks to higher metamaterial density. See CLAUDE.md
   *  → "CRITICAL: Test Methodology — AATCC 100 vs ASTM E2149". */
  primaryTest: "ASTM E2149" | "ASTM E2149 + AATCC 100";
  testNote: string;
}> = [
  {
    id: "F1",
    name: "Full Spectrum",
    dose: 1.0,
    washes: 100,
    color: "from-emerald-500 to-emerald-600",
    desc: "Every benefit FUZE delivers, stacked. Microfiber shielding and detergent-chemistry catalysis on top of color, UV, drying, and antimicrobial.",
    pitch: "When the brand wants the full performance stack — antimicrobial, fabric performance, color, UV, AND microfiber shielding.",
    naturalFiberDomination: true,
    primaryTest: "ASTM E2149 + AATCC 100",
    testNote: "Sufficient metamaterial density to pass both — the dynamic-contact test (E2149, the mechanism match for non-leaching FUZE) AND the layered ion-release test (AATCC 100, the historical test built around leaching competitors).",
    benefits: [
      { icon: "🦠", text: "Permanent antimicrobial bond — AATCC 100 third-party validated" },
      { icon: "👑", text: "Cotton & natural-fiber dominance — no competitor matches FUZE on cellulose" },
      { icon: "💧", text: "Enhanced moisture wicking" },
      { icon: "🌬️", text: "Faster drying time" },
      { icon: "♨️", text: "Improved evaporation rate" },
      { icon: "🎨", text: "Color fastness improvement" },
      { icon: "☀️", text: "UVA fiber protection" },
      { icon: "🛡️", text: "UVB fiber protection" },
      { icon: "🧵", text: "Microfiber shielding — reduces shedding into wash water" },
      { icon: "✨", text: "Catalyzes home laundry detergent chemistry" },
    ],
  },
  {
    id: "F2",
    name: "Advanced Performance",
    dose: 0.75,
    washes: 75,
    color: "from-teal-500 to-teal-600",
    desc: "Adds color fastness + UVA/UVB fiber protection on top of Core Performance's wicking, drying, and evaporation gains.",
    pitch: "When the brand needs color hold + UV protection in addition to active fabric performance.",
    naturalFiberDomination: true,
    primaryTest: "ASTM E2149 + AATCC 100",
    testNote: "Density is high enough to also pass AATCC 100 — the layered ion-release test that historically advantages leaching competitors. ASTM E2149 (the dynamic-contact test designed for non-leaching chemistries like FUZE) remains the mechanism-correct primary.",
    benefits: [
      { icon: "🦠", text: "Permanent antimicrobial bond — AATCC 100 third-party validated" },
      { icon: "👑", text: "Cotton & natural-fiber dominance" },
      { icon: "💧", text: "Enhanced moisture wicking" },
      { icon: "🌬️", text: "Faster drying time" },
      { icon: "♨️", text: "Improved evaporation rate" },
      { icon: "🎨", text: "Color fastness improvement" },
      { icon: "☀️", text: "UVA fiber protection" },
      { icon: "🛡️", text: "UVB fiber protection" },
    ],
  },
  {
    id: "F3",
    name: "Core Performance",
    dose: 0.5,
    washes: 50,
    color: "from-cyan-500 to-cyan-600",
    desc: "Adds active fabric performance — wicking, drying, evaporation — on top of the antimicrobial baseline.",
    pitch: "When the brand wants performance fabric features (wicking, drying, evaporation) layered on top of antimicrobial.",
    naturalFiberDomination: true,
    primaryTest: "ASTM E2149",
    testNote: "ASTM E2149 is the test designed for non-leaching, contact-kill antimicrobials — exactly how FUZE works. AATCC 100's layered geometry was built around leaching competitors and slows non-leaching contact mechanisms; meet us on the right test.",
    benefits: [
      { icon: "🦠", text: "Permanent antimicrobial bond — AATCC 100 third-party validated" },
      { icon: "👑", text: "Cotton & natural-fiber dominance" },
      { icon: "💧", text: "Enhanced moisture wicking" },
      { icon: "🌬️", text: "Faster drying time" },
      { icon: "♨️", text: "Improved evaporation rate" },
    ],
  },
  {
    id: "F4",
    name: "Essential Protection",
    dose: 0.25,
    washes: 25,
    color: "from-sky-500 to-sky-600",
    desc: "The dose where FUZE dominates natural fibers. No competitor on the market approaches our performance on cotton and cellulose at this concentration.",
    pitch: "When the brand wants the strongest cotton / natural-fiber antimicrobial on the market at the lowest cost. This is where we beat everyone.",
    naturalFiberDomination: true,
    primaryTest: "ASTM E2149",
    testNote: "ASTM E2149 dynamic-contact testing is the right validation method for non-leaching, contact-kill chemistries. FUZE doesn't leach metal into wash water by design — we kill on direct contact, which is exactly what E2149 measures. AATCC 100's stacked layers create dead zones that leaching competitors fill with ion clouds; FUZE has no ion cloud (and we don't want one), so AATCC 100 understates our real-world contact-kill performance at this dose.",
    benefits: [
      { icon: "🦠", text: "Permanent antimicrobial bond — AATCC 100 third-party validated" },
      { icon: "👑", text: "Cotton & natural-fiber dominance — FUZE outperforms every silver-ion / QAC / zinc / chitosan competitor on cellulose at this dose" },
    ],
  },
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

  // Competitor selection
  const [competitorId, setCompetitorId] = useState("");
  const competitor = competitors.find(c => c.id === competitorId) || null;

  // Target washes locked to selected tier
  const activeTier = FUZE_TIERS.find(t => t.dose === dose) || FUZE_TIERS[0];
  const targetWashes = activeTier.washes;

  // Calculate FUZE quote
  const outputs = useMemo(() => calcQuote({
    gsm: gsm || 0, width, widthUnit, doseMgPerKg: dose,
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
        gsm: gsm || 0, width, widthUnit, doseMgPerKg: tier.dose,
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Fabric Weight (GSM)</label>
              <input type="number" value={gsm} min={0} onChange={(e) => setGsm(e.target.value === "" ? "" : Number(e.target.value))}
                onBlur={() => { if (gsm === "") setGsm(0); }}
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
          <div className="text-xs text-slate-500 mb-4">{FUZE_TIERS.find(t => t.dose === dose)?.id || "Custom"} — {FUZE_TIERS.find(t => t.dose === dose)?.name || "Custom Tier"}</div>
          <div className="bg-gradient-to-br from-[#00b4c3]/5 to-[#009ba8]/5 rounded-xl border border-[#00b4c3]/20 p-5 mb-4">
            <div className="text-xs text-slate-500 mb-1">Total Quoted Cost</div>
            <div className="text-3xl font-bold text-slate-900">{money(outputs.totalCostPerLinearMeter, currency, fx)}<span className="text-sm font-normal text-slate-500"> /m</span></div>
            <div className="text-2xl font-semibold text-slate-700 mt-2">{money(outputs.costPerYard, currency, fx)}<span className="text-sm font-normal text-slate-500"> /yd</span></div>
            <div className="text-2xl font-semibold text-slate-700">{money(outputs.costPerKg, currency, fx)}<span className="text-sm font-normal text-slate-500"> /kg</span></div>
            <div className="text-2xl font-semibold text-slate-700">{money(outputs.costPerLb, currency, fx)}<span className="text-sm font-normal text-slate-500"> /lb</span></div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">FUZE {FUZE_TIERS.find(t => t.dose === dose)?.id || ""} cost</span><span className="font-medium">{money(outputs.fuzeCostPerLinearMeter, currency, fx)}/m</span></div>
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
              if (!tier) return <><span className="font-semibold text-slate-600">Custom tier</span></>;
              return <><span className={`font-semibold ${
                tier.id === "F1" ? "text-emerald-600" : tier.id === "F2" ? "text-teal-600" : tier.id === "F3" ? "text-cyan-600" : "text-sky-600"
              }`}>{tier.id} — {tier.name}:</span> {tier.desc} · Permanent attachment — applied once, lasts the life of the textile.</>;
            })()}
          </div>

          <div className="mt-3 text-[10px] text-slate-400">FUZE stock concentration: 30 ppm · Bottle: 19 L</div>
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Competitor Comparison Benchmark</label>
            <div className="h-10 rounded-lg bg-slate-50 border border-slate-200 px-3 flex items-center text-sm font-medium text-slate-700">
              FUZE {activeTier.id} — Permanent integration vs competitor re-application cycles
            </div>
          </div>
        </div>

        {/* Competitor Info + Env Score */}
        {competitor && envScore && costComparisons && (
          <div className="space-y-6">

            {/* ═══ TIER LADDER — what each level unlocks ═══
                Andrew (2026-05-04): "Each tier is permanent. As we add to
                Core / Advanced / Full Spectrum, we layer additional benefits
                of FUZE — drying, wicking, evaporation, color fastness, UVA/UVB
                fiber protection, microfiber shielding, detergent catalysis."
                This block tells that story before we get into the head-to-head. */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-base font-bold text-slate-800">FUZE tier ladder — every tier is permanent</h3>
                <span className="text-[11px] text-slate-400">Each step adds another layer of FUZE performance on top of the antimicrobial baseline</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Show in lowest-to-highest order so the benefit stack reads as
                    a cumulative climb. FUZE_TIERS is F1→F4 in source; reverse
                    the slice for display. */}
                {[...FUZE_TIERS].reverse().map((tier) => {
                  const isActive = tier.dose === dose;
                  return (
                    <button
                      key={tier.id}
                      onClick={() => setDose(tier.dose)}
                      type="button"
                      className={`text-left rounded-xl border p-4 transition-all ${
                        isActive
                          ? "border-emerald-400 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-200"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex w-8 h-8 rounded-lg bg-gradient-to-br ${tier.color} text-white text-[10px] font-black items-center justify-center shrink-0`}>
                          {tier.id}
                        </span>
                        <div className="text-xs font-bold text-slate-800 leading-tight">{tier.name}</div>
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug mb-2">{tier.desc}</div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Validated by · <span className="text-slate-700">{tier.primaryTest}</span>
                      </div>
                      <ul className="space-y-1">
                        {tier.benefits.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-700 leading-tight">
                            <span className="shrink-0 w-3.5 text-center text-[11px]">{b.icon}</span>
                            <span>{b.text}</span>
                          </li>
                        ))}
                      </ul>
                      {isActive && (
                        <div className="mt-2 inline-block text-[10px] font-bold text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5">
                          Selected
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-3 italic">
                Click any tier to make it the active comparison below. Per-meter cost stays flat across the entire wash life of whichever tier you pick — there is no per-wash or per-cycle pricing on FUZE.
              </p>
            </div>

            {/* ═══ ACTIVE-TIER COST COMPARISON ═══
                Andrew (2026-05-04): "The left FUZE side should match the
                selection they are using for the price comparison at the top.
                It should never mention the other application levels at all."
                We show ONLY the tier the user picked — single row, head-to-
                head against the chosen competitor. Cleaner. No multi-tier
                table; no "you'd pay more for F1" sub-narrative. */}
            {(() => {
              const cc = costComparisons.find(c => c.fuzeDose === dose) || costComparisons[0];
              const fuzeMore = cc.fuzeCostPerMeter > cc.competitorTotalCostPerMeter;
              const fuzeLess = cc.fuzeCostPerMeter < cc.competitorTotalCostPerMeter;
              return (
                <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-base font-bold text-slate-800 mb-1">
                    FUZE {activeTier.id} {activeTier.name} vs {competitor.product}
                  </h3>
                  <p className="text-xs text-slate-500 mb-5">
                    Both products are mill-applied. Neither can be reapplied to a garment that has shipped to a customer.
                    What separates them is <span className="font-semibold">whether the wash claim is third-party validated</span>.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* FUZE side — ACTIVE TIER ONLY, with full benefit stack
                        and cotton-dominance hero on F4 (Andrew, 2026-05-04). */}
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`inline-flex w-9 h-9 rounded-lg bg-gradient-to-br ${activeTier.color} text-white text-xs font-black items-center justify-center shrink-0`}>
                          {activeTier.id}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-emerald-800">FUZE {activeTier.id} — {activeTier.name}</div>
                          <div className="text-[10px] text-emerald-700">Permanent · one mill application</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-baseline">
                          <span className="text-emerald-700">Cost per meter</span>
                          <span className="font-black text-2xl text-emerald-700">{money(cc.fuzeCostPerMeter, currency, fx)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-emerald-700">Wash claim</span>
                          <span className="font-bold text-emerald-700">{activeTier.washes} washes</span>
                        </div>

                        {/* F4-only: cotton-dominance hero. This is the angle
                            that closes natural-fiber brands at the lowest dose. */}
                        {activeTier.id === "F4" && (
                          <div className="mt-3 -mx-1 px-3 py-2.5 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Where FUZE dominates</div>
                            <div className="text-sm font-black mt-0.5">Cotton & natural fibers — at this dose, FUZE outperforms every silver-ion / QAC / zinc / chitosan competitor on cellulose</div>
                          </div>
                        )}

                        {/* What this tier delivers — benefit stack */}
                        <div className="pt-2 border-t border-emerald-200">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5">What this tier delivers</div>
                          <ul className="space-y-1.5">
                            {activeTier.benefits.map((b, i) => (
                              <li key={i} className="flex items-start gap-2 text-[12px] text-emerald-800 leading-snug">
                                <span className="shrink-0 w-4 text-center">{b.icon}</span>
                                <span>{b.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Test methodology — the "meet us on the right test" callout */}
                        <div className="pt-2 border-t border-emerald-200 space-y-1">
                          <div className="flex items-baseline justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Validated by</span>
                            <span className="text-[11px] font-bold text-emerald-800">{activeTier.primaryTest}</span>
                          </div>
                          <div className="text-[11px] text-emerald-700/80 leading-snug">{activeTier.testNote}</div>
                          <div className="text-[11px] text-emerald-700/80 italic">Third-party reports available on request. Same per-meter cost across the entire {activeTier.washes}-wash life — no re-application, no per-wash pricing.</div>
                        </div>
                      </div>
                    </div>

                    {/* Competitor side */}
                    <div className="bg-red-50/60 border border-red-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-black items-center justify-center shrink-0">
                          ⚠
                        </span>
                        <div>
                          <div className="text-sm font-bold text-red-800">{competitor.product}</div>
                          <div className="text-[10px] text-red-600">{competitor.company}</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-baseline">
                          <span className="text-red-700">Cost per meter</span>
                          <span className="font-black text-2xl text-red-700">{money(cc.competitorTotalCostPerMeter, currency, fx)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-red-700">Wash claim</span>
                          <span className="font-bold text-red-700">{competitor.maxWashClaim} washes</span>
                        </div>
                        <div className="text-[11px] text-red-700/80 pt-2 border-t border-red-200">
                          {competitor.washClaimSource === "aatcc-100-third-party"
                            ? "Independently validated AATCC 100 data available."
                            : "Self-published marketing claim. No public third-party AATCC 100 validation."}
                          {" "}One mill application — re-application is impossible after the garment ships.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cost delta strip */}
                  <div className="mt-4 flex items-center justify-center text-sm font-semibold gap-2">
                    <span className="text-slate-500">Cost difference at FUZE {activeTier.id}:</span>
                    {fuzeLess && (
                      <span className="text-emerald-600 font-black">{money(cc.competitorTotalCostPerMeter - cc.fuzeCostPerMeter, currency, fx)}/m cheaper than {competitor.product.split(" ")[0]}</span>
                    )}
                    {fuzeMore && (
                      <span className="text-amber-600 font-black">+{money(cc.fuzeCostPerMeter - cc.competitorTotalCostPerMeter, currency, fx)}/m premium for {activeTier.washes}-wash third-party validation</span>
                    )}
                    {!fuzeMore && !fuzeLess && (
                      <span className="text-slate-700 font-black">price match — pivot the conversation to chemistry, leaching, and validated wash data</span>
                    )}
                  </div>

                  {/* Explainer */}
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="text-xs font-semibold text-emerald-800 mb-1.5">What you can actually defend in a brand conversation</div>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      <strong>EPA registers an active ingredient as a pesticide. EPA does NOT validate any wash count claim.</strong>
                      &nbsp;Every &ldquo;25 washes&rdquo; / &ldquo;50 washes&rdquo; / &ldquo;lifetime of garment&rdquo; number on a competitor data sheet
                      comes from that company&apos;s own AATCC 100 testing on samples of their choosing in conditions of their choosing —
                      there is no public independent validation. {competitor.product}&apos;s {competitor.maxWashClaim}-wash number is
                      {competitor.washClaimSource === "aatcc-100-third-party" ? " independently validated." : " self-published marketing."}{" "}
                      FUZE shares its third-party reports for the tier you select with brands on request — that&apos;s the asymmetry that closes the deal.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* ═══ MEET US ON THE RIGHT TEST ═══
                Test methodology weapon — surfaces the AATCC 100 vs ASTM E2149
                framing Andrew briefed 2026-05-04. AATCC 100 was designed for
                LEACHING antimicrobials (silver-ion, AgCl, QAC, zinc) — the
                stacked-layer ion-release test geometry advantages chemistries
                that release toxic metal into the wash water. FUZE doesn't
                leach by design; we kill on direct contact, which is exactly
                what ASTM E2149 measures. F4/F3 peak-perform on E2149; F1/F2
                also pass AATCC 100 by virtue of higher metamaterial density. */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-base font-bold text-white">Meet us on the right test</h3>
                <span className="text-[11px] text-slate-400">ASTM E2149 vs AATCC 100 — why the test matters as much as the result</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-900/40 border border-emerald-700/50 rounded-xl p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1">
                    ASTM E2149 — the right test for FUZE
                  </div>
                  <div className="text-sm font-semibold text-emerald-100 mb-2">Dynamic-contact antimicrobial test</div>
                  <p className="text-[12px] text-emerald-100/90 leading-relaxed">
                    Designed for <strong>non-leaching, contact-kill</strong> antimicrobials. The treated fabric is shaken
                    in a buffered bacterial suspension; reduction is measured after a defined contact period.
                    No ion cloud required. No leaching tolerated. The test rewards direct surface contact —
                    which is exactly how FUZE metamaterial dismantles bacteria once it&apos;s permanently
                    bonded into the fiber.
                  </p>
                </div>
                <div className="bg-slate-700/50 border border-slate-500/40 rounded-xl p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    AATCC 100 — the test built for leaching competitors
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mb-2">Stacked-layer ion-release test</div>
                  <p className="text-[12px] text-slate-200/90 leading-relaxed">
                    Stacks multiple fabric layers around an inoculated coupon and measures CFUs after a
                    contact period. Silver-ion / AgCl / zinc / QAC chemistries <strong>release ions into
                    the inter-layer moisture</strong> — that ion field saturates the dead zones between
                    layers and kills bacteria there. FUZE has no ion cloud (and we don&apos;t want one),
                    so bacteria in those voids survive longer. The test geometry advantages leaching
                    chemistries.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
                {[...FUZE_TIERS].reverse().map((tier) => (
                  <div key={tier.id} className={`rounded-lg border px-3 py-2 ${tier.dose === dose ? "border-emerald-400 bg-emerald-900/30" : "border-slate-600 bg-slate-800/40"}`}>
                    <div className="font-bold text-white">{tier.id} — {tier.name}</div>
                    <div className="text-slate-300 mt-0.5">{tier.primaryTest}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-slate-300 italic leading-relaxed">
                F4 Essential and F3 Core are validated on ASTM E2149 — the mechanism-correct test
                for non-leaching FUZE. F2 Advanced and F1 Full Spectrum carry enough metamaterial
                density to also pass AATCC 100, the historical layered test built around the
                competitive set. We share third-party reports for whichever tier the brand picks.
              </p>
            </div>

            {/* Chemistry + Cost side-by-side for ACTIVE tier */}
            {(() => {
              const cc = costComparisons.find(c => c.fuzeDose === dose);
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-red-50/50 border border-red-200/50 rounded-xl p-4">
                    <div className="text-xs font-semibold text-red-800/60 uppercase tracking-wider mb-2">
                      {competitor.product} — Requires Re-Application
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Chemistry</span><span className="font-medium text-slate-700">{competitor.chemistryLabel}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Est. chemical price</span><span className="font-medium text-slate-700">${competitor.chemicalPricePerKg}/kg</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Single app dosage</span><span className="font-medium text-slate-700">{competitor.dosageTypical} ppm</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Durability claim</span><span className="font-medium text-red-600">{competitor.maxWashClaim} wash cycles before re-treatment</span></div>
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
                      <div className="flex justify-between"><span className="text-slate-500">Chemistry</span><span className="font-medium text-slate-700">High Density Allotrope (Non-ionic)</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Application</span><span className="font-medium text-emerald-600">Single permanent integration</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Attachment</span><span className="font-medium text-emerald-600">Permanent — EPA verified · Lasts life of textile</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Re-treatments needed</span><span className="font-bold text-emerald-600">None — applied once</span></div>
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
                  <div className="text-sm text-slate-400 mt-0.5">Per linear meter of fabric · Full product lifecycle</div>
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

            {/* ═══ EPA REGISTRATION COMPARISON ═══ */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-base font-bold text-slate-800 mb-1">EPA Registration Comparison</h3>
              <p className="text-xs text-slate-500 mb-4">
                Many competitor products were registered decades ago under far less stringent efficacy and toxicity standards.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Competitor EPA */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm font-semibold text-red-800">{competitor.product}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">EPA Reg #:</span>
                      <span className="font-mono text-red-700 text-xs">{competitor.epaRegNumber}</span>
                    </div>
                    {competitor.epaRegYear && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">First registered:</span>
                        <span className="font-bold text-red-700">
                          {competitor.epaRegYear}
                          <span className="text-slate-400 font-normal ml-1">({new Date().getFullYear() - competitor.epaRegYear} years ago)</span>
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Chemistry:</span>
                      <span className="text-slate-700">{competitor.chemistryLabel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Max wash claim:</span>
                      <span className="text-slate-700">{competitor.maxWashClaim} washes</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-red-200 text-xs text-red-600/80">
                      {competitor.epaRegNote}
                    </div>
                    {competitor.epaLabelUrl && (
                      <a
                        href={competitor.epaLabelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium mt-1"
                      >
                        View EPA label / product page
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>

                {/* FUZE EPA */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-800">FUZE Antimicrobial</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">EPA Status:</span>
                      <span className="font-bold text-emerald-700">EPA Lifetime Approval</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Durability:</span>
                      <span className="font-bold text-emerald-700">Lifetime (100+ washes)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Binder Required:</span>
                      <span className="font-bold text-emerald-700">None</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Curing Required:</span>
                      <span className="font-bold text-emerald-700">None</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Heavy Metal Leaching:</span>
                      <span className="font-bold text-emerald-700">Zero</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Formaldehyde:</span>
                      <span className="font-bold text-emerald-700">None</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-emerald-200 text-xs text-emerald-600/80">
                      FUZE is the only antimicrobial textile treatment with EPA-verified lifetime durability. Single application, no binder, no curing, no environmental discharge.
                    </div>
                  </div>
                </div>
              </div>

              {/* Regulatory era context */}
              {competitor.epaRegYear && competitor.epaRegYear < 2000 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Regulatory Context</div>
                  <p className="text-xs text-amber-600/80">
                    {competitor.product} was first EPA-registered in {competitor.epaRegYear} — {competitor.epaRegYear < 1990 ? "well before" : "before"} the EPA issued PRN 2000-1 in March 2000, which clarified the Treated Articles Exemption for antimicrobials.
                    Products registered in this era had significantly lower requirements for proving efficacy, toxicity testing, and environmental impact than modern standards require.
                    No modern-era re-evaluation of the original registration has been mandated.
                  </p>
                </div>
              )}
            </div>

            {/* ═══ ALL COMPETITORS EPA TABLE ═══ */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-base font-bold text-slate-800 mb-1">Full Competitor EPA Registry</h3>
              <p className="text-xs text-slate-500 mb-4">{competitors.length} competitor products tracked across all chemistry types.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-2 pr-3 font-semibold text-slate-500">Product</th>
                      <th className="py-2 pr-3 font-semibold text-slate-500">Company</th>
                      <th className="py-2 pr-3 font-semibold text-slate-500">Chemistry</th>
                      <th className="py-2 pr-3 font-semibold text-slate-500">EPA Reg #</th>
                      <th className="py-2 pr-3 font-semibold text-slate-500">Year</th>
                      <th className="py-2 pr-3 font-semibold text-slate-500">Washes</th>
                      <th className="py-2 font-semibold text-slate-500">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitors.map(c => (
                      <tr key={c.id} className={`border-b border-slate-100 ${c.id === competitorId ? "bg-red-50" : "hover:bg-slate-50"}`}>
                        <td className="py-2 pr-3 font-medium text-slate-700">{c.product}</td>
                        <td className="py-2 pr-3 text-slate-500">{c.company}</td>
                        <td className="py-2 pr-3 text-slate-500">{c.chemistryLabel}</td>
                        <td className="py-2 pr-3 font-mono text-slate-600">{c.epaRegNumber}</td>
                        <td className="py-2 pr-3">
                          {c.epaRegYear ? (
                            <span className={c.epaRegYear < 2000 ? "text-amber-600 font-bold" : "text-slate-600"}>
                              {c.epaRegYear}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{c.maxWashClaim}</td>
                        <td className="py-2">
                          {c.epaLabelUrl ? (
                            <a href={c.epaLabelUrl} target="_blank" rel="noopener noreferrer" className="text-[#00b4c3] hover:underline">
                              View
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
