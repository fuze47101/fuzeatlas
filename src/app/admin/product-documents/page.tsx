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
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const INTERNAL_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "FABRIC_MANAGER", "TESTING_MANAGER"];
  const canEdit = !!user && ["ADMIN", "EMPLOYEE"].includes(user.role);

  useEffect(() => {
    if (user && !INTERNAL_ROLES.includes(user.role)) {
      router.push("/home");
      return;
    }
    load();
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

  async function save(docType: string) {
    const existing = docs.find((d) => d.docType === docType);
    const res = await fetch("/api/admin/product-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docType,
        title: form.title || existing?.title || DOC_TYPES.find((t) => t.key === docType)?.label,
        description: form.description ?? existing?.description,
        fileUrl: form.fileUrl ?? existing?.fileUrl,
        version: form.version ?? existing?.version,
        effectiveDate: form.effectiveDate ?? existing?.effectiveDate,
        // Phase 6D — library categorization fields.
        category: form.category ?? existing?.category,
        audience: form.audience ?? existing?.audience,
        productLine: form.productLine ?? existing?.productLine,
      }),
    });
    if ((await res.json()).ok) {
      setEditing(null);
      setForm({});
      load();
    }
  }

  // Phase 6D — categories + audiences + product lines.
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
  const PRODUCT_LINES = ["", "F1", "F2", "F3", "F4"];

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
        {DOC_TYPES.map((t) => {
          const doc = docs.find((d) => d.docType === t.key);
          const isEditing = editing === t.key;
          return (
            <div key={t.key} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-3xl">{t.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900">{t.label}</h3>
                    <p className="text-xs text-slate-500">{t.desc}</p>
                    {doc ? (
                      <div className="mt-2 text-sm">
                        <p className="text-slate-700">
                          <strong>{doc.title}</strong>
                          {doc.version && <span className="text-xs text-slate-500 ml-2">{doc.version}</span>}
                        </p>
                        {doc.description && <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[#00b4c3] font-semibold">{T.viewFile}</a>
                          <span>{T.uploadedByTpl.replace("{name}", doc.uploadedByName || T.unknownAuthor)}</span>
                          <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-600 mt-1">{T.noDocYet}</p>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setEditing(null);
                        setForm({});
                      } else {
                        setEditing(t.key);
                        setForm({
                          title: doc?.title || t.label,
                          description: doc?.description || "",
                          fileUrl: doc?.fileUrl || "",
                          version: doc?.version || "",
                          effectiveDate: doc?.effectiveDate ? new Date(doc.effectiveDate).toISOString().slice(0, 10) : "",
                          category: doc?.category || "tds_sds",
                          audience: doc?.audience || ["BRAND", "FACTORY", "DISTRIBUTOR", "LAB"],
                          productLine: doc?.productLine || "",
                        });
                      }
                    }}
                    className="flex-shrink-0 px-4 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg hover:bg-[#009aa8]"
                  >
                    {isEditing ? T.cancelBtn : doc ? T.updateBtn : T.uploadBtn}
                  </button>
                )}
              </div>

              {isEditing && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input type="text" placeholder={T.titlePlaceholder} value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    <input type="text" placeholder={T.versionPlaceholder} value={form.version || ""} onChange={(e) => setForm({ ...form, version: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <input type="url" placeholder={T.fileUrlPlaceholder} value={form.fileUrl || ""} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <input type="date" placeholder={T.effectiveDatePlaceholder} value={form.effectiveDate || ""} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <textarea placeholder={T.descriptionPlaceholder} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />

                  {/* Phase 6D — library categorization */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{T.categoryLabel}</label>
                      <select
                        value={form.category || "tds_sds"}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{T.productLineLabel}</label>
                      <select
                        value={form.productLine || ""}
                        onChange={(e) => setForm({ ...form, productLine: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        {PRODUCT_LINES.map((pl) => (
                          <option key={pl || "any"} value={pl}>
                            {pl ? T.productLineTpl.replace("{tier}", pl) : T.productLineAny}
                          </option>
                        ))}
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
                              const next = active
                                ? current.filter((x) => x !== aud)
                                : [...current, aud];
                              setForm({ ...form, audience: next });
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                              active
                                ? "bg-[#00b4c3] text-white"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {aud}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button onClick={() => save(t.key)} className="px-5 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg">{T.saveBtn}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
