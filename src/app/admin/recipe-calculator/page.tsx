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
  { n: 3, title: "Set Method + VFD", desc: "Pad-Dry-Cure, 4 bar, 10 Hz ≈ 3 m/min" },
  { n: 4, title: "Dip → Pad → Weigh Wet", desc: "Measure pickup from dry-to-wet" },
  { n: 5, title: "Wet-to-Wet (optional)", desc: "For wet-on-wet production recipes" },
  { n: 6, title: "Production Scale (optional)", desc: "Total FUZE liters for a real run" },
  { n: 7, title: "Review & Save", desc: "Confirm all four tier recipes" },
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
    qcPassed: true,
    notes: "",
  });

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
    if (step === 2) return Number(form.drySampleWeight) > 0;
    if (step === 4) return Number(form.wetAfterBathWeight) > 0 && Number(form.wetAfterBathWeight) > Number(form.drySampleWeight);
    return true;
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/recipe-bench-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

        {/* Step 4: Wet weight */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-slate-700">
              💧 Submerge the same sample in clean DI water for 10 sec, let drain 3 sec, then pad at 4 bar / 10 Hz. Weigh immediately (within 10 sec of padding).
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Dry weight (reference)</label>
                <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-600">{form.drySampleWeight || "—"} g</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Wet weight after pad (g) *</label>
                <input type="number" step="0.001" value={form.wetAfterBathWeight} onChange={(e) => set("wetAfterBathWeight", e.target.value)} placeholder="e.g. 3.30" className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-lg font-bold" autoFocus />
              </div>
            </div>
            {calc.pickupDryToWetPct !== undefined && (
              <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-white/60">Pickup rate (dry → wet)</p>
                <p className="text-5xl font-black text-[#00b4c3] mt-1">{calc.pickupDryToWetPct.toFixed(1)}<span className="text-2xl font-medium text-white/60">%</span></p>
                <p className="text-xs text-white/50 mt-1">Every kg of dry fabric picks up {(calc.pickupDryToWetPct / 100).toFixed(2)} kg of bath liquor</p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Wet-to-wet */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-slate-700">
              🌊 <strong>Optional.</strong> Only needed if your production treats wet-on-wet fabric. Pre-wet a fresh sample, weigh, pad, weigh again.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Pre-wet weight (g)</label>
                <input type="number" step="0.001" value={form.preWetSampleWeight} onChange={(e) => set("preWetSampleWeight", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Wet after pad (from pre-wet) (g)</label>
                <input type="number" step="0.001" value={form.wetAfterBathFromPreWet} onChange={(e) => set("wetAfterBathFromPreWet", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
            </div>
            {calc.pickupWetToWetPct !== undefined && (
              <div className="p-4 bg-slate-900 rounded-lg text-white">
                <p className="text-xs font-bold uppercase text-white/60">Pre-wet moisture</p>
                <p className="text-xl font-mono font-bold">{calc.preWetMoisturePct.toFixed(1)}%</p>
                <p className="text-xs font-bold uppercase text-white/60 mt-2">Wet-to-wet pickup</p>
                <p className="text-3xl font-black text-[#00b4c3]">{calc.pickupWetToWetPct.toFixed(1)}%</p>
                <p className="text-xs text-white/50 mt-1">This will be used for the dilution calc (overrides dry-to-wet).</p>
              </div>
            )}
            <p className="text-xs text-slate-500">Not doing wet-to-wet? Just click Next.</p>
          </div>
        )}

        {/* Step 6: Production */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-slate-700">
              🏭 <strong>Optional.</strong> Enter the target production fabric mass (kg) and we'll compute total FUZE liters for a real run at each tier.
            </div>
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
              <div className="p-4 bg-slate-900 rounded-lg text-white space-y-1">
                <div className="flex justify-between"><span className="text-white/70 text-sm">Total bath volume</span><span className="font-mono font-bold">{calc.targetBathVolumeL.toFixed(1)} L</span></div>
                {["F1","F2","F3","F4"].map(t => (
                  <div key={t} className="flex justify-between text-sm">
                    <span className="text-white/70">{t} FUZE needed</span>
                    <span className="font-mono font-bold text-[#00b4c3]">{calc[`${t}_liters`]?.toFixed(2) || "—"} L</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500">Skip if you just want the recipe (no production planning).</p>
          </div>
        )}

        {/* Step 7: Review + save */}
        {step === 7 && (
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
                      <div><p className="text-slate-500">mL FUZE / L bath</p><p className="font-mono font-bold">{fmt(calc[`${t}_ml`], 1)}</p></div>
                      {calc[`${t}_liters`] && <div className="pt-1 border-t border-slate-200"><p className="text-slate-500 text-[10px]">for {form.targetProductionKg}kg</p><p className="font-mono font-bold text-[#00b4c3]">{fmt(calc[`${t}_liters`])} L</p></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={graduate} className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 text-sm">⭐ Graduate to Recipe</button>
                  <a href={`/admin/recipe-calculator/${savedTestId}/print`} target="_blank" className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg text-sm text-center hover:bg-slate-800">🖨 Print Test Card</a>
                  <button onClick={() => { setSavedTestId(""); setSavedTestNumber(""); setStep(1); setForm((f: any) => ({ ...f, drySampleWeight: "", wetAfterBathWeight: "", preWetSampleWeight: "", wetAfterBathFromPreWet: "", targetProductionKg: "", notes: "" })); }} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-sm">+ New Test</button>
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
                        <a href={`/admin/recipe-calculator/${t.id}/print`} target="_blank" className="text-xs text-[#00b4c3] font-semibold hover:underline mr-2">🖨</a>
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
