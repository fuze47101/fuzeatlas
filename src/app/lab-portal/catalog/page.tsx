"use client";
import { useEffect, useState } from "react";

const TEST_TYPES = [
  "ICP", "ANTIBACTERIAL", "FUNGAL", "ODOR", "UV", "MICROFIBER",
  "PERFORMANCE", "RECIPE_DEVELOPMENT", "SOLAR_PERFORMANCE", "HEAT_DEFLECTION", "OTHER",
];

const EMPTY_SERVICE = {
  testType: "",
  testMethod: "",
  description: "",
  listPriceUSD: "",
  turnaroundDays: "",
  rushPriceUSD: "",
  rushDays: "",
  notes: "",
};

export default function LabCatalogPage() {
  const [data, setData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/lab-portal")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setData(j);
          setServices(j.services || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const addService = () => {
    const newSvc = { ...EMPTY_SERVICE };
    setServices([...services, newSvc]);
    setEditingIdx(services.length);
  };

  const removeService = (idx: number) => {
    setServices(services.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

  const updateService = (idx: number, field: string, value: any) => {
    const updated = [...services];
    updated[idx] = { ...updated[idx], [field]: value };
    setServices(updated);
  };

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/lab-portal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services }),
      });
      const j = await res.json();
      if (j.ok) {
        setSuccess("Test catalog saved successfully!");
        setServices(j.lab?.services || services);
        setEditingIdx(null);
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(j.error || "Failed to save");
      }
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading catalog...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-red-400">Unable to load</div>;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Test Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">{data.lab.name} — {services.length} test{services.length !== 1 ? "s" : ""} listed</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addService}
            className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] shadow-lg shadow-[#00b4c3]/30"
          >
            + Add Test
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save All Changes"}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      <div className="space-y-3">
        {services.map((svc, idx) => (
          <div
            key={svc.id || `new-${idx}`}
            className={`bg-white rounded-xl border transition-all ${
              editingIdx === idx ? "border-[#00b4c3] shadow-lg" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            {/* Header / collapsed view */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[#00b4c3] bg-[#00b4c3]/10 px-2 py-1 rounded">
                  {svc.testMethod || "NEW"}
                </span>
                <div>
                  <div className="font-bold text-sm text-slate-900">{svc.testType?.replace(/_/g, " ") || "New Test"}</div>
                  <div className="text-xs text-slate-500 line-clamp-1">{svc.description || "No description"}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {svc.listPriceUSD && <span className="font-semibold text-slate-700">${svc.listPriceUSD}</span>}
                {svc.turnaroundDays && <span className="text-slate-500">{svc.turnaroundDays}d</span>}
                <span className="text-slate-400 text-xs">{editingIdx === idx ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* Expanded edit form */}
            {editingIdx === idx && (
              <div className="px-4 pb-4 border-t border-slate-100 pt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Test Type</label>
                    <select
                      value={svc.testType}
                      onChange={(e) => updateService(idx, "testType", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
                    >
                      <option value="">Select type...</option>
                      {TEST_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Test Method / Code</label>
                    <input
                      type="text"
                      value={svc.testMethod || ""}
                      onChange={(e) => updateService(idx, "testMethod", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
                      placeholder="e.g. AATCC 100, ASTM E2149"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Your Price (USD)</label>
                    <input
                      type="number"
                      value={svc.listPriceUSD || ""}
                      onChange={(e) => updateService(idx, "listPriceUSD", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
                      placeholder="e.g. 350"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Turnaround (days)</label>
                    <input
                      type="number"
                      value={svc.turnaroundDays || ""}
                      onChange={(e) => updateService(idx, "turnaroundDays", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
                      placeholder="e.g. 7"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Rush Price (USD)</label>
                    <input
                      type="number"
                      value={svc.rushPriceUSD || ""}
                      onChange={(e) => updateService(idx, "rushPriceUSD", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Rush Days</label>
                    <input
                      type="number"
                      value={svc.rushDays || ""}
                      onChange={(e) => updateService(idx, "rushDays", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                  <textarea
                    value={svc.description || ""}
                    onChange={(e) => updateService(idx, "description", e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
                    placeholder="Brief description of this test service..."
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Notes / Special Conditions</label>
                  <input
                    type="text"
                    value={svc.notes || ""}
                    onChange={(e) => updateService(idx, "notes", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
                    placeholder="Min quantities, special requirements, etc."
                  />
                </div>

                {/* FUZE negotiated price (read-only for lab users) */}
                {svc.priceUSD && (
                  <div className="bg-[#00b4c3]/5 rounded-lg p-3 mb-4">
                    <span className="text-xs font-bold text-[#00b4c3]">FUZE Negotiated Rate: ${svc.priceUSD}</span>
                    <span className="text-xs text-slate-500 ml-2">(Set by FUZE — customers see this price)</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => removeService(idx)}
                    className="px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-50"
                  >
                    Remove Test
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {services.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border">
          <div className="text-5xl mb-3">🧪</div>
          <h3 className="text-lg font-bold text-slate-700">No tests in your catalog</h3>
          <p className="text-sm text-slate-500 mt-1">Add your first test service to start receiving test requests from FUZE customers.</p>
          <button onClick={addService} className="mt-4 px-6 py-2.5 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] shadow-lg shadow-[#00b4c3]/30">
            + Add Your First Test
          </button>
        </div>
      )}
    </div>
  );
}
