"use client";
import { useEffect, useState } from "react";

const TYPE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  ICP: { bg: "bg-blue-100", text: "text-blue-700", bar: "#3b82f6" },
  ANTIBACTERIAL: { bg: "bg-purple-100", text: "text-purple-700", bar: "#8b5cf6" },
  FUNGAL: { bg: "bg-amber-100", text: "text-amber-700", bar: "#f59e0b" },
  ODOR: { bg: "bg-rose-100", text: "text-rose-700", bar: "#f43f5e" },
  UV: { bg: "bg-cyan-100", text: "text-cyan-700", bar: "#06b6d4" },
  OTHER: { bg: "bg-slate-100", text: "text-slate-600", bar: "#94a3b8" },
  UNKNOWN: { bg: "bg-slate-100", text: "text-slate-600", bar: "#94a3b8" },
};

type TestData = {
  total: number;
  typeBreakdown: { type: string; count: number }[];
  runs: {
    id: string;
    testType: string | null;
    dateSent: string | null;
    dateReceived: string | null;
    lab: string | null;
    brand: string | null;
    factory: string | null;
    fuzeNumber: string | null;
    hasIcp: boolean;
    hasAb: boolean;
    hasFungal: boolean;
    hasOdor: boolean;
  }[];
  resultCounts: {
    icp: number;
    fungal: number;
    odor: number;
  };
};

export default function TestsPage() {
  const [data, setData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/tests")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-lg">
        Loading test results...
      </div>
    );
  if (!data)
    return <div className="text-red-500 p-6">Failed to load test data.</div>;

  const maxType = Math.max(...data.typeBreakdown.map((t) => t.count), 1);
  const totalResults = data.resultCounts.icp + data.resultCounts.fungal + data.resultCounts.odor;

  const filteredRuns = data.runs.filter((r) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (r.testType && r.testType.toLowerCase().includes(q)) ||
      (r.lab && r.lab.toLowerCase().includes(q)) ||
      (r.brand && r.brand.toLowerCase().includes(q)) ||
      (r.factory && r.factory.toLowerCase().includes(q)) ||
      (r.fuzeNumber && r.fuzeNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">Test Results</h1>
        <p className="text-sm text-slate-500 mt-1">
          {data.total.toLocaleString()} test runs with{" "}
          {totalResults.toLocaleString()} detailed results
        </p>
      </div>

      {/* Result count cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-3xl font-black text-slate-800">
            {data.total.toLocaleString()}
          </p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Total Test Runs</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-3xl font-black text-blue-600">
            {data.resultCounts.icp.toLocaleString()}
          </p>
          <p className="text-xs font-semibold text-slate-500 mt-1">ICP Results</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-3xl font-black text-amber-600">
            {data.resultCounts.fungal.toLocaleString()}
          </p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Fungal Results</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-3xl font-black text-rose-600">
            {data.resultCounts.odor.toLocaleString()}
          </p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Odor Results</p>
        </div>
      </div>

      {/* Tests by type bar chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Tests by Type</h3>
        <div className="space-y-3">
          {data.typeBreakdown.map((t) => {
            const colors = TYPE_COLORS[t.type] || TYPE_COLORS.UNKNOWN;
            return (
              <div key={t.type} className="flex items-center gap-3">
                <div className="w-32 text-xs font-semibold text-slate-600 text-right truncate">
                  {t.type}
                </div>
                <div className="flex-1 bg-slate-100 rounded-full h-8 relative overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                    style={{
                      width: `${Math.max((t.count / maxType) * 100, 3)}%`,
                      background: colors.bar,
                    }}
                  >
                    <span className="text-[11px] font-bold text-white drop-shadow">
                      {t.count}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent test runs table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Recent Test Runs</h3>
          <input
            type="text"
            placeholder="Filter runs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase">
                Type
              </th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase">
                Brand
              </th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase">
                FUZE #
              </th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase">
                Lab
              </th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase">
                Factory
              </th>
              <th className="text-center px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase">
                Results
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((r) => {
              const typeColor = TYPE_COLORS[r.testType || "UNKNOWN"] || TYPE_COLORS.UNKNOWN;
              return (
                <tr
                  key={r.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${typeColor.bg} ${typeColor.text}`}
                    >
                      {r.testType || "\u2014"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-700 font-medium">
                    {r.brand || "\u2014"}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-600">
                    {r.fuzeNumber || "\u2014"}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-600">
                    {r.lab || "\u2014"}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-600">
                    {r.factory || "\u2014"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {r.hasIcp && (
                        <span className="w-2 h-2 rounded-full bg-blue-500" title="ICP" />
                      )}
                      {r.hasAb && (
                        <span
                          className="w-2 h-2 rounded-full bg-purple-500"
                          title="Antibacterial"
                        />
                      )}
                      {r.hasFungal && (
                        <span
                          className="w-2 h-2 rounded-full bg-amber-500"
                          title="Fungal"
                        />
                      )}
                      {r.hasOdor && (
                        <span
                          className="w-2 h-2 rounded-full bg-rose-500"
                          title="Odor"
                        />
                      )}
                      {!r.hasIcp && !r.hasAb && !r.hasFungal && !r.hasOdor && (
                        <span className="text-slate-300 text-xs">{"\u2014"}</span>
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
  );
}
