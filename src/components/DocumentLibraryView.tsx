"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

/**
 * Shared document-library view. Both /compliance-library (libraryType
 * "COMPLIANCE") and /marketing-library (libraryType "MARKETING") render this
 * so they stay visually identical. Parametrized by the partition, its
 * category set, its i18n bundle, and the cross-library move target.
 */

export interface LibraryCategory {
  id: string;
  icon: string;
  color: string;
  labelKey: string;
  descKey: string;
}

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

const ALL_ROLE_KEYS = [
  { id: "ADMIN", labelKey: "roleAdmin" },
  { id: "EMPLOYEE", labelKey: "roleEmployee" },
  { id: "SALES_MANAGER", labelKey: "roleSalesManager" },
  { id: "SALES_REP", labelKey: "roleSalesRep" },
  { id: "FABRIC_MANAGER", labelKey: "roleFabricManager" },
  { id: "TESTING_MANAGER", labelKey: "roleTestingManager" },
  { id: "FACTORY_MANAGER", labelKey: "roleFactoryManager" },
  { id: "FACTORY_USER", labelKey: "roleFactory" },
  { id: "BRAND_USER", labelKey: "roleBrand" },
  { id: "DISTRIBUTOR_USER", labelKey: "roleDistributor" },
];

export default function DocumentLibraryView({
  libraryType,
  categories,
  text: T,
  move,
}: {
  libraryType: "COMPLIANCE" | "MARKETING";
  categories: LibraryCategory[];
  text: any;
  move: { label: string; targetType: "COMPLIANCE" | "MARKETING" };
}) {
  const { user } = useAuth();
  const toast = useToast();
  const countsUrl = `/api/compliance-docs?libraryType=${libraryType}`;

  function getCategoryMeta(catId: string) {
    const builtIn = categories.find((c) => c.id === catId);
    if (builtIn) {
      return {
        id: catId,
        label: (T as any)[builtIn.labelKey] || catId.replace(/_/g, " "),
        icon: builtIn.icon,
        color: builtIn.color,
        desc: (T as any)[builtIn.descKey] || "",
      };
    }
    return {
      id: catId,
      label: catId.replace(/_/g, " "),
      icon: "\u{1F3F7}\u{FE0F}",
      color: "bg-purple-50 text-purple-700 border-purple-200",
      desc: T.customCategoryDescTemplate.replace("{name}", catId.replace(/_/g, " ")),
    };
  }

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

  const [managingCategory, setManagingCategory] = useState<string | null>(null);
  const [categoryAction, setCategoryAction] = useState<"rename" | "delete" | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [deleteMoveTo, setDeleteMoveTo] = useState("OTHER");
  const [catSaving, setCatSaving] = useState(false);

  const [movingDoc, setMovingDoc] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState("");

  const isAdmin = user?.role === "ADMIN" || user?.role === "EMPLOYEE";
  const canDelete = user?.role === "ADMIN";

  const defaultCategory = categories[0]?.id || "OTHER";
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: defaultCategory,
    customCategory: "",
    version: "",
    url: "",
    visibleTo: ["ADMIN", "EMPLOYEE", "BRAND_USER", "FACTORY_USER", "FACTORY_MANAGER"] as string[],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const allCategories = (() => {
    const builtInIds = new Set(categories.map((c) => c.id));
    const customIds = Object.keys(categoryCounts).filter((id) => !builtInIds.has(id));
    return [
      ...categories.map((c) => getCategoryMeta(c.id)),
      ...customIds.map((id) => getCategoryMeta(id)),
    ];
  })();

  const refreshCounts = () => {
    fetch(countsUrl)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCategoryCounts(d.categories || {}); })
      .catch(() => {});
  };

  const load = () => {
    const qs = new URLSearchParams({ libraryType });
    if (activeCategory) qs.set("category", activeCategory);
    fetch(`/api/compliance-docs?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setDocs(d.documents || []);
          if (!activeCategory) setCategoryCounts(d.categories || {});
        }
      })
      .catch(() => toast.error(T.toastLoadFailed))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, libraryType]);

  useEffect(() => {
    refreshCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryType]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) { toast.error(T.toastFileTooLarge); return; }
    setSelectedFile(file);
    if (!form.title) setForm((f) => ({ ...f, title: file.name.replace(/\.[^/.]+$/, "") }));
  };

  const processDroppedFile = (file: File) => {
    if (file.size > 500 * 1024 * 1024) { toast.error(T.toastFileTooLarge); return; }
    setSelectedFile(file);
    if (!form.title) setForm((f) => ({ ...f, title: file.name.replace(/\.[^/.]+$/, "") }));
    if (!showUpload && !editingDoc) setShowUpload(true);
  };

  const handlePageDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!isAdmin) return; setPageDragOver(true); };
  const handlePageDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setPageDragOver(false);
  };
  const handlePageDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setPageDragOver(false);
    if (!isAdmin) return;
    const file = e.dataTransfer.files?.[0];
    if (file) { resetForm(); processDroppedFile(file); }
  };

  const handleDropZoneDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDropZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };
  const handleDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processDroppedFile(file);
  };

  const resetForm = () => {
    setForm({
      title: "", description: "", category: defaultCategory, customCategory: "",
      version: "", url: "",
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
      if (selectedFile) {
        setUploadProgress(T.uploadPreparing);
        const urlRes = await fetch("/api/compliance-docs/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: selectedFile.name, contentType: selectedFile.type || "application/octet-stream" }),
        });
        const urlData = await urlRes.json();
        if (!urlData.ok) throw new Error(urlData.error || T.uploadPrepareFailed);
        setUploadProgress(T.uploadUploading.replace("{size}", formatFileSize(selectedFile.size)));
        const s3Res = await fetch(urlData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
          body: selectedFile,
        });
        if (!s3Res.ok) throw new Error(T.uploadStorageFailed);
        s3Key = urlData.s3Key;
        setUploadProgress(T.uploadSavingRecord);
      }
      const payload: any = {
        title: form.title,
        description: form.description || null,
        category: effectiveCategory,
        version: form.version || null,
        visibleTo: form.visibleTo,
        url: form.url || null,
        libraryType,
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
        toast.success(T.toastUploaded);
        setShowUpload(false);
        resetForm();
        load();
        refreshCounts();
      } else toast.error(d.error || T.toastUploadFailed);
    } catch (err: any) {
      toast.error(err.message || T.toastUploadFailed);
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const startEdit = (doc: ComplianceDoc) => {
    const isCustom = !categories.some((c) => c.id === doc.category);
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
        toast.success(T.toastUpdated);
        setEditingDoc(null);
        resetForm();
        load();
        refreshCounts();
      } else toast.error(d.error || T.toastUpdateFailed);
    } catch {
      toast.error(T.toastUpdateFailed);
    } finally {
      setSaving(false);
    }
  };

  const deleteDoc = async (id: string) => {
    try {
      const res = await fetch(`/api/compliance-docs/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (d.ok) { toast.success(T.toastDeleted); load(); refreshCounts(); }
      else toast.error(d.error || T.toastDeleteFailed);
    } catch { toast.error(T.toastDeleteFailed); }
  };

  const renameCategory = async () => {
    if (!managingCategory || !renameTo.trim()) return;
    setCatSaving(true);
    try {
      const res = await fetch("/api/compliance-docs/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldCategory: managingCategory, newCategory: renameTo.trim(), libraryType }),
      });
      const d = await res.json();
      if (d.ok) {
        const label = d.updated !== 1 ? T.docPluralShort : T.docSingularShort;
        toast.success(T.toastRenamed.replace("{count}", String(d.updated)).replace("{label}", label));
        setManagingCategory(null); setCategoryAction(null); setRenameTo("");
        if (activeCategory === managingCategory) setActiveCategory(d.newCategory);
        load(); refreshCounts();
      } else toast.error(d.error || T.toastRenameFailed);
    } catch { toast.error(T.toastRenameFailed); }
    finally { setCatSaving(false); }
  };

  const deleteCategory = async () => {
    if (!managingCategory || !deleteMoveTo) return;
    setCatSaving(true);
    try {
      const res = await fetch("/api/compliance-docs/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: managingCategory, moveTo: deleteMoveTo, libraryType }),
      });
      const d = await res.json();
      if (d.ok) {
        const label = d.moved !== 1 ? T.docPluralShort : T.docSingularShort;
        toast.success(T.toastCategoryDeleted.replace("{count}", String(d.moved)).replace("{label}", label).replace("{target}", getCategoryMeta(d.to).label));
        setManagingCategory(null); setCategoryAction(null);
        if (activeCategory === managingCategory) setActiveCategory(null);
        load(); refreshCounts();
      } else toast.error(d.error || T.toastCategoryDeleteFailed);
    } catch { toast.error(T.toastCategoryDeleteFailed); }
    finally { setCatSaving(false); }
  };

  const quickMoveDoc = async (docId: string, targetCategory: string) => {
    try {
      const res = await fetch(`/api/compliance-docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: targetCategory }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(T.toastMoved.replace("{target}", getCategoryMeta(targetCategory).label));
        setMovingDoc(null); setMoveTarget("");
        load(); refreshCounts();
      } else toast.error(d.error || T.toastMoveFailed);
    } catch { toast.error(T.toastMoveFailed); }
  };

  // Cross-library move (COMPLIANCE ↔ MARKETING).
  const moveToOtherLibrary = async (docId: string) => {
    try {
      const res = await fetch(`/api/compliance-docs/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryType: move.targetType }),
      });
      const d = await res.json();
      if (d.ok) { toast.success(move.label); load(); refreshCounts(); }
      else toast.error(d.error || T.toastMoveFailed);
    } catch { toast.error(T.toastMoveFailed); }
  };

  const downloadDoc = (doc: ComplianceDoc) => {
    if (doc.downloadUrl) window.open(doc.downloadUrl, "_blank");
    else if (doc.url) window.open(doc.url, "_blank");
  };

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      visibleTo: f.visibleTo.includes(role) ? f.visibleTo.filter((r) => r !== role) : [...f.visibleTo, role],
    }));
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalDocs = Object.values(categoryCounts).reduce((s, n) => s + n, 0);
  const managingCount = managingCategory ? (categoryCounts[managingCategory] || 0) : 0;

  return (
    <div
      className="p-4 sm:p-8 max-w-6xl mx-auto relative"
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {pageDragOver && !showUpload && !editingDoc && isAdmin && (
        <div className="fixed inset-0 z-[90] bg-[#00b4c3]/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl px-12 py-10 border-2 border-dashed border-[#00b4c3] text-center">
            <p className="text-4xl mb-3">{"\u{1F4E4}"}</p>
            <p className="text-lg font-semibold text-slate-800">{T.dropToUploadTitle}</p>
            <p className="text-sm text-slate-500 mt-1">{T.dropToUploadDesc}</p>
          </div>
        </div>
      )}

      {/* Header — product-documents aesthetic */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">{T.pageTitle}</h1>
          <p className="text-slate-600 mt-1">
            {T.pageSubtitleTemplate.replace("{count}", String(totalDocs)).replace("{label}", totalDocs !== 1 ? T.docPlural : T.docSingular)}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowUpload(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa] font-semibold text-sm shrink-0"
          >
            {T.uploadDocument}
          </button>
        )}
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-xl border p-3 text-left transition-all ${
            activeCategory === null
              ? "bg-[#00b4c3]/10 border-[#00b4c3] ring-1 ring-[#00b4c3]/20"
              : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
          }`}
        >
          <span className="text-lg">{"\u{1F4DA}"}</span>
          <p className="text-xs font-semibold text-slate-800 mt-1">{T.catAll}</p>
          <p className="text-lg font-bold text-slate-900">{totalDocs}</p>
        </button>
        {allCategories.map((cat) => (
          <div key={cat.id} className="relative group">
            <button
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={`w-full rounded-xl border p-3 text-left transition-all ${
                activeCategory === cat.id
                  ? "bg-[#00b4c3]/10 border-[#00b4c3] ring-1 ring-[#00b4c3]/20"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <p className="text-xs font-semibold text-slate-800 mt-1 leading-tight">{cat.label}</p>
              <p className="text-lg font-bold text-slate-900">{categoryCounts[cat.id] || 0}</p>
            </button>
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); setManagingCategory(cat.id); setCategoryAction(null); setRenameTo(cat.label); setDeleteMoveTo("OTHER"); }}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600"
                title={T.manageCategoryTooltip}
              >
                {"⚙"}
              </button>
            )}
          </div>
        ))}
      </div>

      {activeCategory && (
        <div className="mb-4 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-600">{getCategoryMeta(activeCategory).desc}</p>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">{"\u{1F4CB}"}</p>
          <p>{activeCategory ? T.noDocsThisCategory : T.noDocsYet}</p>
          {isAdmin && <p className="text-sm mt-1">{T.getStartedHint}</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs text-slate-400 uppercase">
                  <th className="py-2.5 px-4">{T.colDocument}</th>
                  <th className="py-2.5 px-4">{T.colCategory}</th>
                  <th className="py-2.5 px-4">{T.colVersion}</th>
                  <th className="py-2.5 px-4">{T.colSize}</th>
                  <th className="py-2.5 px-4">{T.colUploaded}</th>
                  <th className="py-2.5 px-4">{T.colVisibility}</th>
                  <th className="py-2.5 px-4 text-right">{T.colActions}</th>
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
                            {doc.description && <p className="text-xs text-slate-500 line-clamp-1">{doc.description}</p>}
                            {doc.filename && <p className="text-[10px] text-slate-400 mt-0.5">{doc.filename}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cat.color}`}>{cat.label}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{doc.version || "—"}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{formatFileSize(doc.sizeBytes)}</td>
                      <td className="py-3 px-4">
                        <p className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                        {doc.uploadedBy && <p className="text-[10px] text-slate-400">{doc.uploadedBy.name}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {(doc.visibleTo as string[]).slice(0, 3).map((role) => (
                            <span key={role} className="px-1.5 py-0.5 bg-slate-100 text-[9px] font-medium text-slate-500 rounded">{role.replace(/_/g, " ")}</span>
                          ))}
                          {(doc.visibleTo as string[]).length > 3 && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-[9px] font-medium text-slate-500 rounded">+{(doc.visibleTo as string[]).length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {(doc.downloadUrl || doc.url) && (
                            <button onClick={() => downloadDoc(doc)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">{T.downloadAction}</button>
                          )}
                          {isAdmin && (
                            <div className="relative">
                              {movingDoc === doc.id ? (
                                <div className="flex items-center gap-1">
                                  <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} className="text-xs border border-slate-300 rounded px-1.5 py-0.5 max-w-[120px]" autoFocus>
                                    <option value="">{T.moveToPlaceholder}</option>
                                    {allCategories.filter((c) => c.id !== doc.category).map((c) => (
                                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                                    ))}
                                  </select>
                                  <button onClick={() => moveTarget && quickMoveDoc(doc.id, moveTarget)} disabled={!moveTarget} className="text-[10px] text-green-600 hover:text-green-800 font-bold disabled:opacity-30">{"✓"}</button>
                                  <button onClick={() => { setMovingDoc(null); setMoveTarget(""); }} className="text-[10px] text-slate-400 hover:text-slate-600 font-bold">{"✗"}</button>
                                </div>
                              ) : (
                                <button onClick={() => { setMovingDoc(doc.id); setMoveTarget(""); }} className="text-xs text-slate-500 hover:text-slate-700 font-medium" title={T.moveToTooltip}>{T.moveAction}</button>
                              )}
                            </div>
                          )}
                          {isAdmin && (
                            <button onClick={() => moveToOtherLibrary(doc.id)} className="text-xs text-purple-600 hover:text-purple-800 font-medium" title={move.label}>{move.label}</button>
                          )}
                          {isAdmin && (
                            <button onClick={() => startEdit(doc)} className="text-xs text-[#00b4c3] hover:text-[#009aaa] font-medium">{T.editAction}</button>
                          )}
                          {canDelete && (
                            <button onClick={() => setDeleteConfirm(doc.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">{T.deleteAction}</button>
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

      {/* Upload / Edit modal */}
      {(showUpload || editingDoc) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowUpload(false); setEditingDoc(null); resetForm(); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-900">{editingDoc ? T.editTitle : T.uploadTitle}</h2>
              <button onClick={() => { setShowUpload(false); setEditingDoc(null); resetForm(); }} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {!editingDoc && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.fileLabel}</label>
                  <div
                    onDragOver={handleDropZoneDragOver}
                    onDragLeave={handleDropZoneDragLeave}
                    onDrop={handleDropZoneDrop}
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${isDragging ? "border-[#00b4c3] bg-[#00b4c3]/5 scale-[1.01]" : "border-slate-300 hover:border-[#00b4c3]"}`}
                  >
                    {selectedFile ? (
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-800">{selectedFile.name}</p>
                          <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                        </div>
                        <button onClick={() => setSelectedFile(null)} className="text-red-500 text-sm hover:text-red-700">{T.removeFile}</button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <p className="text-2xl mb-2">{isDragging ? "\u{1F4E5}" : "\u{1F4C2}"}</p>
                        <p className="text-sm font-medium text-slate-700">{isDragging ? T.dropHere : T.dragDropHere}</p>
                        <p className="text-xs text-slate-400 mt-1">{T.dragDropHelper}</p>
                        <input type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.xlsx,.xls,.csv,.txt,.zip,.mp4,.mov,.avi,.wmv,.webm,.mp3,.wav,.pptx,.ppt,.svg,.webp,.tiff,.bmp" />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{T.orUrl}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{T.titleLabel}</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder={T.titlePlaceholder} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{T.descriptionLabel}</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={2} placeholder={T.descriptionPlaceholder} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.categoryLabel}</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, customCategory: "" })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    {allCategories.map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.label}</option>))}
                    <option value="__CUSTOM__">{"\u{2795}"} {T.customCategoryOption}</option>
                  </select>
                  {form.category === "__CUSTOM__" && (
                    <input type="text" value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder={T.customCategoryPlaceholder} />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.versionLabel}</label>
                  <input type="text" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder={T.versionPlaceholder} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{T.externalUrlLabel}</label>
                <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder={T.urlPlaceholder} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{T.visibleToRoles}</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLE_KEYS.map((role) => (
                    <button key={role.id} type="button" onClick={() => toggleRole(role.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.visibleTo.includes(role.id) ? "bg-[#00b4c3] text-white border-[#00b4c3]" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}>
                      {(T as any)[role.labelKey]}
                    </button>
                  ))}
                </div>
              </div>
              {uploadProgress && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-blue-700">{uploadProgress}</span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end sticky bottom-0 bg-white">
              <button onClick={() => { setShowUpload(false); setEditingDoc(null); resetForm(); }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">{T.cancel}</button>
              <button onClick={editingDoc ? saveEdit : handleUpload} disabled={saving || !form.title} className="px-5 py-2 text-sm font-semibold bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa] disabled:opacity-50">
                {saving ? T.saving : editingDoc ? T.saveChanges : T.uploadTitle}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title={T.deleteDocConfirmTitle}
        message={T.deleteDocConfirmMsg}
        confirmLabel={T.deleteDocConfirmBtn}
        variant="danger"
        onConfirm={() => { if (deleteConfirm) deleteDoc(deleteConfirm); setDeleteConfirm(null); }}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Category management modal */}
      {managingCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setManagingCategory(null); setCategoryAction(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {T.manageHeaderTemplate.replace("{icon}", getCategoryMeta(managingCategory).icon).replace("{label}", getCategoryMeta(managingCategory).label)}
              </h2>
              <button onClick={() => { setManagingCategory(null); setCategoryAction(null); }} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-500 mb-4">
                {T.inCategoryCount.replace("{count}", String(managingCount)).replace("{label}", managingCount !== 1 ? T.docPlural : T.docSingular)}
              </p>
              {!categoryAction && (
                <div className="flex gap-3">
                  <button onClick={() => setCategoryAction("rename")} className="flex-1 px-4 py-3 bg-[#00b4c3]/10 text-[#00b4c3] rounded-xl hover:bg-[#00b4c3]/20 font-medium text-sm transition-colors">{"✏️"} {T.renameCategoryBtn}</button>
                  {canDelete && (
                    <button onClick={() => setCategoryAction("delete")} className="flex-1 px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 font-medium text-sm transition-colors">{"\u{1F5D1}"} {T.deleteCategoryBtn}</button>
                  )}
                </div>
              )}
              {categoryAction === "rename" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{T.renameNewName}</label>
                    <input type="text" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3]/30 focus:border-[#00b4c3]" placeholder={T.renameNewNamePlaceholder} autoFocus />
                    <p className="text-xs text-slate-400 mt-1">{T.renameStoredAs.replace("{name}", renameTo.trim().toUpperCase().replace(/[\s-]+/g, "_") || "...")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={renameCategory} disabled={catSaving || !renameTo.trim()} className="flex-1 px-4 py-2 bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa] font-medium text-sm disabled:opacity-50 transition-colors">
                      {catSaving ? T.renaming : T.renameCount.replace("{count}", String(managingCount)).replace("{label}", managingCount !== 1 ? T.docPluralShort : T.docSingularShort)}
                    </button>
                    <button onClick={() => setCategoryAction(null)} className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">{T.back}</button>
                  </div>
                </div>
              )}
              {categoryAction === "delete" && (
                <div className="space-y-3">
                  <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">{T.deleteCategoryWarning.replace("{count}", String(managingCount)).replace("{label}", managingCount !== 1 ? T.docPlural : T.docSingular)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{T.moveDocsTo}</label>
                    <select value={deleteMoveTo} onChange={(e) => setDeleteMoveTo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      {allCategories.filter((c) => c.id !== managingCategory).map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.label}</option>))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={deleteCategory} disabled={catSaving || !deleteMoveTo} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50 transition-colors">
                      {catSaving ? T.deleting : T.deleteCategoryConfirm}
                    </button>
                    <button onClick={() => setCategoryAction(null)} className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">{T.back}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
