"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { calcQuote, money, type CalcInputs, type CalcOutputs } from "@/lib/fuze-calc";

const FUZE_TIERS = [
  { id: "F1", dose: 1.0, washes: 100, label: "Full Spectrum", color: "bg-emerald-500" },
  { id: "F2", dose: 0.75, washes: 75, label: "Advanced", color: "bg-teal-500" },
  { id: "F3", dose: 0.5, washes: 50, label: "Core", color: "bg-cyan-500" },
  { id: "F4", dose: 0.25, washes: 25, label: "Foundation", color: "bg-sky-500" },
] as const;

const COMMON_MATERIALS = [
  "Cotton", "Polyester", "Nylon", "Spandex", "Elastane", "Rayon",
  "Modal", "Tencel", "Bamboo", "Wool", "Silk", "Linen", "Acrylic",
];

function CostCard({ fabric }: { fabric: any }) {
  const [tier, setTier] = useState(FUZE_TIERS[0]);
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
          <h1 className="text-2xl font-black text-slate-900">My Fabrics</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.brand.name} — {data.fabrics.length} fabric{data.fabrics.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] shadow-lg shadow-[#00b4c3]/30 transition-all"
        >
          + Add Fabric
        </button>
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
              <th className="px-4 py-3 text-center">Submissions</th>
            </tr>
          </thead>
          <tbody>
            {data.fabrics.map((f: any) => (
              <tr
                key={f.id}
                onClick={() => router.push(`/fabrics/${f.id}`)}
                className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
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
                <td className="px-4 py-3 text-center font-bold">{f.submissionCount || 0}</td>
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
    </div>
  );
}
