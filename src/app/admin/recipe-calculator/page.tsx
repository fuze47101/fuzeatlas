// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/**
 * FUZE Lab Recipe Calculator
 *
 * Lab tech enters dry sample weight + post-bath weight → live calc
 * of pickup %, bath concentration, dilution ratio, and FUZE volume
 * for all four tiers (F1–F4). Optional wet-to-wet measurements and
 * production scaling.
 *
 * The same math runs server-side on save, so the persisted record
 * matches what the tech saw on screen.
 */

const STOCK_MG_PER_L = 30;
const TIER_MG_PER_KG: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };

/**
 * Sanity checks on raw measurements. Returns an array of warnings
 * with severity so the UI can flag suspicious entries BEFORE the
 * tech commits a bad record. None of these are hard errors — they
 * just nudge the tech to double-check.
 */
function validateInputs(input: any, calc: any) {
  const warnings: { severity: "error" | "warn" | "info"; field: string; msg: string }[] = [];
  const dry = Number(input.drySampleWeight) || 0;
  const wet = Number(input.wetAfterBathWeight) || 0;
  const preWet = Number(input.preWetSampleWeight) || 0;
  const wetFromPre = Number(input.wetAfterBathFromPreWet) || 0;
  const gsm = Number(input.fabricWeightGsm) || 0;
  const pressure = Number(input.squeezePressure) || 0;
  const stock = Number(input.stockMgPerL) || 30;

  if (dry > 0 && wet > 0 && wet <= dry) {
    warnings.push({ severity: "error", field: "wetAfterBathWeight", msg: "Wet weight must be greater than dry weight." });
  }
  if (dry > 0 && wet / dry > 3) {
    warnings.push({ severity: "warn", field: "wetAfterBathWeight", msg: "Pickup appears unusually high (>200%). Re-check weighing." });
  }
  if (preWet > 0 && dry > 0 && preWet <= dry) {
    warnings.push({ severity: "error", field: "preWetSampleWeight", msg: "Pre-wet weight should be greater than dry weight." });
  }
  if (preWet > 0 && wetFromPre > 0 && wetFromPre <= preWet) {
    warnings.push({ severity: "error", field: "wetAfterBathFromPreWet", msg: "Wet-after-pad (from pre-wet) must be greater than pre-wet weight." });
  }
  if (calc.pickupDryToWetPct !== undefined) {
    if (calc.pickupDryToWetPct < 30) {
      warnings.push({ severity: "warn", field: "wetAfterBathWeight", msg: `Pickup ${calc.pickupDryToWetPct.toFixed(1)}% is low for pad. Typical range 50-100%. Sample may be over-squeezed.` });
    } else if (calc.pickupDryToWetPct > 120) {
      warnings.push({ severity: "warn", field: "wetAfterBathWeight", msg: `Pickup ${calc.pickupDryToWetPct.toFixed(1)}% is high. Normal for nonwoven / heavy knits; unusual for plain weave.` });
    }
  }
  if (calc.pickupWetToWetPct !== undefined && calc.pickupDryToWetPct !== undefined && calc.pickupWetToWetPct > calc.pickupDryToWetPct + 10) {
    warnings.push({ severity: "warn", field: "wetAfterBathFromPreWet", msg: "Wet-to-wet pickup higher than dry-to-wet — unusual. Verify measurements." });
  }
  if (gsm > 0 && (gsm < 30 || gsm > 700)) {
    warnings.push({ severity: "info", field: "fabricWeightGsm", msg: `${gsm} g/m² is outside the typical 30-700 range.` });
  }
  if (pressure > 0 && (pressure < 1 || pressure > 8)) {
    warnings.push({ severity: "info", field: "squeezePressure", msg: `${pressure} bar is outside the typical 2-6 bar pad range (FUZE lab mini pad = 4 bar).` });
  }
  if (stock < 10 || stock > 60) {
    warnings.push({ severity: "warn", field: "stockMgPerL", msg: `Stock ${stock} mg/L — standard is 30. Confirm before saving.` });
  }
  if (dry > 0 && dry < 0.5) {
    warnings.push({ severity: "info", field: "drySampleWeight", msg: "Sample under 0.5g is very small — scale precision matters a lot." });
  }
  return warnings;
}

function computeRecipe(input: any) {
  const dry = Number(input.drySampleWeight) || 0;
  const wetDryToWet = Number(input.wetAfterBathWeight) || 0;
  const preWet = Number(input.preWetSampleWeight) || 0;
  const wetFromPreWet = Number(input.wetAfterBathFromPreWet) || 0;
  const stock = Number(input.stockMgPerL) || STOCK_MG_PER_L;

  const out: any = { stockMgPerL: stock };

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

export default function RecipeCalculatorPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [recentTests, setRecentTests] = useState<any[]>([]);

  const [form, setForm] = useState<any>({
    fabricId: "",
    fabricLabel: "",
    fabricType: "Knit",
    fiberContent: "",
    fabricWeightGsm: "",
    applicationMethod: "PAD_DRY_CURE",
    squeezePressure: "4",  // FUZE lab mini pad bath runs at 4 bar
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
    fetch("/api/fabrics?limit=300")
      .then((r) => r.json())
      .then((d) => setFabrics(d.fabrics || []))
      .catch(() => {});
    loadRecent();
  }, [user]);

  async function loadRecent() {
    try {
      const res = await fetch("/api/admin/recipe-bench-tests");
      const d = await res.json();
      if (d.ok) setRecentTests(d.tests);
    } catch {}
  }

  const calc = useMemo(() => computeRecipe(form), [form]);
  const warnings = useMemo(() => validateInputs(form, calc), [form, calc]);
  const warnFor = (field: string) => warnings.filter(w => w.field === field);
  const hasBlockingError = warnings.some(w => w.severity === "error");

  function set(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.drySampleWeight || !form.wetAfterBathWeight) {
      setError("Dry sample weight and wet-after-bath weight are required.");
      return;
    }
    if (!form.fabricLabel && !form.fabricId) {
      setError("Provide a fabric label or select a fabric.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/recipe-bench-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.ok) {
        setSuccess(`Saved as ${d.test.testNumber}`);
        setTimeout(() => setSuccess(""), 6000);
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

  const fmtPct = (n: number | undefined) =>
    n !== undefined && n !== null ? `${n.toFixed(2)}%` : "—";
  const fmt1 = (n: number | undefined) =>
    n !== undefined && n !== null ? n.toFixed(1) : "—";
  const fmt2 = (n: number | undefined) =>
    n !== undefined && n !== null ? n.toFixed(2) : "—";
  const fmt3 = (n: number | undefined) =>
    n !== undefined && n !== null ? n.toFixed(3) : "—";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Recipe Calculator</h1>
          <p className="text-slate-600">
            Enter bench-test measurements → live calculation of pickup rate, bath
            concentrations, dilutions, and FUZE volumes for F1–F4.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a href="/admin/recipe-calculator/sop" target="_blank" className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800">
            📋 Print SOP
          </a>
        </div>
      </div>

      {/* Step-by-step guide — collapsible */}
      <details className="mb-6 bg-gradient-to-br from-cyan-50 to-sky-50 border-2 border-[#00b4c3]/40 rounded-xl overflow-hidden" open>
        <summary className="cursor-pointer px-5 py-3 font-bold text-slate-900 flex items-center justify-between">
          <span>📖 Bench Test Procedure</span>
          <span className="text-xs font-normal text-slate-500">click to collapse</span>
        </summary>
        <div className="px-5 pb-5 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          {[
            {
              n: 1,
              t: "Cut a clean fabric sample",
              d: "10×10 cm (or consistent sample size) from the fabric you're testing. Note the fabric ID, type, and g/m².",
            },
            {
              n: 2,
              t: "Weigh the dry sample",
              d: "Record the dry weight in grams. Enter in section 3 → Dry sample weight.",
            },
            {
              n: 3,
              t: "Dip in clean water · pad @ 4 bar",
              d: "Fully submerge the sample in clean water, feed through the mini pad bath at 4 bar. Immediately weigh.",
            },
            {
              n: 4,
              t: "Record post-pad wet weight",
              d: "Enter in section 3 → Wet weight after pad. Live calc will show pickup %.",
            },
            {
              n: 5,
              t: "(Optional) Wet-to-wet run",
              d: "If you treat on wet fabric in production: weigh the pre-wet sample, then dip-and-pad, then weigh again. Fill both wet-to-wet fields.",
            },
            {
              n: 6,
              t: "Check on-screen Live Calculation",
              d: "Pickup %, bath concentration, dilution ratios and FUZE mL per L are computed. Watch for yellow sanity warnings.",
            },
            {
              n: 7,
              t: "(Optional) Scale to production",
              d: "Enter target fabric mass in kg to see total FUZE liters + bath volume needed for an actual run.",
            },
            {
              n: 8,
              t: "Save + Graduate or Print",
              d: "Save the bench test to persist the record. Graduate to FabricRecipe to publish for the factory. Print Test Card for the lab bench.",
            },
          ].map((s) => (
            <div key={s.n} className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-black flex items-center justify-center">{s.n}</span>
                <p className="font-bold text-slate-900 text-xs">{s.t}</p>
              </div>
              <p className="text-xs text-slate-600 leading-snug">{s.d}</p>
            </div>
          ))}
        </div>
      </details>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">✓ {success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── INPUTS ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fabric */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-bold text-slate-900 mb-3">1. Fabric</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Link to fabric (optional)</label>
                <select value={form.fabricId} onChange={(e) => set("fabricId", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">— Not linked —</option>
                  {fabrics.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fuzeNumber || f.name} {f.name && f.fuzeNumber ? `· ${f.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Fabric label / description *</label>
                <input value={form.fabricLabel} onChange={(e) => set("fabricLabel", e.target.value)} placeholder="e.g. 180 gsm French Terry · Cotton" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Fabric type</label>
                <select value={form.fabricType} onChange={(e) => set("fabricType", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option>Knit</option>
                  <option>Woven</option>
                  <option>Nonwoven</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Weight (g/m²)</label>
                <input type="number" value={form.fabricWeightGsm} onChange={(e) => set("fabricWeightGsm", e.target.value)} placeholder="180" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Fiber content</label>
                <input value={form.fiberContent} onChange={(e) => set("fiberContent", e.target.value)} placeholder="e.g. 100% Cotton or 65/35 Poly-Cotton" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
          </div>

          {/* Method */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-bold text-slate-900 mb-3">2. Application Method</h2>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { v: "PAD_DRY_CURE", label: "Pad-Dry-Cure" },
                { v: "EXHAUST", label: "Exhaust" },
                { v: "SPRAY", label: "Spray" },
                { v: "FOAM", label: "Foam" },
              ].map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => set("applicationMethod", m.v)}
                  className={`p-2 rounded-lg border text-xs font-semibold ${
                    form.applicationMethod === m.v
                      ? "border-[#00b4c3] bg-[#00b4c3]/10 text-[#00b4c3]"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Squeeze pressure (bar)</label>
                <input type="number" step="0.1" value={form.squeezePressure} onChange={(e) => set("squeezePressure", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Drying °C</label>
                <input type="number" value={form.dryingTemp} onChange={(e) => set("dryingTemp", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Drying min</label>
                <input type="number" step="0.1" value={form.dryingTime} onChange={(e) => set("dryingTime", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Curing °C</label>
                <input type="number" value={form.curingTemp} onChange={(e) => set("curingTemp", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Curing min</label>
                <input type="number" step="0.1" value={form.curingTime} onChange={(e) => set("curingTime", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              {form.applicationMethod === "EXHAUST" && (
                <div>
                  <label className="text-xs font-semibold text-slate-600">Liquor ratio</label>
                  <input value={form.liquorRatio} onChange={(e) => set("liquorRatio", e.target.value)} placeholder="1:10" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              )}
            </div>
          </div>

          {/* Measurements */}
          <div className="bg-gradient-to-br from-cyan-50 to-white border-2 border-[#00b4c3]/40 rounded-xl p-5">
            <h2 className="font-bold text-slate-900 mb-1">3. Measurements</h2>
            <p className="text-xs text-slate-500 mb-3">Dry-to-wet pad pickup — required. Wet-to-wet — optional but more accurate for wet-on-wet production.</p>

            <div className="mb-4">
              <p className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-2">Dry → Wet (standard)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Dry sample weight (g) *</label>
                  <input type="number" step="0.01" value={form.drySampleWeight} onChange={(e) => set("drySampleWeight", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
                  {warnFor("drySampleWeight").map((w, i) => <WarnLine key={i} {...w} />)}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Wet weight after pad (g) *</label>
                  <input type="number" step="0.01" value={form.wetAfterBathWeight} onChange={(e) => set("wetAfterBathWeight", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
                  {warnFor("wetAfterBathWeight").map((w, i) => <WarnLine key={i} {...w} />)}
                </div>
              </div>
            </div>

            <div className="mb-4 pt-3 border-t border-slate-200">
              <p className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-2">Wet → Wet (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Pre-wet weight (g)</label>
                  <input type="number" step="0.01" value={form.preWetSampleWeight} onChange={(e) => set("preWetSampleWeight", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
                  {warnFor("preWetSampleWeight").map((w, i) => <WarnLine key={i} {...w} />)}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Wet weight after pad from pre-wet (g)</label>
                  <input type="number" step="0.01" value={form.wetAfterBathFromPreWet} onChange={(e) => set("wetAfterBathFromPreWet", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
                  {warnFor("wetAfterBathFromPreWet").map((w, i) => <WarnLine key={i} {...w} />)}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-2">Production scaling (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Target fabric mass (kg)</label>
                  <input type="number" step="0.1" value={form.targetProductionKg} onChange={(e) => set("targetProductionKg", e.target.value)} placeholder="e.g. 1000" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Stock FUZE (mg/L)</label>
                  <input type="number" step="0.1" value={form.stockMgPerL} onChange={(e) => set("stockMgPerL", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
                  <p className="text-[10px] text-slate-400 mt-0.5">Standard = 30 mg/L</p>
                </div>
              </div>
            </div>
          </div>

          {/* Notes + save */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="mb-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.qcPassed} onChange={(e) => set("qcPassed", e.target.checked)} />
                QC Passed
              </label>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Notes</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
            </div>
            {warnings.length > 0 && (
              <div className={`mt-3 p-3 rounded-lg border text-xs ${hasBlockingError ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
                <p className={`font-bold mb-1 ${hasBlockingError ? "text-red-800" : "text-amber-800"}`}>
                  {hasBlockingError ? "⛔ Fix these before saving" : "⚠ Sanity checks — review before saving"}
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {warnings.map((w, i) => (
                    <li key={i} className={w.severity === "error" ? "text-red-700" : w.severity === "warn" ? "text-amber-700" : "text-slate-600"}>
                      {w.msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button onClick={save} disabled={saving || hasBlockingError} className="mt-3 w-full px-4 py-3 bg-[#00b4c3] text-white rounded-lg font-bold hover:bg-[#009aa8] disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Saving..." : hasBlockingError ? "Fix errors above to save" : "Save Bench Test"}
            </button>
          </div>
        </div>

        {/* ── LIVE OUTPUTS ── */}
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-5 sticky top-4">
            <h3 className="font-black text-lg mb-4">Live Calculation</h3>

            <div className="space-y-2 mb-5 pb-4 border-b border-white/20">
              <Row label="Dry-to-wet pickup" value={fmtPct(calc.pickupDryToWetPct)} />
              {calc.pickupWetToWetPct !== undefined && (
                <>
                  <Row label="Pre-wet moisture" value={fmtPct(calc.preWetMoisturePct)} />
                  <Row label="Wet-to-wet pickup" value={fmtPct(calc.pickupWetToWetPct)} highlight />
                </>
              )}
            </div>

            {["F1", "F2", "F3", "F4"].map((tier) => (
              <div key={tier} className="mb-3 pb-3 border-b border-white/10 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-black text-[#00b4c3]">{tier}</span>
                  <span className="text-xs text-white/60">{TIER_MG_PER_KG[tier]} mg/kg OWF</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                  <span className="text-white/70">Bath conc</span>
                  <span className="text-right font-mono">{fmt2(calc[`${tier}_bath`])} <span className="text-white/50">mg/L</span></span>
                  <span className="text-white/70">FUZE / L bath</span>
                  <span className="text-right font-mono">{fmt1(calc[`${tier}_ml`])} <span className="text-white/50">mL</span></span>
                  <span className="text-white/70">Dilution</span>
                  <span className="text-right font-mono">1 : {fmt1(calc[`${tier}_ratio`])}</span>
                </div>
                {calc[`${tier}_liters`] !== undefined && (
                  <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs bg-white/5 rounded px-2 py-1">
                    <span className="text-[#00b4c3]">for {form.targetProductionKg}kg</span>
                    <span className="text-right font-bold text-[#00b4c3]">{fmt2(calc[`${tier}_liters`])} L FUZE</span>
                  </div>
                )}
              </div>
            ))}

            {calc.targetBathVolumeL && (
              <div className="mt-3 pt-3 border-t border-white/20 text-xs">
                <Row label="Total bath volume for target" value={`${fmt1(calc.targetBathVolumeL)} L`} />
              </div>
            )}

            <p className="mt-4 text-[10px] text-white/50">
              Stock @ {calc.stockMgPerL} mg/L. Pickup used: {calc.pickupWetToWetPct ? "wet-to-wet" : "dry-to-wet"}.
              1 L bath ≈ 1 kg water (dilute approximation).
            </p>
          </div>
        </div>
      </div>

      {/* Recent tests */}
      {recentTests.length > 0 && (
        <div className="mt-8">
          <h2 className="font-bold text-slate-900 mb-3">Recent Bench Tests</h2>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Test #</th>
                  <th className="text-left px-3 py-2">Fabric</th>
                  <th className="text-left px-3 py-2">Method</th>
                  <th className="text-right px-3 py-2">Pickup %</th>
                  <th className="text-right px-3 py-2">F1 dil</th>
                  <th className="text-right px-3 py-2">F2 dil</th>
                  <th className="text-right px-3 py-2">F3 dil</th>
                  <th className="text-right px-3 py-2">F4 dil</th>
                  <th className="text-right px-3 py-2">Date</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentTests.map((t) => {
                  const pickup = t.pickupWetToWetPct || t.pickupDryToWetPct;
                  return (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs">{t.testNumber}</td>
                      <td className="px-3 py-2">{t.fabric?.fuzeNumber || t.fabricLabel}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{t.applicationMethod.replace(/_/g, "-")}</td>
                      <td className="px-3 py-2 text-right font-mono">{pickup ? pickup.toFixed(1) + "%" : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">1:{t.f1DilutionRatio ? t.f1DilutionRatio.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">1:{t.f2DilutionRatio ? t.f2DilutionRatio.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">1:{t.f3DilutionRatio ? t.f3DilutionRatio.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">1:{t.f4DilutionRatio ? t.f4DilutionRatio.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{new Date(t.testDate).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <a
                          href={`/admin/recipe-calculator/${t.id}/print`}
                          target="_blank"
                          className="text-xs text-[#00b4c3] font-semibold hover:underline mr-2"
                        >
                          🖨 Print
                        </a>
                        {t.graduatedRecipeId ? (
                          <span className="text-xs text-emerald-700 font-semibold">✓ Graduated</span>
                        ) : (
                          <button
                            onClick={async () => {
                              if (!confirm(`Graduate ${t.testNumber} into 4 published FabricRecipes (F1–F4)?`)) return;
                              const res = await fetch(`/api/admin/recipe-bench-tests/${t.id}/graduate`, { method: "POST" });
                              const d = await res.json();
                              if (d.ok) {
                                setSuccess(d.message);
                                loadRecent();
                              } else {
                                setError(d.error);
                              }
                            }}
                            className="text-xs text-[#00b4c3] font-semibold hover:underline"
                          >
                            ⭐ Graduate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/70">{label}</span>
      <span className={`font-mono ${highlight ? "text-[#00b4c3] font-bold" : ""}`}>{value}</span>
    </div>
  );
}

function WarnLine({ severity, msg }: { severity: "error" | "warn" | "info"; msg: string }) {
  const cls = severity === "error"
    ? "text-red-700 bg-red-50 border-red-200"
    : severity === "warn"
    ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-slate-600 bg-slate-50 border-slate-200";
  const icon = severity === "error" ? "⛔" : severity === "warn" ? "⚠" : "ⓘ";
  return (
    <div className={`mt-1 px-2 py-1 text-[11px] rounded border ${cls}`}>
      {icon} {msg}
    </div>
  );
}
