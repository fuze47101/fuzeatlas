"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function FactoryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [factory, setFactory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<any>({});
  const [tab, setTab] = useState<"details"|"brands"|"fabrics"|"contacts">("details");

  useEffect(() => {
    fetch(`/api/factories/${id}`).then(r => r.json()).then(j => {
      if (j.ok) {
        setFactory(j.factory);
        const f = j.factory;
        setForm({
          name: f.name || "", chineseName: f.chineseName || "", millType: f.millType || "",
          specialty: f.specialty || "", purchasing: f.purchasing || "", annualSales: f.annualSales || "",
          address: f.address || "", city: f.city || "", state: f.state || "",
          country: f.country || "", secondaryCountry: f.secondaryCountry || "",
          development: f.development || "", customerType: f.customerType || "", brandNominated: f.brandNominated || "",
        });
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/factories/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (j.ok) { setFactory({ ...factory, ...j.factory }); setEditing(false); setSuccess("Factory updated"); setTimeout(() => setSuccess(""), 3000); }
      else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading factory...</div>;
  if (!factory) return <div className="flex items-center justify-center h-64 text-red-400">Factory not found</div>;

  const c = factory._count;

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push("/factories")} className="text-sm text-blue-600 hover:underline mb-1 block">&larr; Back to Factories</button>
          <h1 className="text-2xl font-black text-slate-900">{factory.name}</h1>
          {factory.chineseName && <p className="text-sm text-slate-500">{factory.chineseName}</p>}
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            {factory.country && <span>📍 {factory.city ? `${factory.city}, ` : ""}{factory.country}</span>}
            {factory.millType && <span>· {factory.millType}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Edit Factory</button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[["Brands", c.brands, "🎯"],["Fabrics", c.fabrics, "🧵"],["Submissions", c.submissions, "📋"],["Contacts", c.contacts, "👤"]].map(([l, v, i]) => (
          <div key={l as string} className="bg-white rounded-xl p-3 shadow-sm border text-center">
            <div className="text-lg">{i}</div>
            <div className="text-xl font-black text-slate-900">{v as number}</div>
            <div className="text-xs text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-slate-200 mb-4">
        {(["details","brands","fabrics","contacts"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="grid grid-cols-2 gap-4">
            {[
              ["Factory Name", "name"], ["Chinese Name", "chineseName"], ["Mill Type", "millType"],
              ["Specialty", "specialty"], ["Purchasing", "purchasing"], ["Annual Sales", "annualSales"],
              ["Address", "address"], ["City", "city"], ["State", "state"], ["Country", "country"],
              ["Secondary Country", "secondaryCountry"], ["Development", "development"],
              ["Customer Type", "customerType"], ["Brand Nominated", "brandNominated"],
            ].map(([label, field]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
                {editing ? (
                  <input type="text" value={form[field] || ""} onChange={e => setForm({ ...form, [field]: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                ) : (
                  <div className="text-sm text-slate-900">{factory[field] || "—"}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "brands" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          {factory.brands.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">No brands linked</p> : (
            <div className="space-y-2">
              {factory.brands.map((bf: any) => (
                <div key={bf.id} onClick={() => router.push(`/brands/${bf.brand.id}`)} className="p-3 bg-slate-50 rounded-lg hover:bg-blue-50 cursor-pointer flex justify-between items-center">
                  <div className="font-semibold text-sm">{bf.brand.name}</div>
                  <span className="text-xs text-slate-500">{bf.brand.pipelineStage}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "fabrics" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          {factory.fabrics.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">No fabrics</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b"><th className="pb-2">FUZE #</th><th className="pb-2">Construction</th><th className="pb-2">Color</th><th className="pb-2">GSM</th></tr></thead>
              <tbody>
                {factory.fabrics.map((f: any) => (
                  <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/fabrics/${f.id}`)}>
                    <td className="py-2 font-bold text-blue-600">FUZE {f.fuzeNumber}</td><td className="py-2">{f.construction}</td><td className="py-2">{f.color}</td><td className="py-2">{f.weightGsm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "contacts" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          {factory.contacts.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">No contacts</p> : (
            <div className="space-y-3">
              {factory.contacts.map((ct: any) => (
                <div key={ct.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-sm">{(ct.firstName || ct.name || "?")[0]}</div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900">{ct.firstName} {ct.lastName} {ct.title && `(${ct.title})`}</div>
                    <div className="text-xs text-slate-500">{ct.email} {ct.phone && `· ${ct.phone}`}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
