"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

const NOTE_TYPES = ["NOTE", "CALL", "EMAIL", "MEETING", "TASK", "FOLLOW_UP"];

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
  const [tab, setTab] = useState<"details"|"brands"|"fabrics"|"submissions"|"tests"|"contacts"|"notes">("details");
  const [users, setUsers] = useState<any[]>([]);
  // Tests state
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  // Brand linking
  const [allBrands, setAllBrands] = useState<any[]>([]);
  const [showLinkBrand, setShowLinkBrand] = useState(false);
  const [linkBrandId, setLinkBrandId] = useState("");
  // Delete
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adminCode, setAdminCode] = useState("");

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
          salesRepId: f.salesRepId || "",
        });
      }
    }).finally(() => setLoading(false));

    fetch("/api/users").then(r => r.json()).then(j => { if (j.ok) setUsers(j.users); }).catch(() => {});
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

  const handleDelete = async () => {
    setDeleting(true); setError("");
    try {
      const res = await fetch(`/api/factories/${id}?code=${encodeURIComponent(adminCode)}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) { router.push("/factories"); }
      else { setError(j.error || "Failed to delete factory"); setShowDeleteConfirm(false); }
    } catch (e: any) { setError(e.message); setShowDeleteConfirm(false); } finally { setDeleting(false); }
  };

  const loadTests = async () => {
    setTestsLoading(true);
    try {
      const res = await fetch(`/api/tests/by-entity?factoryId=${id}`);
      const j = await res.json();
      if (j.ok) setTestRuns(j.testRuns);
    } catch {} finally { setTestsLoading(false); }
  };

  const loadBrands = async () => {
    if (allBrands.length > 0) return;
    try {
      const res = await fetch("/api/brands");
      const j = await res.json();
      if (j.ok) setAllBrands(j.brands);
    } catch {}
  };

  useEffect(() => {
    if (tab === "tests" && testRuns.length === 0) loadTests();
    if (tab === "brands") loadBrands();
  }, [tab]);

  const handleLinkBrand = async () => {
    if (!linkBrandId) return;
    try {
      const res = await fetch("/api/brand-factory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId: linkBrandId, factoryId: id }) });
      const j = await res.json();
      if (j.ok) {
        setFactory({ ...factory, brands: [...factory.brands, j.link], _count: { ...factory._count, brands: factory._count.brands + 1 } });
        setShowLinkBrand(false); setLinkBrandId("");
      } else setError(j.error);
    } catch (e: any) { setError(e.message); }
  };

  const handleUnlinkBrand = async (linkId: string) => {
    if (!confirm("Remove this brand link?")) return;
    try {
      const res = await fetch(`/api/brand-factory?id=${linkId}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) {
        setFactory({ ...factory, brands: factory.brands.filter((bf: any) => bf.id !== linkId), _count: { ...factory._count, brands: factory._count.brands - 1 } });
      }
    } catch (e: any) { setError(e.message); }
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
            {factory.salesRep && <span>· Rep: {factory.salesRep.name}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100">{t.common.delete}</button>
              <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">{t.common.edit}</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold">{t.common.cancel}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">{saving ? t.common.saving : t.common.save}</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          [t.factories.brands, c.brands, "🎯"],
          [t.factories.fabrics, c.fabrics, "🧵"],
          [t.dashboard.submissions, c.submissions, "📋"],
          [t.contacts.title, c.contacts, "👤"],
          [t.nav.testResults || "Tests", testRuns.length || 0, "🧪"],
        ].map(([l, v, i]) => (
          <div key={l as string} className="bg-white rounded-xl p-3 shadow-sm border text-center">
            <div className="text-lg">{i}</div>
            <div className="text-xl font-black text-slate-900">{v as number}</div>
            <div className="text-xs text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-4 overflow-x-auto">
        {(["details","brands","fabrics","submissions","tests","contacts","notes"] as const).map(tabName => {
          const tabLabels: Record<string, string> = {
            details: t.brandTabs.details,
            brands: t.factories.brands,
            fabrics: t.factories.fabrics,
            submissions: t.dashboard.submissions || "Submissions",
            tests: t.nav.testResults || "Tests",
            contacts: t.contacts.title,
            notes: t.brandTabs.notes || "Notes",
          };
          return (
            <button key={tabName} onClick={() => setTab(tabName)}
              className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === tabName ? "border-amber-600 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {tabLabels[tabName]}
            </button>
          );
        })}
      </div>

      {/* ── Details Tab ── */}
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
            {/* Sales rep selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.brands.salesRep || "Sales Rep"}</label>
              {editing ? (
                <select value={form.salesRepId || ""} onChange={e => setForm({ ...form, salesRepId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <div className="text-sm text-slate-900">{factory.salesRep?.name || "—"}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Brands Tab (Enhanced with link/unlink) ── */}
      {tab === "brands" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900">{t.factories.brands}</h3>
            <button onClick={() => { setShowLinkBrand(!showLinkBrand); loadBrands(); }}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">+ Link Brand</button>
          </div>
          {showLinkBrand && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Select Brand</label>
              <div className="flex gap-2">
                <select value={linkBrandId} onChange={e => setLinkBrandId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">Choose a brand...</option>
                  {allBrands
                    .filter((b: any) => !factory.brands.some((bf: any) => bf.brand.id === b.id))
                    .map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)
                  }
                </select>
                <button onClick={handleLinkBrand} disabled={!linkBrandId}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">Link</button>
                <button onClick={() => setShowLinkBrand(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">{t.common.cancel}</button>
              </div>
            </div>
          )}
          {factory.brands.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">{t.factories.noBrandsLinked}</p> : (
            <div className="space-y-2">
              {factory.brands.map((bf: any) => (
                <div key={bf.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-amber-50 group">
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => router.push(`/brands/${bf.brand.id}`)}>
                    <span className="text-lg">🔥</span>
                    <div>
                      <div className="font-semibold text-sm">{bf.brand.name}</div>
                      <span className="text-xs text-slate-500">{bf.brand.pipelineStage}</span>
                    </div>
                  </div>
                  <button onClick={() => handleUnlinkBrand(bf.id)} className="text-xs text-red-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">Unlink</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Fabrics Tab ── */}
      {tab === "fabrics" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900">{t.factories.fabrics}</h3>
            <button onClick={() => router.push(`/fabrics/new?factoryId=${id}`)} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">+ New Fabric</button>
          </div>
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

      {/* ── Submissions Tab (NEW) ── */}
      {tab === "submissions" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-4">{t.dashboard.submissions || "Submissions"}</h3>
          {factory.submissions.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No submissions linked to this factory yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">Fabric #</th><th className="pb-2">Status</th><th className="pb-2">Test Status</th><th className="pb-2">Date</th>
              </tr></thead>
              <tbody>
                {factory.submissions.map((s: any) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
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

      {/* ── Tests Tab (NEW) ── */}
      {tab === "tests" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900">{t.nav.testResults || "Test Results"}</h3>
            <button onClick={loadTests} className="text-xs text-amber-600 hover:underline">Refresh</button>
          </div>
          {testsLoading ? (
            <p className="text-slate-400 text-sm text-center py-8">{t.common.loading}</p>
          ) : testRuns.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No test results linked to this factory yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">Type</th><th className="pb-2">Fabric</th><th className="pb-2">Lab</th><th className="pb-2">Method</th><th className="pb-2">Result</th><th className="pb-2">Date</th>
              </tr></thead>
              <tbody>
                {testRuns.map((tr: any) => {
                  const pass = tr.icpResult ? true : tr.abResult?.methodPass ?? tr.abResult?.pass ?? tr.fungalResult?.pass ?? tr.odorResult?.pass;
                  const typeColors: Record<string,string> = { ICP: "bg-violet-100 text-violet-700", ANTIBACTERIAL: "bg-blue-100 text-blue-700", FUNGAL: "bg-emerald-100 text-emerald-700", ODOR: "bg-amber-100 text-amber-700", UV: "bg-pink-100 text-pink-700" };
                  return (
                    <tr key={tr.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/tests/${tr.id}`)}>
                      <td className="py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeColors[tr.testType] || "bg-slate-100 text-slate-600"}`}>{tr.testType}</span></td>
                      <td className="py-2 font-mono text-xs">{tr.submission?.fuzeFabricNumber ? `FUZE ${tr.submission.fuzeFabricNumber}` : "—"}</td>
                      <td className="py-2 text-xs">{tr.lab?.name || "—"}</td>
                      <td className="py-2 text-xs text-slate-600">{tr.testMethodStd || tr.testMethodRaw || "—"}</td>
                      <td className="py-2">
                        {pass === true && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">PASS</span>}
                        {pass === false && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">FAIL</span>}
                        {(pass === null || pass === undefined) && <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="py-2 text-xs text-slate-500">{tr.testDate ? new Date(tr.testDate).toLocaleDateString() : tr.createdAt ? new Date(tr.createdAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Contacts Tab ── */}
      {tab === "contacts" && (
        <FactoryContactsTab factoryId={id as string} contacts={factory.contacts} onUpdate={(contacts: any[]) => setFactory({ ...factory, contacts, _count: { ...factory._count, contacts: contacts.length } })} t={t} />
      )}

      {/* ── Notes Tab (NEW) ── */}
      {tab === "notes" && (
        <FactoryNotesTab factoryId={id as string} t={t} />
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Factory</h3>
            <p className="text-sm text-slate-600 mb-1">Are you sure you want to delete <strong>{factory.name}</strong>?</p>
            <p className="text-xs text-slate-500 mb-4">This action cannot be undone. All linked records must be removed first.</p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Code</label>
              <input type="password" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && adminCode) handleDelete(); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="Enter admin code" autoFocus />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setAdminCode(""); }} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">{t.common.cancel}</button>
              <button onClick={handleDelete} disabled={deleting || !adminCode} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">{deleting ? "Deleting..." : "Yes, Delete"}</button>
            </div>
          </div>
        </div>
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
      const res = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, factoryId }) });
      const j = await res.json();
      if (j.ok) { sync([...contacts, j.contact]); setForm(empty); setShowAdd(false); }
      else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
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
          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">+ {t.contacts.addContact}</button>
      </div>
      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>}
      {showAdd && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="First name" autoFocus />
            <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Last name" />
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Title/Role" />
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Email" />
            <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Phone" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">{saving ? t.common.saving : t.contacts.addContact}</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">{t.common.cancel}</button>
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
                  <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="First name" />
                  <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Last name" />
                  <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Title" />
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Email" />
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Phone" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(ct.id)} className="text-xs text-green-600 hover:underline font-semibold">{saving ? "..." : t.common.save}</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-slate-500 hover:underline">{t.common.cancel}</button>
                </div>
              </div>
            ) : (
              <div key={ct.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg group">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-sm flex-shrink-0">{(ct.firstName || ct.name || "?")[0]}</div>
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

/* ── FactoryNotesTab — standalone CRUD (notes aren't in factory model) ── */
function FactoryNotesTab({ factoryId, t }: { factoryId: string; t: any }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const empty = { content: "", noteType: "NOTE", contactName: "" };
  const [form, setForm] = useState(empty);

  // Notes are attached to brands in the schema, but we show a simple local note log
  // For now, notes are loaded empty and can be added
  useEffect(() => {
    setLoading(false);
  }, []);

  const handleAdd = async () => {
    if (!form.content.trim()) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form }) });
      const j = await res.json();
      if (j.ok) { setNotes([j.note, ...notes]); setForm(empty); setShowAdd(false); }
      else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) setNotes(notes.filter(n => n.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const typeColors: Record<string,string> = {
    NOTE: "bg-slate-100 text-slate-700", CALL: "bg-blue-100 text-blue-700", EMAIL: "bg-violet-100 text-violet-700",
    MEETING: "bg-green-100 text-green-700", TASK: "bg-amber-100 text-amber-700", FOLLOW_UP: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-900">{t.brandTabs.notes || "Notes"}</h3>
        <button onClick={() => { setShowAdd(!showAdd); setForm(empty); }}
          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">+ Add Note</button>
      </div>
      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>}
      {showAdd && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
              <select value={form.noteType} onChange={e => setForm({ ...form, noteType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {NOTE_TYPES.map(nt => <option key={nt} value={nt}>{nt.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Name</label>
              <input type="text" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Who was this with?" />
            </div>
          </div>
          <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3" placeholder="Write your note..." autoFocus />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !form.content.trim()}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">{saving ? t.common.saving : "Save Note"}</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">{t.common.cancel}</button>
          </div>
        </div>
      )}
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-8">{t.common.loading}</p>
      ) : notes.length === 0 && !showAdd ? (
        <p className="text-slate-400 text-sm text-center py-8">No notes for this factory yet. Add one above.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n: any) => (
            <div key={n.id} className="p-3 bg-slate-50 rounded-lg group">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeColors[n.noteType] || typeColors.NOTE}`}>{(n.noteType || "NOTE").replace("_", " ")}</span>
                  {n.contactName && <span className="text-xs text-slate-600 font-semibold">{n.contactName}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{n.date ? new Date(n.date).toLocaleDateString() : new Date(n.createdAt).toLocaleDateString()}</span>
                  <button onClick={() => handleDelete(n.id)} className="text-xs text-red-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">{t.common.delete}</button>
                </div>
              </div>
              <p className="text-sm text-slate-700">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
