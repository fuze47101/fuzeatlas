// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

/**
 * FZ-500 · Solaris IR Heat Deflection Protocol — wizard
 *
 *   1. Fabric + tier
 *   2. Device setup (dimensions snapshot, bulb, ambient)
 *   3. Baseline run (untreated / control)
 *   4. Treated run (FUZE applied)
 *   5. Results + save
 *
 * Sensor data normally flows via the Pi → /api/admin/solaris-tests/[id]/ingest
 * with a bearer token. This wizard also accepts manual pasted series for
 * bench entry when the Pi isn't online yet.
 */

const TIERS = ["F1", "F2", "F3", "F4"];

function parseSeries(text: string) {
  // Accepts CSV: "t_sec,plateA,plateB,air,humidity" with or without header,
  // one row per line. Returns array of objects.
  if (!text) return [];
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  const rows: any[] = [];
  for (const line of lines) {
    const parts = line.split(/[,\t]/).map((p) => p.trim());
    // Skip obvious header rows
    if (isNaN(Number(parts[0]))) continue;
    const [t, a, b, air, rh] = parts;
    rows.push({
      t_sec: Number(t),
      plateA: Number(a),
      plateB: b !== undefined ? Number(b) : Number(a),
      air: air !== undefined ? Number(air) : null,
      humidity: rh !== undefined ? Number(rh) : null,
    });
  }
  return rows;
}

function seriesMetrics(series: any[]) {
  if (!Array.isArray(series) || !series.length) return { maxPlate: null, maxAir: null, tTo50: null, tTo60: null, ramp: null };
  const plate = series.map((s) => {
    const vals = [s.plateA, s.plateB].filter((v) => typeof v === "number" && Number.isFinite(v));
    return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : NaN;
  });
  const air = series.map((s) => s.air).filter((v) => typeof v === "number" && Number.isFinite(v));
  const maxPlate = Math.max(...plate.filter((v) => Number.isFinite(v)));
  const maxAir = air.length ? Math.max(...air) : null;
  const findX = (target: number) => {
    for (let i = 0; i < series.length; i++) if (plate[i] >= target) return Number(series[i].t_sec);
    return null;
  };
  const first = series[0];
  const sixty = series.find((s: any) => Number(s.t_sec) >= 60);
  let ramp = null;
  if (first && sixty) {
    const dt = Number(sixty.t_sec) - Number(first.t_sec);
    const dTemp = plate[series.indexOf(sixty)] - plate[0];
    if (dt > 0) ramp = dTemp / dt;
  }
  return { maxPlate, maxAir, tTo50: findX(50), tTo60: findX(60), ramp };
}

export default function SolarisWizardPage() {
  const { t } = useI18n();
  const T = t.solarisTest;
  const STEPS = [
    { n: 1, title: T.step1Title, desc: T.step1Desc },
    { n: 2, title: T.step2Title, desc: T.step2Desc },
    { n: 3, title: T.step3Title, desc: T.step3Desc },
    { n: 4, title: T.step4Title, desc: T.step4Desc },
    { n: 5, title: T.step5Title, desc: T.step5Desc },
  ];
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialFabricId = searchParams.get("fabricId") || "";

  const [step, setStep] = useState(1);
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [benchTests, setBenchTests] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedTest, setSavedTest] = useState<any>(null);

  const [form, setForm] = useState<any>({
    fabricId: initialFabricId,
    fabricLabel: "",
    fabricType: "",
    fiberContent: "",
    fabricWeightGsm: "",
    fabricColor: "",
    treatedAtTier: "F2",
    benchTestId: "",
    deviceName: "Solaris Unit 1",
    bulbWattage: "175",
    bulbType: "IR heat lamp · halogen",
    bulbToFabricMm: "200",
    fabricToPlateMm: "45",
    hoopDiameterMm: "150",
    hoopThicknessMm: "10",
    plateWidthMm: "175",
    plateHeightMm: "175",
    plateMaterial: "Anodized aluminum",
    ambientTempC: "",
    ambientHumidityPct: "",
    runDurationSec: "600",
    sampleIntervalMs: "1000",
    nikeSpecMaxDeltaC: "",
    notes: "",
  });

  const [baselineCsv, setBaselineCsv] = useState("");
  const [treatedCsv, setTreatedCsv] = useState("");

  const baselineSeries = parseSeries(baselineCsv);
  const treatedSeries = parseSeries(treatedCsv);
  const baseM = seriesMetrics(baselineSeries);
  const trM = seriesMetrics(treatedSeries);

  const deltaPlate = baseM.maxPlate != null && trM.maxPlate != null ? trM.maxPlate - baseM.maxPlate : null;
  const deflectionPct = baseM.maxPlate && deltaPlate != null ? -(deltaPlate / baseM.maxPlate) * 100 : null;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/fabrics?take=100").then((r) => r.json()).then((d) => {
      if (d.ok) setFabrics(d.fabrics || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.fabricId) { setBenchTests([]); return; }
    fetch(`/api/admin/recipe-bench-tests?fabricId=${form.fabricId}`).then((r) => r.json()).then((d) => {
      if (d.ok) setBenchTests(d.tests || []);
    }).catch(() => {});
  }, [form.fabricId]);

  // When a fabric is selected, pull default fabric properties
  useEffect(() => {
    if (!form.fabricId) return;
    const f = fabrics.find((x: any) => x.id === form.fabricId);
    if (!f) return;
    setForm((s: any) => ({
      ...s,
      fabricLabel: s.fabricLabel || `${f.fuzeNumber || f.customerCode || "Fabric"}`,
      fabricType: s.fabricType || f.fabricCategory || "",
      fabricWeightGsm: s.fabricWeightGsm || (f.weightGsm ? String(f.weightGsm) : ""),
      fabricColor: s.fabricColor || f.color || "",
    }));
  }, [form.fabricId, fabrics]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/solaris-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          baselineSeries: baselineSeries.length ? baselineSeries : null,
          treatedSeries: treatedSeries.length ? treatedSeries : null,
        }),
      });
      const d = await res.json();
      if (d.ok) setSavedTest(d.test);
      else alert(`Save failed: ${d.error}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  const fmt = (n: any, p = 2) => (n === null || n === undefined || !Number.isFinite(Number(n))) ? "—" : Number(n).toFixed(p);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#00b4c3]">{T.badge}</p>
            <h1 className="text-2xl font-black text-slate-900">{T.pageTitle}</h1>
          </div>
          <a href="/admin/solaris-test/list" className="text-sm text-[#00b4c3] font-semibold">{T.viewAllTests}</a>
        </div>

        {/* Stepper */}
        <div className="flex gap-2 mb-6">
          {STEPS.map((s) => (
            <button
              key={s.n}
              onClick={() => setStep(s.n)}
              className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${step === s.n ? "bg-[#00b4c3] text-white border-[#00b4c3]" : step > s.n ? "bg-white border-emerald-300 text-slate-700" : "bg-white border-slate-200 text-slate-500"}`}
            >
              <div className="text-[10px] font-bold opacity-80">{T.stepPrefix} {s.n}</div>
              <div className="text-sm font-bold">{s.title}</div>
              <div className="text-[10px] opacity-70">{s.desc}</div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* STEP 1 — Fabric + Tier */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">{T.step1Heading}</h2>
              <div>
                <label className="text-xs font-semibold text-slate-600">{T.fabricLabel}</label>
                <select value={form.fabricId} onChange={(e) => set("fabricId", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="">{T.fabricUnlinked}</option>
                  {fabrics.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.fuzeNumber || f.customerCode || f.id} · {f.color || ""} · {f.weightGsm || "—"} gsm</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.fabricReportLabel}</label>
                  <input value={form.fabricLabel} onChange={(e) => set("fabricLabel", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.fabricColorLabel}</label>
                  <input value={form.fabricColor} onChange={(e) => set("fabricColor", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder={T.fabricColorPlaceholder} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.fabricTypeLabel}</label>
                  <input value={form.fabricType} onChange={(e) => set("fabricType", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder={T.fabricTypePlaceholder} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.gsmLabel}</label>
                  <input type="number" value={form.fabricWeightGsm} onChange={(e) => set("fabricWeightGsm", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">{T.fiberContentLabel}</label>
                <input value={form.fiberContent} onChange={(e) => set("fiberContent", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder={T.fiberContentPlaceholder} />
              </div>
              <div className="p-3 bg-slate-100 rounded-lg">
                <p className="text-xs font-semibold text-slate-600 mb-2">{T.treatmentTierLabel}</p>
                <div className="flex gap-2">
                  {TIERS.map((tier) => (
                    <button key={tier} onClick={() => set("treatedAtTier", tier)} className={`px-4 py-2 rounded-lg border-2 font-bold ${form.treatedAtTier === tier ? "bg-[#00b4c3] text-white border-[#00b4c3]" : "bg-white border-slate-300 text-slate-600"}`}>{tier}</button>
                  ))}
                </div>
              </div>
              {benchTests.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.linkBenchTestLabel}</label>
                  <select value={form.benchTestId} onChange={(e) => set("benchTestId", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="">{T.linkNone}</option>
                    {benchTests.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.testNumber} · {new Date(t.testDate).toLocaleDateString()}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Device Setup */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">{T.step2Heading}</h2>
              <p className="text-xs text-slate-500">{T.step2Help}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.deviceNameLabel}</label>
                  <input value={form.deviceName} onChange={(e) => set("deviceName", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.bulbWattsLabel}</label>
                  <input type="number" value={form.bulbWattage} onChange={(e) => set("bulbWattage", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.bulbTypeLabel}</label>
                  <input value={form.bulbType} onChange={(e) => set("bulbType", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.bulbToFabricLabel}</label>
                  <input type="number" value={form.bulbToFabricMm} onChange={(e) => set("bulbToFabricMm", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.fabricToPlateLabel}</label>
                  <input type="number" value={form.fabricToPlateMm} onChange={(e) => set("fabricToPlateMm", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.hoopDiameterLabel}</label>
                  <input type="number" value={form.hoopDiameterMm} onChange={(e) => set("hoopDiameterMm", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.hoopThicknessLabel}</label>
                  <input type="number" value={form.hoopThicknessMm} onChange={(e) => set("hoopThicknessMm", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.plateWidthLabel}</label>
                  <input type="number" value={form.plateWidthMm} onChange={(e) => set("plateWidthMm", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.plateHeightLabel}</label>
                  <input type="number" value={form.plateHeightMm} onChange={(e) => set("plateHeightMm", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.plateMaterialLabel}</label>
                  <input value={form.plateMaterial} onChange={(e) => set("plateMaterial", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.ambientTempLabel}</label>
                  <input type="number" step="0.1" value={form.ambientTempC} onChange={(e) => set("ambientTempC", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.ambientHumidityLabel}</label>
                  <input type="number" step="0.1" value={form.ambientHumidityPct} onChange={(e) => set("ambientHumidityPct", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.runDurationLabel}</label>
                  <input type="number" value={form.runDurationSec} onChange={(e) => set("runDurationSec", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">{T.sampleIntervalLabel}</label>
                  <input type="number" value={form.sampleIntervalMs} onChange={(e) => set("sampleIntervalMs", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Baseline Run */}
          {step === 3 && (
            <RunStep
              title={T.step3Heading}
              help={T.step3Help}
              csv={baselineCsv}
              setCsv={setBaselineCsv}
              metrics={baseM}
              fmt={fmt}
              T={T}
            />
          )}

          {/* STEP 4 — Treated Run */}
          {step === 4 && (
            <RunStep
              title={T.step4Heading}
              help={T.step4Help}
              csv={treatedCsv}
              setCsv={setTreatedCsv}
              metrics={trM}
              fmt={fmt}
              T={T}
            />
          )}

          {/* STEP 5 — Results + Save */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">{T.step5Heading}</h2>
              <div className="grid grid-cols-3 gap-3">
                <Metric label={T.metricBaselineMaxPlate} value={fmt(baseM.maxPlate, 1) + " °C"} />
                <Metric label={T.metricTreatedMaxPlate} value={fmt(trM.maxPlate, 1) + " °C"} />
                <Metric label={T.metricDeltaPlate} value={fmt(deltaPlate, 1) + " °C"} highlight={deltaPlate != null && deltaPlate < 0 ? "good" : deltaPlate != null ? "bad" : undefined} />
                <Metric label={T.metricIrDeflection} value={fmt(deflectionPct, 1) + " %"} highlight={deflectionPct != null && deflectionPct > 0 ? "good" : undefined} />
                <Metric label={T.metricBaselineRamp} value={fmt(baseM.ramp, 3)} />
                <Metric label={T.metricTreatedRamp} value={fmt(trM.ramp, 3)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">{T.nikeSpecLabel}</label>
                <input type="number" step="0.1" value={form.nikeSpecMaxDeltaC} onChange={(e) => set("nikeSpecMaxDeltaC", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder={T.nikeSpecPlaceholder} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">{T.notesLabel}</label>
                <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              {!savedTest ? (
                <button onClick={save} disabled={saving} className="w-full px-6 py-3 bg-[#00b4c3] text-white font-black rounded-lg disabled:opacity-50">
                  {saving ? T.savingButton : T.saveButton}
                </button>
              ) : (
                <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-lg">
                  <p className="font-black text-emerald-900">{T.savedPrefix} {savedTest.testNumber}</p>
                  <div className="flex gap-2 mt-2">
                    <a href={`/admin/solaris-test/${savedTest.id}/report`} target="_blank" className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg">{T.viewReport}</a>
                    <button onClick={() => { setSavedTest(null); setStep(1); setBaselineCsv(""); setTreatedCsv(""); }} className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg">{T.newTest}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nav */}
          {!savedTest && (
            <div className="flex justify-between mt-6 pt-4 border-t border-slate-200">
              <button disabled={step === 1} onClick={() => setStep(step - 1)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg disabled:opacity-50">{T.navBack}</button>
              {step < 5 && <button onClick={() => setStep(step + 1)} className="px-6 py-2 bg-[#00b4c3] text-white font-bold rounded-lg">{T.navNext}</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RunStep({ title, help, csv, setCsv, metrics, fmt, T }: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-slate-700">
        <p className="mb-1">{help}</p>
        <p className="mt-2 font-semibold">{T.csvFormatLine}</p>
        <code className="block bg-white px-2 py-1 mt-1 text-[10px] rounded border">{T.csvFormatExample}</code>
        <p className="mt-1 text-[11px] text-slate-500">{T.csvFormatHint}</p>
      </div>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder="0,24.8,24.7,24.5,45.2&#10;1,25.1,25.0,24.6,45.1&#10;2,26.0,25.9,24.7,45.0&#10;…"
        rows={10}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
      />
      <div className="grid grid-cols-4 gap-3">
        <Metric label={T.runMaxPlate} value={fmt(metrics.maxPlate, 1) + " °C"} />
        <Metric label={T.runMaxAir} value={fmt(metrics.maxAir, 1) + " °C"} />
        <Metric label={T.runTimeTo50} value={fmt(metrics.tTo50, 0) + " s"} />
        <Metric label={T.runTimeTo60} value={fmt(metrics.tTo60, 0) + " s"} />
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: any) {
  const color = highlight === "good" ? "text-emerald-700" : highlight === "bad" ? "text-red-700" : "text-slate-900";
  return (
    <div className="p-3 border border-slate-200 rounded-lg">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-mono font-black ${color}`}>{value}</p>
    </div>
  );
}
