// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface OngoingTest {
  id: string;
  poNumber?: string;
  status: string;
  priority?: number;
  brandName?: string;
  accountManager: string;
  factoryName?: string;
  factoryCountry?: string;
  labName?: string;
  fabricInfo?: string;
  testTypes: string[];
  totalLines: number;
  completedLines: number;
  progress: number;
  daysActive: number;
  daysUntilEta: number | null;
  overdue: boolean;
  createdAt: string;
  testingStartedAt: string | null;
  requestedCompletionDate: string | null;
  estimatedCompletionDate: string | null;
  specialInstructions?: string;
  reportUploaded: boolean;
}

interface Summary {
  total: number;
  awaitingAccept: number;
  inProgress: number;
  resultsReady: number;
  overdue: number;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-700",
  RESULTS_RECEIVED: "bg-purple-100 text-purple-700",
};

export default function OngoingTestsPage() {
  const [tests, setTests] = useState<OngoingTest[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterLab, setFilterLab] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/ongoing-tests")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setTests(j.tests || []);
          setSummary(j.summary || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const labs = [...new Set(tests.map((t) => t.labName).filter(Boolean))].sort();

  const filtered = tests.filter((t) => {
    if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
    if (filterLab !== "ALL" && t.labName !== filterLab) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (t.poNumber || "").toLowerCase().includes(s) ||
        (t.brandName || "").toLowerCase().includes(s) ||
        (t.factoryName || "").toLowerCase().includes(s) ||
        (t.labName || "").toLowerCase().includes(s) ||
        (t.fabricInfo || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Ongoing Tests Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time visibility into all active test requests across labs
          </p>
        </div>
        <Link
          href="/admin/sample-trials"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition"
        >
          🧪 Sample Trials
        </Link>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-white border rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-slate-700">{summary.total}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Total Active</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-amber-700">{summary.awaitingAccept}</p>
            <p className="text-[10px] font-semibold text-amber-600 uppercase">Awaiting Accept</p>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-cyan-700">{summary.inProgress}</p>
            <p className="text-[10px] font-semibold text-cyan-600 uppercase">In Progress</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-purple-700">{summary.resultsReady}</p>
            <p className="text-[10px] font-semibold text-purple-600 uppercase">Results Ready</p>
          </div>
          <div className={`border rounded-xl p-4 text-center ${summary.overdue > 0 ? "bg-red-50 border-red-200" : "bg-white"}`}>
            <p className={`text-2xl font-black ${summary.overdue > 0 ? "text-red-600" : "text-slate-400"}`}>
              {summary.overdue}
            </p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Overdue</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search PO, brand, factory, lab, fabric..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESULTS_RECEIVED">Results Received</option>
        </select>
        <select
          value={filterLab}
          onChange={(e) => setFilterLab(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="ALL">All Labs</option>
          {labs.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Showing {filtered.length} of {tests.length} tests
      </p>

      {/* Tests Table (Desktop) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="px-4 py-3 font-semibold text-slate-600">PO / Request</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Brand</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Lab</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Progress</th>
              <th className="px-4 py-3 font-semibold text-slate-600">ETA</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Days Active</th>
              <th className="px-4 py-3 font-semibold text-slate-600">AM</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className={`border-b border-slate-100 hover:bg-slate-50 ${t.overdue ? "bg-red-50" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{t.poNumber || t.id.substring(0, 8)}</div>
                  <div className="text-xs text-slate-500">
                    {t.factoryName}{t.factoryCountry ? ` (${t.factoryCountry})` : ""}
                  </div>
                  {t.fabricInfo && <div className="text-xs text-slate-400 truncate max-w-[180px]">{t.fabricInfo}</div>}
                </td>
                <td className="px-4 py-3 text-slate-600">{t.brandName || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{t.labName || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[t.status] || "bg-slate-100"}`}>
                    {t.status?.replace(/_/g, " ")}
                  </span>
                  {t.priority && t.priority <= 2 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">
                      PRIORITY
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00b4c3] rounded-full"
                        style={{ width: `${t.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{t.completedLines}/{t.totalLines}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {t.estimatedCompletionDate ? (
                    <div className={`text-xs font-semibold ${t.overdue ? "text-red-600" : "text-slate-700"}`}>
                      {new Date(t.estimatedCompletionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {t.overdue && <span className="ml-1 text-red-500">({Math.abs(t.daysUntilEta || 0)}d late)</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{t.daysActive}d</td>
                <td className="px-4 py-3 text-xs text-slate-600">{t.accountManager}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  No tests match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {filtered.map((t) => (
          <div
            key={t.id}
            className={`bg-white border rounded-xl p-4 ${t.overdue ? "border-red-200 bg-red-50" : "border-slate-200"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-800">{t.poNumber || t.id.substring(0, 8)}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[t.status] || "bg-slate-100"}`}>
                {t.status?.replace(/_/g, " ")}
              </span>
            </div>
            <div className="text-xs text-slate-500 space-y-1 mb-2">
              <p>Brand: {t.brandName || "—"} | Lab: {t.labName || "—"}</p>
              <p>Factory: {t.factoryName || "—"}</p>
              <p>AM: {t.accountManager}</p>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#00b4c3] rounded-full" style={{ width: `${t.progress}%` }} />
              </div>
              <span className="text-xs text-slate-500">{t.completedLines}/{t.totalLines}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{t.daysActive}d active</span>
              <span>
                ETA:{" "}
                {t.estimatedCompletionDate
                  ? new Date(t.estimatedCompletionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "—"}
                {t.overdue && <span className="text-red-600 ml-1">OVERDUE</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
