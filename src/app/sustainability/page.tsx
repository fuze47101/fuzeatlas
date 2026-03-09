"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { calcQuote, money, type WidthUnit } from "@/lib/fuze-calc";
import { COMPETITORS, applyOverrides, type Competitor, type PriceOverride } from "@/lib/competitors";
import { calcSustainabilityScore, generateESGClaims, FUZE_SUSTAINABILITY } from "@/lib/sustainability";

function num(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function SustainabilityPage() {
  // Admin overrides
  const [priceOverrides, setPriceOverrides] = useState<PriceOverride[]>([]);
  const competitors = useMemo(() => applyOverrides([...COMPETITORS], priceOverrides), [priceOverrides]);

  useEffect(() => {
    fetch("/api/admin/competitor-pricing")
      .then((r) => r.json())
      .then((data) => { if (data.ok && data.overrides) setPriceOverrides(data.overrides); })
      .catch(() => {});
  }, []);

  // Fabric inputs
  const [gsm, setGsm] = useState(150);
  const [width, setWidth] = useState(60);
  const [widthUnit] = useState<WidthUnit>("in");
  const [competitorId, setCompetitorId] = useState("silvadur-930");
  const [targetWashes, setTargetWashes] = useState(100);
  const [metersPerGarment, setMetersPerGarment] = useState(1.5);
  const [annualMeters, setAnnualMeters] = useState(100000);

  const competitor = competitors.find(c => c.id === competitorId) || competitors[0];

  const outputs = useMemo(() => calcQuote({
    gsm, width, widthUnit, doseMgPerKg: 1.0,
    stockMgPerL: 30, pricePerLiter: 36, discountPercent: 0,
    adders: [],
  }), [gsm, width, widthUnit]);

  const fabricWeightKg = outputs.kgPerLinearMeter || 0.15;

  const score = useMemo(
    () => calcSustainabilityScore(competitor, fabricWeightKg, targetWashes, metersPerGarment),
    [competitor, fabricWeightKg, targetWashes, metersPerGarment],
  );

  const esgClaims = useMemo(
    () => generateESGClaims(score, competitor, annualMeters),
    [score, competitor, annualMeters],
  );

  const gradeColor =
    score.sustainabilityScore >= 90 ? "from-emerald-500 to-emerald-600" :
    score.sustainabilityScore >= 70 ? "from-teal-500 to-teal-600" :
    score.sustainabilityScore >= 50 ? "from-amber-500 to-amber-600" : "from-red-500 to-red-600";

  return (
    <div className="max-w-7xl mx-auto p-6 pb-20">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 rounded-3xl p-8 mb-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, #00b4c3 0%, transparent 50%), radial-gradient(circle at 80% 20%, #10b981 0%, transparent 50%)" }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🌍</span>
            <div>
              <h1 className="text-2xl font-bold">FUZE Sustainability Impact Calculator</h1>
              <p className="text-emerald-200 text-sm">Quantify the environmental benefit of switching to FUZE — for ESG reports, brand marketing, and hangtag claims.</p>
            </div>
          </div>

          {/* Certification badges */}
          <div className="flex flex-wrap gap-3 mt-6">
            {FUZE_SUSTAINABILITY.certifications.map(cert => (
              <div key={cert.name} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/20">
                <span className="text-lg">{cert.icon}</span>
                <div>
                  <div className="text-xs font-semibold text-white">{cert.name}</div>
                  <div className="text-[10px] text-emerald-200">{cert.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Input controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Configure Your Comparison</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Current Antimicrobial</label>
            <select value={competitorId} onChange={e => setCompetitorId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm">
              {competitors.map(c => (
                <option key={c.id} value={c.id}>{c.product}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fabric GSM</label>
            <input type="number" value={gsm} onChange={e => setGsm(+e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Width (inches)</label>
            <input type="number" value={width} onChange={e => setWidth(+e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Wash Target</label>
            <input type="number" value={targetWashes} onChange={e => setTargetWashes(+e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Meters/Garment</label>
            <input type="number" value={metersPerGarment} onChange={e => setMetersPerGarment(+e.target.value)} step={0.1}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Annual Production (m)</label>
            <input type="number" value={annualMeters} onChange={e => setAnnualMeters(+e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
        </div>
      </div>

      {/* Big score + per-meter stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Score card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white text-center">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sustainability Score</div>
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br ${gradeColor} text-white font-black text-4xl shadow-xl mb-3`}>
            {score.grade}
          </div>
          <div className="text-3xl font-black">{score.sustainabilityScore}<span className="text-sm font-normal text-slate-400">/100</span></div>
          <div className="w-full bg-white/10 rounded-full h-2 mt-3 overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${gradeColor}`} style={{ width: `${score.sustainabilityScore}%` }} />
          </div>
          <div className="text-xs text-slate-400 mt-3">vs {competitor.product}</div>
        </div>

        {/* Per-meter stats */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <div className="text-3xl font-black text-emerald-700">{num(score.co2SavedPerMeter * 1000, 1)}<span className="text-sm font-normal text-emerald-500"> g</span></div>
          <div className="text-sm font-semibold text-emerald-800 mt-1">CO₂ Saved per Meter</div>
          <div className="text-xs text-emerald-600/70 mt-2">From eliminated binder production ({num(score.co2Breakdown.binderProduction * 1000, 1)}g), curing energy ({num(score.co2Breakdown.curingEnergy * 1000, 1)}g), chemistry ({num(score.co2Breakdown.chemistryProduction * 1000, 1)}g)</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="text-3xl font-black text-blue-700">{num(score.waterSavedPerMeter, 1)}<span className="text-sm font-normal text-blue-500"> L</span></div>
          <div className="text-sm font-semibold text-blue-800 mt-1">Water Saved per Meter</div>
          <div className="text-xs text-blue-600/70 mt-2">Contaminated wastewater not generated — FUZE production and application create zero effluent</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="text-3xl font-black text-amber-700">{num(score.energySavedPerMeter, 3)}<span className="text-sm font-normal text-amber-500"> kWh</span></div>
          <div className="text-sm font-semibold text-amber-800 mt-1">Factory Energy Saved per Meter</div>
          <div className="text-xs text-amber-600/70 mt-2">{competitor.curingRequired ? `No ${competitor.curingTempC}°C curing oven needed — FUZE bonds at ambient temperature` : "Competitor also doesn't require curing"}</div>
        </div>
      </div>

      {/* Per 10,000 garments — the headline number */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-2xl p-8 mb-8 text-white">
        <div className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-4">Per 10,000 Garments — Switching from {competitor.product} to FUZE</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-4xl font-black">{num(score.co2SavedPer10kGarments, 1)}</div>
            <div className="text-emerald-200 text-sm font-medium mt-1">kg CO₂ eliminated</div>
            <div className="text-emerald-300/60 text-xs mt-1">≈ {num(score.co2SavedPer10kGarments / 2.3, 0)} car trips across America</div>
          </div>
          <div>
            <div className="text-4xl font-black">{num(score.waterSavedPer10kGarments, 0)}</div>
            <div className="text-emerald-200 text-sm font-medium mt-1">liters water saved</div>
            <div className="text-emerald-300/60 text-xs mt-1">Contaminated wastewater not created</div>
          </div>
          <div>
            <div className="text-4xl font-black">{num(score.chemicalEliminated10kGarments / 1000, 1)}</div>
            <div className="text-emerald-200 text-sm font-medium mt-1">grams chemistry eliminated</div>
            <div className="text-emerald-300/60 text-xs mt-1">{competitor.heavyMetalReleased} not entering supply chain</div>
          </div>
          <div>
            <div className="text-4xl font-black">{num(score.binderEliminated10kGarments / 1000, 2)}</div>
            <div className="text-emerald-200 text-sm font-medium mt-1">kg binder eliminated</div>
            <div className="text-emerald-300/60 text-xs mt-1">Zero petrochemical polymer binder</div>
          </div>
        </div>
      </div>

      {/* Annual impact at brand scale */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Annual Brand Impact at {num(annualMeters, 0)} Meters/Year</h2>
        <p className="text-xs text-slate-500 mb-6">Numbers your brand can use in ESG reports, sustainability statements, and marketing materials.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {esgClaims.map((claim, i) => (
            <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{claim.icon}</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{claim.category}</span>
              </div>
              <div className="text-sm font-bold text-slate-800 mb-2">{claim.headline}</div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">{claim.detail}</p>
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg inline-block">
                <span className="text-xs font-bold text-emerald-700">{claim.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FUZE Production Profile */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-base font-semibold text-slate-800 mb-1">FUZE Production Sustainability Profile</h2>
        <p className="text-xs text-slate-500 mb-6">How FUZE is made — and why it matters for your brand.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm flex-shrink-0">1</span>
              <div>
                <div className="text-sm font-semibold text-slate-800">Recycled Metal Source</div>
                <p className="text-xs text-slate-500">High density allotrope synthesized from metals recovered from electronic waste streams. No virgin mining required.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm flex-shrink-0">2</span>
              <div>
                <div className="text-sm font-semibold text-slate-800">Laser Synthesis</div>
                <p className="text-xs text-slate-500">30 amp laser is the sole energy source for meta-material production. No heat, no pressure, no chemical reactions. Just physics.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm flex-shrink-0">3</span>
              <div>
                <div className="text-sm font-semibold text-slate-800">99.98% Pure Water</div>
                <p className="text-xs text-slate-500">Product is 99.98% deionized water with FUZE meta-material suspension. No binders, no surfactants, no stabilizers, no additives of any kind.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm flex-shrink-0">4</span>
              <div>
                <div className="text-sm font-semibold text-slate-800">Closed-Loop Packaging</div>
                <p className="text-xs text-slate-500">PET-1 recyclable bottles returned for re-use. Only production waste: periodic DI water filter replacement (non-hazardous).</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">What FUZE Produces Zero Of:</div>
            {[
              { label: "Chemical Effluent", note: "Zero discharge in manufacturing" },
              { label: "Volatile Organic Compounds (VOC)", note: "No off-gassing at any stage" },
              { label: "Air Pollution", note: "No combustion, no chemical reactions" },
              { label: "Hazardous Waste", note: "Nothing requiring special disposal" },
              { label: "Contaminated Water", note: "No process water waste" },
              { label: "Remediation Requirements", note: "No cleanup obligations — ever" },
              { label: "Heavy Metal Leaching", note: "Zero leach rate over garment lifetime" },
              { label: "Microplastic Shedding", note: "No binder = no polymer fragments" },
              { label: "Formaldehyde", note: "No crosslinkers needed" },
              { label: "Factory Curing Energy", note: "Bonds at ambient temperature" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 py-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <div>
                  <span className="text-sm font-medium text-slate-800">{item.label}</span>
                  <span className="text-xs text-slate-400 ml-2">— {item.note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Application methods */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Factory Application Flexibility</h2>
        <p className="text-xs text-slate-500 mb-4">FUZE integrates into your existing process — no equipment modification, no additional steps, no additional energy.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {FUZE_SUSTAINABILITY.applicationMethods.map(m => (
            <div key={m.method} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="text-sm font-semibold text-slate-700">{m.method}</div>
              <div className="text-xs text-slate-500 mt-1">{m.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-links */}
      <div className="flex gap-4">
        <Link href="/pricing" className="flex-1 text-center py-3 bg-[#00b4c3] text-white rounded-xl font-semibold text-sm hover:bg-[#00a0b0] transition-colors">
          Pricing & Environmental Comparison Tool →
        </Link>
      </div>
    </div>
  );
}
