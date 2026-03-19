"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { calcQuote, money, type CalcInputs, type CalcOutputs } from "@/lib/fuze-calc";

/* ── Test Request Modal ── */
function TestRequestModal({
  fabric,
  onClose,
  onSuccess,
}: {
  fabric: any;
  onClose: () => void;
  onSuccess: (result: any) => void;
}) {
  const [labs, setLabs] = useState<any[]>([]);
  const [selectedLab, setSelectedLab] = useState<string>("");
  const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>({});
  const [rushTests, setRushTests] = useState<Record<string, boolean>>({});
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/brand-portal/test-request")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setLabs(j.labs);
          // Auto-select FUZE lab if it exists
          const fuzeLab = j.labs.find((l: any) => l.name.toLowerCase().includes("fuze"));
          if (fuzeLab) setSelectedLab(fuzeLab.id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const currentLab = labs.find((l) => l.id === selectedLab);
  const services = currentLab?.services || [];

  const toggleTest = (testMethod: string) => {
    setSelectedTests((prev) => ({ ...prev, [testMethod]: !prev[testMethod] }));
  };
  const toggleRush = (testMethod: string) => {
    setRushTests((prev) => ({ ...prev, [testMethod]: !prev[testMethod] }));
  };

  const selectedServices = services.filter((s: any) => selectedTests[s.testMethod]);
  const totalCost = selectedServices.reduce((sum: number, s: any) => {
    const rush = rushTests[s.testMethod] ? (s.rushPriceUSD || 0) : 0;
    return sum + (s.priceUSD || 0) + rush;
  }, 0);
  const maxDays = selectedServices.reduce((max: number, s: any) => {
    const days = rushTests[s.testMethod] ? (s.rushDays || s.turnaroundDays || 0) : (s.turnaroundDays || 0);
    return Math.max(max, days);
  }, 0);

  const handleSubmit = async () => {
    if (!selectedLab) return setError("Please select a laboratory");
    if (selectedServices.length === 0) return setError("Please select at least one test");
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/brand-portal/test-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fabricId: fabric.id,
          labId: selectedLab,
          priority,
          specialInstructions: instructions || null,
          services: selectedServices.map((s: any) => ({
            testType: s.testType,
            testMethod: s.testMethod,
            quantity: 1,
            rush: rushTests[s.testMethod] || false,
          })),
        }),
      });
      const j = await res.json();
      if (j.ok) onSuccess(j.testRequest);
      else setError(j.error || "Failed to submit");
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00b4c3] to-emerald-500 p-6 rounded-t-2xl text-white">
          <h2 className="text-xl font-black">Request Testing</h2>
          <p className="text-white/80 text-sm mt-1">
            FUZE {fabric.fuzeNumber} — {fabric.customerCode || fabric.construction || "Fabric"}
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading available tests...</div>
          ) : (
            <>
              {/* Lab Selection */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Select Laboratory
                </label>
                <select
                  value={selectedLab}
                  onChange={(e) => { setSelectedLab(e.target.value); setSelectedTests({}); setRushTests({}); }}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-900 bg-white focus:border-[#00b4c3] focus:outline-none focus:ring-2 focus:ring-[#00b4c3]/20 appearance-none cursor-pointer"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                >
                  <option value="">— Choose a laboratory —</option>
                  {labs.filter((l: any) => l.services.length > 0).map((lab: any) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name} — {[lab.city, lab.country].filter(Boolean).join(", ")} ({lab.services.length} tests)
                    </option>
                  ))}
                  {labs.filter((l: any) => l.services.length === 0).length > 0 && (
                    <optgroup label="Labs without test services">
                      {labs.filter((l: any) => l.services.length === 0).map((lab: any) => (
                        <option key={lab.id} value={lab.id} disabled>
                          {lab.name} — No tests configured
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {currentLab && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    {currentLab.name.toLowerCase().includes("fuze") && (
                      <span className="px-2 py-0.5 bg-[#00b4c3] text-white text-[10px] font-bold rounded-full">INTERNAL LAB</span>
                    )}
                    {currentLab.accreditations && <span>{currentLab.accreditations}</span>}
                  </div>
                )}
              </div>

              {/* Test Selection */}
              {currentLab && services.length > 0 && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Select Tests
                  </label>
                  <div className="space-y-2">
                    {services.map((svc: any) => (
                      <div
                        key={svc.testMethod}
                        className={`rounded-xl border-2 transition-all ${
                          selectedTests[svc.testMethod]
                            ? "border-[#00b4c3] bg-[#00b4c3]/5"
                            : "border-slate-200"
                        }`}
                      >
                        <button
                          onClick={() => toggleTest(svc.testMethod)}
                          className="w-full p-4 text-left"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#00b4c3] bg-[#00b4c3]/10 px-2 py-0.5 rounded">
                                  {svc.testMethod}
                                </span>
                                <span className="font-bold text-sm text-slate-900">{svc.testType.replace(/_/g, " ")}</span>
                                {svc.preferred && (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">
                                    ★ {svc.preferredNote || "Recommended"}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{svc.description}</p>
                            </div>
                            <div className="text-right ml-4 shrink-0">
                              <div className="text-sm font-black text-slate-900">${svc.priceUSD}</div>
                              <div className="text-[10px] text-slate-500">{svc.turnaroundDays} days</div>
                            </div>
                          </div>
                        </button>
                        {/* Rush option */}
                        {selectedTests[svc.testMethod] && svc.rushPriceUSD && (
                          <div className="px-4 pb-3 flex items-center gap-2">
                            <button
                              onClick={() => toggleRush(svc.testMethod)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                rushTests[svc.testMethod]
                                  ? "bg-amber-100 text-amber-700 border border-amber-300"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              ⚡ Rush (+${svc.rushPriceUSD}, {svc.rushDays} days)
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentLab && services.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm">
                  No test services configured for this lab yet.
                </div>
              )}

              {/* Priority */}
              {selectedServices.length > 0 && (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Priority</label>
                    <div className="flex gap-2">
                      {["NORMAL", "HIGH", "URGENT"].map((p) => (
                        <button
                          key={p}
                          onClick={() => setPriority(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            priority === p
                              ? p === "URGENT" ? "bg-red-100 text-red-700 border border-red-300"
                                : p === "HIGH" ? "bg-amber-100 text-amber-700 border border-amber-300"
                                : "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Special Instructions (optional)
                    </label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                      placeholder="Any special requirements or notes for the lab..."
                    />
                  </div>

                  {/* Cost Summary */}
                  <div className="bg-gradient-to-r from-slate-50 to-[#00b4c3]/5 rounded-xl border p-4 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">Order Summary</span>
                      <span className="text-xs text-slate-500">{selectedServices.length} test{selectedServices.length !== 1 ? "s" : ""}</span>
                    </div>
                    {selectedServices.map((s: any) => (
                      <div key={s.testMethod} className="flex items-center justify-between text-sm py-1">
                        <span className="text-slate-700">
                          <span className="font-mono text-xs text-[#00b4c3]">{s.testMethod}</span> {s.testType.replace(/_/g, " ")}
                          {rushTests[s.testMethod] && <span className="text-amber-600 text-xs ml-1">⚡ Rush</span>}
                        </span>
                        <span className="font-semibold text-slate-900">
                          ${(s.priceUSD || 0) + (rushTests[s.testMethod] ? (s.rushPriceUSD || 0) : 0)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t mt-2 pt-2 flex items-center justify-between">
                      <div>
                        <div className="font-black text-lg text-slate-900">${totalCost}</div>
                        <div className="text-[10px] text-slate-500">Est. {maxDays} business days</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

              {/* Actions */}
              <div className="flex gap-3">
                {selectedServices.length > 0 && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 px-6 py-3 bg-[#00b4c3] text-white rounded-xl text-sm font-black hover:bg-[#009aa8] disabled:opacity-50 shadow-lg shadow-[#00b4c3]/30 transition-all"
                  >
                    {submitting ? "Submitting..." : `Submit Request · $${totalCost}`}
                  </button>
                )}
                <button onClick={onClose} className="px-4 py-3 text-sm text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const FUZE_TIERS = [
  { id: "F1", dose: 1.0, washes: 100, label: "Full Spectrum", color: "bg-emerald-500" },
  { id: "F2", dose: 0.75, washes: 75, label: "Advanced", color: "bg-teal-500" },
  { id: "F3", dose: 0.5, washes: 50, label: "Core", color: "bg-cyan-500" },
  { id: "F4", dose: 0.25, washes: 25, label: "Foundation", color: "bg-sky-500" },
] as const;

type FuzeTier = (typeof FUZE_TIERS)[number];

const COMMON_MATERIALS = [
  "Cotton", "Polyester", "Nylon", "Spandex", "Elastane", "Rayon",
  "Modal", "Tencel", "Bamboo", "Wool", "Silk", "Linen", "Acrylic",
];

function CostCard({ fabric }: { fabric: any }) {
  const [tier, setTier] = useState<FuzeTier>(FUZE_TIERS[0]);
  const outputs = useMemo(() => {
    if (!fabric.weightGsm || !fabric.widthInches) return null;
    return calcQuote({
      gsm: fabric.weightGsm,
      width: fabric.widthInches,
      widthUnit: "in",
      doseMgPerKg: tier.dose,
      stockMgPerL: 30,
      pricePerLiter: 36,
      discountPercent: 0,
      adders: [],
    });
  }, [fabric.weightGsm, fabric.widthInches, tier]);

  if (!outputs) return <span className="text-xs text-slate-400">Need GSM + width</span>;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {FUZE_TIERS.map((t) => (
          <button
            key={t.id}
            onClick={(e) => { e.stopPropagation(); setTier(t); }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
              tier.id === t.id ? `${t.color} text-white` : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {t.id}
          </button>
        ))}
      </div>
      <div className="text-sm font-bold text-slate-900">
        {money(outputs.totalCostPerLinearMeter, "USD")}<span className="text-xs font-normal text-slate-500">/m</span>
      </div>
      <div className="text-xs text-slate-500">
        {money(outputs.costPerYard, "USD")}/yd · {tier.washes}w
      </div>
    </div>
  );
}

export default function BrandPortalFabricsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testingFabric, setTestingFabric] = useState<any>(null); // fabric being submitted for testing

  // New fabric form
  const [form, setForm] = useState({
    customerCode: "",
    factoryCode: "",
    construction: "",
    color: "",
    weightGsm: "",
    widthInches: "",
    yarnType: "",
    finishNote: "",
    note: "",
    factoryId: "",
  });
  const [contents, setContents] = useState<{ material: string; percent: string }[]>([
    { material: "", percent: "" },
  ]);

  useEffect(() => {
    fetch("/api/brand-portal")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "Failed to load brand data");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAddFabric = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/brand-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contents: contents.filter((c) => c.material),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setSuccess(`Fabric FUZE #${j.fabric.fuzeNumber} created`);
        setShowAdd(false);
        setForm({ customerCode: "", factoryCode: "", construction: "", color: "", weightGsm: "", widthInches: "", yarnType: "", finishNote: "", note: "", factoryId: "" });
        setContents([{ material: "", percent: "" }]);
        // Refresh data
        const res2 = await fetch("/api/brand-portal");
        const j2 = await res2.json();
        if (j2.ok) setData(j2);
        setTimeout(() => setSuccess(""), 4000);
      } else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const addContentRow = () => setContents([...contents, { material: "", percent: "" }]);
  const removeContentRow = (i: number) => setContents(contents.filter((_, idx) => idx !== i));

  // Cost preview for new fabric form
  const previewCost = useMemo(() => {
    const gsm = parseFloat(form.weightGsm);
    const width = parseFloat(form.widthInches);
    if (!gsm || !width) return null;
    return FUZE_TIERS.map((tier) => ({
      ...tier,
      cost: calcQuote({
        gsm, width, widthUnit: "in", doseMgPerKg: tier.dose,
        stockMgPerL: 30, pricePerLiter: 36, discountPercent: 0, adders: [],
      }),
    }));
  }, [form.weightGsm, form.widthInches]);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading your fabrics...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-red-400">{error || "Unable to load brand portal"}</div>;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Fabrics</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.brand.name} — {data.fabrics.length} fabric{data.fabrics.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/FUZE_Fabric_Intake_Form.pdf"
            download="FUZE_Fabric_Intake_Form.pdf"
            className="px-4 py-2 text-[#00b4c3] bg-[#00b4c3]/10 border border-[#00b4c3]/30 rounded-lg text-sm font-bold hover:bg-[#00b4c3]/20 transition-all"
          >
            ↓ Download Form (PDF)
          </a>
          <button
            onClick={() => router.push("/fabrics/intake")}
            className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] shadow-lg shadow-[#00b4c3]/30 transition-all"
          >
            + Add Fabric
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* ── Add Fabric Form ── */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-[#00b4c3]/30 shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Register New Fabric</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Your Fabric Code</label>
              <input type="text" value={form.customerCode} onChange={(e) => setForm({ ...form, customerCode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="e.g. BRD-001" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Construction</label>
              <input type="text" value={form.construction} onChange={(e) => setForm({ ...form, construction: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="e.g. Jersey, Interlock" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Color</label>
              <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="e.g. Black, White" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">GSM (weight) *</label>
              <input type="number" value={form.weightGsm} onChange={(e) => setForm({ ...form, weightGsm: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="e.g. 180" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Width (inches) *</label>
              <input type="number" value={form.widthInches} onChange={(e) => setForm({ ...form, widthInches: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="e.g. 60" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Yarn Type</label>
              <input type="text" value={form.yarnType} onChange={(e) => setForm({ ...form, yarnType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="e.g. Ring Spun" />
            </div>
          </div>

          {/* Fabric Composition */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 mb-2">Fabric Composition</label>
            {contents.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select
                  value={c.material}
                  onChange={(e) => {
                    const next = [...contents];
                    next[i].material = e.target.value;
                    setContents(next);
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                >
                  <option value="">Select material...</option>
                  {COMMON_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="%"
                  value={c.percent}
                  onChange={(e) => {
                    const next = [...contents];
                    next[i].percent = e.target.value;
                    setContents(next);
                  }}
                  className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                />
                {contents.length > 1 && (
                  <button onClick={() => removeContentRow(i)} className="px-2 text-red-400 hover:text-red-600 text-sm">×</button>
                )}
              </div>
            ))}
            <button onClick={addContentRow} className="text-xs text-[#00b4c3] font-semibold hover:underline">+ Add material</button>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="Any additional notes..." />
          </div>

          {/* Live Cost Preview */}
          {previewCost && (
            <div className="bg-gradient-to-r from-[#00b4c3]/5 to-emerald-50 rounded-xl border border-[#00b4c3]/20 p-4 mb-4">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">FUZE Treatment Cost Preview</h3>
              <div className="grid grid-cols-4 gap-3">
                {previewCost.map((t) => (
                  <div key={t.id} className="bg-white rounded-lg p-3 border shadow-sm text-center">
                    <span className={`inline-block w-8 h-8 rounded-lg ${t.color} text-white text-xs font-black leading-8 mb-1`}>{t.id}</span>
                    <div className="text-sm font-bold text-slate-900">{money(t.cost.totalCostPerLinearMeter, "USD")}/m</div>
                    <div className="text-[10px] text-slate-500">{money(t.cost.costPerYard, "USD")}/yd · {t.washes}w</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleAddFabric}
              disabled={saving}
              className="px-6 py-2.5 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50 shadow-lg shadow-[#00b4c3]/30"
            >
              {saving ? "Creating..." : "Create Fabric"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Fabric Table ── */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3">FUZE #</th>
              <th className="px-4 py-3">Your Code</th>
              <th className="px-4 py-3">Construction</th>
              <th className="px-4 py-3">Composition</th>
              <th className="px-4 py-3">GSM</th>
              <th className="px-4 py-3">Width</th>
              <th className="px-4 py-3">FUZE Cost</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.fabrics.map((f: any) => (
              <tr
                key={f.id}
                className="border-t border-slate-100 hover:bg-blue-50 transition-colors"
              >
                <td className="px-4 py-3 font-bold text-[#00b4c3]">FUZE {f.fuzeNumber || "—"}</td>
                <td className="px-4 py-3 text-slate-700">{f.customerCode || "—"}</td>
                <td className="px-4 py-3 text-slate-700">{f.construction || "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {f.contents && f.contents.length > 0
                    ? f.contents.map((c: any) => `${c.material}${c.percent ? ` ${c.percent}%` : ""}`).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-700">{f.weightGsm || "—"}</td>
                <td className="px-4 py-3 text-slate-700">{f.widthInches ? `${f.widthInches}"` : "—"}</td>
                <td className="px-4 py-3">
                  <CostCard fabric={f} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); setTestingFabric(f); }}
                    className="px-3 py-1.5 bg-[#00b4c3] text-white rounded-lg text-xs font-bold hover:bg-[#009aa8] shadow-sm shadow-[#00b4c3]/20 transition-all whitespace-nowrap"
                  >
                    🧪 Request Testing
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.fabrics.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🧵</div>
            <h3 className="text-lg font-bold text-slate-700">No fabrics yet</h3>
            <p className="text-sm text-slate-500 mt-1">Add your first fabric to see FUZE treatment cost estimates</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 px-6 py-2.5 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] shadow-lg shadow-[#00b4c3]/30"
            >
              + Add Your First Fabric
            </button>
          </div>
        )}
      </div>

      {/* Test Request Modal */}
      {testingFabric && (
        <TestRequestModal
          fabric={testingFabric}
          onClose={() => setTestingFabric(null)}
          onSuccess={(result) => {
            setTestingFabric(null);
            setSuccess(`Test request ${result.poNumber} submitted to ${result.labName}! Estimated cost: $${result.estimatedCost}. Your request is pending review.`);
            // Refresh data to update submission counts
            fetch("/api/brand-portal").then((r) => r.json()).then((j) => { if (j.ok) setData(j); });
            setTimeout(() => setSuccess(""), 8000);
          }}
        />
      )}
    </div>
  );
}
