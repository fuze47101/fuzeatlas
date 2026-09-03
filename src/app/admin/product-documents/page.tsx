// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

export default function ProductDocumentsPage() {
  const { t } = useI18n();
  const T = t.productDocumentsAdmin;
  const DOC_TYPES = [
    { key: "TDS", label: T.docTypeTDSLabel, icon: "📘", desc: T.docTypeTDSDesc },
    { key: "SDS", label: T.docTypeSDSLabel, icon: "📕", desc: T.docTypeSDSDesc },
    { key: "PRODUCT_SPEC", label: T.docTypeSpecLabel, icon: "📗", desc: T.docTypeSpecDesc },
    { key: "HANDLING_GUIDE", label: T.docTypeHandlingLabel, icon: "📙", desc: T.docTypeHandlingDesc },
    { key: "APPLICATION_GUIDE", label: T.docTypeApplicationLabel, icon: "📓", desc: T.docTypeApplicationDesc },
  ];
  const { user } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Which type's add/replace form is open + (for replace) the target doc id.
  const [formFor, setFormFor] = useState<{ docType: string; replaceId?: string } | null>(null);
  const [form, setForm] = useState<any>({});

  const INTERNAL_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "FABRIC_MANAGER", "TESTING_MANAGER"];
  const canEdit = !!user && ["ADMIN", "EMPLOYEE"].includes(user.role);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const CATEGORIES = [
    { value: "tds_sds", label: T.catTdsSds },
    { value: "toxicology", label: T.catToxicology },
    { value: "pricing", label: T.catPricing },
    { value: "sustainability", label: T.catSustainability },
    { value: "education", label: T.catEducation },
    { value: "claims_compliance", label: T.catClaimsCompliance },
    { value: "application_guide", label: T.catApplicationGuide },
    { value: "case_study", label: T.catCaseStudy },
  ];
  const AUDIENCES = ["BRAND", "FACTORY", "DISTRIBUTOR", "LAB", "PUBLIC"];

  const PRODUCT_LINE_OPTIONS = [
    { value: "F1_SILVER", label: T.plF1Silver },
    { value: "HELIOS_GOLD", label: T.plHeliosGold },
    { value: "COMBINED", label: T.plCombined },
    { value: "OTHER", label: T.plOther },
  ];
  const LANGUAGES = [
    { value: "EN", label: T.langEN },
    { value: "VI", label: T.langVI },
    { value: "ZH", label: T.langZH },
  ];

  function productLineLabel(v: string) {
    if (!v || v === "DEFAULT") return T.plDefaultLabel;
    const base = v.replace(/_\d+$/, ""); // strip auto-sequence suffix (_2, _3, …)
    const opt = PRODUCT_LINE_OPTIONS.find((o) => o.value === base);
    return opt ? opt.label : base.replace(/_/g, " ");
  }
  function languageLabel(v: string) {
    const opt = LANGUAGES.find((o) => o.value === v);
    return opt ? opt.label : v;
  }

  async function handleFileUpload(file: File, docType: string) {
    setUploadingFor(docType);
    setUploadProgress("Preparing upload...");
    try {
      const urlRes = await fetch("/api/admin/product-documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type || "application/pdf", docType }),
      });
      const urlData = await urlRes.json();
      if (!urlData.ok) throw new Error(urlData.error || "Failed to prepare upload");
      setUploadProgress(`Uploading ${file.name}...`);
      const s3Res = await fetch(urlData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!s3Res.ok) throw new Error("S3 upload failed");
      setForm((f: any) => ({ ...f, fileUrl: urlData.publicUrl }));
      setUploadProgress("Uploaded — click Save to record.");
      setTimeout(() => setUploadProgress(null), 2500);
    } catch (err: any) {
      setUploadProgress(`Upload failed: ${err.message}`);
      setTimeout(() => setUploadProgress(null), 4000);
    } finally {
      setUploadingFor(null);
    }
  }

  useEffect(() => {
    if (user && !INTERNAL_ROLES.includes(user.role)) {
      router.push("/home");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    try {
      const res = await fetch("/api/admin/product-documents");
      const d = await res.json();
      if (d.ok) setDocs(d.documents);
    } finally {
      setLoading(false);
    }
  }

  function openAdd(docType: string) {
    setForm({
      title: "",
      description: "",
      fileUrl: "",
      version: "",
      effectiveDate: "",
      category: "tds_sds",
      audience: ["BRAND", "FACTORY", "DISTRIBUTOR", "LAB"],
      productLine: "F1_SILVER",
      productLineOther: "",
      language: "EN",
    });
    setFormFor({ docType });
  }

  function openReplace(doc: any) {
    const known = PRODUCT_LINE_OPTIONS.some((o) => o.value === doc.productLine);
    setForm({
      title: doc.title || "",
      description: doc.description || "",
      fileUrl: doc.fileUrl || "",
      version: doc.version || "",
      effectiveDate: doc.effectiveDate ? new Date(doc.effectiveDate).toISOString().slice(0, 10) : "",
      category: doc.category || "tds_sds",
      audience: doc.audience || ["BRAND", "FACTORY", "DISTRIBUTOR", "LAB"],
      productLine: doc.productLine === "DEFAULT" ? "DEFAULT" : known ? doc.productLine : "OTHER",
      productLineOther: known || doc.productLine === "DEFAULT" ? "" : doc.productLine,
      language: doc.language || "EN",
    });
    setFormFor({ docType: doc.docType, replaceId: doc.id });
  }

  function closeForm() {
    setFormFor(null);
    setForm({});
    setUploadProgress(null);
  }

  async function save() {
    if (!formFor) return;
    const productLine =
      form.productLine === "OTHER" ? (form.productLineOther?.trim() || "OTHER") : form.productLine;
    const res = await fetch("/api/admin/product-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docType: formFor.docType,
        replaceId: formFor.replaceId ?? null,
        title: form.title,
        description: form.description,
        fileUrl: form.fileUrl,
        version: form.version,
        effectiveDate: form.effectiveDate || null,
        category: form.category,
        audience: form.audience,
        productLine,
        language: form.language,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      closeForm();
      load();
    } else {
      alert(d.error || "Save failed");
    }
  }

  async function remove(id: string) {
    if (!window.confirm(T.deleteConfirm)) return;
    const res = await fetch(`/api/admin/product-documents?id=${id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.ok) load();
    else alert(d.error || "Delete failed");
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900">{T.title}</h1>
        <p className="text-slate-600">{T.introPrefix}<a href="/admin/batches" className="text-[#00b4c3] font-semibold">{T.introLink}</a>{T.introSuffix}</p>
      </div>

      <div className="space-y-4">
        {DOC_TYPES.map((dt) => {
          const typeDocs = docs.filter((d) => d.docType === dt.key);
          const isFormOpen = formFor?.docType === dt.key;
          return (
            <div key={dt.key} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-3xl">{dt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900">{dt.label}</h3>
                    <p className="text-xs text-slate-500">{dt.desc}</p>

                    {/* Document list */}
                    {typeDocs.length === 0 ? (
                      <p className="text-sm text-amber-600 mt-2">{T.noDocYet}</p>
                    ) : (
                      <div className="mt-3 divide-y divide-slate-100 border border-slate-100 rounded-lg">
                        {typeDocs.map((doc) => (
                          <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 text-[10px] font-bold uppercase tracking-wider border border-cyan-200">{productLineLabel(doc.productLine)}</span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">{languageLabel(doc.language)}</span>
                                {doc.version && <span className="text-[11px] text-slate-500">{doc.version}</span>}
                              </div>
                              <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">{doc.title}</p>
                              {doc.description && <p className="text-xs text-slate-500 truncate">{doc.description}</p>}
                              <div className="flex flex-wrap gap-3 mt-0.5 text-[11px] text-slate-400">
                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[#00b4c3] font-semibold">{T.viewFile}</a>
                                <span>{T.uploadedByTpl.replace("{name}", doc.uploadedByName || T.unknownAuthor)}</span>
                                <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => openReplace(doc)} className="px-2.5 py-1 text-xs font-semibold text-[#00b4c3] border border-[#00b4c3]/40 rounded-lg hover:bg-cyan-50">{T.replaceBtn}</button>
                                <button onClick={() => remove(doc.id)} className="px-2.5 py-1 text-xs font-semibold text-red-500 border border-red-200 rounded-lg hover:bg-red-50">{T.deleteBtn}</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {canEdit && !isFormOpen && (
                  <button
                    onClick={() => openAdd(dt.key)}
                    className="flex-shrink-0 px-4 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg hover:bg-[#009aa8]"
                  >
                    {T.addDocument}
                  </button>
                )}
              </div>

              {/* Add / Replace form */}
              {isFormOpen && canEdit && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{T.plMultiLabel}</label>
                      <select
                        value={form.productLine || "F1_SILVER"}
                        onChange={(e) => setForm({ ...form, productLine: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        {PRODUCT_LINE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                        {form.productLine === "DEFAULT" && <option value="DEFAULT">{T.plDefaultLabel}</option>}
                      </select>
                      {form.productLine === "OTHER" && (
                        <input type="text" placeholder={T.plOtherPlaceholder} value={form.productLineOther || ""} onChange={(e) => setForm({ ...form, productLineOther: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{T.languageLabel}</label>
                      <select
                        value={form.language || "EN"}
                        onChange={(e) => setForm({ ...form, language: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        {LANGUAGES.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input type="text" placeholder={T.titlePlaceholder} value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    <input type="text" placeholder={T.versionPlaceholder} value={form.version || ""} onChange={(e) => setForm({ ...form, version: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Upload PDF (or paste URL below)</label>
                    <div
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files?.[0]; if (file) handleFileUpload(file, dt.key); }}
                      className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-[#00b4c3] hover:bg-cyan-50/30 transition-colors cursor-pointer"
                      onClick={() => {
                        const input = window.document.createElement("input");
                        input.type = "file";
                        input.accept = "application/pdf,.pdf,.doc,.docx,.xls,.xlsx";
                        input.onchange = (ev: any) => { const file = ev.target.files?.[0]; if (file) handleFileUpload(file, dt.key); };
                        input.click();
                      }}
                    >
                      {uploadingFor === dt.key && uploadProgress ? (
                        <p className="text-xs text-slate-700 font-semibold">{uploadProgress}</p>
                      ) : form.fileUrl ? (
                        <p className="text-xs text-emerald-600 font-semibold">✓ File attached — click Save to record (or drop a new one to replace)</p>
                      ) : (
                        <p className="text-xs text-slate-500">Drop a PDF here or click to choose · PDF / DOCX / XLSX</p>
                      )}
                    </div>
                  </div>

                  <input type="url" placeholder={T.fileUrlPlaceholder} value={form.fileUrl || ""} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <input type="date" placeholder={T.effectiveDatePlaceholder} value={form.effectiveDate || ""} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <textarea placeholder={T.descriptionPlaceholder} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{T.categoryLabel}</label>
                      <select value={form.category || "tds_sds"} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                        {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{T.audienceLabel}</label>
                    <div className="flex flex-wrap gap-2">
                      {AUDIENCES.map((aud) => {
                        const active = (form.audience || []).includes(aud);
                        return (
                          <button
                            key={aud}
                            type="button"
                            onClick={() => {
                              const current: string[] = form.audience || [];
                              const next = active ? current.filter((x) => x !== aud) : [...current, aud];
                              setForm({ ...form, audience: next });
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${active ? "bg-[#00b4c3] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                          >
                            {aud}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={save} disabled={!form.title || !form.fileUrl} className="px-5 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg disabled:opacity-50">{T.saveBtn}</button>
                    <button onClick={closeForm} className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">{T.cancelBtn}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
