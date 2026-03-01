"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewFabricPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [brands, setBrands] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [form, setForm] = useState({
    fuzeNumber: "", customerCode: "", factoryCode: "", construction: "",
    color: "", weightGsm: "", widthInches: "", yarnType: "", finishNote: "",
    note: "", brandId: "", factoryId: "",
  });
  const [contents, setContents] = useState([{ material: "", percent: "" }]);

  useEffect(() => {
    fetch("/api/brands").then(r => r.json()).then(j => {
      if (j.ok) {
        const all: any[] = [];
        Object.values(j.grouped).forEach((arr: any) => arr.forEach((b: any) => all.push(b)));
        setBrands(all.sort((a, b) => a.name.localeCompare(b.name)));
      }
    }).catch(() => {});
    fetch("/api/factories").then(r => r.json()).then(j => { if (j.ok) setFactories(j.factories); }).catch(() => {});
  }, []);

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const payload = { ...form, contents: contents.filter(c => c.material) };
      const res = await fetch("/api/fabrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (j.ok) router.push(`/fabrics/${j.fabric.id}`);
      else setError(j.error || "Failed to create fabric");
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-[800px] mx-auto">
      <button onClick={() => router.push("/fabrics")} className="text-sm text-blue-600 hover:underline mb-2 block">&larr; Back to Fabrics</button>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Add New Fabric</h1>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">FUZE Number</label>
            <input type="number" value={form.fuzeNumber} onChange={e => set("fuzeNumber", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Customer Code</label>
            <input type="text" value={form.customerCode} onChange={e => set("customerCode", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Factory Code</label>
            <input type="text" value={form.factoryCode} onChange={e => set("factoryCode", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Construction</label>
            <input type="text" value={form.construction} onChange={e => set("construction", e.target.value)} placeholder="e.g. Knit, Woven, Jersey"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Color</label>
            <input type="text" value={form.color} onChange={e => set("color", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Weight (GSM)</label>
            <input type="number" step="0.1" value={form.weightGsm} onChange={e => set("weightGsm", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Width (inches)</label>
            <input type="number" step="0.1" value={form.widthInches} onChange={e => set("widthInches", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Yarn Type</label>
            <input type="text" value={form.yarnType} onChange={e => set("yarnType", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Brand</label>
            <select value={form.brandId} onChange={e => set("brandId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select brand...</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Factory</label>
            <select value={form.factoryId} onChange={e => set("factoryId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select factory...</option>
              {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Finish Note</label>
          <input type="text" value={form.finishNote} onChange={e => set("finishNote", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
          <textarea value={form.note} onChange={e => set("note", e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Content composition */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2">Fabric Content / Composition</label>
          {contents.map((c, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="text" placeholder="Material (e.g. Polyester)" value={c.material}
                onChange={e => { const nc = [...contents]; nc[i].material = e.target.value; setContents(nc); }}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" placeholder="%" value={c.percent} step="0.1"
                onChange={e => { const nc = [...contents]; nc[i].percent = e.target.value; setContents(nc); }}
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {contents.length > 1 && (
                <button type="button" onClick={() => setContents(contents.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setContents([...contents, { material: "", percent: "" }])} className="text-xs text-blue-600 hover:underline">+ Add material</button>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={() => router.push("/fabrics")} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Creating..." : "Create Fabric"}
          </button>
        </div>
      </form>
    </div>
  );
}
