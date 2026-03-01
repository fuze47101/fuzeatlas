"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
  hasIcp: boolean;
  hasAb: boolean;
  hasFungal: boolean;
  hasOdor: boolean;
}

interface TestData {
  total: number;
  typeBreakdown: { type: string; count: number }[];
  runs: TestRun[];
  resultCounts: { icp: number; fungal: number; odor: number; antibacterial: number };
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
  const [data, setData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [savedBanner, setSavedBanner] = useState(false);

  // Assign modal state
  const [assigningTest, setAssigningTest] = useState<TestRun | null>(null);

  // Edit modal state
  const [editingTest, setEditingTest] = useState<TestRun | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
      loadData(filterType);
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const loadData = (type?: string) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    fetch(`/api/tests?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Check for saved=true in URL
    if (typeof window !== "undefined" && window.location.search.includes("saved=true")) {
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 5000);
      window.history.replaceState({}, "", "/tests");
    }
    loadData();
  }, []);

  // Re-fetch when filter type changes (server-side filtering)
  useEffect(() => {
    loadData(filterType);
  }, [filterType]);

  const filtered = data?.runs.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.testType.toLowerCase().includes(q) ||
      (r.testReportNumber || "").toLowerCase().includes(q) ||
      (r.lab || "").toLowerCase().includes(q) ||
      (r.brand || "").toLowerCase().includes(q) ||
      (r.factory || "").toLowerCase().includes(q) ||
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
          <span className="text-emerald-500">&#10003;</span> Test result saved successfully
        </div>
      )}

      {/* Header — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Test Results</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {data?.total || 0} test runs — {data?.resultCounts?.antibacterial || 0} antibacterial, {data?.resultCounts?.icp || 0} ICP, {data?.resultCounts?.fungal || 0} fungal
          </p>
        </div>
        <Link
          href="/tests/upload"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload Test Report
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

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by type, report #, lab, brand, factory..."
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      {/* Table — responsive: cards on mobile, table on desktop */}
      {/* Mobile: card list */}
      <div className="sm:hidden space-y-3">
        {filtered?.map((run) => {
          const colors = TYPE_COLORS[run.testType] || TYPE_COLORS.OTHER;
          return (
            <div key={run.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
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
                    Edit
                  </button>
                  <button
                    onClick={() => setAssigningTest(run)}
                    className="px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    {run.brand || run.factory ? "Reassign" : "Assign"}
                  </button>
                </div>
              </div>
              {run.testReportNumber && (
                <p className="text-sm font-medium text-slate-900">{run.testReportNumber}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {run.lab && <span>Lab: {run.lab}</span>}
                {run.brand && <span>Brand: <span className="text-slate-700 font-medium">{run.brand}</span></span>}
                {run.factory && <span>Factory: <span className="text-slate-700 font-medium">{run.factory}</span></span>}
                {run.washCount && <span>Washes: {run.washCount}</span>}
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
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Report #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Lab</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Brand</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Factory</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Washes</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Results</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((run) => {
                const colors = TYPE_COLORS[run.testType] || TYPE_COLORS.OTHER;
                return (
                  <tr key={run.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                        {run.testType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{run.testReportNumber || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{run.lab || "—"}</td>
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
                          onClick={() => openEdit(run)}
                          className="px-2 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setAssigningTest(run)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                            run.brand || run.factory
                              ? "text-green-700 border-green-200 hover:bg-green-50"
                              : "text-blue-600 border-blue-200 hover:bg-blue-50"
                          }`}
                        >
                          {run.brand || run.factory ? "Reassign" : "Assign"}
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
            {search || filterType ? "No tests match your filters." : "No test results yet. Upload a test report to get started."}
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
          onClose={() => setAssigningTest(null)}
          onAssigned={() => {
            setAssigningTest(null);
            loadData();
          }}
        />
      )}

      {/* Edit modal */}
      {editingTest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingTest(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Edit Test</h2>
              <button onClick={() => setEditingTest(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {editError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{editError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Test Type</label>
                <select
                  value={editForm.testType}
                  onChange={(e) => setEditForm({ ...editForm, testType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="ICP">ICP</option>
                  <option value="ANTIBACTERIAL">ANTIBACTERIAL</option>
                  <option value="FUNGAL">FUNGAL</option>
                  <option value="ODOR">ODOR</option>
                  <option value="UV">UV</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Report #</label>
                <input
                  type="text"
                  value={editForm.testReportNumber}
                  onChange={(e) => setEditForm({ ...editForm, testReportNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. 162201, TWNC01400561"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lab</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="text"
                    value={editForm.testDate}
                    onChange={(e) => setEditForm({ ...editForm, testDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="2/24/2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Wash Count</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Test Method</label>
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
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
