"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

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
  const { t } = useI18n();
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
  const [tab, setTab] = useState<"details"|"contacts"|"products"|"fabrics"|"submissions"|"sows"|"notes"|"research">("details");
  const [research, setResearch] = useState<any>(null);
  const [researchDate, setResearchDate] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", productType: "", sku: "", description: "" });
  const [productSaving, setProductSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editProductForm, setEditProductForm] = useState<any>({});
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adminCode, setAdminCode] = useState("");

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

    // Load saved research
    fetch(`/api/brands/${id}/research`)
      .then(r => r.json())
      .then(j => {
        if (j.ok && j.research) {
          setResearch(j.research);
          setResearchDate(j.researchDate || null);
        }
      })
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

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/brands/${id}?code=${encodeURIComponent(adminCode)}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) {
        router.push("/brands");
      } else {
        setError(j.error || "Failed to delete brand");
        setShowDeleteConfirm(false);
      }
    } catch (e: any) {
      setError(e.message);
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await fetch(`/api/brands/${id}/products`);
      const j = await res.json();
      if (j.ok) setProducts(j.products);
    } catch {} finally { setProductsLoading(false); }
  };

  useEffect(() => {
    if (tab === "products" && products.length === 0) loadProducts();
  }, [tab]);

  const handleAddProduct = async () => {
    if (!productForm.name.trim()) return;
    setProductSaving(true);
    try {
      const res = await fetch(`/api/brands/${id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productForm),
      });
      const j = await res.json();
      if (j.ok) {
        setProducts(prev => [j.product, ...prev]);
        setProductForm({ name: "", productType: "", sku: "", description: "" });
        setShowAddProduct(false);
      } else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setProductSaving(false); }
  };

  const handleUpdateProduct = async (productId: string) => {
    setProductSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editProductForm),
      });
      const j = await res.json();
      if (j.ok) {
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...j.product } : p));
        setEditingProduct(null);
      } else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setProductSaving(false); }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) setProducts(prev => prev.filter(p => p.id !== productId));
      else setError(j.error);
    } catch (e: any) { setError(e.message); }
  };

  const handleResearch = async (autoSaveContacts = false) => {
    setResearching(true);
    setResearchError("");
    try {
      const res = await fetch(`/api/brands/${id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSaveContacts }),
      });
      const j = await res.json();
      if (j.ok) {
        setResearch(j.research);
        setResearchDate(new Date().toISOString());
        if (autoSaveContacts) {
          setSuccess("Research complete — contacts saved!");
          setTimeout(() => setSuccess(""), 4000);
        }
      } else {
        setResearchError(j.error || "Research failed");
      }
    } catch (e: any) {
      setResearchError(e.message);
    } finally {
      setResearching(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">{t.common.loading}</div>;
  if (!brand) return <div className="flex items-center justify-center h-64 text-red-400">{t.brands.notFound}</div>;

  const c = brand._count;

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push("/brands")} className="text-sm text-blue-600 hover:underline mb-1 block">&larr; {t.common.backToPipeline}</button>
          <h1 className="text-2xl font-black text-slate-900">{brand.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: stageColor(brand.pipelineStage) }}>
              {t.stages[brand.pipelineStage as keyof typeof t.stages] || brand.pipelineStage}
            </span>
            {brand.salesRep && <span className="text-sm text-slate-500">{t.brands.rep}: {brand.salesRep.name}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100">{t.common.delete}</button>
              <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">{t.brands.editBrand}</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300">{t.common.cancel}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {saving ? t.common.saving : t.common.save}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Stats row */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[[t.brandTabs.products, c.products, "📦"],[t.brandTabs.fabrics, c.fabrics, "🧵"],[t.brandTabs.submissions, c.submissions, "📋"],[t.brands.factories, c.factories, "🏭"],[t.brandTabs.contacts, c.contacts, "👤"],[t.brandTabs.sows, c.sows, "📄"]].map(([label, count, icon]) => (
          <div key={label as string} className="bg-white rounded-xl p-3 shadow-sm border text-center">
            <div className="text-lg">{icon}</div>
            <div className="text-xl font-black text-slate-900">{(count as number) || 0}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        {(["details","contacts","products","fabrics","submissions","sows","notes","research"] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === tabKey ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.brandTabs[tabKey as keyof typeof t.brandTabs]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "details" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.brands.brandName} field="name" form={form} setForm={setForm} editing={editing} required t={t} />
            <Field label={t.brands.pipelineStage} field="pipelineStage" form={form} setForm={setForm} editing={editing} type="select" options={STAGES.map(s => ({ value: s, label: t.stages[s as keyof typeof t.stages] || s }))} t={t} />
            <Field label={t.brands.customerType} field="customerType" form={form} setForm={setForm} editing={editing} t={t} />
            <Field label={t.brands.leadReferralSource} field="leadReferralSource" form={form} setForm={setForm} editing={editing} t={t} />
            <Field label={t.brands.salesRep} field="salesRepId" form={form} setForm={setForm} editing={editing} type="select" options={users.map(u => ({ value: u.id, label: u.name }))} t={t} />
            <Field label={t.brands.website} field="website" form={form} setForm={setForm} editing={editing} t={t} />
            <Field label={t.brands.linkedin} field="linkedInProfile" form={form} setForm={setForm} editing={editing} t={t} />
            <Field label={t.brands.dateInitialContact} field="dateOfInitialContact" form={form} setForm={setForm} editing={editing} type="date" t={t} />
            <Field label={t.brands.presentationDate} field="presentationDate" form={form} setForm={setForm} editing={editing} type="date" t={t} />
            <Field label={t.brands.projectType} field="projectType" form={form} setForm={setForm} editing={editing} t={t} />
            <div className="col-span-2">
              <Field label={t.brands.backgroundInfo} field="backgroundInfo" form={form} setForm={setForm} editing={editing} type="textarea" t={t} />
            </div>
            <div className="col-span-2">
              <Field label={t.brands.projectDescription} field="projectDescription" form={form} setForm={setForm} editing={editing} type="textarea" t={t} />
            </div>
            <Field label={t.brands.forecast} field="forecast" form={form} setForm={setForm} editing={editing} t={t} />
            <Field label={t.brands.deliverables} field="deliverables" form={form} setForm={setForm} editing={editing} t={t} />
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          {brand.contacts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">{t.contacts.noContacts}</p>
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

      {tab === "products" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900">{t.products.skus}</h3>
            <button onClick={() => setShowAddProduct(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">+ {t.products.addProduct}</button>
          </div>

          {/* Add product form */}
          {showAddProduct && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t.products.productName} <span className="text-red-500">*</span></label>
                  <input type="text" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Dri-FIT Running Tee" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t.products.productType}</label>
                  <input type="text" value={productForm.productType} onChange={e => setProductForm({ ...productForm, productType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Garment, Textile, Turf" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t.products.sku}</label>
                  <input type="text" value={productForm.sku} onChange={e => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. NK-DRF-2026" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t.products.description}</label>
                  <input type="text" value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Short description" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddProduct} disabled={productSaving || !productForm.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {productSaving ? t.common.saving : t.products.addProduct}
                </button>
                <button onClick={() => { setShowAddProduct(false); setProductForm({ name: "", productType: "", sku: "", description: "" }); }}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">{t.common.cancel}</button>
              </div>
            </div>
          )}

          {productsLoading ? (
            <p className="text-slate-400 text-sm text-center py-8">{t.common.loadingProducts}</p>
          ) : products.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">{t.products.noProducts}</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">{t.common.name}</th><th className="pb-2">{t.common.type}</th><th className="pb-2">{t.products.sku}</th><th className="pb-2">{t.products.description}</th><th className="pb-2">{t.brandTabs.sows}</th><th className="pb-2 w-20"></th>
              </tr></thead>
              <tbody>
                {products.map((p: any) => (
                  editingProduct === p.id ? (
                    <tr key={p.id} className="border-b border-slate-100 bg-blue-50">
                      <td className="py-2 pr-2"><input type="text" value={editProductForm.name || ""} onChange={e => setEditProductForm({ ...editProductForm, name: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                      <td className="py-2 pr-2"><input type="text" value={editProductForm.productType || ""} onChange={e => setEditProductForm({ ...editProductForm, productType: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                      <td className="py-2 pr-2"><input type="text" value={editProductForm.sku || ""} onChange={e => setEditProductForm({ ...editProductForm, sku: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                      <td className="py-2 pr-2"><input type="text" value={editProductForm.description || ""} onChange={e => setEditProductForm({ ...editProductForm, description: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                      <td className="py-2">{p.sows?.length || 0}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => handleUpdateProduct(p.id)} className="text-xs text-green-600 hover:underline mr-2">{productSaving ? "..." : t.common.save}</button>
                        <button onClick={() => setEditingProduct(null)} className="text-xs text-slate-500 hover:underline">{t.common.cancel}</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-2 text-slate-600">{p.productType || "—"}</td>
                      <td className="py-2 font-mono text-xs text-slate-700">{p.sku || "—"}</td>
                      <td className="py-2 text-slate-600">{p.description || "—"}</td>
                      <td className="py-2">{p.sows?.length || 0}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => { setEditingProduct(p.id); setEditProductForm({ name: p.name, productType: p.productType || "", sku: p.sku || "", description: p.description || "" }); }}
                          className="text-xs text-blue-600 hover:underline mr-2">{t.common.edit}</button>
                        <button onClick={() => { if (confirm(t.products.deleteConfirm)) handleDeleteProduct(p.id); }}
                          className="text-xs text-red-500 hover:underline">{t.common.delete}</button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "fabrics" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          {brand.fabrics.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">{t.common.noFabrics}</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">{t.common.fabricNumber}</th><th className="pb-2">{t.common.construction}</th><th className="pb-2">{t.common.color}</th><th className="pb-2">{t.fabrics.gsm}</th>
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
            <p className="text-slate-400 text-sm text-center py-8">{t.common.noSubmissions}</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">{t.common.fabricNumber}</th><th className="pb-2">{t.common.status}</th><th className="pb-2">{t.common.testStatus}</th><th className="pb-2">{t.common.date}</th>
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
            <h3 className="font-bold text-slate-900">{t.common.statementsOfWork}</h3>
            <button onClick={() => router.push(`/sow/new?brandId=${id}`)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">+ {t.common.newSow}</button>
          </div>
          {brand.sows.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">{t.common.noSows}</p>
          ) : (
            <div className="space-y-2">
              {brand.sows.map((s: any) => (
                <div key={s.id} onClick={() => router.push(`/sow/${s.id}`)} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-sm">{s.title || t.common.untitledSow}</div>
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
            <p className="text-slate-400 text-sm text-center py-8">{t.common.noNotes}</p>
          ) : (
            <div className="space-y-3">
              {brand.notes.map((n: any) => (
                <div key={n.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-600">{n.noteType || t.common.note} {n.contactName && `· ${n.contactName}`}</span>
                    <span className="text-xs text-slate-400">{n.date ? new Date(n.date).toLocaleDateString() : ""}</span>
                  </div>
                  <p className="text-sm text-slate-700">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "research" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-slate-900">{t.research.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{t.research.subtitle}</p>
                {researchDate && <p className="text-xs text-slate-400 mt-0.5">{t.research.lastResearched} {new Date(researchDate).toLocaleDateString()} at {new Date(researchDate).toLocaleTimeString()}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleResearch(false)} disabled={researching}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {researching ? t.research.researching : research ? t.research.rerunResearch : t.research.runResearch}
                </button>
                {research && !researching && (
                  <button onClick={() => handleResearch(true)} disabled={researching}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                    {t.research.saveContacts}
                  </button>
                )}
              </div>
            </div>
            {researchError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">{researchError}</div>}

            {researching && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3" />
                <p className="text-sm text-slate-500">{t.research.dualAiResearching}</p>
                <p className="text-xs text-slate-400 mt-1">Running Anthropic Claude + OpenAI GPT-4o in parallel (15-30 sec)</p>
              </div>
            )}

            {research && !researching && (
              <div className="space-y-6">
                {/* Company Overview */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">1</span>
                    {t.research.companyOverview}
                    {research._sources?.map((s: string) => (
                      <span key={s} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s === "Anthropic" ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}>{s}</span>
                    ))}
                    {research.confidence && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ml-auto ${research.confidence === "HIGH" ? "bg-green-100 text-green-700" : research.confidence === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {t.research[research.confidence.toLowerCase() as 'high' | 'medium' | 'low']} {t.research.confidence}
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {research.company?.name && <div><span className="text-slate-500">{t.common.name}:</span> <strong>{research.company.name}</strong></div>}
                    {research.company?.headquarters && <div><span className="text-slate-500">{t.research.headquarters}:</span> <strong>{research.company.headquarters}</strong></div>}
                    {research.company?.website && <div><span className="text-slate-500">{t.brands.website}:</span> <a href={research.company.website.startsWith("http") ? research.company.website : `https://${research.company.website}`} target="_blank" className="text-blue-600 hover:underline font-semibold">{research.company.website}</a></div>}
                    {research.company?.linkedin && <div><span className="text-slate-500">{t.brands.linkedin}:</span> <a href={research.company.linkedin} target="_blank" className="text-blue-600 hover:underline font-semibold">{t.common.profile}</a></div>}
                    {research.company?.employeeCount && <div><span className="text-slate-500">{t.research.employees}:</span> <strong>{research.company.employeeCount}</strong></div>}
                    {research.company?.revenue && <div><span className="text-slate-500">{t.research.revenue}:</span> <strong>{research.company.revenue}</strong></div>}
                    {research.company?.founded && <div><span className="text-slate-500">{t.research.founded}:</span> <strong>{research.company.founded}</strong></div>}
                    {research.company?.industry && <div><span className="text-slate-500">{t.research.industry}:</span> <strong>{research.company.industry}</strong></div>}
                  </div>
                  {research.company?.description && <p className="mt-2 text-sm text-slate-600">{research.company.description}</p>}
                </div>

                {/* Key Contacts */}
                {research.contacts?.length > 0 && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full text-xs font-bold">2</span>
                      {t.research.keyDecisionMakers} ({research.contacts.length})
                    </h4>
                    <div className="space-y-3">
                      {research.contacts.map((c: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm shrink-0">
                            {(c.name || "?")[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">{c.name}</span>
                              {c.priority && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">P{c.priority}</span>}
                            </div>
                            <div className="text-xs text-slate-600 font-semibold">{c.title}</div>
                            <div className="flex gap-3 mt-1 text-xs">
                              {c.email && (
                                <span className="flex items-center gap-1">
                                  <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">{c.email}</a>
                                  {c.emailConfidence && (
                                    <span className={`px-1 py-0 rounded text-[9px] font-bold ${c.emailConfidence === "verified" ? "bg-green-100 text-green-700" : c.emailConfidence === "likely" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{t.research[c.emailConfidence as 'verified' | 'likely' | 'estimated']}</span>
                                  )}
                                </span>
                              )}
                              {c.phone && <span className="text-slate-500">{c.phone}</span>}
                              {c.linkedin && <a href={c.linkedin} target="_blank" className="text-blue-600 hover:underline">{t.brands.linkedin}</a>}
                            </div>
                            {c.relevance && <p className="text-xs text-slate-500 mt-1 italic">{c.relevance}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Opportunity Analysis */}
                {research.opportunity && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">3</span>
                      {t.research.opportunityAnalysis}
                      {research.opportunity.fitScore && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ml-auto ${research.opportunity.fitScore >= 7 ? "bg-green-100 text-green-700" : research.opportunity.fitScore >= 4 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          Fit: {research.opportunity.fitScore}/10
                        </span>
                      )}
                      {research.opportunity.estimatedScale && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{research.opportunity.estimatedScale}</span>
                      )}
                    </h4>
                    {research.opportunity.fitReason && <p className="text-sm text-slate-700 mb-3">{research.opportunity.fitReason}</p>}
                    {research.opportunity.bestProductLines?.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs font-bold text-slate-600">{t.research.bestProductLines}: </span>
                        <span className="text-xs text-slate-700">{research.opportunity.bestProductLines.join(", ")}</span>
                      </div>
                    )}
                    {research.opportunity.currentAntimicrobial && (
                      <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        <strong>{t.research.currentAntimicrobial}:</strong> {research.opportunity.currentAntimicrobial}
                      </div>
                    )}
                    {research.opportunity.suggestedApproach && (
                      <div className="mb-3 p-3 bg-white border border-purple-200 rounded-lg">
                        <span className="text-xs font-bold text-purple-700 block mb-1">{t.research.suggestedApproach}</span>
                        <p className="text-sm text-slate-700">{research.opportunity.suggestedApproach}</p>
                      </div>
                    )}
                    {research.opportunity.openingMessage && (
                      <div className="p-3 bg-white border border-purple-200 rounded-lg">
                        <span className="text-xs font-bold text-purple-700 block mb-1">{t.research.draftOpeningMessage}</span>
                        <p className="text-sm text-slate-700 italic">&ldquo;{research.opportunity.openingMessage}&rdquo;</p>
                      </div>
                    )}
                    {research.opportunity.objections?.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs font-bold text-slate-600 block mb-2">{t.research.potentialObjections}</span>
                        <div className="space-y-2">
                          {research.opportunity.objections.map((obj: any, i: number) => (
                            <div key={i} className="text-xs">
                              <span className="text-red-600 font-semibold">{t.research.objection}: </span><span className="text-slate-700">{obj.objection}</span>
                              <br />
                              <span className="text-green-600 font-semibold">{t.research.counter}: </span><span className="text-slate-700">{obj.counter}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Products & Market */}
                {research.products && (
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">4</span>
                      {t.research.productMarketIntel}
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      {research.products.categories?.length > 0 && <div><span className="font-bold text-slate-600 block mb-1">{t.research.productCategories}</span>{research.products.categories.join(", ")}</div>}
                      {research.products.targetMarkets?.length > 0 && <div><span className="font-bold text-slate-600 block mb-1">{t.research.targetMarkets}</span>{research.products.targetMarkets.join(", ")}</div>}
                      {research.products.keyBrands?.length > 0 && <div><span className="font-bold text-slate-600 block mb-1">{t.research.keyBrandsLines}</span>{research.products.keyBrands.join(", ")}</div>}
                      {research.products.sustainability?.length > 0 && <div><span className="font-bold text-slate-600 block mb-1">{t.research.sustainability}</span>{research.products.sustainability.join(", ")}</div>}
                    </div>
                  </div>
                )}

                {/* News */}
                {research.news?.length > 0 && (
                  <div className="p-4 bg-sky-50 rounded-lg">
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-sky-100 text-sky-700 rounded-full text-xs font-bold">5</span>
                      {t.research.recentNewsTriggers}
                    </h4>
                    <div className="space-y-2">
                      {research.news.map((n: any, i: number) => (
                        <div key={i} className="text-sm">
                          <div className="flex items-center gap-2">
                            <strong className="text-slate-900">{n.headline}</strong>
                            {n.date && <span className="text-xs text-slate-400">{n.date}</span>}
                          </div>
                          {n.summary && <p className="text-xs text-slate-600 mt-0.5">{n.summary}</p>}
                          {n.relevance && <p className="text-xs text-sky-600 italic">{n.relevance}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Research Notes */}
                {research.researchNotes && (
                  <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600">
                    <strong>{t.research.researchNotes}:</strong> {research.researchNotes}
                  </div>
                )}
              </div>
            )}

            {!research && !researching && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-sm text-slate-600 font-semibold">{t.research.readyToResearch}</p>
                <p className="text-xs text-slate-400 mt-1">Fires Anthropic Claude + OpenAI GPT-4o in parallel, then merges the best intel from both</p>
                <p className="text-xs text-slate-400">Finds C-suite contacts, emails, company intel, competitive landscape, and draft outreach</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{t.brands.deleteBrand}</h3>
            <p className="text-sm text-slate-600 mb-1">
              {t.brands.deleteConfirm} <strong>{brand.name}</strong>?
            </p>
            <p className="text-xs text-slate-500 mb-4">
              {t.brands.deleteWarning}
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t.brands.adminCode}</label>
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && adminCode) handleDelete(); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder={t.brands.enterAdminCode}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setAdminCode(""); }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !adminCode}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t.common.deleting : t.brands.yesDelete}
              </button>
            </div>
          </div>
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

function Field({ label, field, form, setForm, editing, type = "text", options, required, t }: any) {
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
          <option value="">{t.common.select}</option>
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
