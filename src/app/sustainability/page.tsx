"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { calcQuote, money, type WidthUnit } from "@/lib/fuze-calc";
import { COMPETITORS, applyOverrides, type Competitor, type PriceOverride } from "@/lib/competitors";
import { calcSustainabilityScore, generateESGClaims, FUZE_SUSTAINABILITY, UPSTREAM_MANUFACTURING } from "@/lib/sustainability";

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
  const [brandName, setBrandName] = useState("");
  const [preparedFor, setPreparedFor] = useState("");
  const [reportMode, setReportMode] = useState<"single" | "all">("single");
  const [exporting, setExporting] = useState(false);

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

  // Resolve upstream data for CO2 breakdown display
  const upstreamData = useMemo(() => {
    const ct = competitor.chemistryType;
    const key = ct === "silver_ion" ? "silver_ion"
      : ct === "silver_nano" ? "silver_nano"
      : ct === "silver_chloride" ? "silver_chloride"
      : ct.includes("silver") ? "silver_chloride"
      : ct === "qac_silane" ? "qac_silane"
      : ct.includes("zinc") ? "zinc_pyrithione"
      : ct === "copper" ? "copper"
      : "silver_chloride";
    return UPSTREAM_MANUFACTURING[key] || UPSTREAM_MANUFACTURING.silver_chloride;
  }, [competitor]);

  const gradeColor =
    score.sustainabilityScore >= 90 ? "from-emerald-500 to-emerald-600" :
    score.sustainabilityScore >= 70 ? "from-teal-500 to-teal-600" :
    score.sustainabilityScore >= 50 ? "from-amber-500 to-amber-600" : "from-red-500 to-red-600";

  const competitorGradeColor =
    score.competitorEnvironmentalGrade === "F" ? "from-red-600 to-red-700" :
    score.competitorEnvironmentalGrade === "D" ? "from-red-500 to-orange-600" :
    score.competitorEnvironmentalGrade === "D+" ? "from-orange-500 to-orange-600" :
    score.competitorEnvironmentalGrade === "C" ? "from-amber-500 to-amber-600" :
    score.competitorEnvironmentalGrade === "C+" ? "from-yellow-500 to-amber-500" : "from-teal-500 to-teal-600";

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

      {/* Export Report Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 mb-8 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Export Sustainability + Competitive Intelligence Report</h2>
            <p className="text-xs text-slate-400 mt-1">Generate a branded PDF-ready report with full competitor teardowns, EPA data, and environmental impact analysis.</p>
          </div>
          <button
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const res = await fetch("/api/reports/sustainability-competitive", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    gsm,
                    widthInches: width,
                    targetWashes,
                    metersPerGarment,
                    annualMeters,
                    competitorIds: reportMode === "all" ? "all" : [competitorId],
                    brandName: brandName || undefined,
                    preparedFor: preparedFor || undefined,
                  }),
                });
                if (!res.ok) throw new Error("Report generation failed");
                const html = await res.text();
                const blob = new Blob([html], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
              } catch (err) {
                alert("Failed to generate report. Check console for details.");
                console.error(err);
              } finally {
                setExporting(false);
              }
            }}
            className="px-6 py-3 bg-gradient-to-r from-[#00b4c3] to-emerald-500 text-white font-bold rounded-xl text-sm hover:from-[#00a0b0] hover:to-emerald-600 transition-all shadow-lg shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
          >
            {exporting ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" /></svg> Generating...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Export PDF Report</>
            )}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Report Scope</label>
            <select value={reportMode} onChange={e => setReportMode(e.target.value as "single" | "all")}
              className="w-full h-10 rounded-lg border border-slate-600 bg-slate-800 text-white px-3 text-sm">
              <option value="single">Selected Competitor Only</option>
              <option value="all">All Competitors (Full Teardown)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Brand Name (optional)</label>
            <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="e.g. Levi's, H&M"
              className="w-full h-10 rounded-lg border border-slate-600 bg-slate-800 text-white px-3 text-sm placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Prepared For (optional)</label>
            <input type="text" value={preparedFor} onChange={e => setPreparedFor(e.target.value)} placeholder="e.g. John Smith, VP Sustainability"
              className="w-full h-10 rounded-lg border border-slate-600 bg-slate-800 text-white px-3 text-sm placeholder-slate-500" />
          </div>
          <div className="flex items-end">
            <div className="text-xs text-slate-500">
              Opens in new tab as print-ready HTML. Use <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">Ctrl+P</kbd> → Save as PDF.
            </div>
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

      {/* Environmental Grade Cards + Recyclability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Grade Cards */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Environmental Rating</div>
          <div className="flex items-center justify-center gap-8">
            {/* FUZE Grade */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-black text-5xl shadow-xl mb-3">
                A
              </div>
              <div className="text-sm font-bold text-emerald-700">FUZE</div>
              <div className="text-[10px] text-slate-500 mt-1">Zero binders, zero curing,<br />zero leaching, recyclable</div>
            </div>

            <div className="text-2xl font-black text-slate-300">vs</div>

            {/* Competitor Grade */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br ${competitorGradeColor} text-white font-black text-5xl shadow-xl mb-3`}>
                {score.competitorEnvironmentalGrade}
              </div>
              <div className="text-sm font-bold text-red-700">{competitor.product}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                {competitor.binderRequired ? "Binder required" : ""}
                {competitor.binderRequired && competitor.curingRequired ? ", " : ""}
                {competitor.curingRequired ? `${competitor.curingTempC}°C curing` : ""}
                {(competitor.binderRequired || competitor.curingRequired) && competitor.leachRatePerWash > 0 ? ", " : ""}
                {competitor.leachRatePerWash > 0 ? "leaches metals" : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Recyclability Assessment */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Textile Recyclability</div>
          <div className="flex items-center justify-center gap-8">
            {/* FUZE Recyclable */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-xl mb-3">
                <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </div>
              <div className="text-sm font-bold text-emerald-700">FUZE</div>
              <div className="text-[10px] text-emerald-600 mt-1 font-semibold">Fully Recyclable</div>
              <div className="text-[10px] text-slate-500">No binders, no coatings<br />Clean fiber recovery</div>
            </div>

            <div className="text-2xl font-black text-slate-300">vs</div>

            {/* Competitor Recyclable */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br ${score.competitorRecyclable ? "from-emerald-500 to-emerald-600" : "from-red-500 to-red-600"} shadow-xl mb-3`}>
                {score.competitorRecyclable ? (
                  <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                ) : (
                  <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                  </svg>
                )}
              </div>
              <div className="text-sm font-bold text-red-700">{competitor.product}</div>
              <div className={`text-[10px] mt-1 font-semibold ${score.competitorRecyclable ? "text-emerald-600" : "text-red-600"}`}>
                {score.competitorRecyclable ? "Recyclable" : "Not Recyclable"}
              </div>
              <div className="text-[10px] text-slate-500">{score.recyclabilityNote.split('.')[0]}.</div>
            </div>
          </div>

          {/* SB 707 callout */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0">⚖️</span>
              <div>
                <div className="text-xs font-bold text-amber-800">California SB 707 — Responsible Textile Recovery Act</div>
                <p className="text-[10px] text-amber-700 mt-1">Requires textile producers to fund and implement collection and recycling programs. Chemical binders and curing agents that prevent clean fiber recovery create compliance risk and increased producer responsibility fees. FUZE-treated textiles remain fully recyclable.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lifecycle Stage Navigator */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex-1 flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <span className="font-bold text-red-700">1</span>
            </div>
            <div className="text-sm font-semibold text-slate-700">Chemical Plant</div>
            <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="font-bold text-amber-700">2</span>
            </div>
            <div className="text-sm font-semibold text-slate-700">Factory Application</div>
            <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <span className="font-bold text-orange-700">3</span>
            </div>
            <div className="text-sm font-semibold text-slate-700">Wastewater Remediation</div>
            <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="font-bold text-purple-700">4</span>
            </div>
            <div className="text-sm font-semibold text-slate-700">Consumer & Municipal</div>
          </div>
        </div>
      </div>

      {/* STAGE 1: Chemical Plant Manufacturing */}
      <div className="bg-red-50 rounded-2xl border border-red-200 shadow-sm p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-white text-lg">1</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-900">Stage 1: Chemical Plant Manufacturing</h2>
            <p className="text-sm text-red-700 mt-1">Before {competitor.product} ever reaches a factory — {competitor.company}&apos;s manufacturing footprint</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-red-700">{num(score.upstreamPlantCO2PerMeter * annualMeters, 1)}</div>
            <div className="text-xs font-semibold text-red-600 mt-2">kg CO₂ at Plant</div>
            <div className="text-[10px] text-red-500 mt-1">{num(score.upstreamPlantCO2PerMeter, 4)}/m</div>
          </div>
          <div className="bg-white border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-red-700">{num(score.upstreamPlantWasteKgPerMeter * annualMeters, 1)}</div>
            <div className="text-xs font-semibold text-red-600 mt-2">kg Chemical Waste</div>
            <div className="text-[10px] text-red-500 mt-1">{num(score.upstreamPlantWasteKgPerMeter, 4)}/m</div>
          </div>
          <div className="bg-white border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-red-700">{num(score.upstreamPlantVOCgPerMeter * annualMeters / 1000, 1)}</div>
            <div className="text-xs font-semibold text-red-600 mt-2">kg VOCs Emitted</div>
            <div className="text-[10px] text-red-500 mt-1">{num(score.upstreamPlantVOCgPerMeter, 2)}/m</div>
          </div>
          <div className="bg-white border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-red-700">{num(score.upstreamPlantWaterLitersPerMeter * annualMeters, 0)}</div>
            <div className="text-xs font-semibold text-red-600 mt-2">L Process Water</div>
            <div className="text-[10px] text-red-500 mt-1">{num(score.upstreamPlantWaterLitersPerMeter, 1)}/m</div>
          </div>
        </div>

        {/* CO2 Breakdown: Mining → Refining → Synthesis */}
        {upstreamData.co2Breakdown && (
          <div className="bg-white border border-red-200 rounded-xl p-4 mb-4">
            <div className="text-xs font-semibold text-red-800 mb-3">CO₂ Breakdown — {num(upstreamData.facilityCO2PerKg, 0)} kg CO₂/kg product</div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <div className="text-lg font-black text-red-700">{num(upstreamData.co2Breakdown.mining, 0)}</div>
                <div className="text-[10px] font-semibold text-red-600">kg CO₂ — Mining</div>
                <div className="text-[9px] text-red-400 mt-0.5">Ore extraction, crushing, concentration</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-red-700">{num(upstreamData.co2Breakdown.refining, 0)}</div>
                <div className="text-[10px] font-semibold text-red-600">kg CO₂ — Refining</div>
                <div className="text-[9px] text-red-400 mt-0.5">Smelting, electrolytic purification</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-red-700">{num(upstreamData.co2Breakdown.synthesis, 0)}</div>
                <div className="text-[10px] font-semibold text-red-600">kg CO₂ — Synthesis</div>
                <div className="text-[9px] text-red-400 mt-0.5">Product formulation, compounding</div>
              </div>
            </div>
            <div className="text-[9px] text-gray-400 border-t border-red-100 pt-2">{upstreamData.co2Breakdown.source}</div>
          </div>
        )}

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-emerald-700 mb-2">FUZE Manufacturing Profile</div>
          <p className="text-xs text-emerald-600">30-amp liquid laser ablation on a 1m² table. Recycled electronics feedstock. Solar-capable. <strong>Zero chemicals. Zero waste. Zero VOCs. Zero process water.</strong></p>
        </div>
      </div>

      {/* STAGE 2: Factory Application */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-white text-lg">2</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-900">Stage 2: Textile Factory Application</h2>
            <p className="text-sm text-amber-700 mt-1">Energy, binders, and equipment costs to apply at the mill</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-amber-700">{num(score.energySavedPerMeter, 3)}</div>
            <div className="text-xs font-semibold text-amber-600 mt-2">kWh Curing Energy Saved</div>
            <div className="text-[10px] text-amber-500 mt-1">FUZE: {competitor.curingRequired ? `No ${competitor.curingTempC}°C oven` : "No curing needed"}</div>
          </div>
          <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-amber-700">{num(score.binderEliminatedPerMeter, 1)}</div>
            <div className="text-xs font-semibold text-amber-600 mt-2">g Binder Eliminated</div>
            <div className="text-[10px] text-amber-500 mt-1">Zero petrochemical polymer</div>
          </div>
          <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-amber-700">{competitor.binderFormaldehyde ? "Yes" : "No"}</div>
            <div className="text-xs font-semibold text-amber-600 mt-2">Formaldehyde Binder?</div>
            <div className="text-[10px] text-amber-500 mt-1">{competitor.binderRequired ? (competitor.binderFormaldehyde ? "Toxic crosslinker required" : "Binder required") : "Not required"}</div>
          </div>
          <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-amber-700">{competitor.binderVOC ? "Yes" : "No"}</div>
            <div className="text-xs font-semibold text-amber-600 mt-2">VOC at Application?</div>
            <div className="text-[10px] text-amber-500 mt-1">{competitor.binderVOC ? "Off-gassing required" : "Zero off-gassing"}</div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-emerald-700 mb-2">FUZE Application Profile</div>
          <p className="text-xs text-emerald-600"><strong>No binder.</strong> <strong>No curing.</strong> <strong>No energy.</strong> <strong>No VOCs.</strong> Integrates into existing dye bath, exhaust, or spray equipment. Zero additional steps. Bonds at ambient temperature.</p>
        </div>
      </div>

      {/* STAGE 3: Factory Wastewater Remediation */}
      <div className="bg-orange-50 rounded-2xl border border-orange-200 shadow-sm p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-white text-lg">3</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-orange-900">Stage 3: Factory Wastewater Remediation</h2>
            <p className="text-sm text-orange-700 mt-1">Cleaning contaminated wastewater before discharge</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white border border-orange-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-orange-700">${num(score.remediationCostPerMeter * annualMeters, 1)}</div>
            <div className="text-xs font-semibold text-orange-600 mt-2">Global Avg Remediation</div>
            <div className="text-[10px] text-orange-500 mt-1">${num(score.remediationCostPerMeter, 3)}/m</div>
          </div>
          <div className="bg-white border border-red-300 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-red-700">${num(score.remediationCostPerMeterUS * annualMeters, 1)}</div>
            <div className="text-xs font-semibold text-red-600 mt-2">US/EU Remediation</div>
            <div className="text-[10px] text-red-500 mt-1">${num(score.remediationCostPerMeterUS, 3)}/m — EPA limits</div>
          </div>
          <div className="bg-white border border-orange-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-orange-700">{num(score.remediationChemicalsKgPerMeter * annualMeters, 1)}</div>
            <div className="text-xs font-semibold text-orange-600 mt-2">kg Treatment Chemicals</div>
            <div className="text-[10px] text-orange-500 mt-1">Caustic soda, flocculants, acids</div>
          </div>
          <div className="bg-white border border-orange-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-orange-700">{num(score.remediationEnergyKwhPerMeter * annualMeters, 1)}</div>
            <div className="text-xs font-semibold text-orange-600 mt-2">kWh Treatment Energy</div>
            <div className="text-[10px] text-orange-500 mt-1">Pumps, reactors, filtration</div>
          </div>
        </div>

        {/* Remediation scope explanation */}
        <div className="bg-white border border-orange-100 rounded-xl p-3 mb-4">
          <div className="text-[10px] text-orange-700"><strong>What this covers:</strong> {score.remediationScope}</div>
        </div>

        {/* True total cost comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-50 border border-red-300 rounded-xl p-5">
            <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">{competitor.product} True Cost/Meter</div>
            <div className="text-3xl font-black text-red-700">${num(score.trueTotalCostPerMeter, 4)}<span className="text-sm font-normal text-red-400">/m</span></div>
            <div className="text-xs text-red-500 mt-2 space-y-1">
              <div>Antimicrobial: ${num(competitor.estimatedCostPerMeterTypical, 4)}/m</div>
              <div>+ Wastewater remediation: ${num(score.remediationCostPerMeter, 4)}/m</div>
              <div>+ Curing energy: ${num(score.energySavedPerMeter * 0.10, 4)}/m</div>
              <div className="font-bold pt-1 border-t border-red-200">Hidden costs: ${num(score.hiddenCostPerMeter, 4)}/m</div>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">FUZE True Cost/Meter</div>
            <div className="text-3xl font-black text-emerald-700">${num(score.fuzeTrueCostPerMeter, 4)}<span className="text-sm font-normal text-emerald-400">/m</span></div>
            <div className="text-xs text-emerald-500 mt-2 space-y-1">
              <div>FUZE F1 treatment: ${num(score.fuzeTrueCostPerMeter, 4)}/m</div>
              <div>+ Wastewater remediation: $0.0000/m</div>
              <div>+ Curing energy: $0.0000/m</div>
              <div className="font-bold pt-1 border-t border-emerald-200">Hidden costs: $0.0000/m</div>
            </div>
          </div>
        </div>
      </div>

      {/* STAGE 4: Consumer & Municipal */}
      <div className="bg-purple-50 rounded-2xl border border-purple-200 shadow-sm p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-white text-lg">4</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-purple-900">Stage 4: Consumer Laundering & Municipal Water</h2>
            <p className="text-sm text-purple-700 mt-1">What happens when consumers wash their clothes</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white border border-purple-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-purple-700">{num(score.consumerLeachedMetalMgPerWash, 2)}</div>
            <div className="text-xs font-semibold text-purple-600 mt-2">mg Metal/Wash</div>
            <div className="text-[10px] text-purple-500 mt-1">Per garment, per wash cycle</div>
          </div>
          <div className="bg-white border border-purple-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-purple-700">{num(score.consumerTotalLeachedMgLifetime, 1)}</div>
            <div className="text-xs font-semibold text-purple-600 mt-2">mg Total Leached</div>
            <div className="text-[10px] text-purple-500 mt-1">Lifetime of garment</div>
          </div>
          <div className="bg-white border border-purple-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-purple-700">{num(score.consumerWaterContaminatedLitersLifetime, 0)}</div>
            <div className="text-xs font-semibold text-purple-600 mt-2">L Contaminated Water</div>
            <div className="text-[10px] text-purple-500 mt-1">Lifetime wash cycles</div>
          </div>
          <div className="bg-white border border-purple-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-purple-700">${num(score.municipalTreatmentCostPerGarment, 3)}</div>
            <div className="text-xs font-semibold text-purple-600 mt-2">Municipal Cost</div>
            <div className="text-[10px] text-purple-500 mt-1">Per garment treatment</div>
          </div>
          <div className="bg-white border border-purple-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-purple-700">{num(score.consumerMicroplasticShedGPerWash, 3)}</div>
            <div className="text-xs font-semibold text-purple-600 mt-2">g Microplastic/Wash</div>
            <div className="text-[10px] text-purple-500 mt-1">From binder shedding</div>
          </div>
          <div className="bg-white border border-purple-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-purple-700">{num(score.consumerBioaccumulationFactor, 2)}</div>
            <div className="text-xs font-semibold text-purple-600 mt-2">Bioaccumulation</div>
            <div className="text-[10px] text-purple-500 mt-1">0–1 persistence scale</div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-emerald-700 mb-2">FUZE Consumer Profile</div>
          <p className="text-xs text-emerald-600"><strong>Zero leaching.</strong> <strong>Zero microplastic.</strong> <strong>Zero municipal burden.</strong> FUZE metamaterial does not leach into home wash water. No binder = no polymer shedding. Zero treatment cost at municipal water facilities.</p>
        </div>
      </div>

      {/* Per 10,000 garments — the headline number */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-2xl p-8 mb-8 text-white">
        <div className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-4">Per 10,000 Garments — Switching from {competitor.product} to FUZE</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div>
            <div className="text-3xl font-black">{num(score.co2SavedPer10kGarments, 1)}</div>
            <div className="text-emerald-200 text-sm font-medium mt-1">kg CO₂</div>
            <div className="text-emerald-300/60 text-xs mt-1">Eliminated across all 4 stages</div>
          </div>
          <div>
            <div className="text-3xl font-black">{num(score.waterSavedPer10kGarments, 0)}</div>
            <div className="text-emerald-200 text-sm font-medium mt-1">L Water Saved</div>
            <div className="text-emerald-300/60 text-xs mt-1">No contamination</div>
          </div>
          <div>
            <div className="text-3xl font-black">{num(score.chemicalEliminated10kGarments / 1000, 1)}</div>
            <div className="text-emerald-200 text-sm font-medium mt-1">g Chemistry</div>
            <div className="text-emerald-300/60 text-xs mt-1">{competitor.heavyMetalReleased} not entering supply chain</div>
          </div>
          <div>
            <div className="text-3xl font-black">{num(score.binderEliminated10kGarments / 1000, 2)}</div>
            <div className="text-emerald-200 text-sm font-medium mt-1">kg Binder</div>
            <div className="text-emerald-300/60 text-xs mt-1">Zero petrochemical polymer</div>
          </div>
          <div>
            <div className="text-3xl font-black">${num(score.hiddenCostPerMeter * 10000 * 1.5, 0)}</div>
            <div className="text-emerald-200 text-sm font-medium mt-1">Hidden Cost Avoided</div>
            <div className="text-emerald-300/60 text-xs mt-1">Total true cost savings</div>
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
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex-1 text-center py-3 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors"
        >
          ↑ Export Full Report
        </button>
      </div>
    </div>
  );
}
