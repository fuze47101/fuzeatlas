"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";
import AssignTestModal from "@/components/AssignTestModal";

interface TestRun {
  id: string;
  testType: string;
  testReportNumber?: string;
  testMethodStd?: string;
  testDate?: string;
  washCount?: number;
  lab?: string;
  brand?: string;
  factory?: string;
  fuzeNumber?: string;
  projectId?: string;
  project?: string;
  hasIcp: boolean;
  hasAb: boolean;
  hasFungal: boolean;
  hasOdor: boolean;
  brandVisible?: boolean;
}

interface TestData {
  total: number;
  typeBreakdown: { type: string; count: number }[];
  runs: TestRun[];
  resultCounts: { icp: number; fungal: number; odor: number; antibacterial: number };
}

interface ProjectOption {
  id: string;
  name: string;
  brandName?: string;
  testCount: number;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  ICP: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  ANTIBACTERIAL: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  FUNGAL: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  ODOR: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  UV: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  MICROFIBER: { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500" },
  OTHER: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
};

export default function TestsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [savedBanner, setSavedBanner] = useState(false);

  // Projects for filter dropdown
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);

  // Assign modal state
  const [assigningTest, setAssigningTest] = useState<TestRun | null>(null);

  // Edit modal state
  const [editingTest, setEditingTest] = useState<TestRun | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Batch stamp selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchStamping, setBatchStamping] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!filtered) return;
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const batchStamp = async (visible: boolean) => {
    if (selectedIds.size === 0) return;
    setBatchStamping(true);
    try {
      const res = await fetch("/api/tests/batch-stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testRunIds: [...selectedIds], visible }),
      });
      const d = await res.json();
      if (d.ok) {
        setSelectedIds(new Set());
        loadData(filterType, filterProject);
      }
    } catch (e) {
      console.error("Batch stamp error:", e);
    } finally {
      setBatchStamping(false);
    }
  };

  const openEdit = (run: TestRun) => {
    setEditingTest(run);
    setEditForm({
      testType: run.testType,
      testReportNumber: run.testReportNumber || "",
      lab: run.lab || "",
      testDate: run.testDate || "",
      washCount: run.washCount ?? "",
      testMethodStd: run.testMethodStd || "",
    });
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingTest) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/tests/${editingTest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testType: editForm.testType,
          testReportNumber: editForm.testReportNumber || null,
          labName: editForm.lab || null,
          testDate: editForm.testDate || null,
          washCount: editForm.washCount || null,
          testMethodStd: editForm.testMethodStd || null,
        }),
      });
      const d = await res.json();
      if (!d.ok) { setEditError(d.error || "Save failed"); return; }
      setEditingTest(null);
      loadData(filterType, filterProject);
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const loadData = (type?: string, project?: string) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (project) params.set("project", project);
    fetch(`/api/tests?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
      })
      .finally(() => setLoading(false));
  };

  // Load projects for filter
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.projects) {
          setProjectOptions(d.projects);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Check for saved=true in URL
    if (typeof window !== "undefined" && window.location.search.includes("saved=true")) {
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 5000);
      window.history.replaceState({}, "", "/tests");
    }
    loadData();
  }, []);

  // Re-fetch when filter type or project changes
  useEffect(() => {
    loadData(filterType, filterProject);
  }, [filterType, filterProject]);

  const filtered = data?.runs.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.testType.toLowerCase().includes(q) ||
      (r.testReportNumber || "").toLowerCase().includes(q) ||
      (r.lab || "").toLowerCase().includes(q) ||
      (r.brand || "").toLowerCase().includes(q) ||
      (r.factory || "").toLowerCase().includes(q) ||
      (r.project || "").toLowerCase().includes(q) ||
      (r.fuzeNumber || "").toLowerCase().includes(q);
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Success banner */}
      {savedBanner && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium flex items-center gap-2">
          <span className="text-emerald-500">&#10003;</span> {t.tests.saveTest} {t.common.save}d successfully
        </div>
      )}

      {/* Header — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t.tests.title}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {data?.total || 0} test runs — {data?.resultCounts?.antibacterial || 0} {t.tests.antibacterial}, {data?.resultCounts?.icp || 0} {t.tests.icp}, {data?.resultCounts?.fungal || 0} {t.tests.fungal}
          </p>
        </div>
        <Link
          href="/tests/upload"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {t.nav.testUpload}
        </Link>
      </div>

      {/* Stats cards — scroll horizontally on mobile */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-6">
        {data?.typeBreakdown.map((t) => {
          const colors = TYPE_COLORS[t.type] || TYPE_COLORS.OTHER;
          return (
            <button
              key={t.type}
              onClick={() => setFilterType(filterType === t.type ? "" : t.type)}
              className={`flex-shrink-0 p-3 rounded-xl border text-left transition-all min-w-[120px] sm:min-w-0 ${
                filterType === t.type
                  ? `${colors.bg} border-current ${colors.text} ring-2 ring-current/20`
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className="text-xs font-medium uppercase tracking-wide">{t.type}</span>
              </div>
              <span className="text-lg font-bold">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + Project filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`${t.common.search} ${t.common.by} ${t.tests.testType}, ${t.tests.testReport}, ${t.tests.lab}, ${t.tests.brand}, ${t.tests.factory}, ${t.tests.project}...`}
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        {projectOptions.length > 0 && (
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[180px]"
          >
            <option value="">{t.tests.project}</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.brandName ? ` (${p.brandName})` : ""} — {p.testCount}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Batch stamp toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-[#00b4c3]/10 border border-[#00b4c3]/30 rounded-xl">
          <span className="text-sm font-medium text-[#00b4c3]">{selectedIds.size} selected</span>
          <button
            onClick={() => batchStamp(true)}
            disabled={batchStamping}
            className="px-3 py-1.5 text-xs font-semibold bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa] disabled:opacity-50 transition-colors"
          >
            {batchStamping ? "Stamping..." : "✓ Stamp for Brand Portal"}
          </button>
          <button
            onClick={() => batchStamp(false)}
            disabled={batchStamping}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Unstamp Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table — responsive: cards on mobile, table on desktop */}
      {/* Mobile: card list */}
      <div className="sm:hidden space-y-3">
        {filtered?.map((run) => {
          const colors = TYPE_COLORS[run.testType] || TYPE_COLORS.OTHER;
          return (
            <div key={run.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 cursor-pointer" onClick={() => window.location.href = `/tests/${run.id}`}>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                  {run.testType}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{run.testDate || ""}</span>
                  <button
                    onClick={() => openEdit(run)}
                    className="px-2 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    {t.common.edit}
                  </button>
                  <button
                    onClick={() => setAssigningTest(run)}
                    className="px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    {run.brand || run.factory || run.project ? t.tests.assignTest : t.tests.assignTest}
                  </button>
                </div>
              </div>
              {run.testReportNumber && (
                <p className="text-sm font-medium text-slate-900">{run.testReportNumber}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {run.project && <span>{t.tests.project}: <span className="text-amber-700 font-medium">{run.project}</span></span>}
                {run.lab && <span>{t.tests.lab}: {run.lab}</span>}
                {run.brand && <span>{t.tests.brand}: <span className="text-slate-700 font-medium">{run.brand}</span></span>}
                {run.factory && <span>{t.tests.factory}: <span className="text-slate-700 font-medium">{run.factory}</span></span>}
                {run.washCount && <span>{t.tests.washCount}: {run.washCount}</span>}
              </div>
              <div className="flex gap-2 mt-1">
                {run.hasIcp && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">ICP</span>}
                {run.hasAb && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs rounded">AB</span>}
                {run.hasFungal && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-xs rounded">FNG</span>}
                {run.hasOdor && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 text-xs rounded">ODR</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filtered ? selectedIds.size === filtered.length && filtered.length > 0 : false}
                    onChange={selectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t.common.type}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t.tests.testReport}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t.tests.lab}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t.tests.project}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t.tests.brand}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t.tests.factory}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t.common.date}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t.tests.washCount}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t.tests.result}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((run) => {
                const colors = TYPE_COLORS[run.testType] || TYPE_COLORS.OTHER;
                return (
                  <tr key={run.id} className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${selectedIds.has(run.id) ? "bg-[#00b4c3]/5" : ""}`} onClick={() => window.location.href = `/tests/${run.id}`}>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(run.id)}
                        onChange={() => toggleSelect(run.id)}
                        className="w-4 h-4 rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {run.testType}
                        </span>
                        {run.brandVisible && (
                          <span className="px-1.5 py-0.5 bg-[#00b4c3]/10 text-[#00b4c3] text-[10px] font-bold rounded" title="Visible to brand portal">
                            BP
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{run.testReportNumber || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{run.lab || "—"}</td>
                    <td className="px-4 py-3">
                      {run.project ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                          {run.project}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {run.brand ? (
                        <span className="text-slate-900 font-medium">{run.brand}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {run.factory ? (
                        <span className="text-slate-900 font-medium">{run.factory}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{run.testDate || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{run.washCount ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {run.hasIcp && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">ICP</span>}
                        {run.hasAb && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs rounded">AB</span>}
                        {run.hasFungal && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-xs rounded">FNG</span>}
                        {run.hasOdor && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 text-xs rounded">ODR</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(run); }}
                          className="px-2 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          {t.common.edit}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setAssigningTest(run); }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                            run.brand || run.factory || run.project
                              ? "text-green-700 border-green-200 hover:bg-green-50"
                              : "text-blue-600 border-blue-200 hover:bg-blue-50"
                          }`}
                        >
                          {run.brand || run.factory || run.project ? t.tests.assignTest : t.tests.assignTest}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(!filtered || filtered.length === 0) && (
          <div className="p-12 text-center text-slate-400">
            {search || filterType || filterProject ? t.tests.noTests : t.tests.noTests}
          </div>
        )}
      </div>

      {/* Assign modal */}
      {assigningTest && (
        <AssignTestModal
          testId={assigningTest.id}
          testType={assigningTest.testType}
          currentBrand={assigningTest.brand}
          currentFactory={assigningTest.factory}
          currentProject={assigningTest.project}
          onClose={() => setAssigningTest(null)}
          onAssigned={() => {
            setAssigningTest(null);
            loadData(filterType, filterProject);
            // Refresh project list in case new one was created
            fetch("/api/projects").then(r => r.json()).then(d => {
              if (d.ok && d.projects) setProjectOptions(d.projects);
            }).catch(() => {});
          }}
        />
      )}

      {/* Edit modal */}
      {editingTest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingTest(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{t.tests.editTest}</h2>
              <button onClick={() => setEditingTest(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {editError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{editError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.tests.testType}</label>
                <select
                  value={editForm.testType}
                  onChange={(e) => setEditForm({ ...editForm, testType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="ICP">{t.tests.icp}</option>
                  <option value="ANTIBACTERIAL">{t.tests.antibacterial}</option>
                  <option value="FUNGAL">{t.tests.fungal}</option>
                  <option value="ODOR">{t.tests.odor}</option>
                  <option value="UV">{t.tests.uv}</option>
                  <option value="OTHER">{t.tests.other}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.tests.testReport}</label>
                <input
                  type="text"
                  value={editForm.testReportNumber}
                  onChange={(e) => setEditForm({ ...editForm, testReportNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. 162201, TWNC01400561"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.tests.lab}</label>
                <input
                  type="text"
                  value={editForm.lab}
                  onChange={(e) => setEditForm({ ...editForm, lab: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. CTLA, ITS, SGS"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.tests.testDate}</label>
                  <input
                    type="text"
                    value={editForm.testDate}
                    onChange={(e) => setEditForm({ ...editForm, testDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="2/24/2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.tests.washCount}</label>
                  <input
                    type="number"
                    value={editForm.washCount}
                    onChange={(e) => setEditForm({ ...editForm, washCount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.tests.methodStd}</label>
                <input
                  type="text"
                  value={editForm.testMethodStd}
                  onChange={(e) => setEditForm({ ...editForm, testMethodStd: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. ICP-MS, AATCC 100, ASTM E2149"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingTest(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editSaving ? `${t.common.saving}` : t.tests.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
