"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

interface Distributor { id: string; name: string; country?: string; }
interface Factory { id: string; name: string; country?: string; }
interface DistDoc {
  id: string;
  docType: string;
  title: string;
  description?: string;
  filename?: string;
  url?: string;
  shipmentRef?: string;
  batchNumber?: string;
  poNumber?: string;
  portOfOrigin?: string;
  portOfDest?: string;
  hsCode?: string;
  expiresAt?: string;
  createdAt: string;
  distributor?: Distributor;
  factory?: Factory;
}

const DOC_TYPES_KEYS: Array<{ value: string; labelKey: string }> = [
  { value: "CERTIFICATE_OF_ANALYSIS", labelKey: "docTypeCoA" },
  { value: "BILL_OF_LADING", labelKey: "docTypeBol" },
  { value: "COMMERCIAL_INVOICE", labelKey: "docTypeInvoice" },
  { value: "PACKING_LIST", labelKey: "docTypePackingList" },
  { value: "CUSTOMS_DECLARATION", labelKey: "docTypeCustoms" },
  { value: "IMPORT_PERMIT", labelKey: "docTypeImportPermit" },
  { value: "EXPORT_PERMIT", labelKey: "docTypeExportPermit" },
  { value: "PHYTOSANITARY_CERT", labelKey: "docTypePhytosanitary" },
  { value: "INSURANCE_CERT", labelKey: "docTypeInsurance" },
  { value: "SDS_MSDS", labelKey: "docTypeSds" },
  { value: "OTHER", labelKey: "docTypeOther" },
];

const DOC_TYPE_COLORS: Record<string, string> = {
  CERTIFICATE_OF_ANALYSIS: "bg-emerald-100 text-emerald-800",
  BILL_OF_LADING: "bg-blue-100 text-blue-800",
  COMMERCIAL_INVOICE: "bg-violet-100 text-violet-800",
  PACKING_LIST: "bg-amber-100 text-amber-800",
  CUSTOMS_DECLARATION: "bg-orange-100 text-orange-800",
  IMPORT_PERMIT: "bg-teal-100 text-teal-800",
  EXPORT_PERMIT: "bg-cyan-100 text-cyan-800",
  SDS_MSDS: "bg-red-100 text-red-800",
  OTHER: "bg-slate-100 text-slate-700",
};

export default function AdminDistributorDocsPage() {
  const { t } = useI18n();
  const T = t.distributorDocsAdmin;
  const DOC_TYPES = DOC_TYPES_KEYS.map(d => ({ value: d.value, label: (T as any)[d.labelKey] }));
  const { user } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<DistDoc[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter state
  const [filterDistributor, setFilterDistributor] = useState("");
  const [filterDocType, setFilterDocType] = useState("");

  // Form state
  const [form, setForm] = useState({
    distributorId: "", docType: "CERTIFICATE_OF_ANALYSIS", title: "", description: "",
    url: "", factoryId: "", shipmentRef: "", batchNumber: "", poNumber: "",
    portOfOrigin: "", portOfDest: "", hsCode: "", expiresAt: "",
  });

  const loadDocs = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDistributor) params.set("distributorId", filterDistributor);
      if (filterDocType) params.set("docType", filterDocType);
      const res = await fetch(`/api/admin/distributor-docs?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setDocuments(data.documents);
        if (data.distributors) setDistributors(data.distributors);
        if (data.factories) setFactories(data.factories);
      }
    } catch {
      setError(T.errorFailedLoad);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const role = user?.role;
    if (role !== "ADMIN" && role !== "EMPLOYEE") {
      router.push("/dashboard");
      return;
    }
    loadDocs();
  }, [user, router, filterDistributor, filterDocType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/distributor-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          factoryId: form.factoryId || undefined,
          expiresAt: form.expiresAt || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(T.successMsg);
        setShowForm(false);
        setForm({
          distributorId: "", docType: "CERTIFICATE_OF_ANALYSIS", title: "", description: "",
          url: "", factoryId: "", shipmentRef: "", batchNumber: "", poNumber: "",
          portOfOrigin: "", portOfDest: "", hsCode: "", expiresAt: "",
        });
        loadDocs();
      } else {
        setError(data.error || T.errorFailedCreate);
      }
    } catch {
      setError(T.errorFailedCreate);
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard" className="hover:text-[#00b4c3]">{T.crumbDashboard}</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">{T.crumbHere}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">{T.pageTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {T.pageSubtitle}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all"
        >
          {showForm ? T.btnCancel : T.btnNewDocument}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{success}</div>}

      {/* ── Create Form ── */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">{T.formHeading}</h2>
          <p className="text-sm text-slate-500 mb-4">
            {T.formHelp}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Distributor + Doc Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{T.labelDistributor}</label>
                <select value={form.distributorId} onChange={(e) => updateForm("distributorId", e.target.value)}
                  required className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">{T.placeholderDistributor}</option>
                  {distributors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}{d.country ? ` (${d.country})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{T.labelDocType}</label>
                <select value={form.docType} onChange={(e) => updateForm("docType", e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white">
                  {DOC_TYPES.map(dt => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Title + Factory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{T.labelTitle}</label>
                <input type="text" value={form.title} onChange={(e) => updateForm("title", e.target.value)}
                  required placeholder={T.placeholderTitle}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{T.labelFactory}</label>
                <select value={form.factoryId} onChange={(e) => updateForm("factoryId", e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">{T.placeholderFactoryNone}</option>
                  {factories.map(f => (
                    <option key={f.id} value={f.id}>{f.name}{f.country ? ` (${f.country})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{T.labelDescription}</label>
              <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)}
                rows={2} placeholder={T.placeholderDescription}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            </div>

            {/* Row 3: File URL */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{T.labelUrl}</label>
              <input type="url" value={form.url} onChange={(e) => updateForm("url", e.target.value)}
                placeholder={T.placeholderUrl}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            </div>

            {/* Shipping / Logistics Section */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">{T.sectionShipping}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{T.labelShipmentRef}</label>
                  <input type="text" value={form.shipmentRef} onChange={(e) => updateForm("shipmentRef", e.target.value)}
                    placeholder={T.placeholderShipmentRef} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{T.labelBatch}</label>
                  <input type="text" value={form.batchNumber} onChange={(e) => updateForm("batchNumber", e.target.value)}
                    placeholder={T.placeholderBatch} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{T.labelPo}</label>
                  <input type="text" value={form.poNumber} onChange={(e) => updateForm("poNumber", e.target.value)}
                    placeholder={T.placeholderPo} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{T.labelPortOrigin}</label>
                  <input type="text" value={form.portOfOrigin} onChange={(e) => updateForm("portOfOrigin", e.target.value)}
                    placeholder={T.placeholderPortOrigin} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{T.labelPortDest}</label>
                  <input type="text" value={form.portOfDest} onChange={(e) => updateForm("portOfDest", e.target.value)}
                    placeholder={T.placeholderPortDest} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{T.labelHsCode}</label>
                  <input type="text" value={form.hsCode} onChange={(e) => updateForm("hsCode", e.target.value)}
                    placeholder={T.placeholderHsCode} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            {/* Expiry */}
            <div className="max-w-xs">
              <label className="block text-sm font-semibold text-slate-700 mb-1">{T.labelExpiry}</label>
              <input type="date" value={form.expiresAt} onChange={(e) => updateForm("expiresAt", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-semibold text-sm hover:shadow-lg disabled:opacity-50">
                {saving ? T.btnCreating : T.btnCreate}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-2.5 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                {T.btnCancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select value={filterDistributor} onChange={(e) => setFilterDistributor(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-w-[200px]">
          <option value="">{T.filterAllDistributors}</option>
          {distributors.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select value={filterDocType} onChange={(e) => setFilterDocType(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-w-[200px]">
          <option value="">{T.filterAllTypes}</option>
          {DOC_TYPES.map(dt => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>
        <span className="text-sm text-slate-400 self-center">{documents.length} {documents.length !== 1 ? T.countDocuments : T.countDocument}</span>
      </div>

      {/* ── Document List ── */}
      {documents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">{T.emptyTitle}</p>
          <button onClick={() => setShowForm(true)}
            className="text-[#00b4c3] hover:underline font-medium text-sm">
            {T.emptyCreateFirst}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">{T.colType}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">{T.colTitle}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden sm:table-cell">{T.colDistributor}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden md:table-cell">{T.colFactory}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden lg:table-cell">{T.colReferences}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">{T.colDate}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 w-20">{T.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map(doc => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${DOC_TYPE_COLORS[doc.docType] || "bg-slate-100 text-slate-600"}`}>
                      {DOC_TYPES.find(d => d.value === doc.docType)?.label?.split(" (")[0] || doc.docType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{doc.title}</div>
                    {doc.description && <div className="text-xs text-slate-400 truncate max-w-[250px]">{doc.description}</div>}
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#00b4c3] hover:underline">{T.viewFile}</a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                    {doc.distributor?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                    {doc.factory?.name || "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="text-xs text-slate-500 space-y-0.5">
                      {doc.batchNumber && <div>{T.refBatch} {doc.batchNumber}</div>}
                      {doc.poNumber && <div>{T.refPo} {doc.poNumber}</div>}
                      {doc.shipmentRef && <div>{T.refTrack} {doc.shipmentRef}</div>}
                      {doc.portOfOrigin && doc.portOfDest && <div>{doc.portOfOrigin} → {doc.portOfDest}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(doc.createdAt).toLocaleDateString()}
                    {doc.expiresAt && (
                      <div className={new Date(doc.expiresAt) < new Date() ? "text-red-500 font-semibold" : "text-amber-500"}>
                        {T.expPrefix} {new Date(doc.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <a href={`/api/admin/distributor-docs/${doc.id}/pdf`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#00b4c3]/10 hover:bg-[#00b4c3]/20 text-[#009ba8] rounded-lg text-xs font-medium transition-colors"
                        title={T.titleDownloadPdf}>
                        {T.actionPdf}
                      </a>
                      <a href={`/admin/distributor-docs/${doc.id}/print`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                        title={T.titlePrintPreview}>
                        {T.actionPrint}
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
