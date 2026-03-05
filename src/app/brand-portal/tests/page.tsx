"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const TYPE_COLORS: Record<string, string> = {
  ICP: "bg-violet-100 text-violet-700",
  ANTIBACTERIAL: "bg-blue-100 text-blue-700",
  FUNGAL: "bg-emerald-100 text-emerald-700",
  ODOR: "bg-amber-100 text-amber-700",
  UV: "bg-pink-100 text-pink-700",
};

export default function BrandPortalTestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [brand, setBrand] = useState<any>(null);

  useEffect(() => {
    // First get brand info
    fetch("/api/brand-portal")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setBrand(j.brand);
          // Now fetch tests filtered by brand submissions
          const submissionIds = j.submissions.map((s: any) => s.id);
          return fetch(`/api/tests?brandId=${j.brand.id}&brandVisible=true`);
        }
        throw new Error(j.error || "Failed to load");
      })
      .then((r) => r?.json())
      .then((j) => {
        if (j?.ok) setTests(j.runs || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading test results...</div>;

  const filtered = filter === "all" ? tests : tests.filter((t: any) => t.testType === filter);
  const types = [...new Set(tests.map((t: any) => t.testType))];

  // Summary
  const passed = tests.filter((t: any) => {
    if (t.icpResult) return true; // ICP always "passes" (it's a measurement)
    return t.abResult?.methodPass || t.abResult?.pass || t.fungalResult?.pass || t.odorResult?.pass;
  }).length;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Test Results</h1>
        <p className="text-sm text-slate-500 mt-1">
          {brand?.name || "Your brand"} — {tests.length} test result{tests.length !== 1 ? "s" : ""}
          {passed > 0 && <span className="text-emerald-600 font-semibold"> · {passed} passed</span>}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {types.map((type) => {
          const count = tests.filter((t: any) => t.testType === type).length;
          return (
            <div key={type} className="bg-white rounded-xl p-4 shadow-sm border text-center">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-1 ${TYPE_COLORS[type] || "bg-slate-100 text-slate-600"}`}>{type}</span>
              <div className="text-2xl font-black text-slate-900">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === "all" ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"}`}
        >
          All ({tests.length})
        </button>
        {types.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === type ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"}`}
          >
            {type} ({tests.filter((t: any) => t.testType === type).length})
          </button>
        ))}
      </div>

      {/* Tests Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Report #</th>
              <th className="px-4 py-3">Fabric</th>
              <th className="px-4 py-3">Lab</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Washes</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t: any) => {
              const pass = t.icpResult ? true : t.abResult?.methodPass ?? t.abResult?.pass ?? t.fungalResult?.pass ?? t.odorResult?.pass;
              return (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/tests/${t.id}`)}
                  className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TYPE_COLORS[t.testType] || "bg-slate-100 text-slate-600"}`}>
                      {t.testType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{t.testReportNumber || "—"}</td>
                  <td className="px-4 py-3 font-bold text-[#00b4c3]">
                    {t.submission?.fuzeFabricNumber ? `FUZE ${t.submission.fuzeFabricNumber}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">{t.lab?.name || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{t.testMethodStd || "—"}</td>
                  <td className="px-4 py-3 text-center">{t.washCount || "—"}</td>
                  <td className="px-4 py-3">
                    {pass === true && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">PASS</span>}
                    {pass === false && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">FAIL</span>}
                    {pass === null || pass === undefined && <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {t.testDate ? new Date(t.testDate).toLocaleDateString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            {filter === "all" ? "No test results yet for your brand" : `No ${filter} results`}
          </div>
        )}
      </div>
    </div>
  );
}
