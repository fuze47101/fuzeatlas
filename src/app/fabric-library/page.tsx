"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/i18n";

interface TestResult {
  testType: string;
  testMethod?: string;
  washCount?: number;
  testDate?: string;
  icpAgPpm?: number;
  organism?: string;
  percentReduction?: number;
  abPass?: boolean;
  fungalPass?: boolean;
  odorPass?: boolean;
  odorType?: string;
}

interface CatalogFabric {
  fuzeNumber: number | null;
  construction?: string;
  weightGsm?: number;
  widthInches?: number;
  yarnType?: string;
  fabricCategory?: string;
  endUse?: string;
  weavePattern?: string;
  knitStitchType?: string;
  color?: string;
  testCount: number;
  tests: TestResult[];
}

interface Stats {
  totalFabrics: number;
  totalTests: number;
  totalIcp: number;
  totalAb: number;
}


const TEST_TYPE_COLORS: Record<string, string> = {
  ICP: "bg-violet-100 text-violet-800 border-violet-200",
  ANTIBACTERIAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FUNGAL: "bg-amber-100 text-amber-800 border-amber-200",
  ODOR: "bg-sky-100 text-sky-800 border-sky-200",
  UV: "bg-orange-100 text-orange-800 border-orange-200",
  MOISTURE: "bg-blue-100 text-blue-800 border-blue-200",
};

export default function FabricLibraryPage() {
  const { t } = useI18n();
  const T = t.fabricLibraryPage;
  const TEST_TYPE_LABELS: Record<string, string> = {
    ICP: T.filterIcp,
    ANTIBACTERIAL: T.filterAntibacterial,
    FUNGAL: T.filterFungal,
    ODOR: T.filterOdor,
    UV: "UV Resistance",
    MOISTURE: "Moisture",
  };
  const { user } = useAuth();
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogFabric[]>([]);
  const [stats, setStats] = useState<Stats>({ totalFabrics: 0, totalTests: 0, totalIcp: 0, totalAb: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [testTypeFilter, setTestTypeFilter] = useState("");
  const [passOnly, setPassOnly] = useState(false);
  const [expandedFabric, setExpandedFabric] = useState<number | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (testTypeFilter) params.set("testType", testTypeFilter);
      if (passOnly) params.set("passOnly", "true");
      params.set("page", String(page));

      const res = await fetch(`/api/fabric-library?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setCatalog(data.catalog);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
      } else {
        setError(data.error || T.errorFailedDefault);
      }
    } catch {
      setError(T.errorFailedLoad);
    } finally {
      setLoading(false);
    }
  }, [search, testTypeFilter, passOnly, page]);

  useEffect(() => {
    if (!user) return;
    loadCatalog();
  }, [user, loadCatalog]);

  const formatReduction = (val?: number) => {
    if (val == null) return "—";
    return val >= 99.9 ? ">99.9%" : `${val.toFixed(1)}%`;
  };

  const formatPpm = (val?: number) => {
    if (val == null) return "—";
    return `${val.toFixed(1)} ppm`;
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 mb-2">{T.pageTitle}</h1>
        <p className="text-slate-600 max-w-2xl">
          {T.pageSubtitle}
        </p>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] rounded-xl p-4 text-white">
          <p className="text-xs text-white/70 uppercase tracking-wider font-semibold">{T.statFabrics}</p>
          <p className="text-3xl font-black mt-1">{stats.totalFabrics.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white">
          <p className="text-xs text-white/70 uppercase tracking-wider font-semibold">{T.statTests}</p>
          <p className="text-3xl font-black mt-1">{stats.totalTests.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{T.statIcp}</p>
          <p className="text-3xl font-black text-violet-700 mt-1">{stats.totalIcp.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{T.statAb}</p>
          <p className="text-3xl font-black text-emerald-700 mt-1">{stats.totalAb.toLocaleString()}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={T.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
          />
        </div>
        <select
          value={testTypeFilter}
          onChange={(e) => { setTestTypeFilter(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-w-[160px] focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
        >
          <option value="">{T.filterAllTypes}</option>
          <option value="ICP">{T.filterIcp}</option>
          <option value="ANTIBACTERIAL">{T.filterAntibacterial}</option>
          <option value="FUNGAL">{T.filterFungal}</option>
          <option value="ODOR">{T.filterOdor}</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white cursor-pointer hover:bg-slate-50 whitespace-nowrap">
          <input
            type="checkbox"
            checked={passOnly}
            onChange={(e) => { setPassOnly(e.target.checked); setPage(1); }}
            className="rounded text-[#00b4c3] focus:ring-[#00b4c3]"
          />
          {T.passOnly}
        </label>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : catalog.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">{T.emptyTitle}</p>
          <button
            onClick={() => { setSearchInput(""); setSearch(""); setTestTypeFilter(""); setPassOnly(false); }}
            className="text-[#00b4c3] hover:underline font-medium text-sm"
          >
            {T.emptyClear}
          </button>
        </div>
      ) : (
        <>
          {/* Fabric Cards */}
          <div className="space-y-3">
            {catalog.map((fabric, idx) => (
              <div key={fabric.fuzeNumber || idx}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-[#00b4c3]/50 transition-all">
                {/* Fabric Header Row */}
                <button
                  onClick={() => setExpandedFabric(expandedFabric === fabric.fuzeNumber ? null : fabric.fuzeNumber)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="font-mono font-black text-[#00b4c3] text-lg whitespace-nowrap">
                      FUZE-{fabric.fuzeNumber}
                    </span>
                    <div className="hidden sm:flex items-center gap-2 flex-1 min-w-0">
                      {fabric.construction && (
                        <span className="text-sm text-slate-700 truncate">{fabric.construction}</span>
                      )}
                      {fabric.weightGsm && (
                        <span className="text-xs text-slate-400 whitespace-nowrap">{fabric.weightGsm} GSM</span>
                      )}
                      {fabric.yarnType && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">{fabric.yarnType}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Test type pills (compact) */}
                    <div className="hidden md:flex items-center gap-1">
                      {[...new Set(fabric.tests.map(t => t.testType))].map(type => (
                        <span key={type}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${TEST_TYPE_COLORS[type] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {type === "ANTIBACTERIAL" ? "AB" : type}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {fabric.testCount} {fabric.testCount !== 1 ? T.testsSuffix : T.testSuffix}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${expandedFabric === fabric.fuzeNumber ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Detail */}
                {expandedFabric === fabric.fuzeNumber && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50">
                    {/* Fabric Properties */}
                    <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 text-sm">
                      {fabric.construction && (
                        <div><span className="text-slate-500">{T.propConstruction}</span> <span className="font-medium text-slate-800">{fabric.construction}</span></div>
                      )}
                      {fabric.weightGsm && (
                        <div><span className="text-slate-500">{T.propWeight}</span> <span className="font-medium text-slate-800">{fabric.weightGsm} GSM</span></div>
                      )}
                      {fabric.widthInches && (
                        <div><span className="text-slate-500">{T.propWidth}</span> <span className="font-medium text-slate-800">{fabric.widthInches}&quot;</span></div>
                      )}
                      {fabric.yarnType && (
                        <div><span className="text-slate-500">{T.propYarn}</span> <span className="font-medium text-slate-800">{fabric.yarnType}</span></div>
                      )}
                      {fabric.fabricCategory && (
                        <div><span className="text-slate-500">{T.propCategory}</span> <span className="font-medium text-slate-800 capitalize">{fabric.fabricCategory}</span></div>
                      )}
                      {fabric.endUse && (
                        <div><span className="text-slate-500">{T.propEndUse}</span> <span className="font-medium text-slate-800">{fabric.endUse}</span></div>
                      )}
                      {fabric.weavePattern && (
                        <div><span className="text-slate-500">{T.propWeave}</span> <span className="font-medium text-slate-800">{fabric.weavePattern}</span></div>
                      )}
                      {fabric.color && (
                        <div><span className="text-slate-500">{T.propColor}</span> <span className="font-medium text-slate-800">{fabric.color}</span></div>
                      )}
                    </div>

                    {/* Test Results Table */}
                    {fabric.tests.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 border-b border-slate-200">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold text-slate-700">{T.colTest}</th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-700">{T.colMethod}</th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-700 hidden sm:table-cell">{T.colWashes}</th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-700">{T.colResult}</th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-700">{T.colStatus}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {fabric.tests.map((test, ti) => (
                              <tr key={ti} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${TEST_TYPE_COLORS[test.testType] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                                    {TEST_TYPE_LABELS[test.testType] || test.testType}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-600 text-xs">
                                  {test.testMethod || "—"}
                                </td>
                                <td className="px-3 py-2 text-slate-600 hidden sm:table-cell">
                                  {test.washCount != null ? `${test.washCount}x` : "—"}
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-800">
                                  {test.testType === "ICP" && formatPpm(test.icpAgPpm)}
                                  {test.testType === "ANTIBACTERIAL" && (
                                    <span>{formatReduction(test.percentReduction)}{test.organism ? <span className="text-xs text-slate-400 ml-1">({test.organism})</span> : ""}</span>
                                  )}
                                  {test.testType === "FUNGAL" && (test.fungalPass != null ? (test.fungalPass ? T.pass : T.fail) : "—")}
                                  {test.testType === "ODOR" && (test.odorPass != null ? (test.odorPass ? T.pass : T.fail) : "—")}
                                  {!["ICP", "ANTIBACTERIAL", "FUNGAL", "ODOR"].includes(test.testType) && "—"}
                                </td>
                                <td className="px-3 py-2">
                                  {(() => {
                                    let pass: boolean | null = null;
                                    if (test.testType === "ICP") pass = test.icpAgPpm != null && test.icpAgPpm > 0;
                                    else if (test.testType === "ANTIBACTERIAL") pass = test.abPass ?? null;
                                    else if (test.testType === "FUNGAL") pass = test.fungalPass ?? null;
                                    else if (test.testType === "ODOR") pass = test.odorPass ?? null;

                                    if (pass === true) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">{T.passBadge}</span>;
                                    if (pass === false) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{T.failBadge}</span>;
                                    return <span className="text-slate-400 text-xs">—</span>;
                                  })()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                {T.paginationPrev}
              </button>
              <span className="text-sm text-slate-600 px-4">
                {T.paginationLabel.replace("{page}", String(page)).replace("{pages}", String(totalPages))}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                {T.paginationNext}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
