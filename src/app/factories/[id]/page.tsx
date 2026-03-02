"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

export default function FactoryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
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
      if (j.ok) { setFactory({ ...factory, ...j.factory }); setEditing(false); setSuccess(t.factories.factoryUpdated); setTimeout(() => setSuccess(""), 3000); }
      else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">{t.factories.loadingFactory}</div>;
  if (!factory) return <div className="flex items-center justify-center h-64 text-red-400">{t.factories.factoryNotFound}</div>;

  const c = factory._count;

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push("/factories")} className="text-sm text-blue-600 hover:underline mb-1 block">&larr; {t.factories.backToFactories}</button>
          <h1 className="text-2xl font-black text-slate-900">{factory.name}</h1>
          {factory.chineseName && <p className="text-sm text-slate-500">{factory.chineseName}</p>}
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            {factory.country && <span>📍 {factory.city ? `${factory.city}, ` : ""}{factory.country}</span>}
            {factory.millType && <span>· {factory.millType}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">{t.common.edit}</button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold">{t.common.cancel}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">{saving ? t.common.saving : t.common.save}</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{t.factories.factoryUpdated}</div>}

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[[t.factories.brands, c.brands, "🎯"],[t.factories.fabrics, c.fabrics, "🧵"],[t.dashboard.submissions, c.submissions, "📋"],[t.contacts.title, c.contacts, "👤"]].map(([l, v, i]) => (
          <div key={l as string} className="bg-white rounded-xl p-3 shadow-sm border text-center">
            <div className="text-lg">{i}</div>
            <div className="text-xl font-black text-slate-900">{v as number}</div>
            <div className="text-xs text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-slate-200 mb-4">
        {(["details","brands","fabrics","contacts"] as const).map(tabName => {
          const tabLabels: Record<string, string> = {
            details: t.brandTabs.details,
            brands: t.factories.brands,
            fabrics: t.factories.fabrics,
            contacts: t.contacts.title
          };
          return (
            <button key={tabName} onClick={() => setTab(tabName)} className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === tabName ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>
              {tabLabels[tabName]}
            </button>
          );
        })}
      </div>

      {tab === "details" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="grid grid-cols-2 gap-4">
            {[
              [t.factories.factoryName, "name"], [t.factories.chineseName, "chineseName"], [t.factories.millType, "millType"],
              [t.factories.specialty, "specialty"], [t.factories.purchasing, "purchasing"], [t.factories.annualSales, "annualSales"],
              [t.factories.address, "address"], [t.factories.city, "city"], [t.factories.state, "state"], [t.factories.country, "country"],
              [t.factories.secondaryCountry, "secondaryCountry"], [t.factories.development, "development"],
              [t.factories.customerType, "customerType"], [t.factories.brandNominated, "brandNominated"],
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
          {factory.brands.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">{t.factories.noBrandsLinked}</p> : (
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
          {factory.fabrics.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">{t.factories.noFabrics}</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b"><th className="pb-2">{t.fabrics.fuzeNumber}</th><th className="pb-2">{t.fabrics.construction}</th><th className="pb-2">{t.fabrics.color}</th><th className="pb-2">{t.fabrics.gsm}</th></tr></thead>
              <tbody>
                {factory.fabrics.map((f: any) => (
                  <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/fabrics/${f.id}`)}>
                    <td className="py-2 font-bold text-blue-600">{t.fabrics.fuzeLabel} {f.fuzeNumber}</td><td className="py-2">{f.construction}</td><td className="py-2">{f.color}</td><td className="py-2">{f.weightGsm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "contacts" && (
        <FactoryContactsTab factoryId={id as string} contacts={factory.contacts} onUpdate={(contacts: any[]) => setFactory({ ...factory, contacts, _count: { ...factory._count, contacts: contacts.length } })} t={t} />
      )}
    </div>
  );
}

/* ── FactoryContactsTab — inline CRUD ──────────── */
function FactoryContactsTab({ factoryId, contacts: initial, onUpdate, t }: { factoryId: string; contacts: any[]; onUpdate: (c: any[]) => void; t: any }) {
  const [contacts, setContacts] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const empty = { firstName: "", lastName: "", title: "", email: "", phone: "" };
  const [form, setForm] = useState(empty);

  const sync = (updated: any[]) => { setContacts(updated); onUpdate(updated); };

  const handleAdd = async () => {
    if (!form.firstName.trim() && !form.email.trim()) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, factoryId }),
      });
      const j = await res.json();
      if (j.ok) { sync([...contacts, j.contact]); setForm(empty); setShowAdd(false); }
      else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) { sync(contacts.map(c => c.id === id ? j.contact : c)); setEditingId(null); }
      else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) sync(contacts.filter(c => c.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const startEdit = (ct: any) => {
    setEditingId(ct.id);
    setForm({ firstName: ct.firstName || "", lastName: ct.lastName || "", title: ct.title || "", email: ct.email || "", phone: ct.phone || "" });
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-900">{t.contacts.title}</h3>
        <button onClick={() => { setShowAdd(!showAdd); setForm(empty); setEditingId(null); }}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
          + {t.contacts.addContact}
        </button>
      </div>
      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>}
      {showAdd && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="First name" autoFocus />
            <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Last name" />
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Title/Role" />
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Email" />
            <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Phone" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">
              {saving ? t.common.saving : t.contacts.addContact}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">{t.common.cancel}</button>
          </div>
        </div>
      )}
      {contacts.length === 0 && !showAdd ? (
        <p className="text-slate-400 text-sm text-center py-8">{t.factories.noContacts}</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((ct: any) => (
            editingId === ct.id ? (
              <div key={ct.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                  <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="First name" />
                  <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Last name" />
                  <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Title" />
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Email" />
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Phone" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(ct.id)} className="text-xs text-green-600 hover:underline font-semibold">{saving ? "..." : t.common.save}</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-slate-500 hover:underline">{t.common.cancel}</button>
                </div>
              </div>
            ) : (
              <div key={ct.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg group">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-sm flex-shrink-0">
                  {(ct.firstName || ct.name || "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900">{ct.firstName} {ct.lastName} {ct.title && <span className="text-slate-500 font-normal">({ct.title})</span>}</div>
                  <div className="text-xs text-slate-500 truncate">{ct.email}{ct.phone && ` · ${ct.phone}`}</div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(ct)} className="text-xs text-blue-600 hover:underline">{t.common.edit}</button>
                  <button onClick={() => handleDelete(ct.id)} className="text-xs text-red-500 hover:underline">{t.common.delete}</button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
