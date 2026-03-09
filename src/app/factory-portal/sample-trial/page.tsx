// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

interface Fabric {
  id: string;
  fuzeNumber?: number;
  customerCode?: string;
  factoryCode?: string;
  construction?: string;
  weightGsm?: number;
}

interface Brand {
  id: string;
  name: string;
}

interface Lab {
  id: string;
  name: string;
  city?: string;
  country?: string;
  region?: string;
}

interface Trial {
  id: string;
  status: string;
  purposeType: string;
  trialType: string;
  totalMeters: number;
  totalUnit: string;
  targetFuzeTier?: string;
  sampleVolumeLiters?: number;
  createdAt: string;
  fabric?: { fuzeNumber?: number; customerCode?: string };
  brand?: { name: string };
  factory?: { name: string };
  icpLab?: { name: string; city?: string; country?: string };
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  SAMPLE_SHIPPED: "bg-purple-100 text-purple-700",
  SAMPLE_RECEIVED: "bg-indigo-100 text-indigo-700",
  TRIAL_IN_PROGRESS: "bg-cyan-100 text-cyan-700",
  ICP_PENDING: "bg-orange-100 text-orange-700",
  ICP_SUBMITTED: "bg-teal-100 text-teal-700",
  COMPLETE: "bg-emerald-100 text-emerald-700",
};

const TIER_DESCRIPTIONS: Record<string, string> = {
  F1: "F1 — Maximum Protection (1.0 mg/kg)",
  F2: "F2 — Standard Protection (0.75 mg/kg)",
  F3: "F3 — Light Protection (0.5 mg/kg)",
  F4: "F4 — Minimal Protection (0.25 mg/kg)",
};

export default function SampleTrialPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<"form" | "list">("list");
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [fabricId, setFabricId] = useState("");
  const [purposeType, setPurposeType] = useState("");
  const [brandId, setBrandId] = useState("");
  const [partnershipNote, setPartnershipNote] = useState("");
  const [trialType, setTrialType] = useState("");
  const [totalMeters, setTotalMeters] = useState("");
  const [totalUnit, setTotalUnit] = useState("meters");
  const [targetFuzeTier, setTargetFuzeTier] = useState("F2");
  const [applicationMethod, setApplicationMethod] = useState("");
  const [icpLabId, setIcpLabId] = useState("");
  const [icpLabOther, setIcpLabOther] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingCountry, setShippingCountry] = useState("");
  const [shippingContactName, setShippingContactName] = useState("");
  const [shippingContactPhone, setShippingContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Computed sample volume
  const selectedFabric = fabrics.find((f) => f.id === fabricId);
  const tierDoses: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };
  const calcVolume = () => {
    if (!totalMeters || !selectedFabric) return null;
    const lengthM = totalUnit === "yards" ? parseFloat(totalMeters) * 0.9144 : parseFloat(totalMeters);
    const widthM = 1.5; // default
    const weightKg = (selectedFabric.weightGsm || 200) / 1000;
    const dose = tierDoses[targetFuzeTier] || 0.75;
    return Math.round(weightKg * widthM * lengthM * (dose / 30) * 100) / 100;
  };
  const estimatedVolume = calcVolume();

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        const [fabRes, brandRes, labRes, trialRes] = await Promise.all([
          fetch("/api/factory-portal/fabrics"),
          fetch("/api/brands?limit=500"),
          fetch("/api/labs?capability=icp"),
          fetch("/api/factory-portal/sample-trial"),
        ]);
        const fabData = await fabRes.json();
        const brandData = await brandRes.json();
        const labData = await labRes.json();
        const trialData = await trialRes.json();

        if (fabData.ok) setFabrics(fabData.fabrics || []);
        if (brandData.ok || brandData.brands) setBrands(brandData.brands || []);
        if (labData.ok) setLabs(labData.labs || []);
        if (trialData.ok) setTrials(trialData.trials || []);
      } catch (e) {
        console.error("Load error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/factory-portal/sample-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fabricId,
          purposeType,
          brandId: brandId || null,
          partnershipNote: partnershipNote || null,
          trialType,
          totalMeters: parseFloat(totalMeters),
          totalUnit,
          targetFuzeTier,
          applicationMethod: applicationMethod || null,
          shippingAddress,
          shippingCity,
          shippingCountry,
          shippingContactName,
          shippingContactPhone,
          icpLabId: icpLabId || null,
          icpLabOther: icpLabOther || null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
        // Reload trials
        const trialRes = await fetch("/api/factory-portal/sample-trial");
        const trialData = await trialRes.json();
        if (trialData.ok) setTrials(trialData.trials || []);
      } else {
        setError(data.error || "Failed to submit request");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setFabricId("");
    setPurposeType("");
    setBrandId("");
    setPartnershipNote("");
    setTrialType("");
    setTotalMeters("");
    setTargetFuzeTier("F2");
    setApplicationMethod("");
    setIcpLabId("");
    setIcpLabOther("");
    setShippingAddress("");
    setShippingCity("");
    setShippingCountry("");
    setShippingContactName("");
    setShippingContactPhone("");
    setNotes("");
    setError("");
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-emerald-900 mb-2">Sample Trial Request Submitted</h2>
          <p className="text-emerald-700 mb-6">
            Your FUZE sample trial request has been submitted for review. You will receive notification when your sample is approved and shipped.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { resetForm(); setTab("form"); }} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm">
              Submit Another
            </button>
            <button onClick={() => { resetForm(); setTab("list"); }} className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm">
              View My Trials
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Group labs by country for dropdown
  const labsByCountry: Record<string, Lab[]> = {};
  labs.forEach((l) => {
    const key = l.country || "Other";
    (labsByCountry[key] ??= []).push(l);
  });

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/factory-portal" className="hover:text-[#00b4c3]">Factory Portal</Link>
          <span>/</span>
          <span>Sample Trials</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">FUZE Sample Trial Request</h1>
        <p className="text-slate-600">Request FUZE product samples for fabric treatment trials</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("list")} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
          My Trials ({trials.length})
        </button>
        <button onClick={() => { resetForm(); setTab("form"); }} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === "form" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
          New Request
        </button>
      </div>

      {/* ────── LIST TAB ────── */}
      {tab === "list" && (
        <div>
          {trials.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-slate-500 mb-4">No sample trial requests yet.</p>
              <button onClick={() => setTab("form")} className="px-6 py-2 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-medium text-sm hover:shadow-lg">
                Request Your First Sample
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {trials.map((t) => (
                <Link key={t.id} href={`/factory-portal/sample-trial/${t.id}`}
                  className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-[#00b4c3] hover:shadow-md transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900">
                          FUZE-{t.fabric?.fuzeNumber || "—"} {t.fabric?.customerCode ? `(${t.fabric.customerCode})` : ""}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[t.status] || "bg-slate-100 text-slate-700"}`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 space-y-0.5">
                        <p>{t.purposeType === "BRAND_PARTNERSHIP" ? `Brand: ${t.brand?.name || "—"}` : "Self-Development"} · {t.trialType === "LAB_TRIAL" ? "Lab Trial" : "Production Trial"}</p>
                        <p>{t.totalMeters} {t.totalUnit} · {t.targetFuzeTier || "—"} · Est. {t.sampleVolumeLiters || "—"}L</p>
                        {t.icpLab && <p className="text-xs text-slate-400">ICP Lab: {t.icpLab.name}, {t.icpLab.city}, {t.icpLab.country}</p>}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────── FORM TAB ────── */}
      {tab === "form" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Step 1: Select Fabric */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">1</div>
              <h2 className="text-lg font-semibold text-slate-900">Select Fabric</h2>
            </div>
            {fabrics.length === 0 ? (
              <div className="text-sm text-slate-500">
                <p className="mb-2">No fabrics found. Submit a fabric first to request a sample trial.</p>
                <Link href="/factory-portal/intake" className="text-[#00b4c3] font-medium hover:underline">Submit New Fabric →</Link>
              </div>
            ) : (
              <>
                <select value={fabricId} onChange={(e) => setFabricId(e.target.value)} required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] text-sm">
                  <option value="">Choose a fabric...</option>
                  {fabrics.map((f) => (
                    <option key={f.id} value={f.id}>
                      FUZE-{f.fuzeNumber} {f.customerCode ? `(${f.customerCode})` : ""} {f.construction ? `— ${f.construction}` : ""} {f.weightGsm ? `${f.weightGsm} gsm` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-400">
                  Don't see your fabric? <Link href="/factory-portal/intake" className="text-[#00b4c3] hover:underline">Submit it first</Link>
                </p>
              </>
            )}
          </div>

          {/* Step 2: Trial Purpose */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">2</div>
              <h2 className="text-lg font-semibold text-slate-900">Trial Purpose</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${purposeType === "BRAND_PARTNERSHIP" ? "border-[#00b4c3] bg-[#00b4c3]/5" : "border-slate-200 hover:border-[#00b4c3]"}`}>
                <input type="radio" name="purposeType" value="BRAND_PARTNERSHIP" checked={purposeType === "BRAND_PARTNERSHIP"} onChange={(e) => setPurposeType(e.target.value)} className="sr-only" />
                <div className="font-semibold text-slate-900 text-sm mb-1">Brand Partnership</div>
                <div className="text-xs text-slate-500">Trial for a specific brand or customer project</div>
              </label>
              <label className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${purposeType === "SELF_DEVELOPMENT" ? "border-[#00b4c3] bg-[#00b4c3]/5" : "border-slate-200 hover:border-[#00b4c3]"}`}>
                <input type="radio" name="purposeType" value="SELF_DEVELOPMENT" checked={purposeType === "SELF_DEVELOPMENT"} onChange={(e) => setPurposeType(e.target.value)} className="sr-only" />
                <div className="font-semibold text-slate-900 text-sm mb-1">Self-Development</div>
                <div className="text-xs text-slate-500">Internal R&D or capability development</div>
              </label>
            </div>
            {purposeType === "BRAND_PARTNERSHIP" && (
              <div className="space-y-3">
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] text-sm">
                  <option value="">Select a brand...</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Brand not listed? Describe the partnership:</label>
                  <input type="text" value={partnershipNote} onChange={(e) => setPartnershipNote(e.target.value)}
                    placeholder="e.g., Nike - Dri-FIT Performance Line 2026"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Trial Details */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">3</div>
              <h2 className="text-lg font-semibold text-slate-900">Trial Details</h2>
            </div>

            <div className="space-y-4">
              {/* Trial Type */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Trial Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${trialType === "LAB_TRIAL" ? "border-[#00b4c3] bg-[#00b4c3]/5" : "border-slate-200 hover:border-[#00b4c3]"}`}>
                    <input type="radio" name="trialType" value="LAB_TRIAL" checked={trialType === "LAB_TRIAL"} onChange={(e) => setTrialType(e.target.value)} className="sr-only" />
                    <div className="font-semibold text-sm">Lab Trial</div>
                    <div className="text-[10px] text-slate-500">Small scale (1-10m)</div>
                  </label>
                  <label className={`p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${trialType === "PRODUCTION_TRIAL" ? "border-[#00b4c3] bg-[#00b4c3]/5" : "border-slate-200 hover:border-[#00b4c3]"}`}>
                    <input type="radio" name="trialType" value="PRODUCTION_TRIAL" checked={trialType === "PRODUCTION_TRIAL"} onChange={(e) => setTrialType(e.target.value)} className="sr-only" />
                    <div className="font-semibold text-sm">Production Trial</div>
                    <div className="text-[10px] text-slate-500">Production scale (10m+)</div>
                  </label>
                </div>
              </div>

              {/* Meters + Unit */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Total Fabric Length</label>
                  <input type="number" value={totalMeters} onChange={(e) => setTotalMeters(e.target.value)}
                    placeholder="e.g., 50" min="0.1" step="0.1" required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Unit</label>
                  <select value={totalUnit} onChange={(e) => setTotalUnit(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]">
                    <option value="meters">Meters</option>
                    <option value="yards">Yards</option>
                  </select>
                </div>
              </div>

              {/* FUZE Tier */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Target FUZE Tier</label>
                <select value={targetFuzeTier} onChange={(e) => setTargetFuzeTier(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]">
                  {Object.entries(TIER_DESCRIPTIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Application Method */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Application Method (if known)</label>
                <select value={applicationMethod} onChange={(e) => setApplicationMethod(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]">
                  <option value="">Not sure / TBD</option>
                  <option value="exhaust">Exhaust</option>
                  <option value="pad">Pad</option>
                  <option value="spray">Spray</option>
                </select>
              </div>

              {/* Estimated Volume */}
              {estimatedVolume !== null && (
                <div className="p-3 bg-[#00b4c3]/10 rounded-lg">
                  <p className="text-sm font-semibold text-[#009ba8]">
                    Estimated FUZE Sample Volume: <span className="text-lg">{estimatedVolume} L</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Based on fabric weight, width, length, and selected tier. Final volume confirmed upon approval.</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Select ICP Lab */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">4</div>
              <h2 className="text-lg font-semibold text-slate-900">ICP Lab Commitment</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4 ml-11">
              Mandatory. After treatment, you must send treated fabric to an approved ICP lab for validation testing.
            </p>

            <select value={icpLabId} onChange={(e) => setIcpLabId(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] text-sm mb-3">
              <option value="">Select an approved ICP lab...</option>
              {Object.entries(labsByCountry).sort(([a], [b]) => a.localeCompare(b)).map(([country, countryLabs]) => (
                <optgroup key={country} label={country}>
                  {countryLabs.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}{l.city ? ` — ${l.city}` : ""}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Lab not listed? Provide details:</label>
              <input type="text" value={icpLabOther} onChange={(e) => setIcpLabOther(e.target.value)}
                placeholder="Lab name, city, country"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>Important:</strong> ICP testing must be completed at an approved lab after your FUZE trial. Results must be submitted through this portal to complete the trial process.
            </div>
          </div>

          {/* Step 5: Shipping Address */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">5</div>
              <h2 className="text-lg font-semibold text-slate-900">FUZE Sample Delivery Address</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4 ml-11">Where should we ship the FUZE product sample?</p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Factory / Delivery Address</label>
                <textarea value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Street address, building, unit..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">City</label>
                  <input type="text" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Country</label>
                  <input type="text" value={shippingCountry} onChange={(e) => setShippingCountry(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Contact Name</label>
                  <input type="text" value={shippingContactName} onChange={(e) => setShippingContactName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Contact Phone</label>
                  <input type="text" value={shippingContactPhone} onChange={(e) => setShippingContactPhone(e.target.value)}
                    placeholder="+1 555 123 4567"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
                </div>
              </div>
            </div>
          </div>

          {/* Step 6: Notes + Submit */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">6</div>
              <h2 className="text-lg font-semibold text-slate-900">Additional Notes</h2>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Special requirements, timeline constraints, prior treatment experience..."
              rows={3}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
          </div>

          {/* Submit */}
          <button type="submit" disabled={submitting || !fabricId || !purposeType || !trialType || !totalMeters || (!icpLabId && !icpLabOther)}
            className="w-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-3.5 rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50">
            {submitting ? "Submitting Request..." : "Submit Sample Trial Request"}
          </button>
        </form>
      )}
    </div>
  );
}
