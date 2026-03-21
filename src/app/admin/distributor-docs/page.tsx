"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

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

const DOC_TYPES = [
  { value: "CERTIFICATE_OF_ANALYSIS", label: "Certificate of Analysis (C of A)" },
  { value: "BILL_OF_LADING", label: "Bill of Lading (BOL)" },
  { value: "COMMERCIAL_INVOICE", label: "Commercial Invoice" },
  { value: "PACKING_LIST", label: "Packing List" },
  { value: "CUSTOMS_DECLARATION", label: "Customs Declaration" },
  { value: "IMPORT_PERMIT", label: "Import Permit" },
  { value: "EXPORT_PERMIT", label: "Export Permit" },
  { value: "PHYTOSANITARY_CERT", label: "Phytosanitary Certificate" },
  { value: "INSURANCE_CERT", label: "Insurance Certificate" },
  { value: "SDS_MSDS", label: "Safety Data Sheet (SDS/MSDS)" },
  { value: "OTHER", label: "Other" },
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
      setError("Failed to load documents");
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
        setSuccess("Document created successfully");
        setShowForm(false);
        setForm({
          distributorId: "", docType: "CERTIFICATE_OF_ANALYSIS", title: "", description: "",
          url: "", factoryId: "", shipmentRef: "", batchNumber: "", poNumber: "",
          portOfOrigin: "", portOfDest: "", hsCode: "", expiresAt: "",
        });
        loadDocs();
      } else {
        setError(data.error || "Failed to create document");
      }
    } catch {
      setError("Failed to create document");
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
            <Link href="/dashboard" className="hover:text-[#00b4c3]">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Distributor Documents</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Distributor Document Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create, upload, and manage C of A, BOL, customs, and logistics documents for distributors
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all"
        >
          {showForm ? "Cancel" : "+ New Document"}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{success}</div>}

      {/* ── Create Form ── */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Create Document Entry</h2>
          <p className="text-sm text-slate-500 mb-4">
            Enter document details directly. This creates a database record the distributor can see.
            Attach a URL to an uploaded file, or leave blank to fill in details for printing/emailing.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Distributor + Doc Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Distributor *</label>
                <select value={form.distributorId} onChange={(e) => updateForm("distributorId", e.target.value)}
                  required className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">Select distributor...</option>
                  {distributors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}{d.country ? ` (${d.country})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Document Type *</label>
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
                <label className="block text-sm font-semibold text-slate-700 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={(e) => updateForm("title", e.target.value)}
                  required placeholder="e.g. Certificate of Analysis - Batch 2026-03"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Factory (optional)</label>
                <select value={form.factoryId} onChange={(e) => updateForm("factoryId", e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">No factory linked</option>
                  {factories.map(f => (
                    <option key={f.id} value={f.id}>{f.name}{f.country ? ` (${f.country})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)}
                rows={2} placeholder="Optional notes about this document"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            </div>

            {/* Row 3: File URL */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Document URL (optional)</label>
              <input type="url" value={form.url} onChange={(e) => updateForm("url", e.target.value)}
                placeholder="https://... (link to uploaded file in S3, Google Drive, etc.)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            </div>

            {/* Shipping / Logistics Section */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Shipping & Logistics Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tracking / Shipment Ref</label>
                  <input type="text" value={form.shipmentRef} onChange={(e) => updateForm("shipmentRef", e.target.value)}
                    placeholder="e.g. DHL 1234567890" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Batch Number</label>
                  <input type="text" value={form.batchNumber} onChange={(e) => updateForm("batchNumber", e.target.value)}
                    placeholder="e.g. B2026-03-001" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">PO Number</label>
                  <input type="text" value={form.poNumber} onChange={(e) => updateForm("poNumber", e.target.value)}
                    placeholder="e.g. PO-5678" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Port of Origin</label>
                  <input type="text" value={form.portOfOrigin} onChange={(e) => updateForm("portOfOrigin", e.target.value)}
                    placeholder="e.g. Shanghai" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Port of Destination</label>
                  <input type="text" value={form.portOfDest} onChange={(e) => updateForm("portOfDest", e.target.value)}
                    placeholder="e.g. Los Angeles" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">HS Code</label>
                  <input type="text" value={form.hsCode} onChange={(e) => updateForm("hsCode", e.target.value)}
                    placeholder="e.g. 3808.94" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            {/* Expiry */}
            <div className="max-w-xs">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Expiry Date (optional)</label>
              <input type="date" value={form.expiresAt} onChange={(e) => updateForm("expiresAt", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-semibold text-sm hover:shadow-lg disabled:opacity-50">
                {saving ? "Creating..." : "Create Document"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-2.5 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select value={filterDistributor} onChange={(e) => setFilterDistributor(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-w-[200px]">
          <option value="">All Distributors</option>
          {distributors.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select value={filterDocType} onChange={(e) => setFilterDocType(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-w-[200px]">
          <option value="">All Types</option>
          {DOC_TYPES.map(dt => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>
        <span className="text-sm text-slate-400 self-center">{documents.length} document{documents.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Document List ── */}
      {documents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">No documents yet</p>
          <button onClick={() => setShowForm(true)}
            className="text-[#00b4c3] hover:underline font-medium text-sm">
            Create the first document &rarr;
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden sm:table-cell">Distributor</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden md:table-cell">Factory</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden lg:table-cell">References</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 w-20">Actions</th>
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
                        className="text-xs text-[#00b4c3] hover:underline">View file &rarr;</a>
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
                      {doc.batchNumber && <div>Batch: {doc.batchNumber}</div>}
                      {doc.poNumber && <div>PO: {doc.poNumber}</div>}
                      {doc.shipmentRef && <div>Track: {doc.shipmentRef}</div>}
                      {doc.portOfOrigin && doc.portOfDest && <div>{doc.portOfOrigin} → {doc.portOfDest}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(doc.createdAt).toLocaleDateString()}
                    {doc.expiresAt && (
                      <div className={new Date(doc.expiresAt) < new Date() ? "text-red-500 font-semibold" : "text-amber-500"}>
                        Exp: {new Date(doc.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <a href={`/api/admin/distributor-docs/${doc.id}/pdf`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#00b4c3]/10 hover:bg-[#00b4c3]/20 text-[#009ba8] rounded-lg text-xs font-medium transition-colors"
                        title="Download PDF">
                        PDF
                      </a>
                      <a href={`/admin/distributor-docs/${doc.id}/print`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                        title="Print preview">
                        Print
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
