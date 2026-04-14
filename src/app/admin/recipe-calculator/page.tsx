// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/**
 * FUZE Lab Recipe Calculator — step-by-step wizard.
 *
 * Tech is walked one screen at a time through the bench test:
 *   1. Fabric (pre-linked via ?fabricId=... if coming from fabric page)
 *   2. Dry sample weight (100 cm² cutter) → auto-compute GSM
 *   3. Application method + squeeze + VFD frequency
 *   4. Post-pad wet weight → auto-compute pickup %
 *   5. (Optional) Wet-to-wet measurement
 *   6. (Optional) Production scaling
 *   7. Review + save → option to Graduate + Print
 */

const STOCK_MG_PER_L = 30;
const TIER_MG_PER_KG: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };
const ROLLER_CIRCUMFERENCE_M = 0.41;
const HZ_TO_M_PER_MIN = 0.295;
const HZ_TO_RPM = HZ_TO_M_PER_MIN / ROLLER_CIRCUMFERENCE_M;
const STANDARD_BATHS_L = [50, 100, 200, 300, 400];

// For a given bath volume (L) at a given pickup %, how much FUZE stock (L) to add?
//   bath_conc (mg/L) = tier_mg_per_kg / (pickup/100)
//   total active needed (mg) = bath_conc × bath_L
//   FUZE stock volume (L) = total_mg / stock_mg_per_L  (units: mg / (mg/L) = L)
function fuzeLitersForBath(bathL: number, pickupPct: number, mgPerKg: number, stock: number): number {
  if (!pickupPct || !bathL) return 0;
  const bathConc = mgPerKg / (pickupPct / 100);
  const totalMgNeeded = bathConc * bathL;
  return totalMgNeeded / stock;
}

function computeRecipe(input: any) {
  const dry = Number(input.drySampleWeight) || 0;
  const wetDryToWet = Number(input.wetAfterBathWeight) || 0;
  const preWet = Number(input.preWetSampleWeight) || 0;
  const wetFromPreWet = Number(input.wetAfterBathFromPreWet) || 0;
  const stock = Number(input.stockMgPerL) || STOCK_MG_PER_L;
  const sampleArea = Number(input.sampleAreaCm2) || 100;

  const out: any = { stockMgPerL: stock };

  // Auto-GSM from cut-sample weight
  if (dry > 0 && sampleArea > 0) {
    out.computedGsm = (dry / sampleArea) * 10000;
  }

  if (dry > 0 && wetDryToWet > 0) {
    out.pickupDryToWetPct = ((wetDryToWet - dry) / dry) * 100;
  }
  if (dry > 0 && preWet > 0 && wetFromPreWet > 0) {
    out.preWetMoisturePct = ((preWet - dry) / dry) * 100;
    out.pickupWetToWetPct = ((wetFromPreWet - preWet) / dry) * 100;
  }

  const pickup = out.pickupWetToWetPct || out.pickupDryToWetPct;
  for (const [tier, mgPerKg] of Object.entries(TIER_MG_PER_KG)) {
    if (!pickup || pickup <= 0) continue;
    const bathMgPerL = mgPerKg / (pickup / 100);
    const fuzeMlPerLBath = (bathMgPerL / stock) * 1000;
    const dilutionRatio = stock / bathMgPerL - 1;
    out[`${tier}_bath`] = bathMgPerL;
    out[`${tier}_ml`] = fuzeMlPerLBath;
    out[`${tier}_ratio`] = dilutionRatio;
  }

  const targetKg = Number(input.targetProductionKg) || 0;
  if (targetKg > 0 && pickup) {
    out.targetBathVolumeL = targetKg * (pickup / 100);
    for (const tier of Object.keys(TIER_MG_PER_KG)) {
      out[`${tier}_liters`] = (targetKg * TIER_MG_PER_KG[tier]) / stock;
    }
  }

  return out;
}

function validateStep(step: number, input: any, calc: any) {
  const w: { severity: "error" | "warn" | "info"; msg: string }[] = [];
  const dry = Number(input.drySampleWeight) || 0;
  const wet = Number(input.wetAfterBathWeight) || 0;
  const preWet = Number(input.preWetSampleWeight) || 0;
  const wetFromPre = Number(input.wetAfterBathFromPreWet) || 0;

  if (step === 2) {
    if (dry > 0 && dry < 0.5) w.push({ severity: "info", msg: "Sample under 0.5g — scale precision matters a lot." });
    if (calc.computedGsm !== undefined) {
      if (calc.computedGsm < 30 || calc.computedGsm > 700) {
        w.push({ severity: "info", msg: `Computed GSM ${calc.computedGsm.toFixed(0)} is outside typical 30-700 range.` });
      }
    }
  }
  if (step === 3) {
    const p = Number(input.squeezePressure) || 0;
    const hz = Number(input.vfdFrequencyHz) || 0;
    if (p > 0 && (p < 1 || p > 8)) w.push({ severity: "info", msg: `${p} bar outside typical 2-6 bar range (FUZE mini pad standard = 4 bar).` });
    if (hz > 0 && (hz < 2 || hz > 50)) w.push({ severity: "info", msg: `${hz} Hz is unusual (typical bench 5-15 Hz).` });
  }
  if (step === 4) {
    if (dry > 0 && wet > 0 && wet <= dry) w.push({ severity: "error", msg: "Wet weight must be greater than dry weight." });
    if (dry > 0 && wet / dry > 3) w.push({ severity: "warn", msg: "Pickup appears >200% — double-check weighing." });
    if (calc.pickupDryToWetPct !== undefined) {
      if (calc.pickupDryToWetPct < 30) w.push({ severity: "warn", msg: `Pickup ${calc.pickupDryToWetPct.toFixed(1)}% is low — sample over-squeezed?` });
      else if (calc.pickupDryToWetPct > 120) w.push({ severity: "warn", msg: `Pickup ${calc.pickupDryToWetPct.toFixed(1)}% is high — normal for nonwoven / heavy knits.` });
    }
  }
  if (step === 5) {
    if (preWet > 0 && dry > 0 && preWet <= dry) w.push({ severity: "error", msg: "Pre-wet weight should be greater than dry weight." });
    if (preWet > 0 && wetFromPre > 0 && wetFromPre <= preWet) w.push({ severity: "error", msg: "Wet-after-pad from pre-wet must be greater than pre-wet weight." });
  }
  return w;
}

const STEPS = [
  { n: 1, title: "Select Fabric", desc: "Link this test to a fabric in Atlas" },
  { n: 2, title: "Cut & Weigh Dry", desc: "100 cm² cutter → weigh sample → auto GSM" },
  { n: 3, title: "Set Method + VFD", desc: "Vertical pad, 4 bar, 10 Hz ≈ 3 m/min" },
  { n: 4, title: "Dip → Pad → Weigh Wet", desc: "Triplicate runs → mean pickup" },
  { n: 5, title: "Prepare Test Bath", desc: "Mix FUZE stock + water for the bench treatment" },
  { n: 6, title: "Wet-to-Wet (optional)", desc: "For wet-on-wet production recipes" },
  { n: 7, title: "Production Scale (optional)", desc: "Total FUZE liters for a real run" },
  { n: 8, title: "Review & Save → ICP", desc: "Confirm recipes, save, bag & tag for ICP" },
];

export default function RecipeCalculatorPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const prefillFabricId = params.get("fabricId") || "";

  const [fabrics, setFabrics] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedTestId, setSavedTestId] = useState<string>("");
  const [savedTestNumber, setSavedTestNumber] = useState<string>("");
  const [error, setError] = useState("");
  const [recentTests, setRecentTests] = useState<any[]>([]);
  const [step, setStep] = useState(prefillFabricId ? 2 : 1);

  // runs[0] is the canonical measurement (also mirrored to drySampleWeight/wetAfterBathWeight).
  // runs[1]/[2] are optional for triplicate — mean is used for the final calc.
  const [runs, setRuns] = useState<{ dry: string; wet: string }[]>([
    { dry: "", wet: "" },
    { dry: "", wet: "" },
    { dry: "", wet: "" },
  ]);

  const [form, setForm] = useState<any>({
    fabricId: prefillFabricId,
    fabricLabel: "",
    fabricType: "Knit",
    fiberContent: "",
    fabricWeightGsm: "",
    sampleAreaCm2: "100",
    applicationMethod: "PAD_DRY_CURE",
    squeezePressure: "4",
    vfdFrequencyHz: "10",
    dryingTemp: "",
    dryingTime: "",
    curingTemp: "",
    curingTime: "",
    liquorRatio: "",
    drySampleWeight: "",
    wetAfterBathWeight: "",
    preWetSampleWeight: "",
    wetAfterBathFromPreWet: "",
    targetProductionKg: "",
    stockMgPerL: String(STOCK_MG_PER_L),
    // Test bath prep (for bench treatment → ICP sample)
    testedAtTier: "F1",
    testBathVolumeL: "1",
    qcPassed: true,
    notes: "",
  });

  // Recompute mean across completed runs and mirror into form.drySampleWeight / wetAfterBathWeight
  const runStats = useMemo(() => {
    const complete = runs.filter((r) => Number(r.dry) > 0 && Number(r.wet) > Number(r.dry));
    if (complete.length === 0) return { meanDry: 0, meanWet: 0, perRunPickup: [], meanPickup: 0, maxDevPct: 0 };
    const meanDry = complete.reduce((s, r) => s + Number(r.dry), 0) / complete.length;
    const meanWet = complete.reduce((s, r) => s + Number(r.wet), 0) / complete.length;
    const perRunPickup = complete.map((r) => ((Number(r.wet) - Number(r.dry)) / Number(r.dry)) * 100);
    const meanPickup = perRunPickup.reduce((s, p) => s + p, 0) / perRunPickup.length;
    const maxDevPct = meanPickup > 0 ? Math.max(...perRunPickup.map((p) => Math.abs(p - meanPickup) / meanPickup * 100)) : 0;
    return { meanDry, meanWet, perRunPickup, meanPickup, maxDevPct, runCount: complete.length };
  }, [runs]);

  useEffect(() => {
    if (runStats.runCount > 0) {
      setForm((f: any) => ({
        ...f,
        drySampleWeight: runStats.meanDry.toFixed(3),
        wetAfterBathWeight: runStats.meanWet.toFixed(3),
      }));
    }
  }, [runStats.meanDry, runStats.meanWet, runStats.runCount]);

  useEffect(() => {
    if (user && !["ADMIN", "EMPLOYEE", "LAB_USER", "LAB_MANAGER"].includes(user.role)) {
      router.push("/home");
      return;
    }
    fetch("/api/fabrics?limit=500")
      .then((r) => r.json())
      .then((d) => {
        const list = d.fabrics || [];
        setFabrics(list);
        // If prefilled fabricId, auto-populate label + hints
        if (prefillFabricId) {
          const f = list.find((x: any) => x.id === prefillFabricId);
          if (f) {
            setForm((prev: any) => ({
              ...prev,
              fabricLabel: f.fuzeNumber ? `${f.fuzeNumber} · ${f.name || ""}`.trim() : (f.name || ""),
              fiberContent: f.fiberContent || prev.fiberContent,
              fabricType: f.fabricType || prev.fabricType,
              fabricWeightGsm: f.gsm || prev.fabricWeightGsm,
            }));
          }
        }
      })
      .catch(() => {});
    loadRecent();
  }, [user, prefillFabricId]);

  async function loadRecent() {
    try {
      const res = await fetch("/api/admin/recipe-bench-tests");
      const d = await res.json();
      if (d.ok) setRecentTests(d.tests);
    } catch {}
  }

  const calc = useMemo(() => computeRecipe(form), [form]);
  const warnings = useMemo(() => validateStep(step, form, calc), [form, calc, step]);
  const hasError = warnings.some(w => w.severity === "error");

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // Sync GSM when dry weight or sample area changes on step 2
  useEffect(() => {
    if (calc.computedGsm !== undefined) {
      setForm((f: any) => ({ ...f, fabricWeightGsm: calc.computedGsm.toFixed(0) }));
    }
  }, [calc.computedGsm]);

  function canAdvance(): boolean {
    if (hasError) return false;
    if (step === 1) return !!form.fabricId || !!form.fabricLabel;
    if (step === 2) return Number(form.drySampleWeight) > 0 || Number(runs[0].dry) > 0;
    if (step === 4) return runStats.runCount > 0;
    return true;
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const sampleRunsPayload = runs
        .filter((r) => Number(r.dry) > 0 && Number(r.wet) > Number(r.dry))
        .map((r, i) => ({
          run: i + 1,
          dry: Number(r.dry),
          wet: Number(r.wet),
          pickup: ((Number(r.wet) - Number(r.dry)) / Number(r.dry)) * 100,
        }));

      // Compute test bath amounts for persistence
      const tier = form.testedAtTier || "F1";
      const bathL = Number(form.testBathVolumeL) || 1;
      const stock = Number(form.stockMgPerL) || STOCK_MG_PER_L;
      const pickup = runStats.meanPickup;
      const testBathFuzeMl = pickup ? ((TIER_MG_PER_KG[tier] / (pickup / 100)) * bathL * 1000) / stock : null;
      const testBathWaterMl = testBathFuzeMl !== null ? bathL * 1000 - testBathFuzeMl : null;
      const icpExpectedPpm = TIER_MG_PER_KG[tier] * 1000;

      const res = await fetch("/api/admin/recipe-bench-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sampleRuns: sampleRunsPayload,
          testBathFuzeMl,
          testBathWaterMl,
          icpExpectedPpm,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setSavedTestId(d.test.id);
        setSavedTestNumber(d.test.testNumber);
        loadRecent();
      } else {
        setError(d.error || "Save failed");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function graduate() {
    if (!savedTestId) return;
    const res = await fetch(`/api/admin/recipe-bench-tests/${savedTestId}/graduate`, { method: "POST" });
    const d = await res.json();
    if (d.ok) {
      alert(d.message);
      loadRecent();
    }
  }

  // ICP submission + result entry on save screen
  const [icpForm, setIcpForm] = useState<any>({ icpLab: "", icpSampleId: "", icpMeasuredPpm: "", icpReportUrl: "" });
  const [icpSaving, setIcpSaving] = useState(false);
  const [icpState, setIcpState] = useState<"idle" | "submitted" | "complete">("idle");

  async function submitToIcp() {
    if (!savedTestId) return;
    setIcpSaving(true);
    try {
      const res = await fetch(`/api/admin/recipe-bench-tests/${savedTestId}/icp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          icpLab: icpForm.icpLab,
          icpSampleId: icpForm.icpSampleId,
          testedAtTier: form.testedAtTier,
          testBathVolumeL: Number(form.testBathVolumeL),
          icpExpectedPpm: TIER_MG_PER_KG[form.testedAtTier || "F1"] * 1000,
        }),
      });
      if ((await res.json()).ok) setIcpState("submitted");
    } finally {
      setIcpSaving(false);
    }
  }

  async function enterIcpResult() {
    if (!savedTestId || !icpForm.icpMeasuredPpm) return;
    setIcpSaving(true);
    try {
      const res = await fetch(`/api/admin/recipe-bench-tests/${savedTestId}/icp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enter-result",
          icpMeasuredPpm: Number(icpForm.icpMeasuredPpm),
          icpReportUrl: icpForm.icpReportUrl,
        }),
      });
      if ((await res.json()).ok) setIcpState("complete");
    } finally {
      setIcpSaving(false);
    }
  }

  const fmt = (n: any, p = 2) => (n === null || n === undefined || isNaN(n)) ? "—" : Number(n).toFixed(p);
  const pickupUsed = calc.pickupWetToWetPct ?? calc.pickupDryToWetPct;
  const lineSpeed = (Number(form.vfdFrequencyHz) || 0) * HZ_TO_M_PER_MIN;
  const rpm = (Number(form.vfdFrequencyHz) || 0) * HZ_TO_RPM;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Recipe Calculator</h1>
          <p className="text-slate-600">Guided bench test — one step at a time.</p>
        </div>
        <a href="/admin/recipe-calculator/sop" target="_blank" className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800">
          📋 Print SOP
        </a>
      </div>

      {/* Progress dots */}
      <div className="mb-8 flex items-center justify-between overflow-x-auto gap-2">
        {STEPS.map((s, i) => {
          const state = s.n < step ? "done" : s.n === step ? "current" : "pending";
          return (
            <div key={s.n} className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { if (s.n < step) setStep(s.n); }}
                disabled={s.n > step}
                className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center transition-all ${
                  state === "done" ? "bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600" :
                  state === "current" ? "bg-[#00b4c3] text-white ring-4 ring-[#00b4c3]/20" :
                  "bg-slate-200 text-slate-500"
                }`}
              >
                {state === "done" ? "✓" : s.n}
              </button>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${state === "done" ? "bg-emerald-500" : "bg-slate-200"}`} />}
            </div>
          );
        })}
      </div>

      {/* Current step header */}
      <div className="mb-4">
        <p className="text-xs text-[#00b4c3] font-bold uppercase tracking-widest">Step {step} of {STEPS.length}</p>
        <h2 className="text-2xl font-black text-slate-900">{STEPS[step - 1].title}</h2>
        <p className="text-sm text-slate-600">{STEPS[step - 1].desc}</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {/* ── STEP PANELS ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[300px]">
        {/* Step 1: Fabric */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">Link this bench test to a fabric that's already in Atlas. If it's not here, enter a free-text label.</p>
            <div>
              <label className="text-xs font-semibold text-slate-600">Linked fabric</label>
              <select
                value={form.fabricId}
                onChange={(e) => {
                  const id = e.target.value;
                  const f = fabrics.find((x) => x.id === id);
                  setForm((prev: any) => ({
                    ...prev,
                    fabricId: id,
                    fabricLabel: f ? (f.fuzeNumber ? `${f.fuzeNumber} · ${f.name || ""}`.trim() : (f.name || "")) : prev.fabricLabel,
                    fiberContent: f?.fiberContent || prev.fiberContent,
                    fabricType: f?.fabricType || prev.fabricType,
                    fabricWeightGsm: f?.gsm || prev.fabricWeightGsm,
                  }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">— Select from Atlas —</option>
                {fabrics.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.fuzeNumber || f.name || f.id} {f.name && f.fuzeNumber ? `· ${f.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Or free-text label *</label>
              <input value={form.fabricLabel} onChange={(e) => set("fabricLabel", e.target.value)} placeholder="e.g. 180 gsm French Terry · Cotton" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Fabric type</label>
                <select value={form.fabricType} onChange={(e) => set("fabricType", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  <option>Knit</option><option>Woven</option><option>Nonwoven</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Fiber content</label>
                <input value={form.fiberContent} onChange={(e) => set("fiberContent", e.target.value)} placeholder="100% Cotton" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Cut + weigh dry */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-slate-700">
              📐 Use the <strong>100 cm² FUZE cutter</strong>. Cut one clean sample, place on the analytical balance, record the dry weight in grams. GSM will be computed automatically.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Sample area (cm²)</label>
                <input type="number" value={form.sampleAreaCm2} onChange={(e) => set("sampleAreaCm2", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
                <p className="text-[10px] text-slate-400 mt-0.5">Default 100 cm² (FUZE cutter)</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Dry sample weight (g) *</label>
                <input type="number" step="0.001" value={form.drySampleWeight} onChange={(e) => set("drySampleWeight", e.target.value)} placeholder="e.g. 1.85" className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-lg font-bold" autoFocus />
              </div>
            </div>
            {calc.computedGsm !== undefined && (
              <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-white/60">Computed Fabric Weight</p>
                <p className="text-4xl font-black text-[#00b4c3] mt-1">{calc.computedGsm.toFixed(0)} <span className="text-lg font-medium text-white/60">g/m²</span></p>
                <p className="text-xs text-white/50 mt-1">{form.drySampleWeight}g ÷ {form.sampleAreaCm2}cm² × 10,000 = {calc.computedGsm.toFixed(1)} GSM</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Method + VFD */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Application method</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { v: "PAD_DRY_CURE", label: "Pad-Dry-Cure" },
                  { v: "EXHAUST", label: "Exhaust" },
                  { v: "SPRAY", label: "Spray" },
                  { v: "FOAM", label: "Foam" },
                ].map((m) => (
                  <button key={m.v} type="button" onClick={() => set("applicationMethod", m.v)} className={`p-2 rounded-lg border text-xs font-semibold ${form.applicationMethod === m.v ? "border-[#00b4c3] bg-[#00b4c3]/10 text-[#00b4c3]" : "border-slate-200"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {form.applicationMethod === "PAD_DRY_CURE" && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Squeeze pressure (bar)</label>
                    <input type="number" step="0.1" value={form.squeezePressure} onChange={(e) => set("squeezePressure", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
                    <p className="text-[10px] text-slate-400 mt-0.5">Standard: 4 bar (0.4 MPa)</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">VFD Frequency (Hz)</label>
                    <input type="number" step="0.5" value={form.vfdFrequencyHz} onChange={(e) => set("vfdFrequencyHz", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
                    <p className="text-[10px] text-slate-400 mt-0.5">Standard: 10 Hz</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Line speed (computed)</label>
                    <div className="px-3 py-2 border-2 border-[#00b4c3] rounded-lg bg-cyan-50 font-mono font-bold text-[#00b4c3]">
                      {lineSpeed.toFixed(2)} m/min
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{rpm.toFixed(1)} RPM · 41 cm roller</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Drying °C</label>
                    <input type="number" value={form.dryingTemp} onChange={(e) => set("dryingTemp", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Drying min</label>
                    <input type="number" step="0.1" value={form.dryingTime} onChange={(e) => set("dryingTime", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Curing °C</label>
                    <input type="number" value={form.curingTemp} onChange={(e) => set("curingTemp", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Curing min</label>
                    <input type="number" step="0.1" value={form.curingTime} onChange={(e) => set("curingTime", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                </div>
              </>
            )}
            {form.applicationMethod === "EXHAUST" && (
              <div>
                <label className="text-xs font-semibold text-slate-600">Liquor ratio</label>
                <input value={form.liquorRatio} onChange={(e) => set("liquorRatio", e.target.value)} placeholder="1:10" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            )}
          </div>
        )}

        {/* Step 4: Wet weight — triplicate */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-slate-700">
              <p className="font-bold mb-2">💧 Dry-to-wet pickup — run in triplicate</p>
              <p className="mb-2">Cut <strong>3 separate samples</strong> from the fabric. For each:</p>
              <ol className="space-y-1 pl-5 list-decimal">
                <li>Weigh the dry sample</li>
                <li>Submerge in clean DI water <strong>10 sec</strong>, drain <strong>3 sec</strong></li>
                <li>Feed through pad at <strong>4 bar / 10 Hz — single pass</strong></li>
                <li>Weigh within 10 sec of padding</li>
                <li>Enter both weights in one row below</li>
              </ol>
              <p className="mt-2 text-xs text-amber-800 bg-amber-100 rounded px-2 py-1">
                ⚠ <strong>Single pass only.</strong> Don't re-pad to lower the wet weight — that's over-squeezing, not pickup.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-200">
                    <th className="text-left px-2 py-2">Run</th>
                    <th className="text-left px-2 py-2">Dry weight (g)</th>
                    <th className="text-left px-2 py-2">Wet after pad (g)</th>
                    <th className="text-right px-2 py-2">Pickup %</th>
                    <th className="text-right px-2 py-2">Deviation</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r, i) => {
                    const d = Number(r.dry) || 0;
                    const w = Number(r.wet) || 0;
                    const p = d > 0 && w > d ? ((w - d) / d) * 100 : null;
                    const dev = p !== null && runStats.meanPickup > 0
                      ? ((p - runStats.meanPickup) / runStats.meanPickup) * 100
                      : null;
                    const flagged = dev !== null && Math.abs(dev) > 10;
                    return (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-2 py-2 font-bold text-slate-700">#{i + 1}{i === 0 ? " *" : ""}</td>
                        <td className="px-2 py-2">
                          <input type="number" step="0.001" value={r.dry} onChange={(e) => setRuns((rs) => rs.map((x, j) => j === i ? { ...x, dry: e.target.value } : x))} placeholder="1.85" className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono" autoFocus={i === 0 && !r.dry} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" step="0.001" value={r.wet} onChange={(e) => setRuns((rs) => rs.map((x, j) => j === i ? { ...x, wet: e.target.value } : x))} placeholder="3.30" className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono" />
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-semibold">{p !== null ? p.toFixed(1) + "%" : "—"}</td>
                        <td className={`px-2 py-2 text-right font-mono text-xs ${flagged ? "text-red-600 font-bold" : "text-slate-500"}`}>
                          {dev !== null ? (dev > 0 ? "+" : "") + dev.toFixed(1) + "%" : "—"}
                          {flagged && <span className="ml-1">⚠</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {runStats.runCount > 0 && (
              <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-white/60">Mean pickup ({runStats.runCount} run{runStats.runCount > 1 ? "s" : ""})</p>
                    <p className="text-5xl font-black text-[#00b4c3] mt-1">{runStats.meanPickup.toFixed(1)}<span className="text-2xl font-medium text-white/60">%</span></p>
                    <p className="text-xs text-white/50 mt-1">Used for all bath recipe calculations</p>
                  </div>
                  {runStats.runCount >= 2 && (
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase text-white/60">Max run deviation</p>
                      <p className={`text-xl font-mono font-bold ${runStats.maxDevPct > 10 ? "text-red-400" : "text-emerald-400"}`}>
                        {runStats.maxDevPct.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-white/50">{runStats.maxDevPct > 10 ? "⚠ flag batch" : "✓ within 10%"}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500">* Run 1 required. Runs 2 &amp; 3 strongly recommended — any run &gt;10% from the mean flags the sample.</p>
          </div>
        )}

        {/* Step 5: Prepare Test Bath */}
        {step === 5 && (() => {
          const tier = form.testedAtTier || "F1";
          const bathL = Number(form.testBathVolumeL) || 1;
          const stock = Number(form.stockMgPerL) || STOCK_MG_PER_L;
          const bathConc = pickupUsed ? TIER_MG_PER_KG[tier] / (pickupUsed / 100) : 0;
          const fuzeMl = pickupUsed ? (bathConc * bathL * 1000) / stock : 0;
          const waterMl = bathL * 1000 - fuzeMl;
          const expectedPpm = TIER_MG_PER_KG[tier] * 1000; // mg/kg = ppm by weight
          return (
            <div className="space-y-4">
              <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg text-sm text-slate-700">
                <p className="font-bold mb-2">🧪 Prepare the bench test bath</p>
                <p>The FUZE mini pad is a <strong>vertical padder</strong> — the fabric moves upward through a bath held in the reservoir between the two pads pressed together. Mix a small test bath at the target tier concentration, pour into the reservoir, then pad a fresh fabric sample through it.</p>
                <p className="mt-2 text-xs text-slate-600">Typical bench test uses <strong>1 L</strong> for the reservoir. Smaller 0.5 L batches are fine if you're tight on sample material.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Target tier</label>
                  <div className="grid grid-cols-4 gap-1">
                    {["F1","F2","F3","F4"].map((t) => (
                      <button key={t} type="button" onClick={() => set("testedAtTier", t)} className={`p-2 rounded border text-xs font-bold ${tier === t ? "border-[#00b4c3] bg-[#00b4c3]/10 text-[#00b4c3]" : "border-slate-200 text-slate-600"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{tier} = {TIER_MG_PER_KG[tier]} mg/kg OWF target</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Bath volume (reservoir)</label>
                  <div className="grid grid-cols-3 gap-1">
                    {["0.5","1","2"].map((v) => (
                      <button key={v} type="button" onClick={() => set("testBathVolumeL", v)} className={`p-2 rounded border text-xs font-bold ${String(form.testBathVolumeL) === v ? "border-[#00b4c3] bg-[#00b4c3]/10 text-[#00b4c3]" : "border-slate-200 text-slate-600"}`}>
                        {v} L
                      </button>
                    ))}
                  </div>
                  <input type="number" step="0.1" value={form.testBathVolumeL} onChange={(e) => set("testBathVolumeL", e.target.value)} className="mt-1 w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono" />
                </div>
              </div>

              {pickupUsed ? (
                <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg text-white">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#00b4c3] mb-3">Recipe — measure these exactly</p>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-white/5 rounded p-3">
                      <p className="text-[10px] text-white/60 uppercase">Bath concentration</p>
                      <p className="text-xl font-mono font-black">{bathConc.toFixed(2)} <span className="text-xs text-white/60">mg/L</span></p>
                    </div>
                    <div className="bg-[#00b4c3]/20 border border-[#00b4c3]/40 rounded p-3">
                      <p className="text-[10px] text-[#00b4c3] uppercase">FUZE stock to add</p>
                      <p className="text-2xl font-mono font-black text-[#00b4c3]">{fuzeMl.toFixed(1)} <span className="text-xs">mL</span></p>
                      <p className="text-[10px] text-white/60">≈ {fuzeMl.toFixed(1)} g (water-based)</p>
                    </div>
                    <div className="bg-white/5 rounded p-3">
                      <p className="text-[10px] text-white/60 uppercase">Water to add</p>
                      <p className="text-2xl font-mono font-black">{waterMl.toFixed(0)} <span className="text-xs text-white/60">mL</span></p>
                    </div>
                  </div>
                  <div className="text-xs text-white/70 space-y-1">
                    <p>📝 <strong>Protocol:</strong> measure {fuzeMl.toFixed(1)} mL of 30 mg/L FUZE stock into a clean beaker. Top up to <strong>{bathL} L</strong> total with DI water. Stir gently.</p>
                    <p>🎯 <strong>Expected on fabric:</strong> ~{expectedPpm.toFixed(0)} ppm Ag (for ICP verification)</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  ⚠ Complete Step 4 first — pickup % is required to compute the bath recipe.
                </div>
              )}
            </div>
          );
        })()}

        {/* Step 6: Wet-to-wet */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-slate-700">
              <p className="font-bold mb-2">🌊 Wet-to-wet pickup — when & how</p>
              <p className="mb-2"><strong>When to run it:</strong> if your production treats fabric that arrives wet (from scouring, bleaching, etc.). The existing water dilutes the treatment bath, so net active-ingredient pickup is lower than dry-to-wet.</p>
              <p className="font-semibold mt-2">Protocol (on a fresh sample):</p>
              <ol className="space-y-1 pl-5 list-decimal mt-1">
                <li>Weigh dry (use the dry weight from Step 2)</li>
                <li><strong>Pre-wet with WATER ONLY:</strong> submerge 10 sec, drain 3 sec, pad at 4 bar → weigh = <strong>W_prewet</strong></li>
                <li><strong>Dip in TREATMENT BATH:</strong> submerge 10 sec, drain 3 sec, pad at 4 bar → weigh = <strong>W_final</strong></li>
                <li>Net wet-to-wet pickup % = (W_final − W_prewet) / W_dry × 100</li>
              </ol>
              <p className="mt-2 text-[11px] text-slate-600">Skip this step if your production runs dry fabric into the bath.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Pre-wet weight (g) — water only</label>
                <input type="number" step="0.001" value={form.preWetSampleWeight} onChange={(e) => set("preWetSampleWeight", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
                <p className="text-[10px] text-slate-500 mt-1">After water dip + pad, before bath</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Wet after bath pad (g) — final</label>
                <input type="number" step="0.001" value={form.wetAfterBathFromPreWet} onChange={(e) => set("wetAfterBathFromPreWet", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
                <p className="text-[10px] text-slate-500 mt-1">After treatment dip + pad</p>
              </div>
            </div>
            {calc.pickupWetToWetPct !== undefined && (
              <div className="p-4 bg-slate-900 rounded-lg text-white">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-white/60">Pre-wet moisture</p>
                    <p className="text-xl font-mono font-bold">{calc.preWetMoisturePct.toFixed(1)}%</p>
                    <p className="text-[10px] text-white/50">water picked up before bath</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-white/60">Net wet-to-wet pickup</p>
                    <p className="text-3xl font-black text-[#00b4c3]">{calc.pickupWetToWetPct.toFixed(1)}%</p>
                    <p className="text-[10px] text-white/50">used for dilution calc</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Production */}
        {step === 7 && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-slate-700">
              🏭 Two ways to plan a production run. Use either (or both).
            </div>

            {/* QUICK BATH VOLUME TABLE */}
            {pickupUsed && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">Quick bath reference — FUZE stock needed per bath size</p>
                <div className="overflow-x-auto bg-slate-900 text-white rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/20 text-xs text-white/60">
                        <th className="text-left px-3 py-2">Bath Volume</th>
                        <th className="text-right px-3 py-2">F1</th>
                        <th className="text-right px-3 py-2">F2</th>
                        <th className="text-right px-3 py-2">F3</th>
                        <th className="text-right px-3 py-2">F4</th>
                      </tr>
                    </thead>
                    <tbody>
                      {STANDARD_BATHS_L.map((bathL) => (
                        <tr key={bathL} className="border-b border-white/10">
                          <td className="px-3 py-2 font-mono font-bold">{bathL} L bath</td>
                          {["F1","F2","F3","F4"].map(t => {
                            const lFuze = fuzeLitersForBath(bathL, pickupUsed, TIER_MG_PER_KG[t], Number(form.stockMgPerL) || 30);
                            return (
                              <td key={t} className="px-3 py-2 text-right font-mono text-[#00b4c3] font-bold">
                                {lFuze >= 1 ? lFuze.toFixed(2) + " L" : (lFuze * 1000).toFixed(0) + " mL"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Pickup {pickupUsed.toFixed(1)}% · Stock {form.stockMgPerL} mg/L · Add the rest as water to reach the bath volume.</p>
              </div>
            )}

            {/* TARGET FABRIC MASS */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">Or by target fabric mass</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Target fabric mass (kg)</label>
                  <input type="number" step="1" value={form.targetProductionKg} onChange={(e) => set("targetProductionKg", e.target.value)} placeholder="e.g. 1000" className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Stock FUZE (mg/L)</label>
                  <input type="number" step="0.1" value={form.stockMgPerL} onChange={(e) => set("stockMgPerL", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
                  <p className="text-[10px] text-slate-400 mt-0.5">Standard: 30 mg/L</p>
                </div>
              </div>
              {calc.targetBathVolumeL && (
                <div className="mt-3 p-4 bg-slate-900 rounded-lg text-white space-y-1">
                  <div className="flex justify-between"><span className="text-white/70 text-sm">Total bath volume for {form.targetProductionKg} kg</span><span className="font-mono font-bold">{calc.targetBathVolumeL.toFixed(1)} L</span></div>
                  {["F1","F2","F3","F4"].map(t => (
                    <div key={t} className="flex justify-between text-sm">
                      <span className="text-white/70">{t} FUZE needed</span>
                      <span className="font-mono font-bold text-[#00b4c3]">{calc[`${t}_liters`]?.toFixed(2) || "—"} L</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 7: Review + save */}
        {step === 8 && (
          <div className="space-y-5">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Test summary</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-600">Fabric</span><span className="font-semibold">{form.fabricLabel || "—"}</span>
                <span className="text-slate-600">GSM (computed)</span><span className="font-semibold font-mono">{calc.computedGsm?.toFixed(0) || form.fabricWeightGsm || "—"} g/m²</span>
                <span className="text-slate-600">Method</span><span className="font-semibold">{form.applicationMethod.replace(/_/g, "-")}</span>
                <span className="text-slate-600">Pressure</span><span className="font-semibold font-mono">{form.squeezePressure} bar</span>
                <span className="text-slate-600">VFD / Speed</span><span className="font-semibold font-mono">{form.vfdFrequencyHz} Hz · {lineSpeed.toFixed(2)} m/min</span>
                <span className="text-slate-600">Dry weight</span><span className="font-semibold font-mono">{form.drySampleWeight} g</span>
                <span className="text-slate-600">Wet weight</span><span className="font-semibold font-mono">{form.wetAfterBathWeight} g</span>
                <span className="text-slate-600">Pickup used</span><span className="font-semibold font-mono text-[#00b4c3]">{fmt(pickupUsed, 1)}% ({calc.pickupWetToWetPct ? "wet-to-wet" : "dry-to-wet"})</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Four-tier bath recipe</p>
              <div className="grid grid-cols-4 gap-2">
                {["F1","F2","F3","F4"].map(t => (
                  <div key={t} className="border-2 border-[#00b4c3] rounded-lg p-3">
                    <p className="font-black text-[#00b4c3] text-lg">{t}</p>
                    <p className="text-[10px] text-slate-500">{TIER_MG_PER_KG[t]} mg/kg OWF</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div><p className="text-slate-500">Bath conc</p><p className="font-mono font-bold">{fmt(calc[`${t}_bath`])} mg/L</p></div>
                      <div><p className="text-slate-500">Dilution</p><p className="font-mono font-bold">1 : {fmt(calc[`${t}_ratio`], 1)}</p></div>
                      <div>
                        <p className="text-slate-500">FUZE per L bath</p>
                        <p className="font-mono font-bold">{fmt(calc[`${t}_ml`], 1)} mL</p>
                        <p className="font-mono text-[10px] text-slate-500">≈ {fmt(calc[`${t}_ml`], 1)} g (water-based)</p>
                      </div>
                      {calc[`${t}_liters`] && <div className="pt-1 border-t border-slate-200"><p className="text-slate-500 text-[10px]">for {form.targetProductionKg}kg</p><p className="font-mono font-bold text-[#00b4c3]">{fmt(calc[`${t}_liters`])} L</p></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* QUICK BATH TABLE on review too */}
            {pickupUsed && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Quick bath reference</p>
                <div className="overflow-x-auto bg-slate-900 text-white rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/20 text-xs text-white/60">
                        <th className="text-left px-3 py-2">Bath</th>
                        <th className="text-right px-3 py-2">F1</th>
                        <th className="text-right px-3 py-2">F2</th>
                        <th className="text-right px-3 py-2">F3</th>
                        <th className="text-right px-3 py-2">F4</th>
                      </tr>
                    </thead>
                    <tbody>
                      {STANDARD_BATHS_L.map((bathL) => (
                        <tr key={bathL} className="border-b border-white/10">
                          <td className="px-3 py-2 font-mono">{bathL} L</td>
                          {["F1","F2","F3","F4"].map(t => {
                            const lFuze = fuzeLitersForBath(bathL, pickupUsed, TIER_MG_PER_KG[t], Number(form.stockMgPerL) || 30);
                            return (
                              <td key={t} className="px-3 py-2 text-right font-mono text-[#00b4c3]">
                                {lFuze >= 1 ? lFuze.toFixed(2) + " L" : (lFuze * 1000).toFixed(0) + " mL"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600">Notes (optional)</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.qcPassed} onChange={(e) => set("qcPassed", e.target.checked)} />
              QC Passed
            </label>

            {!savedTestId ? (
              <button onClick={save} disabled={saving} className="w-full px-4 py-3 bg-[#00b4c3] text-white rounded-lg font-black text-lg hover:bg-[#009aa8] disabled:opacity-50">
                {saving ? "Saving..." : "Save Bench Test"}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
                  ✓ Saved as <strong className="font-mono">{savedTestNumber}</strong>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a href={`/admin/recipe-calculator/${savedTestId}/report`} target="_blank" className="px-4 py-2 bg-[#00b4c3] text-white font-black rounded-lg text-sm text-center hover:bg-[#009aa8]">📄 Full Recipe Report (PDF)</a>
                  <a href={`/admin/recipe-calculator/${savedTestId}/print`} target="_blank" className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg text-sm text-center hover:bg-slate-800">🖨 Quick Test Card</a>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={graduate} className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 text-sm">⭐ Graduate to FabricRecipe</button>
                  <button onClick={() => { setSavedTestId(""); setSavedTestNumber(""); setStep(1); setRuns([{dry:"",wet:""},{dry:"",wet:""},{dry:"",wet:""}]); setForm((f: any) => ({ ...f, drySampleWeight: "", wetAfterBathWeight: "", preWetSampleWeight: "", wetAfterBathFromPreWet: "", targetProductionKg: "", notes: "" })); }} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-sm">+ New Test</button>
                </div>

                {/* ICP submission + result */}
                <div className="mt-4 p-4 bg-violet-50 border border-violet-200 rounded-lg">
                  <p className="text-xs font-black uppercase tracking-wide text-violet-900 mb-2">🧫 ICP Validation</p>
                  {icpState === "idle" && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-700">Bag &amp; tag the treated sample, fill the submission form, send to the ICP lab. Expected Ag on fabric: <strong>{(TIER_MG_PER_KG[form.testedAtTier || "F1"] * 1000).toFixed(0)} ppm</strong>.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Lab (ITS, VL, FPC...)" value={icpForm.icpLab} onChange={(e) => setIcpForm({ ...icpForm, icpLab: e.target.value })} className="px-3 py-2 border border-slate-300 rounded text-sm" />
                        <input placeholder="Lab sample ID" value={icpForm.icpSampleId} onChange={(e) => setIcpForm({ ...icpForm, icpSampleId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button disabled={icpSaving} onClick={submitToIcp} className="px-4 py-2 bg-violet-600 text-white font-semibold rounded-lg text-sm">Mark Submitted to ICP</button>
                        <a href={`/admin/recipe-calculator/${savedTestId}/icp-form`} target="_blank" className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg text-sm text-center">🖨 Print ICP Form</a>
                      </div>
                    </div>
                  )}
                  {(icpState === "submitted" || icpState === "complete") && (
                    <div className="space-y-2">
                      <p className="text-xs text-emerald-700">✓ Submitted to ICP. Enter the measured Ag ppm when the result comes back.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" step="0.1" placeholder="Measured Ag (ppm)" value={icpForm.icpMeasuredPpm} onChange={(e) => setIcpForm({ ...icpForm, icpMeasuredPpm: e.target.value })} className="px-3 py-2 border border-slate-300 rounded text-sm font-mono font-bold" />
                        <input placeholder="ICP report PDF URL" value={icpForm.icpReportUrl} onChange={(e) => setIcpForm({ ...icpForm, icpReportUrl: e.target.value })} className="px-3 py-2 border border-slate-300 rounded text-sm" />
                      </div>
                      <button disabled={icpSaving || !icpForm.icpMeasuredPpm} onClick={enterIcpResult} className="w-full px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50">Save ICP Result</button>
                      {icpForm.icpMeasuredPpm && (() => {
                        const expected = TIER_MG_PER_KG[form.testedAtTier || "F1"] * 1000;
                        const measured = Number(icpForm.icpMeasuredPpm);
                        const affinity = expected > 0 ? (measured / expected) * 100 : 0;
                        const within = affinity >= 90 && affinity <= 110;
                        return (
                          <div className={`p-3 rounded border text-xs ${within ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                            <p><strong>Affinity:</strong> {affinity.toFixed(1)}% ({within ? "✓ within 90-110% target" : "⚠ outside target — adjust recipe"}).</p>
                            <p className="mt-0.5">Expected {expected} ppm · Measured {measured} ppm.</p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className={`mt-4 p-3 rounded-lg border text-xs ${hasError ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
            <p className="font-bold mb-1">{hasError ? "⛔ Fix before continuing" : "⚠ Sanity check"}</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {warnings.map((w, i) => <li key={i}>{w.msg}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Nav */}
      {!savedTestId && (
        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="px-5 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg disabled:opacity-40">
            ← Back
          </button>
          <span className="text-sm text-slate-500">Step {step} of {STEPS.length}</span>
          {step < STEPS.length && (
            <button onClick={() => setStep(step + 1)} disabled={!canAdvance()} className="px-5 py-2 bg-[#00b4c3] text-white font-semibold rounded-lg hover:bg-[#009aa8] disabled:opacity-40">
              Next →
            </button>
          )}
          {step === STEPS.length && <span />}
        </div>
      )}

      {/* Recent tests (collapsed) */}
      {recentTests.length > 0 && (
        <details className="mt-8 bg-white border border-slate-200 rounded-xl">
          <summary className="cursor-pointer px-5 py-3 font-bold text-slate-900 text-sm">
            📋 Recent Bench Tests ({recentTests.length})
          </summary>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Test #</th>
                  <th className="text-left px-3 py-2">Fabric</th>
                  <th className="text-right px-3 py-2">Pickup %</th>
                  <th className="text-right px-3 py-2">F1</th>
                  <th className="text-right px-3 py-2">F2</th>
                  <th className="text-right px-3 py-2">F3</th>
                  <th className="text-right px-3 py-2">F4</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentTests.slice(0, 20).map((t) => {
                  const p = t.pickupWetToWetPct || t.pickupDryToWetPct;
                  return (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs">{t.testNumber}</td>
                      <td className="px-3 py-2">{t.fabric?.fuzeNumber || t.fabricLabel}</td>
                      <td className="px-3 py-2 text-right font-mono">{p ? p.toFixed(1) + "%" : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">1:{fmt(t.f1DilutionRatio, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">1:{fmt(t.f2DilutionRatio, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">1:{fmt(t.f3DilutionRatio, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">1:{fmt(t.f4DilutionRatio, 1)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <a href={`/admin/recipe-calculator/${t.id}/report`} target="_blank" className="text-xs text-[#00b4c3] font-semibold hover:underline mr-2">📄</a>
                        <a href={`/admin/recipe-calculator/${t.id}/print`} target="_blank" className="text-xs text-slate-600 font-semibold hover:underline mr-2">🖨</a>
                        {t.graduatedRecipeId ? <span className="text-xs text-emerald-700">✓</span> : (
                          <button onClick={async () => {
                            if (!confirm(`Graduate ${t.testNumber} into 4 FabricRecipes?`)) return;
                            const r = await fetch(`/api/admin/recipe-bench-tests/${t.id}/graduate`, { method: "POST" });
                            const d = await r.json();
                            if (d.ok) loadRecent();
                          }} className="text-xs text-[#00b4c3] font-semibold">⭐</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
