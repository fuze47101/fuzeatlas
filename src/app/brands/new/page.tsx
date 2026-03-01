"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  "LEAD","PRESENTATION","BRAND_TESTING","FACTORY_ONBOARDING",
  "FACTORY_TESTING","PRODUCTION","BRAND_EXPANSION","ARCHIVE","CUSTOMER_WON",
];
const STAGE_LABELS: Record<string,string> = {
  LEAD:"Lead", PRESENTATION:"Presentation", BRAND_TESTING:"Brand Testing",
  FACTORY_ONBOARDING:"Factory Onboard", FACTORY_TESTING:"Factory Testing",
  PRODUCTION:"Production", BRAND_EXPANSION:"Expansion", ARCHIVE:"Archive",
  CUSTOMER_WON:"Won",
};

export default function NewBrandPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "", pipelineStage: "LEAD", customerType: "", leadReferralSource: "",
    website: "", linkedInProfile: "", backgroundInfo: "", projectType: "",
    projectDescription: "", forecast: "", deliverables: "", salesRepId: "",
    dateOfInitialContact: "", presentationDate: "",
  });

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(j => { if (j.ok) setUsers(j.users); }).catch(() => {});
  }, []);

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Brand name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        router.push(`/brands/${j.brand.id}`);
      } else {
        setError(j.error || "Failed to create brand");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[800px] mx-auto">
      <button onClick={() => router.push("/brands")} className="text-sm text-blue-600 hover:underline mb-2 block">&larr; Back to Pipeline</button>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Add New Brand</h1>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Brand Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => set("name", e.target.value)} required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Pipeline Stage</label>
            <select value={form.pipelineStage} onChange={e => set("pipelineStage", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Customer Type</label>
            <input type="text" value={form.customerType} onChange={e => set("customerType", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Lead/Referral Source</label>
            <input type="text" value={form.leadReferralSource} onChange={e => set("leadReferralSource", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Sales Rep</label>
            <select value={form.salesRepId} onChange={e => set("salesRepId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Website</label>
            <input type="url" value={form.website} onChange={e => set("website", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">LinkedIn</label>
            <input type="url" value={form.linkedInProfile} onChange={e => set("linkedInProfile", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Date of Initial Contact</label>
            <input type="date" value={form.dateOfInitialContact} onChange={e => set("dateOfInitialContact", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Presentation Date</label>
            <input type="date" value={form.presentationDate} onChange={e => set("presentationDate", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Project Type</label>
            <input type="text" value={form.projectType} onChange={e => set("projectType", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Background Info</label>
          <textarea value={form.backgroundInfo} onChange={e => set("backgroundInfo", e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Project Description</label>
          <textarea value={form.projectDescription} onChange={e => set("projectDescription", e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Forecast</label>
            <input type="text" value={form.forecast} onChange={e => set("forecast", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Deliverables</label>
            <input type="text" value={form.deliverables} onChange={e => set("deliverables", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={() => router.push("/brands")} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300">Cancel</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Creating..." : "Create Brand"}
          </button>
        </div>
      </form>
    </div>
  );
}
