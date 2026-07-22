"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { calcQuote, money, CURRENCIES, type WidthUnit, type CostAdder } from "@/lib/fuze-calc";
import { COMPETITORS, calcEnvironmentalScore, calcCostComparison, applyOverrides, type PriceOverride } from "@/lib/competitors";
import { useI18n } from "@/i18n";
// Item 5 — the Environmental Score + competitor comparison split out of the
// pricing page. Tier ladder, grade badge, and number helpers are shared.
import { FUZE_TIERS, Gradebadge, num, uid } from "@/lib/pricing-tiers";

// ─── Main Page ────────────────────────────────
export default function EnvironmentalScorePage() {
  const { t } = useI18n();
  const T = t.pricingPage;
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
    adders,
  }), [gsm, width, widthUnit, dose, pricePerLiter, discountPercent, adders]);

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
          <Link href="/dashboard" className="hover:text-[#00b4c3]">{T.crumbDashboard}</Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">{T.envCrumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{T.envPageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {T.envPageSubtitle}
        </p>
      </div>

      {/* ═══ TOP SECTION: Application Inputs (drive the comparison) ═══ */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Inputs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{T.envInputsTitle}</h2>

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

      </div>

      {/* ═══ BOTTOM SECTION: Competitor Comparison ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-slate-800">{T.comparisonTitle}</h2>
          <Link href="/admin/competitor-pricing" className="text-xs text-[#00b4c3] hover:underline font-medium">
            {T.editCompetitorPricing}
          </Link>
        </div>
        <p className="text-sm text-slate-500 mb-6">{T.comparisonSubtitle}{priceOverrides.length > 0 && <span className="ml-2 text-emerald-600 font-medium">{T.realIntelTemplate.replace("{n}", String(priceOverrides.length))}</span>}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{T.competitorProductLabel}</label>
            <select
              value={competitorId}
              onChange={(e) => setCompetitorId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">{T.competitorSelectPlaceholder}</option>
              {competitors.map(c => (
                <option key={c.id} value={c.id}>{c.company} — {c.product}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{T.benchmarkLabel}</label>
            <div className="h-10 rounded-lg bg-slate-50 border border-slate-200 px-3 flex items-center text-sm font-medium text-slate-700">
              {T.benchmarkValueTemplate.replace("{id}", activeTier.id)}
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
                <h3 className="text-base font-bold text-slate-800">{T.tierLadderTitle}</h3>
                <span className="text-[11px] text-slate-400">{T.tierLadderSubtitle}</span>
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
                        {T.validatedByLabel} · <span className="text-slate-700">{tier.primaryTest}</span>
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
                          {T.selectedBadge}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-3 italic">
                {T.tierLadderFooter}
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
                    {T.activeTierVsTemplate.replace("{id}", activeTier.id).replace("{name}", activeTier.name).replace("{product}", competitor.product)}
                  </h3>
                  <p className="text-xs text-slate-500 mb-5">
                    {T.millAppliedNote} <span className="font-semibold">{T.millAppliedNoteEmphasis}</span>.
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
                          <div className="text-sm font-bold text-emerald-800">{T.fuzeTierHeaderTemplate.replace("{id}", activeTier.id).replace("{name}", activeTier.name)}</div>
                          <div className="text-[10px] text-emerald-700">{T.permanentSubtitle}</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-baseline">
                          <span className="text-emerald-700">{T.costPerMeterLabel}</span>
                          <span className="font-black text-2xl text-emerald-700">{money(cc.fuzeCostPerMeter, currency, fx)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-emerald-700">{T.washClaimLabel}</span>
                          <span className="font-bold text-emerald-700">{activeTier.washes} {T.washesUnit}</span>
                        </div>

                        {/* F4-only: cotton-dominance hero. This is the angle
                            that closes natural-fiber brands at the lowest dose. */}
                        {activeTier.id === "F4" && (
                          <div className="mt-3 -mx-1 px-3 py-2.5 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">{T.dominanceHeader}</div>
                            <div className="text-sm font-black mt-0.5">Cotton & natural fibers — at this dose, FUZE outperforms every silver-ion / QAC / zinc / chitosan competitor on cellulose</div>
                          </div>
                        )}

                        {/* What this tier delivers — benefit stack */}
                        <div className="pt-2 border-t border-emerald-200">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5">{T.whatThisTierDelivers}</div>
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
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">{T.validatedByLabel}</span>
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
                          <span className="text-red-700">{T.costPerMeterLabel}</span>
                          <span className="font-black text-2xl text-red-700">{money(cc.competitorTotalCostPerMeter, currency, fx)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-red-700">{T.washClaimLabel}</span>
                          <span className="font-bold text-red-700">{competitor.maxWashClaim} {T.washesUnit}</span>
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
                    <span className="text-slate-500">{T.costDifferenceLabel.replace("{id}", activeTier.id)}</span>
                    {fuzeLess && (
                      <span className="text-emerald-600 font-black">{T.cheaperThanTemplate.replace("{delta}", money(cc.competitorTotalCostPerMeter - cc.fuzeCostPerMeter, currency, fx)).replace("{competitor}", competitor.product.split(" ")[0])}</span>
                    )}
                    {fuzeMore && (
                      <span className="text-amber-600 font-black">{T.premiumForTemplate.replace("{delta}", money(cc.fuzeCostPerMeter - cc.competitorTotalCostPerMeter, currency, fx)).replace("{washes}", String(activeTier.washes))}</span>
                    )}
                    {!fuzeMore && !fuzeLess && (
                      <span className="text-slate-700 font-black">{T.priceMatchText}</span>
                    )}
                  </div>

                  {/* Explainer */}
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="text-xs font-semibold text-emerald-800 mb-1.5">{T.defendHeader}</div>
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
                <h3 className="text-base font-bold text-white">{T.meetUsTitle}</h3>
                <span className="text-[11px] text-slate-400">{T.meetUsSubtitle}</span>
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
                      {T.requiresReapplicationTemplate.replace("{product}", competitor.product)}
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">{T.chemistryLabel}</span><span className="font-medium text-slate-700">{competitor.chemistryLabel}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.estPriceLabel}</span><span className="font-medium text-slate-700">${competitor.chemicalPricePerKg}/kg</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.dosageLabel}</span><span className="font-medium text-slate-700">{competitor.dosageTypical} ppm</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.durabilityLabel}</span><span className="font-medium text-red-600">{T.durabilityTemplate.replace("{washes}", String(competitor.maxWashClaim))}</span></div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{T.applicationsNeededLabel}</span>
                        <span className="font-bold text-red-600">{T.treatmentsTemplate.replace("{n}", String(cc?.competitorApplicationsNeeded || 1))}</span>
                      </div>
                      <div className="border-t border-red-200/50 my-1 pt-1" />
                      <div className="text-[10px] font-semibold text-red-700/60 uppercase tracking-wider">{T.binderRequired}</div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.binderType}</span><span className="font-medium text-red-600 text-xs">{competitor.binderType}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.binderPerTreatment}</span><span className="font-medium text-red-600">{competitor.binderGPerKg} {T.binderPerKgUnit}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.totalBinderLabel}</span><span className="font-bold text-red-600">{num(cc?.competitorTotalBinderG || 0, 2)} g</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.binderLeaches}</span><span className="font-medium text-red-600">{T.binderLeachTemplate.replace("{pct}", String(competitor.binderLeachPctLifetime))}</span></div>
                      {competitor.binderFormaldehyde && (
                        <div className="flex justify-between"><span className="text-slate-500">{T.formaldehydeLabel}</span><span className="font-medium text-red-600">{T.formaldehydeYes}</span></div>
                      )}
                      {competitor.binderVOC && (
                        <div className="flex justify-between"><span className="text-slate-500">{T.vocLabel}</span><span className="font-medium text-red-600">{T.vocTemplate.replace("{temp}", String(competitor.curingTempC))}</span></div>
                      )}
                      <div className="border-t border-red-200/50 my-1 pt-1" />
                      <div className="text-[10px] font-semibold text-red-700/60 uppercase tracking-wider">{T.totalDischargeHeader}</div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.activeAgentLeached}</span><span className="font-bold text-red-600">{num(cc?.competitorTotalLeachMg || 0, 1)} mg</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.binderLeached}</span><span className="font-bold text-red-600">{num((cc?.competitorBinderLeachG || 0) * 1000, 0)} mg</span></div>
                      <div className="flex justify-between bg-red-100/50 -mx-1 px-1 rounded">
                        <span className="text-slate-600 font-semibold">{T.totalToWater}</span>
                        <span className="font-black text-red-700">{num(cc?.competitorTotalDischargeToWaterMg || 0, 0)} mg</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-200/50 rounded-xl p-4">
                    <div className="text-xs font-semibold text-emerald-800/60 uppercase tracking-wider mb-2">{T.fuzeTierHeaderTemplate.replace("{id}", activeTier.id).replace("{name}", activeTier.name)}</div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">{T.chemistryLabel}</span><span className="font-medium text-slate-700">{T.chemistryValue}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.applicationLabel}</span><span className="font-medium text-emerald-600">{T.singlePermanentInt}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.attachmentLabel}</span><span className="font-medium text-emerald-600">{T.attachmentValue}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.retreatmentsLabel}</span><span className="font-bold text-emerald-600">{T.retreatmentsValue}</span></div>
                      <div className="border-t border-emerald-200/50 my-1 pt-1" />
                      <div className="text-[10px] font-semibold text-emerald-700/60 uppercase tracking-wider">{T.noBinderHeader}</div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.binderType}</span><span className="font-medium text-emerald-600">{T.noBinderType}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.binderAppliedLabel}</span><span className="font-medium text-emerald-600">{T.zeroGrams}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.formaldehydeLabel}</span><span className="font-medium text-emerald-600">{T.none}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.vocEmissions}</span><span className="font-medium text-emerald-600">{T.noneVoc}</span></div>
                      <div className="border-t border-emerald-200/50 my-1 pt-1" />
                      <div className="text-[10px] font-semibold text-emerald-700/60 uppercase tracking-wider">{T.totalDischargeHeader}</div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.activeAgentLeached}</span><span className="font-bold text-emerald-600">{T.zeroMg}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{T.binderLeached}</span><span className="font-bold text-emerald-600">{T.zeroMg}</span></div>
                      <div className="flex justify-between bg-emerald-100/50 -mx-1 px-1 rounded">
                        <span className="text-slate-600 font-semibold">{T.totalToWater}</span>
                        <span className="font-black text-emerald-700">{T.zeroMg}</span>
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
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{T.envImpactHeader}</div>
                  <div className="text-xl font-bold mt-1">{T.fuzeVsTemplate.replace("{product}", competitor.product)}</div>
                  <div className="text-sm text-slate-400 mt-0.5">{T.perLinearMeter}</div>
                </div>
                <Gradebadge grade={envScore.compositeGrade} score={envScore.compositeScore} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {(() => {
                  const cc = costComparisons.find(c => c.fuzeDose === dose);
                  return (<>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl font-bold text-emerald-400">{num(cc ? cc.competitorTotalChemistryMg - cc.fuzeChemistryMg : envScore.chemistrySavedMg, 1)}<span className="text-sm font-normal text-slate-400"> mg</span></div>
                      <div className="text-xs text-slate-400 mt-1">{T.activeAgentEliminated}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {cc && cc.competitorApplicationsNeeded > 1
                          ? `Across ${cc.competitorApplicationsNeeded} competitor re-treatments`
                          : "Antimicrobial chemistry not manufactured or applied"}
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl font-bold text-amber-400">{num(cc ? cc.competitorTotalBinderG : envScore.binderSavedG, 2)}<span className="text-sm font-normal text-slate-400"> g</span></div>
                      <div className="text-xs text-slate-400 mt-1">{T.binderEliminated}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {competitor.binderType}
                        {competitor.binderFormaldehyde ? " + formaldehyde" : ""}
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl font-bold text-blue-400">{num(cc ? cc.competitorTotalLeachMg : envScore.metalToWaterMg, 1)}<span className="text-sm font-normal text-slate-400"> mg</span></div>
                      <div className="text-xs text-slate-400 mt-1">{T.keptFromWater}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{competitor.heavyMetalReleased} not discharged</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl font-bold text-purple-400">{num((cc?.competitorBinderLeachG || 0) * 1000, 0)}<span className="text-sm font-normal text-slate-400"> mg</span></div>
                      <div className="text-xs text-slate-400 mt-1">{T.binderKeptFromWater}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Petrochemical polymer microplastics not shed</div>
                    </div>
                    <div className="bg-red-500/20 rounded-xl p-4 border border-red-500/30">
                      <div className="text-2xl font-bold text-red-400">{num(cc?.competitorTotalDischargeToWaterMg || 0, 0)}<span className="text-sm font-normal text-slate-400"> mg</span></div>
                      <div className="text-xs text-red-300 mt-1 font-semibold">{T.totalDischargeEliminated}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Active agent + binder combined — all kept from water</div>
                    </div>
                  </>);
                })()}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-2xl font-bold text-green-400">{num(envScore.carbonReductionKg, 3)}<span className="text-sm font-normal text-slate-400"> kg CO₂</span></div>
                  <div className="text-xs text-slate-400 mt-1">{T.carbonReductionLabel}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{T.carbonReductionNote}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-xs text-slate-400 mb-2">{T.compositeScoreLabel}</div>
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
                <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">{T.competitorToxicityHeader}</div>
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
                  <div className="text-sm font-semibold text-slate-700 mb-4">{T.washTimelineTemplate.replace("{n}", String(targetWashes))}</div>
                  <div className="space-y-4">
                    {/* FUZE bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-emerald-600">{T.fuzeOneApplication.replace("{id}", activeTier.id)}</span>
                        <span className="text-slate-500">{targetWashes}/{targetWashes} {T.washesUnit} — {money(outputs.totalCostPerLinearMeter, currency, fx)}/m</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-7 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full flex items-center justify-center" style={{ width: "100%" }}>
                          <span className="text-[11px] font-bold text-white">{T.lifetimeProtection}</span>
                        </div>
                      </div>
                    </div>
                    {/* Competitor bar — segmented by re-treatments */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-red-600">{T.competitorAppsTemplate.replace("{product}", competitor.product).replace("{n}", String(apps)).replace("{s}", apps > 1 ? "s" : "")}</span>
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
                                {T.appLabel} {i + 1}{i > 0 ? ` (+${Math.round((competitor.retreatmentCostMultiplier - 1) * 100)}% cost)` : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {apps > 1 && (
                        <div className="text-[10px] text-red-500 mt-1 text-center">
                          {T.retreatmentNote}
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
                        ? T.saveTemplate.replace("{amount}", money(cc.fuzeSavingsPerMeter, currency, fx))
                        : T.trueCostWinner}
                    </div>
                    <p className="text-xs text-emerald-600/80">
                      {competitor.product} at {money(competitor.estimatedCostPerMeterTypical, currency, fx)}/m sounds cheap — but that&apos;s only {competitor.maxWashClaim} washes.
                      {cc && cc.competitorApplicationsNeeded > 1 && (<> To match {activeTier.id}&apos;s {targetWashes}-wash durability, you&apos;d need {cc.competitorApplicationsNeeded} treatments costing {money(cc.competitorTotalCostPerMeter, currency, fx)}/m total.</>)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-4">
                    <div className="text-blue-700 font-semibold text-sm mb-2">
                      {cc ? `${num(cc.competitorTotalChemistryMg - cc.fuzeChemistryMg, 0)} mg` : `${(competitor.dosageTypical / dose).toFixed(0)}×`} {T.lessChemistry}
                    </div>
                    <p className="text-xs text-blue-600/80">
                      {cc && cc.competitorApplicationsNeeded > 1
                        ? <>{cc.competitorApplicationsNeeded} applications of {competitor.product} dumps {num(cc.competitorTotalChemistryMg, 0)} mg of {competitor.chemistryLabel.toLowerCase()} into the fabric. FUZE uses just {num(cc.fuzeChemistryMg, 1)} mg.</>
                        : <>FUZE uses {dose} mg/kg vs {competitor.product}&apos;s {competitor.dosageTypical} ppm. That&apos;s {(competitor.dosageTypical / dose).toFixed(0)}× less active material per kilogram of fabric.</>}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200 rounded-xl p-4">
                    <div className="text-rose-700 font-semibold text-sm mb-2">
                      {cc ? `${num(cc.competitorTotalDischargeToWaterMg, 0)} mg` : ""} {T.totalDischargeShortLabel}
                    </div>
                    <p className="text-xs text-rose-600/80">
                      {competitor.product} leaches {competitor.heavyMetalReleased.toLowerCase() !== "none" ? competitor.heavyMetalReleased.toLowerCase() : "toxic compounds"} plus
                      {" "}{competitor.binderType.toLowerCase()} binder into factory wastewater and your customer&apos;s home laundry.
                      {cc && (<> That&apos;s {num(cc.competitorTotalLeachMg, 0)} mg of active agent + {num(cc.competitorBinderLeachG * 1000, 0)} mg of binder polymer = {num(cc.competitorTotalDischargeToWaterMg, 0)} mg total per meter.</>)}
                      {" "}FUZE discharges zero. No active agent. No binder. Nothing.
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-4">
                    <div className="text-amber-700 font-semibold text-sm mb-2">{T.lifetimeApprovalLabel}</div>
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
              <h3 className="text-base font-bold text-slate-800 mb-1">{T.epaComparisonTitle}</h3>
              <p className="text-xs text-slate-500 mb-4">
                {T.epaComparisonSubtitle}
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
                      <span className="text-slate-500">{T.epaRegNumLabel}</span>
                      <span className="font-mono text-red-700 text-xs">{competitor.epaRegNumber}</span>
                    </div>
                    {competitor.epaRegYear && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{T.epaFirstRegLabel}</span>
                        <span className="font-bold text-red-700">
                          {competitor.epaRegYear}
                          <span className="text-slate-400 font-normal ml-1">{T.epaYearsAgoTemplate.replace("{n}", String(new Date().getFullYear() - competitor.epaRegYear))}</span>
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">{T.epaChemistryLabel}</span>
                      <span className="text-slate-700">{competitor.chemistryLabel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{T.epaMaxWashLabel}</span>
                      <span className="text-slate-700">{competitor.maxWashClaim} {T.epaWashesUnit}</span>
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
                        {T.viewEpaLabel}
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
                    <span className="text-sm font-semibold text-emerald-800">{T.fuzeEpaName}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{T.epaStatusLabel}</span>
                      <span className="font-bold text-emerald-700">{T.epaStatusValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{T.durabilityFuzeLabel}</span>
                      <span className="font-bold text-emerald-700">{T.durabilityFuzeValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{T.binderRequiredFuzeLabel}</span>
                      <span className="font-bold text-emerald-700">{T.none}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{T.curingRequiredLabel}</span>
                      <span className="font-bold text-emerald-700">{T.none}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{T.heavyMetalLeachLabel}</span>
                      <span className="font-bold text-emerald-700">{T.zeroValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{T.formaldehydeLabel}</span>
                      <span className="font-bold text-emerald-700">{T.none}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-emerald-200 text-xs text-emerald-600/80">
                      {T.fuzeEpaNote}
                    </div>
                  </div>
                </div>
              </div>

              {/* Regulatory era context */}
              {competitor.epaRegYear && competitor.epaRegYear < 2000 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">{T.regContextHeader}</div>
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
              <h3 className="text-base font-bold text-slate-800 mb-1">{T.fullCompetitorTitle}</h3>
              <p className="text-xs text-slate-500 mb-4">{T.competitorsTrackedTemplate.replace("{n}", String(competitors.length))}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-2 pr-3 font-semibold text-slate-500">{T.colProduct}</th>
                      <th className="py-2 pr-3 font-semibold text-slate-500">{T.colCompany}</th>
                      <th className="py-2 pr-3 font-semibold text-slate-500">{T.colChemistry}</th>
                      <th className="py-2 pr-3 font-semibold text-slate-500">{T.colEpaReg}</th>
                      <th className="py-2 pr-3 font-semibold text-slate-500">{T.colYear}</th>
                      <th className="py-2 pr-3 font-semibold text-slate-500">{T.colWashes}</th>
                      <th className="py-2 font-semibold text-slate-500">{T.colLink}</th>
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
                              {T.viewLink}
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
            <div className="text-sm">{T.selectCompetitorPlaceholder}</div>
          </div>
        )}
      </div>
    </div>
  );
}
