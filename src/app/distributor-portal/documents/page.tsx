"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DistDoc {
  id: string;
  docType: string;
  title: string;
  description?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  url?: string;
  shipmentRef?: string;
  batchNumber?: string;
  poNumber?: string;
  portOfOrigin?: string;
  portOfDest?: string;
  hsCode?: string;
  expiresAt?: string;
  createdAt: string;
  factory?: { id: string; name: string; country?: string };
}

const DOC_TYPE_LABELS: Record<string, string> = {
  CERTIFICATE_OF_ANALYSIS: "Certificate of Analysis",
  BILL_OF_LADING: "Bill of Lading",
  COMMERCIAL_INVOICE: "Commercial Invoice",
  PACKING_LIST: "Packing List",
  CUSTOMS_DECLARATION: "Customs Declaration",
  IMPORT_PERMIT: "Import Permit",
  EXPORT_PERMIT: "Export Permit",
  PHYTOSANITARY_CERT: "Phytosanitary Certificate",
  INSURANCE_CERT: "Insurance Certificate",
  SDS_MSDS: "Safety Data Sheet (SDS)",
  OTHER: "Other",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  CERTIFICATE_OF_ANALYSIS: "bg-emerald-100 text-emerald-800 border-emerald-200",
  BILL_OF_LADING: "bg-blue-100 text-blue-800 border-blue-200",
  COMMERCIAL_INVOICE: "bg-violet-100 text-violet-800 border-violet-200",
  PACKING_LIST: "bg-amber-100 text-amber-800 border-amber-200",
  CUSTOMS_DECLARATION: "bg-orange-100 text-orange-800 border-orange-200",
  IMPORT_PERMIT: "bg-teal-100 text-teal-800 border-teal-200",
  EXPORT_PERMIT: "bg-cyan-100 text-cyan-800 border-cyan-200",
  PHYTOSANITARY_CERT: "bg-lime-100 text-lime-800 border-lime-200",
  INSURANCE_CERT: "bg-indigo-100 text-indigo-800 border-indigo-200",
  SDS_MSDS: "bg-red-100 text-red-800 border-red-200",
  OTHER: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function DistributorDocumentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<DistDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("");

  useEffect(() => {
    if (user?.role !== "DISTRIBUTOR_USER") {
      router.push("/dashboard");
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (docTypeFilter) params.set("docType", docTypeFilter);
        const res = await fetch(`/api/distributor-portal/documents?${params.toString()}`);
        const data = await res.json();
        if (data.ok) setDocuments(data.documents);
        else setError(data.error);
      } catch {
        setError("Failed to load documents");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, router, search, docTypeFilter]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isExpired = (d?: string) => d && new Date(d) < new Date();

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/distributor-portal" className="hover:text-[#00b4c3]">Distributor Portal</Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Documents</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Document Library</h1>
        <p className="text-sm text-slate-500 mt-1">
          Certificates of Analysis, Bills of Lading, customs and import/export documentation
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title, batch, PO, tracking..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
          />
        </div>
        <select
          value={docTypeFilter}
          onChange={(e) => setDocTypeFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-w-[200px] focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
        >
          <option value="">All Document Types</option>
          {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">
            {search || docTypeFilter ? "No documents match your search" : "No documents uploaded yet"}
          </p>
          {(search || docTypeFilter) && (
            <button onClick={() => { setSearchInput(""); setSearch(""); setDocTypeFilter(""); }}
              className="text-[#00b4c3] hover:underline font-medium text-sm">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => (
            <div key={doc.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-[#00b4c3]/50 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${DOC_TYPE_COLORS[doc.docType] || DOC_TYPE_COLORS.OTHER}`}>
                      {DOC_TYPE_LABELS[doc.docType] || doc.docType}
                    </span>
                    {isExpired(doc.expiresAt) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
                        Expired
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">{doc.title}</h3>
                  {doc.description && <p className="text-sm text-slate-500 mb-2">{doc.description}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {doc.factory && (
                      <span>Factory: <span className="text-slate-700 font-medium">{doc.factory.name}</span>{doc.factory.country ? ` (${doc.factory.country})` : ""}</span>
                    )}
                    {doc.batchNumber && <span>Batch: <span className="text-slate-700 font-medium">{doc.batchNumber}</span></span>}
                    {doc.poNumber && <span>PO: <span className="text-slate-700 font-medium">{doc.poNumber}</span></span>}
                    {doc.shipmentRef && <span>Tracking: <span className="text-slate-700 font-medium">{doc.shipmentRef}</span></span>}
                    {doc.portOfOrigin && doc.portOfDest && (
                      <span>{doc.portOfOrigin} → {doc.portOfDest}</span>
                    )}
                    {doc.hsCode && <span>HS: <span className="text-slate-700 font-medium">{doc.hsCode}</span></span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs text-slate-400">{new Date(doc.createdAt).toLocaleDateString()}</span>
                  {doc.filename && (
                    <span className="text-xs text-slate-400">{doc.filename} {doc.sizeBytes ? `(${formatSize(doc.sizeBytes)})` : ""}</span>
                  )}
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#00b4c3] text-white rounded-lg text-xs font-semibold hover:bg-[#009ba8] transition-colors">
                      View / Download
                    </a>
                  )}
                  {doc.expiresAt && !isExpired(doc.expiresAt) && (
                    <span className="text-[10px] text-amber-600">Expires: {new Date(doc.expiresAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
