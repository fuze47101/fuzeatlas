"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface ComplianceDoc {
  id: string;
  title: string;
  description: string | null;
  category: string;
  version: string | null;
  filename: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  url: string | null;
  s3Key: string | null;
  downloadUrl: string | null;
  visibleTo: string[];
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

/* ── BUILT-IN CATEGORIES (expandable — admins can add custom) ── */
const BUILT_IN_CATEGORIES: { id: string; label: string; icon: string; color: string; desc: string }[] = [
  { id: "SDS_MSDS", label: "SDS / MSDS", icon: "\u{1F9EA}", color: "bg-red-50 text-red-700 border-red-200", desc: "Safety Data Sheets & Material Safety Data Sheets" },
  { id: "TDS", label: "TDS", icon: "\u{1F4C4}", color: "bg-blue-50 text-blue-700 border-blue-200", desc: "Technical Data Sheets" },
  { id: "BLUESIGN", label: "Bluesign", icon: "\u{1F535}", color: "bg-sky-50 text-sky-700 border-sky-200", desc: "Bluesign\u{00AE} System Partner Certificates" },
  { id: "ZDHC", label: "ZDHC 3.1", icon: "\u{1F3C5}", color: "bg-emerald-50 text-emerald-700 border-emerald-200", desc: "ZDHC MRSL Conformance Level 3.1" },
  { id: "OEKO_TEX", label: "Oeko-Tex", icon: "\u{1F33F}", color: "bg-green-50 text-green-700 border-green-200", desc: "Oeko-Tex\u{00AE} Standard 100 & ECO PASSPORT Declarations" },
  { id: "GOTS", label: "GOTS", icon: "\u{1F331}", color: "bg-lime-50 text-lime-700 border-lime-200", desc: "Global Organic Textile Standard Declarations" },
  { id: "EPA", label: "EPA", icon: "\u{1F3DB}\uFE0F", color: "bg-teal-50 text-teal-700 border-teal-200", desc: "EPA Registrations & Compliance Documents" },
  { id: "REACH", label: "REACH", icon: "\u{1F30D}", color: "bg-indigo-50 text-indigo-700 border-indigo-200", desc: "EU REACH Registration & SVHC Compliance" },
  { id: "COA", label: "CoA", icon: "\u{1F52C}", color: "bg-violet-50 text-violet-700 border-violet-200", desc: "Certificates of Analysis" },
  { id: "COC", label: "CoC", icon: "\u{2705}", color: "bg-amber-50 text-amber-700 border-amber-200", desc: "Certificates of Conformity / Compliance" },
  { id: "ISO", label: "ISO", icon: "\u{1F4CB}", color: "bg-cyan-50 text-cyan-700 border-cyan-200", desc: "ISO Certifications (9001, 14001, etc.)" },
  { id: "IMPORT_EXPORT", label: "Import / Export", icon: "\u{1F6A2}", color: "bg-orange-50 text-orange-700 border-orange-200", desc: "Import/Export Declarations, HTS, Customs Documents" },
  { id: "OTHER", label: "Other", icon: "\u{1F4C1}", color: "bg-slate-50 text-slate-700 border-slate-200", desc: "Additional compliance & certification documents" },
];

const ALL_ROLES = [
  { id: "ADMIN", label: "Admin" },
  { id: "EMPLOYEE", label: "Employee" },
  { id: "SALES_MANAGER", label: "Sales Manager" },
  { id: "SALES_REP", label: "Sales Rep" },
  { id: "FABRIC_MANAGER", label: "Fabric Manager" },
  { id: "TESTING_MANAGER", label: "Testing Manager" },
  { id: "FACTORY_MANAGER", label: "Factory Manager" },
  { id: "FACTORY_USER", label: "Factory" },
  { id: "BRAND_USER", label: "Brand" },
  { id: "DISTRIBUTOR_USER", label: "Distributor" },
];

function getCategoryMeta(catId: string) {
  return BUILT_IN_CATEGORIES.find((c) => c.id === catId) || {
    id: catId,
    label: catId.replace(/_/g, " "),
    icon: "\u{1F3F7}\uFE0F",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    desc: `Custom category: ${catId.replace(/_/g, " ")}`,
  };
}

export default function ComplianceLibraryPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [docs, setDocs] = useState<ComplianceDoc[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<ComplianceDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pageDragOver, setPageDragOver] = useState(false);

  const isAdmin = user?.role === "ADMIN" || user?.role === "EMPLOYEE";
  const canDelete = user?.role === "ADMIN";

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "SDS_MSDS",
    customCategory: "",
    version: "",
    url: "",
    visibleTo: ["ADMIN", "EMPLOYEE", "BRAND_USER", "FACTORY_USER", "FACTORY_MANAGER"] as string[],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Merge built-in categories with any custom ones from data
  const allCategories = (() => {
    const builtInIds = new Set(BUILT_IN_CATEGORIES.map((c) => c.id));
    const customIds = Object.keys(categoryCounts).filter((id) => !builtInIds.has(id));
    return [
      ...BUILT_IN_CATEGORIES,
      ...customIds.map((id) => getCategoryMeta(id)),
    ];
  })();

  const load = () => {
    const qs = activeCategory ? `?category=${activeCategory}` : "";
    fetch(`/api/compliance-docs${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setDocs(d.documents || []);
          if (!activeCategory) setCategoryCounts(d.categories || {});
        }
      })
      .catch(() => toast.error("Failed to load documents"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [activeCategory]);

  // Load all category counts on mount
  useEffect(() => {
    fetch("/api/compliance-docs")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCategoryCounts(d.categories || {});
      })
      .catch(() => {});
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      toast.error("File too large. Maximum 500MB.");
      return;
    }
    setSelectedFile(file);
    if (!form.title) {
      setForm((f) => ({ ...f, title: file.name.replace(/\.[^/.]+$/, "") }));
    }
  };

  const processDroppedFile = (file: File) => {
    if (file.size > 500 * 1024 * 1024) {
      toast.error("File too large. Maximum 500MB.");
      return;
    }
    setSelectedFile(file);
    if (!form.title) {
      setForm((f) => ({ ...f, title: file.name.replace(/\.[^/.]+$/, "") }));
    }
    // If modal not open, open it
    if (!showUpload && !editingDoc) {
      setShowUpload(true);
    }
  };

  // Page-level drag-and-drop handlers (drop anywhere to open upload)
  const handlePageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAdmin) return;
    setPageDragOver(true);
  };

  const handlePageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if leaving the container entirely
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setPageDragOver(false);
    }
  };

  const handlePageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPageDragOver(false);
    if (!isAdmin) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      resetForm();
      processDroppedFile(file);
    }
  };

  // Modal drop zone handlers
  const handleDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDropZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processDroppedFile(file);
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      category: "SDS_MSDS",
      customCategory: "",
      version: "",
      url: "",
      visibleTo: ["ADMIN", "EMPLOYEE", "BRAND_USER", "FACTORY_USER", "FACTORY_MANAGER"],
    });
    setSelectedFile(null);
    setUploadProgress(null);
  };

  const handleUpload = async () => {
    if (!form.title) return;
    setSaving(true);
    setUploadProgress(null);

    try {
      const effectiveCategory = form.category === "__CUSTOM__"
        ? (form.customCategory.trim().toUpperCase().replace(/[\s-]+/g, "_") || "OTHER")
        : form.category;

      let s3Key: string | null = null;

      // If a file is selected, upload directly to S3 via presigned URL
      if (selectedFile) {
        setUploadProgress("Preparing upload...");

        // Step 1: Get presigned upload URL from our API
        const urlRes = await fetch("/api/compliance-docs/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: selectedFile.name,
            contentType: selectedFile.type || "application/octet-stream",
          }),
        });
        const urlData = await urlRes.json();

        if (!urlData.ok) {
          throw new Error(urlData.error || "Failed to prepare upload");
        }

        // Step 2: Upload file directly to S3 (bypasses Vercel size limits)
        setUploadProgress(`Uploading ${formatFileSize(selectedFile.size)}...`);
        const s3Res = await fetch(urlData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
          body: selectedFile,
        });

        if (!s3Res.ok) {
          throw new Error("Upload to storage failed — please try again");
        }

        s3Key = urlData.s3Key;
        setUploadProgress("Saving record...");
      }

      // Step 3: Create the compliance document record
      const payload: any = {
        title: form.title,
        description: form.description || null,
        category: effectiveCategory,
        version: form.version || null,
        visibleTo: form.visibleTo,
        url: form.url || null,
      };

      if (s3Key) {
        payload.s3Key = s3Key;
        payload.filename = selectedFile!.name;
        payload.contentType = selectedFile!.type || "application/octet-stream";
        payload.sizeBytes = selectedFile!.size;
      }

      const res = await fetch("/api/compliance-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();

      if (d.ok) {
        toast.success("Document uploaded");
        setShowUpload(false);
        resetForm();
        load();
        // Refresh counts
        fetch("/api/compliance-docs")
          .then((r) => r.json())
          .then((d) => { if (d.ok) setCategoryCounts(d.categories || {}); });
      } else {
        toast.error(d.error || "Upload failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const startEdit = (doc: ComplianceDoc) => {
    const isCustom = !BUILT_IN_CATEGORIES.some((c) => c.id === doc.category);
    setForm({
      title: doc.title,
      description: doc.description || "",
      category: isCustom ? "__CUSTOM__" : doc.category,
      customCategory: isCustom ? doc.category : "",
      version: doc.version || "",
      url: doc.url || "",
      visibleTo: Array.isArray(doc.visibleTo) ? doc.visibleTo : ["ADMIN", "EMPLOYEE"],
    });
    setEditingDoc(doc);
  };

  const saveEdit = async () => {
    if (!editingDoc) return;
    setSaving(true);
    try {
      const effectiveCategory = form.category === "__CUSTOM__"
        ? (form.customCategory.trim().toUpperCase().replace(/[\s-]+/g, "_") || "OTHER")
        : form.category;

      const res = await fetch(`/api/compliance-docs/${editingDoc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          category: effectiveCategory,
          version: form.version || null,
          url: form.url || null,
          visibleTo: form.visibleTo,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success("Document updated");
        setEditingDoc(null);
        resetForm();
        load();
        // Refresh counts for new custom categories
        fetch("/api/compliance-docs")
          .then((r) => r.json())
          .then((d) => { if (d.ok) setCategoryCounts(d.categories || {}); });
      } else {
        toast.error(d.error || "Update failed");
      }
    } catch {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteDoc = async (id: string) => {
    try {
      const res = await fetch(`/api/compliance-docs/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (d.ok) {
        toast.success("Document deleted");
        load();
        fetch("/api/compliance-docs")
          .then((r) => r.json())
          .then((d) => { if (d.ok) setCategoryCounts(d.categories || {}); });
      } else {
        toast.error(d.error || "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  const downloadDoc = (doc: ComplianceDoc) => {
    if (doc.downloadUrl) {
      window.open(doc.downloadUrl, "_blank");
    } else if (doc.url) {
      window.open(doc.url, "_blank");
    }
  };

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      visibleTo: f.visibleTo.includes(role)
        ? f.visibleTo.filter((r) => r !== role)
        : [...f.visibleTo, role],
    }));
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalDocs = Object.values(categoryCounts).reduce((s, n) => s + n, 0);

  // How many category cards to show in the grid
  const visibleCatCount = allCategories.length;

  return (
    <div
      className="p-4 sm:p-8 max-w-6xl mx-auto relative"
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {/* Page-level drop overlay */}
      {pageDragOver && !showUpload && !editingDoc && isAdmin && (
        <div className="fixed inset-0 z-[90] bg-[#00b4c3]/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl px-12 py-10 border-2 border-dashed border-[#00b4c3] text-center">
            <p className="text-4xl mb-3">{"\u{1F4E4}"}</p>
            <p className="text-lg font-semibold text-slate-800">Drop file to upload</p>
            <p className="text-sm text-slate-500 mt-1">Release to add a document</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Document Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Compliance, certifications & shipping documents — {totalDocs} document{totalDocs !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowUpload(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa] font-medium text-sm"
          >
            + Upload Document
          </button>
        )}
      </div>

      {/* Category Cards */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6`}>
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-xl border p-3 text-left transition-all ${
            activeCategory === null
              ? "bg-[#00b4c3]/10 border-[#00b4c3] ring-1 ring-[#00b4c3]/20"
              : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
          }`}
        >
          <span className="text-lg">{"\u{1F4DA}"}</span>
          <p className="text-xs font-semibold text-slate-800 mt-1">All</p>
          <p className="text-lg font-bold text-slate-900">{totalDocs}</p>
        </button>
        {allCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className={`rounded-xl border p-3 text-left transition-all ${
              activeCategory === cat.id
                ? "bg-[#00b4c3]/10 border-[#00b4c3] ring-1 ring-[#00b4c3]/20"
                : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <span className="text-lg">{cat.icon}</span>
            <p className="text-xs font-semibold text-slate-800 mt-1 leading-tight">{cat.label}</p>
            <p className="text-lg font-bold text-slate-900">{categoryCounts[cat.id] || 0}</p>
          </button>
        ))}
      </div>

      {/* Active Category Description */}
      {activeCategory && (
        <div className="mb-4 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-600">
            {getCategoryMeta(activeCategory).desc}
          </p>
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">{"\u{1F4CB}"}</p>
          <p>{activeCategory ? "No documents in this category." : "No compliance documents uploaded yet."}</p>
          {isAdmin && <p className="text-sm mt-1">Click &ldquo;Upload Document&rdquo; to get started.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs text-slate-400 uppercase">
                  <th className="py-2.5 px-4">Document</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Version</th>
                  <th className="py-2.5 px-4">Size</th>
                  <th className="py-2.5 px-4">Uploaded</th>
                  <th className="py-2.5 px-4">Visibility</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const cat = getCategoryMeta(doc.category);
                  return (
                    <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{cat.icon}</span>
                          <div>
                            <p className="font-medium text-slate-800">{doc.title}</p>
                            {doc.description && (
                              <p className="text-xs text-slate-500 line-clamp-1">{doc.description}</p>
                            )}
                            {doc.filename && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{doc.filename}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cat.color}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{doc.version || "\u2014"}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{formatFileSize(doc.sizeBytes)}</td>
                      <td className="py-3 px-4">
                        <p className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                        {doc.uploadedBy && (
                          <p className="text-[10px] text-slate-400">{doc.uploadedBy.name}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {(doc.visibleTo as string[]).slice(0, 3).map((role) => (
                            <span key={role} className="px-1.5 py-0.5 bg-slate-100 text-[9px] font-medium text-slate-500 rounded">
                              {role.replace(/_/g, " ")}
                            </span>
                          ))}
                          {(doc.visibleTo as string[]).length > 3 && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-[9px] font-medium text-slate-500 rounded">
                              +{(doc.visibleTo as string[]).length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {(doc.downloadUrl || doc.url) && (
                            <button
                              onClick={() => downloadDoc(doc)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Download
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => startEdit(doc)}
                              className="text-xs text-[#00b4c3] hover:text-[#009aaa] font-medium"
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirm(doc.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload / Edit Modal */}
      {(showUpload || editingDoc) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowUpload(false); setEditingDoc(null); resetForm(); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-900">
                {editingDoc ? "Edit Document" : "Upload Document"}
              </h2>
              <button onClick={() => { setShowUpload(false); setEditingDoc(null); resetForm(); }} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* File upload with drag-and-drop (only for new) */}
              {!editingDoc && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
                  <div
                    onDragOver={handleDropZoneDragOver}
                    onDragLeave={handleDropZoneDragLeave}
                    onDrop={handleDropZoneDrop}
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                      isDragging
                        ? "border-[#00b4c3] bg-[#00b4c3]/5 scale-[1.01]"
                        : "border-slate-300 hover:border-[#00b4c3]"
                    }`}
                  >
                    {selectedFile ? (
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-800">{selectedFile.name}</p>
                          <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                        </div>
                        <button onClick={() => setSelectedFile(null)} className="text-red-500 text-sm hover:text-red-700">Remove</button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <p className="text-2xl mb-2">{isDragging ? "\u{1F4E5}" : "\u{1F4C2}"}</p>
                        <p className="text-sm font-medium text-slate-700">
                          {isDragging ? "Drop file here" : "Drag & drop a file here"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">or click to browse (PDF, DOC, video, images, ZIP — up to 500MB)</p>
                        <input type="file" className="hidden" onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.xlsx,.xls,.csv,.txt,.zip,.mp4,.mov,.avi,.wmv,.webm,.mp3,.wav,.pptx,.ppt,.svg,.webp,.tiff,.bmp" />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Or provide a URL below instead of uploading a file</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. FUZE SDS v4.2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={2}
                  placeholder="Brief description of document contents..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value, customCategory: "" })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {BUILT_IN_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                    <option value="__CUSTOM__">{"\u{2795}"} Custom Category...</option>
                  </select>
                  {form.category === "__CUSTOM__" && (
                    <input
                      type="text"
                      value={form.customCategory}
                      onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                      className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      placeholder="e.g. WRAP, BCI, Higg Index"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
                  <input type="text" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. v4.2, Rev. 3" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">External URL (optional)</label>
                <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="https://..." />
              </div>

              {/* Role visibility */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Visible to Roles</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.visibleTo.includes(role.id)
                          ? "bg-[#00b4c3] text-white border-[#00b4c3]"
                          : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload progress */}
              {uploadProgress && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-blue-700">{uploadProgress}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end sticky bottom-0 bg-white">
              <button onClick={() => { setShowUpload(false); setEditingDoc(null); resetForm(); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={editingDoc ? saveEdit : handleUpload} disabled={saving || !form.title}
                className="px-5 py-2 text-sm font-semibold bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa] disabled:opacity-50">
                {saving ? "Saving..." : editingDoc ? "Save Changes" : "Upload Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Document?"
        message="This will permanently remove this compliance document from the library. This action cannot be undone."
        confirmLabel="Delete Document"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm) deleteDoc(deleteConfirm);
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
