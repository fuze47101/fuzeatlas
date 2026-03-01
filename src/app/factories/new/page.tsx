"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewFactoryPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", chineseName: "", millType: "", specialty: "", purchasing: "",
    annualSales: "", address: "", city: "", state: "", country: "",
    secondaryCountry: "", development: "", customerType: "", brandNominated: "",
  });

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Factory name is required"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/factories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (j.ok) router.push(`/factories/${j.factory.id}`);
      else setError(j.error || "Failed to create factory");
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-[800px] mx-auto">
      <button onClick={() => router.push("/factories")} className="text-sm text-blue-600 hover:underline mb-2 block">&larr; Back to Factories</button>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Add New Factory</h1>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[
            ["Factory Name *", "name", true], ["Chinese Name", "chineseName", false],
            ["Mill Type", "millType", false], ["Specialty", "specialty", false],
            ["Purchasing", "purchasing", false], ["Annual Sales", "annualSales", false],
            ["Address", "address", false], ["City", "city", false],
            ["State/Province", "state", false], ["Country", "country", false],
            ["Secondary Country", "secondaryCountry", false], ["Development", "development", false],
            ["Customer Type", "customerType", false], ["Brand Nominated", "brandNominated", false],
          ].map(([label, field, req]) => (
            <div key={field as string}>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{label as string}</label>
              <input type="text" value={(form as any)[field as string]} onChange={e => set(field as string, e.target.value)} required={req as boolean}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={() => router.push("/factories")} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Creating..." : "Create Factory"}
          </button>
        </div>
      </form>
    </div>
  );
}
