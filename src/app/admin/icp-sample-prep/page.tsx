// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

/**
 * ═══════════════════════════════════════════════════════════════
 *  ICP SAMPLE PREP — ENTRY WIZARD
 *
 *  One submission = one FUZE PO to CTLA that can contain many
 *  treated fabric samples. CTLA bills per fabric submission number
 *  (one line per fabric) so we can reconcile invoices per fabric
 *  in Atlas.
 *
 *  Flow:
 *    Step 1  Pick fabrics (multi-select from the fabric library)
 *    Step 2  Confirm auto-pulled fabric details
 *    Step 3  Application recipe — pick tier + bath volume, read the
 *            mL FUZE / mL DI, pad through the vertical micro-padder,
 *            dry, and commit a SampleApplication record per fabric
 *            (recipe and padder settings are pulled from the latest
 *            RecipeBenchTest; locked until operator hits "Redo")
 *    Step 4  Weigh each dried sample, confirm tier, add notes
 *    Step 5  Review + submit → CTLA PO is created → redirect to
 *            printable submission packet
 *
 *  Target masses:
 *    • Ship > 5 g per fabric submission
 *    • CTLA digests 0.5 g per run (microwave aqua regia)
 *    • Use the 100 cm² wheel / 10×10 cm cutter
 *
 *  See the How-To SOP at /admin/icp-sample-prep/sop for imagery.
 * ═══════════════════════════════════════════════════════════════
 */

const TIERS: { key: string; label: string; mgPerKg: number }[] = [
  { key: "F1", label: "F1 · 1.00 mg/kg", mgPerKg: 1.0 },
  { key: "F2", label: "F2 · 0.75 mg/kg", mgPerKg: 0.75 },
  { key: "F3", label: "F3 · 0.50 mg/kg", mgPerKg: 0.5 },
  { key: "F4", label: "F4 · 0.25 mg/kg", mgPerKg: 0.25 },
];

const SHIP_TARGET_G = 5.0;     // minimum to ship
const DIGEST_TARGET_G = 0.5;   // what CTLA takes per digest run
const WHEEL_CM2 = 100;         // 10 × 10 cm cutter

// ── Types ─────────────────────────────────────────────────
//
// /api/fabrics returns flat fuzeNumber / customerCode / factoryCode
// pulled from the Fabric row (source of truth) with a fallback to the
// linked FabricSubmission if the fabric was registered via intake.
// We keep `submission` as an optional nested shape for back-compat.
type BenchTestSnapshot = {
  id: string;
  testNumber: string;
  testDate: string;
  applicationMethod: string | null;
  squeezePressure: number | null;
  vfdFrequencyHz: number | null;
  lineSpeedMPerMin: number | null;
  stockMgPerL: number | null;
  pickupDryToWetPct: number | null;
  f1BathMgPerL: number | null;
  f2BathMgPerL: number | null;
  f3BathMgPerL: number | null;
  f4BathMgPerL: number | null;
  f1FuzeMlPerLBath: number | null;
  f2FuzeMlPerLBath: number | null;
  f3FuzeMlPerLBath: number | null;
  f4FuzeMlPerLBath: number | null;
} | null;

type FabricRow = {
  id: string;
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  construction: string | null;
  color: string | null;
  widthInches: number | null;
  weightGsm: number | null;
  submission?: {
    fuzeFabricNumber: number | null;
    customerFabricCode: string | null;
    factoryFabricCode: string | null;
  } | null;
  latestBenchTest?: BenchTestSnapshot;
};

// Resolve the "canonical" FUZE number / customer code / factory code for
// a fabric row — flat field on Fabric wins, submission is a fallback.
const fuzeNumOf = (f: FabricRow): number | null =>
  f.fuzeNumber ?? f.submission?.fuzeFabricNumber ?? null;
const customerCodeOf = (f: FabricRow): string | null =>
  f.customerCode ?? f.submission?.customerFabricCode ?? null;
const factoryCodeOf = (f: FabricRow): string | null =>
  f.factoryCode ?? f.submission?.factoryFabricCode ?? null;

type Sample = {
  fabricId: string;
  // pulled from fabric
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  construction: string | null;
  color: string | null;
  weightGsm: number | null;
  // Application recipe snapshot — pulled from the fabric's latest RecipeBenchTest
  // in step 3. null until the operator opens the application step.
  benchTest: BenchTestSnapshot;
  // Step 3 inputs
  tier: string;                   // operator-selected tier for this run (F1-F4)
  bathVolumeL: string;            // bath volume in L (string for input stability)
  operator: string;               // tech name (Ashlee, etc.)
  applicationNotes: string;       // free-form notes about the application
  // Lifecycle — set by the wizard via POST/PATCH to /api/admin/sample-application
  sampleApplicationId: string;    // set after POST — SampleApplication.id
  appNumber: string;              // FUZE-APP-YYYYMMDD-NNNN for display
  paddedAt: string | null;
  driedAt: string | null;
  // Step 4 inputs
  sampleMassG: string;            // final weighed mass for ICP
  notes: string;                  // sample-level ICP notes
};

// ── Helpers ───────────────────────────────────────────────
function fabricLabel(f: FabricRow): string {
  const fuze = fuzeNumOf(f);
  const fn = fuze ? `FUZE-${fuze}` : null;
  const cc = customerCodeOf(f) ? ` · ${customerCodeOf(f)}` : "";
  const con = f.construction ? ` · ${f.construction}` : "";
  const col = f.color ? ` · ${f.color}` : "";
  return `${fn || f.id.slice(0, 8)}${cc}${con}${col}`;
}

function makeSampleFromFabric(f: FabricRow): Sample {
  return {
    fabricId: f.id,
    fuzeNumber: fuzeNumOf(f),
    customerCode: customerCodeOf(f),
    factoryCode: factoryCodeOf(f),
    construction: f.construction ?? null,
    color: f.color ?? null,
    weightGsm: f.weightGsm ?? null,
    // Pulled straight from /api/fabrics — may be null if this fabric has
    // never been through the Recipe Calculator, in which case step 3 will
    // block with a red "no recipe" banner.
    benchTest: f.latestBenchTest ?? null,
    tier: "F3",
    bathVolumeL: "1",
    operator: "",
    applicationNotes: "",
    sampleApplicationId: "",
    appNumber: "",
    paddedAt: null,
    driedAt: null,
    sampleMassG: "",
    notes: "",
  };
}

// ── Bath recipe math ──────────────────────────────────────
// Given a bench test and a chosen tier + bath volume, return the
// mL of 30 ppm FUZE stock + mL of DI water to prepare the bath.
//
//   bathMgPerL = tier_mg_per_kg / (pickupDryToWetPct / 100)
//   fuzeMl     = bathVolumeL × (bathMgPerL / stock) × 1000
//   waterMl    = bathVolumeL × 1000 − fuzeMl
//
// Mirrors /api/admin/sample-application#computeBath so the UI preview
// agrees exactly with what the server writes.
const TIER_MG_PER_KG: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };

function computeBathPreview(bench: BenchTestSnapshot, tier: string, bathVolumeL: number) {
  if (!bench || !bench.pickupDryToWetPct) return null;
  const mgPerKg = TIER_MG_PER_KG[tier];
  const stock = bench.stockMgPerL || 30;
  if (!mgPerKg || !Number.isFinite(bathVolumeL) || bathVolumeL <= 0) return null;
  const bathMgPerL = mgPerKg / (bench.pickupDryToWetPct / 100);
  const fuzeMl = bathVolumeL * (bathMgPerL / stock) * 1000;
  const waterMl = bathVolumeL * 1000 - fuzeMl;
  return {
    bathConcentrationMgPerL: bathMgPerL,
    fuzeMl,
    waterMl,
    stockMgPerL: stock,
    pickupPct: bench.pickupDryToWetPct,
  };
}

// ── Component ─────────────────────────────────────────────
export default function IcpSamplePrepWizardPage() {
  const { t } = useI18n();
  const T = t.icpSamplePrepPage;
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1 — library + selection
  const [fabrics, setFabrics] = useState<FabricRow[]>([]);
  const [fabricsLoading, setFabricsLoading] = useState(false);
  const [fabricsError, setFabricsError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Per-sample editable state — seeded in step 1→2 transition.
  const [samples, setSamples] = useState<Sample[]>([]);

  // Step 3 — application recipe status + errors (per-fabric keyed by fabricId)
  const [applicationError, setApplicationError] = useState<Record<string, string>>({});
  const [applicationSaving, setApplicationSaving] = useState<Record<string, boolean>>({});

  // Step 5 — batch-level
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [rush, setRush] = useState(false);
  const [batchNotes, setBatchNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load fabrics on mount (paged to 200 to keep it snappy)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFabricsLoading(true);
      setFabricsError(null);
      try {
        const url = new URL("/api/fabrics", window.location.origin);
        url.searchParams.set("pageSize", "200");
        if (q) url.searchParams.set("q", q);
        const res = await fetch(url.toString(), { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || `HTTP ${res.status}`);
        // API returns `fabrics` (primary) and `items` (alias for back-compat)
        if (!cancelled) setFabrics(json.fabrics || json.items || []);
      } catch (e: any) {
        if (!cancelled) setFabricsError(e?.message || String(e));
      } finally {
        if (!cancelled) setFabricsLoading(false);
      }
    }
    const t = setTimeout(load, 150); // debounce search
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  // When moving past Step 1, seed `samples` from the selected fabrics.
  // Keep existing entries if user goes back & forth.
  function seedSamplesFromSelection() {
    setSamples((prev) => {
      const byId = new Map(prev.map((s) => [s.fabricId, s]));
      return selectedIds.map((id) => {
        const existing = byId.get(id);
        if (existing) return existing;
        const f = fabrics.find((x) => x.id === id);
        return f ? makeSampleFromFabric(f) : {
          fabricId: id,
          fuzeNumber: null, customerCode: null, factoryCode: null,
          construction: null, color: null, weightGsm: null,
          benchTest: null, tier: "F3", bathVolumeL: "1", operator: "",
          applicationNotes: "", sampleApplicationId: "", appNumber: "",
          paddedAt: null, driedAt: null, sampleMassG: "", notes: "",
        };
      });
    });
  }

  // Create the SampleApplication record for one sample. Called when the
  // operator commits a recipe in step 3. Stamps paddedAt + driedAt to
  // "now" because the current policy is a single confirm-and-save button
  // (no cure step, and the dryer chamber is a set-and-forget pass).
  async function commitApplication(fabricId: string) {
    const s = samples.find((x) => x.fabricId === fabricId);
    if (!s) return;
    if (!s.benchTest?.id) {
      setApplicationError((e) => ({ ...e, [fabricId]: T.errorNoBench }));
      return;
    }
    const vol = Number(s.bathVolumeL);
    if (!Number.isFinite(vol) || vol <= 0) {
      setApplicationError((e) => ({ ...e, [fabricId]: T.errorBathVolume }));
      return;
    }
    setApplicationSaving((x) => ({ ...x, [fabricId]: true }));
    setApplicationError((e) => ({ ...e, [fabricId]: "" }));
    try {
      const res = await fetch("/api/admin/sample-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fabricId,
          benchTestId: s.benchTest.id,
          tier: s.tier,
          bathVolumeL: vol,
          operator: s.operator || null,
          notes: s.applicationNotes || null,
          stampLifecycle: true,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const app = json.sampleApplication;
      setSamples((prev) =>
        prev.map((p) =>
          p.fabricId === fabricId
            ? {
                ...p,
                sampleApplicationId: app.id,
                appNumber: app.appNumber,
                paddedAt: app.paddedAt,
                driedAt: app.driedAt,
              }
            : p
        )
      );
    } catch (e: any) {
      setApplicationError((x) => ({ ...x, [fabricId]: e?.message || String(e) }));
    } finally {
      setApplicationSaving((x) => ({ ...x, [fabricId]: false }));
    }
  }

  const canContinueFromStep1 = selectedIds.length > 0;
  const canContinueFromStep2 = samples.length > 0;
  // Step 3 gate — every sample must have a committed SampleApplication
  // (pad + dry already recorded). sampleApplicationId is populated by
  // commitApplication() after a successful POST to /api/admin/sample-application.
  const canContinueFromStep3 =
    samples.length > 0 && samples.every((s) => !!s.sampleApplicationId);
  // Step 4 gate — every sample has a valid weighed mass in grams.
  const canContinueFromStep4 = samples.every(
    (s) => Number(s.sampleMassG) > 0 && !Number.isNaN(Number(s.sampleMassG))
  );
  const totalMass = useMemo(
    () => samples.reduce((acc, s) => acc + (Number(s.sampleMassG) || 0), 0),
    [samples]
  );
  const shortSamples = samples.filter((s) => Number(s.sampleMassG) > 0 && Number(s.sampleMassG) < SHIP_TARGET_G);

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = {
        labSlug: "CTLA",
        priority,
        rush,
        notes: batchNotes || null,
        samples: samples.map((s) => ({
          fabricId: s.fabricId,
          sampleMassG: Number(s.sampleMassG),
          sampleAreaCm2: WHEEL_CM2,
          tier: s.tier || null,
          // Bench test is derived from the SampleApplication now — we pass both
          // so the server can link the submission line back to either record
          // without a second round-trip.
          benchTestId: s.benchTest?.id || null,
          sampleApplicationId: s.sampleApplicationId || null,
          appNumber: s.appNumber || null,
          notes: s.notes || null,
        })),
      };
      const res = await fetch("/api/admin/icp-sample-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      router.push(`/admin/icp-sample-prep/${encodeURIComponent(json.poNumber)}/print`);
    } catch (e: any) {
      setSubmitError(e?.message || String(e));
      setSubmitting(false);
    }
  }

  // ── Step header ────────────────────────────
  const StepHeader = (
    <header className="flex items-start justify-between mb-6">
      <div>
        <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase">
          {T.headerBadge}
        </p>
        <h1 className="text-3xl font-black text-slate-900 mt-1">{T.headerTitle}</h1>
        <p className="text-sm text-slate-600 mt-1">
          {T.headerSubtitle}
        </p>
      </div>
      <div className="flex gap-2 text-xs">
        <a
          href="/admin/icp-sample-prep/sop"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 rounded border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
        >
          {T.btnHowTo}
        </a>
      </div>
    </header>
  );

  // ── Step progress bar ──────────────────────
  const StepBar = (
    <div className="flex items-center gap-2 mb-6">
      {[
        { n: 1, label: T.stepPick },
        { n: 2, label: T.stepConfirm },
        { n: 3, label: T.stepRecipe },
        { n: 4, label: T.stepWeigh },
        { n: 5, label: T.stepReview },
      ].map((s, i) => (
        <div key={s.n} className="flex items-center gap-2 flex-1">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black border-2 ${
              step === s.n
                ? "bg-[#00b4c3] text-white border-[#00b4c3]"
                : step > s.n
                ? "bg-[#00b4c3]/20 text-[#00b4c3] border-[#00b4c3]"
                : "bg-white text-slate-400 border-slate-300"
            }`}
          >
            {s.n}
          </div>
          <span
            className={`text-xs font-semibold ${step === s.n ? "text-slate-900" : "text-slate-600"}`}
            dangerouslySetInnerHTML={{ __html: s.label }}
          />
          {i < 4 && <div className="flex-1 h-px bg-slate-200" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6">
        {StepHeader}
        {StepBar}

        {/* ═══════════ STEP 1: Pick fabrics ═══════════ */}
        {step === 1 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-900">
                {T.step1Heading}
              </h2>
              <div className="text-sm font-semibold text-slate-600">
                {selectedIds.length} {T.step1Selected}
              </div>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={T.step1Search}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00b4c3] focus:ring-2 focus:ring-[#00b4c3]/30"
            />

            {fabricsError && (
              <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                {fabricsError}
              </div>
            )}

            <div className="mt-4 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[520px] overflow-auto">
              {fabricsLoading ? (
                <div className="p-6 text-center text-slate-600 text-sm">{T.fabricsLoading}</div>
              ) : fabrics.length === 0 ? (
                <div className="p-6 text-center text-slate-600 text-sm">{T.fabricsEmpty}</div>
              ) : (
                fabrics.map((f) => {
                  const selected = selectedIds.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm ${
                        selected ? "bg-[#00b4c3]/5" : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id]
                          )
                        }
                        className="h-4 w-4 accent-[#00b4c3]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {fuzeNumOf(f)
                            ? `FUZE-${fuzeNumOf(f)}`
                            : f.id.slice(0, 8)}
                          {customerCodeOf(f) && (
                            <span className="text-slate-600 font-normal"> · {customerCodeOf(f)}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 truncate">
                          {[f.construction, f.color, f.weightGsm ? `${f.weightGsm} gsm` : null]
                            .filter(Boolean)
                            .join(" · ") || T.noDetails}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                disabled={!canContinueFromStep1}
                onClick={() => {
                  seedSamplesFromSelection();
                  setStep(2);
                }}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white ${
                  canContinueFromStep1 ? "bg-[#00b4c3] hover:bg-[#009ba8]" : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                {T.btnContinue}
              </button>
            </div>
          </section>
        )}

        {/* ═══════════ STEP 2: Confirm details ═══════════ */}
        {step === 2 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-1">
              {T.step2Heading}
            </h2>
            <p className="text-xs text-slate-600 mb-4">
              {T.step2Sub}
            </p>

            <div className="overflow-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">{T.colFuze}</th>
                    <th className="px-3 py-2 text-left">{T.colCustomerCode}</th>
                    <th className="px-3 py-2 text-left">{T.colFactoryCode}</th>
                    <th className="px-3 py-2 text-left">{T.colConstruction}</th>
                    <th className="px-3 py-2 text-left">{T.colColor}</th>
                    <th className="px-3 py-2 text-right">{T.colGsm}</th>
                    <th className="px-3 py-2 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {samples.map((s) => (
                    <tr key={s.fabricId}>
                      <td className="px-3 py-2 font-bold">
                        {s.fuzeNumber ? `FUZE-${s.fuzeNumber}` : "—"}
                      </td>
                      <td className="px-3 py-2">{s.customerCode || "—"}</td>
                      <td className="px-3 py-2">{s.factoryCode || "—"}</td>
                      <td className="px-3 py-2">{s.construction || "—"}</td>
                      <td className="px-3 py-2">{s.color || "—"}</td>
                      <td className="px-3 py-2 text-right">{s.weightGsm ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => {
                            setSamples((prev) => prev.filter((p) => p.fabricId !== s.fabricId));
                            setSelectedIds((prev) => prev.filter((id) => id !== s.fabricId));
                          }}
                          className="text-red-600 hover:underline text-xs font-bold"
                        >
                          {T.btnRemove}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {samples.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-600 text-sm">
                        {T.step2NoSamples}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                {T.btnBack}
              </button>
              <button
                disabled={!canContinueFromStep2}
                onClick={() => setStep(3)}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white ${
                  canContinueFromStep2 ? "bg-[#00b4c3] hover:bg-[#009ba8]" : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                {T.btnContinue}
              </button>
            </div>
          </section>
        )}

        {/* ═══════════ STEP 3: Application recipe ═══════════ */}
        {step === 3 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-1">
              {T.step3Heading}
            </h2>
            <p className="text-xs text-slate-600 mb-4">
              {T.step3Sub}
            </p>

            <div className="grid grid-cols-1 gap-4">
              {samples.map((s, idx) => {
                const bench = s.benchTest;
                const volL = Number(s.bathVolumeL);
                const preview = computeBathPreview(bench, s.tier, volL);
                const err = applicationError[s.fabricId];
                const saving = !!applicationSaving[s.fabricId];
                const locked = !!s.sampleApplicationId;

                return (
                  <div
                    key={s.fabricId}
                    className={`border rounded-lg p-4 ${
                      locked
                        ? "border-emerald-300 bg-emerald-50/40"
                        : "border-slate-200 bg-slate-50/60"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-900">
                          {s.fuzeNumber ? `FUZE-${s.fuzeNumber}` : "Sample"}
                          {s.customerCode && (
                            <span className="text-slate-600 font-normal"> · {s.customerCode}</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-600">
                          {[s.construction, s.color, s.weightGsm ? `${s.weightGsm} gsm` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* No-recipe guard */}
                    {!bench ? (
                      <div className="border border-red-300 bg-red-50 rounded p-3 text-sm">
                        <p className="text-red-800 font-bold mb-1">
                          No Recipe Bench Test linked to this fabric.
                        </p>
                        <p className="text-red-700 text-xs">
                          You have to run the Recipe Calculator first — that&apos;s where we measure
                          pickup % and save per-tier dilution. Without it we can&apos;t build a bath.
                        </p>
                        <a
                          href={`/admin/recipe-calculator?fabricId=${encodeURIComponent(s.fabricId)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-2 px-3 py-1.5 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-700"
                        >
                          Open Recipe Calculator →
                        </a>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* ── Inputs ── */}
                        <div>
                          <div className="mb-3">
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Recipe Bench Test
                            </label>
                            <div className="px-3 py-2 rounded border border-slate-300 bg-white text-sm">
                              <span className="font-semibold">{bench.testNumber}</span>
                              {bench.testDate && (
                                <span className="text-slate-600 ml-2 text-xs">
                                  {new Date(bench.testDate).toLocaleDateString()}
                                </span>
                              )}
                              <span className="block text-xs text-slate-600 mt-0.5">
                                Pickup: <b>{bench.pickupDryToWetPct ?? "—"}%</b>
                                {bench.applicationMethod && (
                                  <> · {bench.applicationMethod}</>
                                )}
                              </span>
                            </div>
                          </div>

                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                            Tier
                          </label>
                          <div className="grid grid-cols-4 gap-1 mb-3">
                            {TIERS.map((t) => (
                              <button
                                key={t.key}
                                type="button"
                                disabled={locked}
                                onClick={() =>
                                  setSamples((prev) =>
                                    prev.map((p) =>
                                      p.fabricId === s.fabricId ? { ...p, tier: t.key } : p
                                    )
                                  )
                                }
                                className={`px-2 py-1.5 rounded text-xs font-bold border ${
                                  s.tier === t.key
                                    ? "bg-[#00b4c3] text-white border-[#00b4c3]"
                                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                              >
                                {t.key}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-slate-600 -mt-2 mb-3">
                            {TIERS.find((t) => t.key === s.tier)?.label}
                          </p>

                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                            Bath volume (L)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            disabled={locked}
                            value={s.bathVolumeL}
                            onChange={(e) =>
                              setSamples((prev) =>
                                prev.map((p) =>
                                  p.fabricId === s.fabricId ? { ...p, bathVolumeL: e.target.value } : p
                                )
                              )
                            }
                            placeholder="1"
                            className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]/40 focus:border-[#00b4c3] disabled:bg-slate-100"
                          />

                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mt-3 mb-1">
                            Operator
                          </label>
                          <input
                            disabled={locked}
                            value={s.operator}
                            onChange={(e) =>
                              setSamples((prev) =>
                                prev.map((p) =>
                                  p.fabricId === s.fabricId ? { ...p, operator: e.target.value } : p
                                )
                              )
                            }
                            placeholder="Who's padding"
                            className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]/40 focus:border-[#00b4c3] disabled:bg-slate-100"
                          />

                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mt-3 mb-1">
                            Application notes
                          </label>
                          <input
                            disabled={locked}
                            value={s.applicationNotes}
                            onChange={(e) =>
                              setSamples((prev) =>
                                prev.map((p) =>
                                  p.fabricId === s.fabricId
                                    ? { ...p, applicationNotes: e.target.value }
                                    : p
                                )
                              )
                            }
                            placeholder="anything to remember about this run"
                            className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]/40 focus:border-[#00b4c3] disabled:bg-slate-100"
                          />
                        </div>

                        {/* ── Recipe preview ── */}
                        <div>
                          <div className="border border-slate-300 bg-white rounded-lg p-4 h-full">
                            <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase mb-2">
                              Bath Recipe
                            </p>
                            {preview ? (
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">FUZE stock (30 ppm)</span>
                                  <span className="font-bold text-slate-900">
                                    {preview.fuzeMl.toFixed(2)} mL
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">DI water</span>
                                  <span className="font-bold text-slate-900">
                                    {preview.waterMl.toFixed(2)} mL
                                  </span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                                  <span className="text-slate-600">Bath volume</span>
                                  <span className="font-bold text-slate-900">
                                    {volL.toFixed(2)} L
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Bath concentration</span>
                                  <span className="font-bold text-slate-900">
                                    {preview.bathConcentrationMgPerL.toFixed(3)} mg/L
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Pickup (WPU)</span>
                                  <span className="font-bold text-slate-900">
                                    {preview.pickupPct}%
                                  </span>
                                </div>

                                {/* Padder settings — snapshot from bench test */}
                                <div className="mt-3 pt-2 border-t border-slate-200">
                                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">
                                    Padder settings (from bench)
                                  </p>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                      <span className="text-slate-600 block">Squeeze</span>
                                      <span className="font-bold text-slate-900">
                                        {bench.squeezePressure != null
                                          ? `${bench.squeezePressure} bar`
                                          : "—"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-600 block">VFD</span>
                                      <span className="font-bold text-slate-900">
                                        {bench.vfdFrequencyHz != null
                                          ? `${bench.vfdFrequencyHz} Hz`
                                          : "—"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-600 block">Line speed</span>
                                      <span className="font-bold text-slate-900">
                                        {bench.lineSpeedMPerMin != null
                                          ? `${bench.lineSpeedMPerMin} m/min`
                                          : "—"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-600">
                                Enter a bath volume and tier to see the recipe.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {err && (
                      <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                        {err}
                      </div>
                    )}

                    {/* Commit / reset */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs text-slate-600">
                        {locked ? (
                          <span className="text-emerald-700 font-bold">
                            ✓ Recorded as <span className="font-mono">{s.appNumber}</span>
                            {s.driedAt && (
                              <span className="text-slate-600 font-normal ml-2">
                                dried {new Date(s.driedAt).toLocaleString()}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            Not yet recorded — pad + dry, then hit the button.
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {locked && (
                          <a
                            href={`/admin/sample-application/${encodeURIComponent(s.sampleApplicationId)}/print`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50"
                          >
                            🖨 Print recipe card
                          </a>
                        )}
                        {locked ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSamples((prev) =>
                                prev.map((p) =>
                                  p.fabricId === s.fabricId
                                    ? {
                                        ...p,
                                        sampleApplicationId: "",
                                        appNumber: "",
                                        paddedAt: null,
                                        driedAt: null,
                                      }
                                    : p
                                )
                              )
                            }
                            className="px-3 py-1.5 rounded text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50"
                          >
                            Redo
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={saving || !bench || !preview}
                            onClick={() => commitApplication(s.fabricId)}
                            className={`px-4 py-1.5 rounded text-xs font-bold text-white ${
                              saving || !bench || !preview
                                ? "bg-slate-300 cursor-not-allowed"
                                : "bg-[#00b4c3] hover:bg-[#009ba8]"
                            }`}
                          >
                            {saving ? "Saving…" : "Pad + dry complete →"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between text-sm">
              <div className="text-slate-600">
                <span className="font-bold">
                  {samples.filter((s) => s.sampleApplicationId).length}
                </span>{" "}
                / {samples.length} recorded
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  ← Back
                </button>
                <button
                  disabled={!canContinueFromStep3}
                  onClick={() => setStep(4)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white ${
                    canContinueFromStep3
                      ? "bg-[#00b4c3] hover:bg-[#009ba8]"
                      : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  Continue →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════ STEP 4: Weigh + tier ═══════════ */}
        {step === 4 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-1">
              {T.step4Heading}
            </h2>
            <p className="text-xs text-slate-600 mb-4">
              {T.step4SubTpl.replace("{wheel}", String(WHEEL_CM2)).replace("{ship}", SHIP_TARGET_G.toFixed(1)).replace("{digest}", DIGEST_TARGET_G.toFixed(1))}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {samples.map((s, idx) => {
                const mass = Number(s.sampleMassG);
                const short = mass > 0 && mass < SHIP_TARGET_G;
                return (
                  <div key={s.fabricId} className="border border-slate-200 rounded-lg p-4 bg-slate-50/60">
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-900">
                          {s.fuzeNumber ? `FUZE-${s.fuzeNumber}` : "Sample"}{" "}
                          {s.customerCode && (
                            <span className="text-slate-600 font-normal"> · {s.customerCode}</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-600">
                          {[s.construction, s.color, s.weightGsm ? `${s.weightGsm} gsm` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                        #{idx + 1}
                      </span>
                    </div>

                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                      Sample mass (g)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={s.sampleMassG}
                        onChange={(e) =>
                          setSamples((prev) =>
                            prev.map((p) =>
                              p.fabricId === s.fabricId ? { ...p, sampleMassG: e.target.value } : p
                            )
                          )
                        }
                        placeholder="e.g. 5.42"
                        className={`flex-1 px-3 py-2 rounded border bg-white text-sm focus:outline-none focus:ring-2 ${
                          short
                            ? "border-amber-400 focus:ring-amber-300"
                            : "border-slate-300 focus:ring-[#00b4c3]/40 focus:border-[#00b4c3]"
                        }`}
                      />
                      <span className="text-xs text-slate-600">g</span>
                    </div>
                    {short && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        ⚠ Below the {SHIP_TARGET_G.toFixed(1)} g ship minimum — cut more.
                      </p>
                    )}

                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mt-3 mb-1">
                      FUZE tier (locked from Step 3)
                    </label>
                    <div className="w-full px-3 py-2 rounded border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700">
                      {TIERS.find((t) => t.key === s.tier)?.label || s.tier}
                    </div>

                    {s.appNumber && (
                      <p className="text-[11px] text-emerald-700 mt-2">
                        ✓ SampleApplication <span className="font-mono">{s.appNumber}</span> recorded
                      </p>
                    )}

                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mt-3 mb-1">
                      Sample notes
                    </label>
                    <input
                      value={s.notes}
                      onChange={(e) =>
                        setSamples((prev) =>
                          prev.map((p) =>
                            p.fabricId === s.fabricId ? { ...p, notes: e.target.value } : p
                          )
                        )
                      }
                      placeholder="anything CTLA should know about this sample"
                      className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]/40 focus:border-[#00b4c3]"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between text-sm">
              <div className="text-slate-600">
                <span className="font-bold">{samples.length}</span> samples ·{" "}
                <span className="font-bold">{totalMass.toFixed(2)} g</span> total
                {shortSamples.length > 0 && (
                  <span className="text-amber-700 ml-2">
                    · {shortSamples.length} under {SHIP_TARGET_G.toFixed(1)} g
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  ← Back
                </button>
                <button
                  disabled={!canContinueFromStep4}
                  onClick={() => setStep(5)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white ${
                    canContinueFromStep4 ? "bg-[#00b4c3] hover:bg-[#009ba8]" : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  Continue →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════ STEP 5: Review + submit ═══════════ */}
        {step === 5 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-1">
              {T.step5Heading}
            </h2>
            <p className="text-xs text-slate-600 mb-4">
              {T.step5Sub}
            </p>

            {/* Batch options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm"
                >
                  <option value="NORMAL">{T.priorityNormal}</option>
                  <option value="HIGH">{T.priorityHigh}</option>
                  <option value="URGENT">{T.priorityUrgent}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                  Rush processing?
                </label>
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rush}
                    onChange={(e) => setRush(e.target.checked)}
                    className="h-4 w-4 accent-[#00b4c3]"
                  />
                  <span>Pay rush fee for expedited turnaround</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                  Batch-level notes
                </label>
                <input
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="tech, date, anything CTLA should see once"
                  className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm"
                />
              </div>
            </div>

            {/* Summary table */}
            <div className="overflow-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">FUZE #</th>
                    <th className="px-3 py-2 text-left">Customer code</th>
                    <th className="px-3 py-2 text-left">Construction / color</th>
                    <th className="px-3 py-2 text-right">Mass (g)</th>
                    <th className="px-3 py-2 text-left">Tier</th>
                    <th className="px-3 py-2 text-left">Application</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {samples.map((s) => (
                    <tr key={s.fabricId}>
                      <td className="px-3 py-2 font-bold">{s.fuzeNumber ? `FUZE-${s.fuzeNumber}` : "—"}</td>
                      <td className="px-3 py-2">{s.customerCode || "—"}</td>
                      <td className="px-3 py-2">{[s.construction, s.color].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold">{Number(s.sampleMassG).toFixed(2)}</td>
                      <td className="px-3 py-2">{s.tier}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-xs">
                        {s.appNumber || "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-3 py-2" colSpan={3}>Total</td>
                    <td className="px-3 py-2 text-right">{totalMass.toFixed(2)}</td>
                    <td className="px-3 py-2" colSpan={2}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Warnings */}
            {shortSamples.length > 0 && (
              <div className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
                <b>{shortSamples.length} sample{shortSamples.length === 1 ? "" : "s"} below {SHIP_TARGET_G.toFixed(1)} g.</b>{" "}
                CTLA needs at least {DIGEST_TARGET_G.toFixed(1)} g per digest run — ship extra so they
                can re-run if needed.
              </div>
            )}

            {submitError && (
              <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                {submitError}
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(4)}
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                {T.btnBack}
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold text-white ${
                  submitting ? "bg-slate-400 cursor-wait" : "bg-[#00b4c3] hover:bg-[#009ba8]"
                }`}
              >
                {submitting ? T.btnSubmitting : T.btnCreatePo}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
