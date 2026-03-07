"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

interface TestRun {
  id: string;
  testType: string;
  testReportNumber?: string;
  testMethodStd?: string;
  testDate?: string;
  washCount?: number;
  lab?: string;
  fuzeNumber?: number;
  customerCode?: string;
  factoryCode?: string;
  fabricId: string;
  hasIcp: boolean;
  hasAb: boolean;
  hasFungal: boolean;
  hasOdor: boolean;
  result?: string;
  submissionDate?: string;
}

interface TestData {
  total: number;
  runs: TestRun[];
}

const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  ICP: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  ANTIBACTERIAL: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  FUNGAL: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  ODOR: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  UV: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  MICROFIBER: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    dot: "bg-teal-500",
  },
  OTHER: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
};

export default function FactoryTestResultsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/factory-portal/tests", {
        headers: {
          "x-user-id": user?.id || "",
        },
      });
      const d = await res.json();
      if (d.ok) {
        setData(d);
      }
    } catch (error) {
      console.error("Error loading test results:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const filtered = (data?.runs || []).filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.testType.toLowerCase().includes(q) ||
      (r.testReportNumber || "").toLowerCase().includes(q) ||
      (r.lab || "").toLowerCase().includes(q) ||
      (r.fuzeNumber?.toString() || "").includes(q) ||
      (r.customerCode || "").toLowerCase().includes(q);

    const matchesType = !filterType || r.testType === filterType;

    return matchesSearch && matchesType;
  });

  const typeBreakdown = Array.from(
    new Map(
      (data?.runs || []).map((r) => [
        r.testType,
        ((data?.runs || []).filter((x) => x.testType === r.testType) || [])
          .length,
      ])
    )
  ).map(([type, count]) => ({ type, count }));

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Test Results
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {data?.total || 0} test results for your fabrics
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {typeBreakdown.map((t) => {
          const colors = TYPE_COLORS[t.type] || TYPE_COLORS.OTHER;
          return (
            <button
              key={t.type}
              onClick={() =>
                setFilterType(filterType === t.type ? "" : t.type)
              }
              className={`flex-shrink-0 p-3 rounded-xl border text-left transition-all min-w-[120px] sm:min-w-0 ${
                filterType === t.type
                  ? `${colors.bg} border-current ${colors.text} ring-2 ring-current/20`
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className="text-xs font-medium uppercase tracking-wide">
                  {t.type}
                </span>
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
          placeholder="Search by test type, report number, lab, FUZE number, or customer code..."
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] text-sm"
        />
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
            {search || filterType
              ? "No test results match your filters"
              : "No test results yet"}
          </div>
        ) : (
          filtered.map((run) => {
            const colors = TYPE_COLORS[run.testType] || TYPE_COLORS.OTHER;
            const isExpanded = expandedId === run.id;

            return (
              <div
                key={run.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Header - clickable to expand */}
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : run.id)
                  }
                  className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text} flex-shrink-0`}
                      >
                        {run.testType}
                      </span>
                      {run.result && (
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            run.result === "PASS"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {run.result}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                      {run.testReportNumber && (
                        <span className="font-medium text-slate-900">
                          {run.testReportNumber}
                        </span>
                      )}
                      {run.lab && (
                        <span className="text-slate-600">
                          Lab: <span className="font-medium">{run.lab}</span>
                        </span>
                      )}
                      {run.testDate && (
                        <span className="text-slate-500">{run.testDate}</span>
                      )}
                    </div>

                    {(run.fuzeNumber || run.customerCode) && (
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                        {run.fuzeNumber && (
                          <span>
                            FUZE: <span className="font-medium">{run.fuzeNumber}</span>
                          </span>
                        )}
                        {run.customerCode && (
                          <span>
                            Code:{" "}
                            <span className="font-medium">{run.customerCode}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expand icon */}
                  <svg
                    className={`w-5 h-5 text-slate-400 ml-4 flex-shrink-0 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </button>

                {/* Details - expandable */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 sm:px-6 py-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {run.testMethodStd && (
                        <div>
                          <p className="text-slate-500 font-medium">
                            Test Method
                          </p>
                          <p className="text-slate-900">{run.testMethodStd}</p>
                        </div>
                      )}
                      {run.washCount !== undefined && run.washCount !== null && (
                        <div>
                          <p className="text-slate-500 font-medium">
                            Wash Count
                          </p>
                          <p className="text-slate-900">{run.washCount}</p>
                        </div>
                      )}
                      {run.submissionDate && (
                        <div>
                          <p className="text-slate-500 font-medium">
                            Submitted
                          </p>
                          <p className="text-slate-900">{run.submissionDate}</p>
                        </div>
                      )}
                      {run.factoryCode && (
                        <div>
                          <p className="text-slate-500 font-medium">
                            Factory Code
                          </p>
                          <p className="text-slate-900">{run.factoryCode}</p>
                        </div>
                      )}
                    </div>

                    {/* Test components */}
                    {(run.hasIcp ||
                      run.hasAb ||
                      run.hasFungal ||
                      run.hasOdor) && (
                      <div className="pt-2">
                        <p className="text-slate-500 font-medium text-sm mb-2">
                          Test Components
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {run.hasIcp && (
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                              ICP
                            </span>
                          )}
                          {run.hasAb && (
                            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded">
                              Antibacterial
                            </span>
                          )}
                          {run.hasFungal && (
                            <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded">
                              Fungal
                            </span>
                          )}
                          {run.hasOdor && (
                            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-medium rounded">
                              Odor
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
