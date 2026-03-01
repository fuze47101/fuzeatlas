"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

export default function BrandDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [tab, setTab] = useState<"details"|"contacts"|"fabrics"|"submissions"|"sows"|"notes">("details");

  useEffect(() => {
    fetch(`/api/brands/${id}`)
      .then(r => r.json())
      .then(j => {
        if (j.ok) {
          setBrand(j.brand);
          setForm({
            name: j.brand.name || "",
            pipelineStage: j.brand.pipelineStage || "LEAD",
            customerType: j.brand.customerType || "",
            leadReferralSource: j.brand.leadReferralSource || "",
            website: j.brand.website || "",
            linkedInProfile: j.brand.linkedInProfile || "",
            backgroundInfo: j.brand.backgroundInfo || "",
            projectType: j.brand.projectType || "",
            projectDescription: j.brand.projectDescription || "",
            forecast: j.brand.forecast || "",
            deliverables: j.brand.deliverables || "",
            salesRepId: j.brand.salesRepId || "",
            dateOfInitialContact: j.brand.dateOfInitialContact?.split("T")[0] || "",
            presentationDate: j.brand.presentationDate?.split("T")[0] || "",
          });
        }
      })
      .finally(() => setLoading(false));

    fetch("/api/users")
      .then(r => r.json())
      .then(j => { if (j.ok) setUsers(j.users); })
      .catch(() => {});
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/brands/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        setBrand({ ...brand, ...j.brand });
        setEditing(false);
        setSuccess("Brand updated successfully");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(j.error || "Failed to update brand");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading brand...</div>;
  if (!brand) return <div className="flex items-center justify-center h-64 text-red-400">Brand not found</div>;

  const c = brand._count;

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push("/brands")} className="text-sm text-blue-600 hover:underline mb-1 block">&larr; Back to Pipeline</button>
          <h1 className="text-2xl font-black text-slate-900">{brand.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: stageColor(brand.pipelineStage) }}>
              {STAGE_LABELS[brand.pipelineStage] || brand.pipelineStage}
            </span>
            {brand.salesRep && <span className="text-sm text-slate-500">Rep: {brand.salesRep.name}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Edit Brand</button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[["Fabrics", c.fabrics, "🧵"],["Submissions", c.submissions, "📋"],["Factories", c.factories, "🏭"],["Contacts", c.contacts, "👤"],["SOWs", c.sows, "📄"]].map(([label, count, icon]) => (
          <div key={label as string} className="bg-white rounded-xl p-3 shadow-sm border text-center">
            <div className="text-lg">{icon}</div>
            <div className="text-xl font-black text-slate-900">{(count as number) || 0}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        {(["details","contacts","fabrics","submissions","sows","notes"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "details" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Brand Name" field="name" form={form} setForm={setForm} editing={editing} required />
            <Field label="Pipeline Stage" field="pipelineStage" form={form} setForm={setForm} editing={editing} type="select" options={STAGES.map(s => ({ value: s, label: STAGE_LABELS[s] }))} />
            <Field label="Customer Type" field="customerType" form={form} setForm={setForm} editing={editing} />
            <Field label="Lead/Referral Source" field="leadReferralSource" form={form} setForm={setForm} editing={editing} />
            <Field label="Sales Rep" field="salesRepId" form={form} setForm={setForm} editing={editing} type="select" options={users.map(u => ({ value: u.id, label: u.name }))} />
            <Field label="Website" field="website" form={form} setForm={setForm} editing={editing} />
            <Field label="LinkedIn" field="linkedInProfile" form={form} setForm={setForm} editing={editing} />
            <Field label="Date of Initial Contact" field="dateOfInitialContact" form={form} setForm={setForm} editing={editing} type="date" />
            <Field label="Presentation Date" field="presentationDate" form={form} setForm={setForm} editing={editing} type="date" />
            <Field label="Project Type" field="projectType" form={form} setForm={setForm} editing={editing} />
            <div className="col-span-2">
              <Field label="Background Info" field="backgroundInfo" form={form} setForm={setForm} editing={editing} type="textarea" />
            </div>
            <div className="col-span-2">
              <Field label="Project Description" field="projectDescription" form={form} setForm={setForm} editing={editing} type="textarea" />
            </div>
            <Field label="Forecast" field="forecast" form={form} setForm={setForm} editing={editing} />
            <Field label="Deliverables" field="deliverables" form={form} setForm={setForm} editing={editing} />
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          {brand.contacts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No contacts yet</p>
          ) : (
            <div className="space-y-3">
              {brand.contacts.map((ct: any) => (
                <div key={ct.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                    {(ct.firstName || ct.name || "?")[0]}
                  </div>
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

      {tab === "fabrics" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          {brand.fabrics.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No fabrics yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">FUZE #</th><th className="pb-2">Construction</th><th className="pb-2">Color</th><th className="pb-2">GSM</th>
              </tr></thead>
              <tbody>
                {brand.fabrics.map((f: any) => (
                  <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/fabrics/${f.id}`)}>
                    <td className="py-2 font-bold text-blue-600">FUZE {f.fuzeNumber}</td>
                    <td className="py-2">{f.construction}</td>
                    <td className="py-2">{f.color}</td>
                    <td className="py-2">{f.weightGsm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "submissions" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          {brand.submissions.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No submissions yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">Fabric #</th><th className="pb-2">Status</th><th className="pb-2">Test Status</th><th className="pb-2">Date</th>
              </tr></thead>
              <tbody>
                {brand.submissions.map((s: any) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2 font-bold">FUZE {s.fuzeFabricNumber}</td>
                    <td className="py-2">{s.status || "—"}</td>
                    <td className="py-2">{s.testStatus || "—"}</td>
                    <td className="py-2 text-slate-500">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "sows" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900">Statements of Work</h3>
            <button onClick={() => router.push(`/sow/new?brandId=${id}`)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">+ New SOW</button>
          </div>
          {brand.sows.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No SOWs yet</p>
          ) : (
            <div className="space-y-2">
              {brand.sows.map((s: any) => (
                <div key={s.id} onClick={() => router.push(`/sow/${s.id}`)} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-sm">{s.title || "Untitled SOW"}</div>
                    <div className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sowStatusColor(s.status)}`}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          {brand.notes.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No notes yet</p>
          ) : (
            <div className="space-y-3">
              {brand.notes.map((n: any) => (
                <div key={n.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-600">{n.noteType || "Note"} {n.contactName && `· ${n.contactName}`}</span>
                    <span className="text-xs text-slate-400">{n.date ? new Date(n.date).toLocaleDateString() : ""}</span>
                  </div>
                  <p className="text-sm text-slate-700">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function stageColor(stage: string) {
  const m: Record<string,string> = {
    LEAD:"#94a3b8", PRESENTATION:"#60a5fa", BRAND_TESTING:"#a78bfa",
    FACTORY_ONBOARDING:"#f59e0b", FACTORY_TESTING:"#fb923c",
    PRODUCTION:"#34d399", BRAND_EXPANSION:"#2dd4bf", ARCHIVE:"#6b7280", CUSTOMER_WON:"#22c55e",
  };
  return m[stage] || "#94a3b8";
}

function sowStatusColor(s: string) {
  const m: Record<string,string> = {
    DRAFT: "bg-slate-200 text-slate-700", SENT: "bg-blue-100 text-blue-700",
    SIGNED: "bg-purple-100 text-purple-700", ACTIVE: "bg-green-100 text-green-700",
    COMPLETE: "bg-emerald-100 text-emerald-700", CANCELLED: "bg-red-100 text-red-700",
  };
  return m[s] || "bg-slate-200 text-slate-700";
}

function Field({ label, field, form, setForm, editing, type = "text", options, required }: any) {
  const val = form[field] || "";

  if (!editing) {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
        <div className="text-sm text-slate-900">{type === "select" ? (options?.find((o: any) => o.value === val)?.label || val || "—") : (val || "—")}</div>
      </div>
    );
  }

  if (type === "select") {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
        <select value={val} onChange={e => setForm({ ...form, [field]: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select...</option>
          {options?.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
        <textarea value={val} onChange={e => setForm({ ...form, [field]: e.target.value })} rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <input type={type} value={val} onChange={e => setForm({ ...form, [field]: e.target.value })}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}
