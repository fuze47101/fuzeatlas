// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
 *    Step 3  Enter per-sample gram mass + tier + optional bench test
 *    Step 4  Review + submit → CTLA PO is created → redirect to
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
  // pulled
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  construction: string | null;
  color: string | null;
  weightGsm: number | null;
  // entered
  sampleMassG: string;
  tier: string;
  benchTestId: string;
  notes: string;
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
    sampleMassG: "",
    tier: "F3",
    benchTestId: "",
    notes: "",
  };
}

// ── Component ─────────────────────────────────────────────
export default function IcpSamplePrepWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 — library + selection
  const [fabrics, setFabrics] = useState<FabricRow[]>([]);
  const [fabricsLoading, setFabricsLoading] = useState(false);
  const [fabricsError, setFabricsError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Step 3 — per-sample editable state
  const [samples, setSamples] = useState<Sample[]>([]);

  // Step 4 — batch-level
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
          sampleMassG: "", tier: "F3", benchTestId: "", notes: "",
        };
      });
    });
  }

  const canContinueFromStep1 = selectedIds.length > 0;
  const canContinueFromStep2 = samples.length > 0;
  const canContinueFromStep3 = samples.every(
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
          benchTestId: s.benchTestId || null,
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
          FUZE Biotech · Quality &amp; Labs
        </p>
        <h1 className="text-3xl font-black text-slate-900 mt-1">ICP Sample Prep</h1>
        <p className="text-sm text-slate-500 mt-1">
          Build a CTLA submission packet with one or more FUZE-treated fabric samples.
          One PO covers the whole batch; CTLA bills per fabric submission number.
        </p>
      </div>
      <div className="flex gap-2 text-xs">
        <a
          href="/admin/icp-sample-prep/sop"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 rounded border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
        >
          📋 How-To (SOP)
        </a>
      </div>
    </header>
  );

  // ── Step progress bar ──────────────────────
  const StepBar = (
    <div className="flex items-center gap-2 mb-6">
      {[
        { n: 1, label: "Pick fabrics" },
        { n: 2, label: "Confirm details" },
        { n: 3, label: "Weigh &amp; tier" },
        { n: 4, label: "Review &amp; submit" },
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
            className={`text-xs font-semibold ${step === s.n ? "text-slate-900" : "text-slate-500"}`}
            dangerouslySetInnerHTML={{ __html: s.label }}
          />
          {i < 3 && <div className="flex-1 h-px bg-slate-200" />}
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
                1. Pick the fabrics you prepped
              </h2>
              <div className="text-sm font-semibold text-slate-600">
                {selectedIds.length} selected
              </div>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by FUZE number, customer code, factory code, color, construction…"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00b4c3] focus:ring-2 focus:ring-[#00b4c3]/30"
            />

            {fabricsError && (
              <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                {fabricsError}
              </div>
            )}

            <div className="mt-4 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[520px] overflow-auto">
              {fabricsLoading ? (
                <div className="p-6 text-center text-slate-500 text-sm">Loading fabrics…</div>
              ) : fabrics.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">No fabrics match.</div>
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
                            <span className="text-slate-500 font-normal"> · {customerCodeOf(f)}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {[f.construction, f.color, f.weightGsm ? `${f.weightGsm} gsm` : null]
                            .filter(Boolean)
                            .join(" · ") || "(no details)"}
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
                Continue →
              </button>
            </div>
          </section>
        )}

        {/* ═══════════ STEP 2: Confirm details ═══════════ */}
        {step === 2 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-1">
              2. Confirm the fabric details we pulled from the library
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              These come straight from the Atlas fabric record — no re-typing. Remove any row that
              isn&apos;t actually in the bag, or go back to add more.
            </p>

            <div className="overflow-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">FUZE #</th>
                    <th className="px-3 py-2 text-left">Customer code</th>
                    <th className="px-3 py-2 text-left">Factory code</th>
                    <th className="px-3 py-2 text-left">Construction</th>
                    <th className="px-3 py-2 text-left">Color</th>
                    <th className="px-3 py-2 text-right">GSM</th>
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
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {samples.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-500 text-sm">
                        No samples selected. Go back and pick at least one fabric.
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
                ← Back
              </button>
              <button
                disabled={!canContinueFromStep2}
                onClick={() => setStep(3)}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white ${
                  canContinueFromStep2 ? "bg-[#00b4c3] hover:bg-[#009ba8]" : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                Continue →
              </button>
            </div>
          </section>
        )}

        {/* ═══════════ STEP 3: Weigh + tier ═══════════ */}
        {step === 3 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-1">
              3. Weigh each sample + tag its tier
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Cut with the {WHEEL_CM2} cm² wheel, fragment to ~5 mm bits, and weigh the whole bag.
              We need <b>more than {SHIP_TARGET_G.toFixed(1)} g</b> per fabric — CTLA digests {DIGEST_TARGET_G.toFixed(1)} g at a time.
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
                            <span className="text-slate-500 font-normal"> · {s.customerCode}</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
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
                      <span className="text-xs text-slate-500">g</span>
                    </div>
                    {short && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        ⚠ Below the {SHIP_TARGET_G.toFixed(1)} g ship minimum — cut more.
                      </p>
                    )}

                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mt-3 mb-1">
                      FUZE tier
                    </label>
                    <select
                      value={s.tier}
                      onChange={(e) =>
                        setSamples((prev) =>
                          prev.map((p) =>
                            p.fabricId === s.fabricId ? { ...p, tier: e.target.value } : p
                          )
                        )
                      }
                      className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]/40 focus:border-[#00b4c3]"
                    >
                      {TIERS.map((t) => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </select>

                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mt-3 mb-1">
                      Bench test ID (optional)
                    </label>
                    <input
                      value={s.benchTestId}
                      onChange={(e) =>
                        setSamples((prev) =>
                          prev.map((p) =>
                            p.fabricId === s.fabricId ? { ...p, benchTestId: e.target.value } : p
                          )
                        )
                      }
                      placeholder="RBT-… if known"
                      className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]/40 focus:border-[#00b4c3]"
                    />

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
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  ← Back
                </button>
                <button
                  disabled={!canContinueFromStep3}
                  onClick={() => setStep(4)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white ${
                    canContinueFromStep3 ? "bg-[#00b4c3] hover:bg-[#009ba8]" : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  Continue →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════ STEP 4: Review + submit ═══════════ */}
        {step === 4 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-1">
              4. Review &amp; submit to CTLA
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Submitting creates a FUZE PO, auto-adds a line per fabric (so CTLA can invoice per
              submission number), and opens the printable packet to drop in the shipping bag.
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
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
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
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">FUZE #</th>
                    <th className="px-3 py-2 text-left">Customer code</th>
                    <th className="px-3 py-2 text-left">Construction / color</th>
                    <th className="px-3 py-2 text-right">Mass (g)</th>
                    <th className="px-3 py-2 text-left">Tier</th>
                    <th className="px-3 py-2 text-left">Bench test</th>
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
                      <td className="px-3 py-2 text-slate-500">{s.benchTestId || "—"}</td>
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
                onClick={() => setStep(3)}
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                ← Back
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold text-white ${
                  submitting ? "bg-slate-400 cursor-wait" : "bg-[#00b4c3] hover:bg-[#009ba8]"
                }`}
              >
                {submitting ? "Submitting…" : "Create PO & Open Printable Packet →"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
