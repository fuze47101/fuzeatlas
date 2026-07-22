"use client";

/**
 * FUZE Fabric Library (item 10) — search-first.
 *
 * Nothing is listed on load. The user first picks a search axis — by fabric
 * construction, by test method, or by organism — and only then do matching
 * fabric/test cards render (paginated). FUZE numbers are neither a search
 * option nor shown in the result headers (the library is anonymized).
 */

import { useAuth } from "@/lib/AuthContext";
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

type SearchMode = "construction" | "testMethod" | "organism";

const TEST_TYPE_COLORS: Record<string, string> = {
  ICP: "bg-violet-100 text-violet-800 border-violet-200",
  ANTIBACTERIAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FUNGAL: "bg-amber-100 text-amber-800 border-amber-200",
  ODOR: "bg-sky-100 text-sky-800 border-sky-200",
  UV: "bg-orange-100 text-orange-800 border-orange-200",
  MOISTURE: "bg-blue-100 text-blue-800 border-blue-200",
};

// Module-scoped so it keeps a stable identity across parent re-renders —
// defining it inside the page component would remount the <input> on every
// keystroke and drop focus.
function SearchCard({
  icon,
  title,
  desc,
  placeholder,
  searchLabel,
  value,
  onChange,
  onSubmit,
}: {
  icon: string;
  title: string;
  desc: string;
  placeholder: string;
  searchLabel: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 mb-3 flex-1">{desc}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
        />
        <button
          type="submit"
          className="px-3 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-semibold hover:bg-[#009ba8] whitespace-nowrap"
        >
          {searchLabel}
        </button>
      </form>
    </div>
  );
}

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

  const [catalog, setCatalog] = useState<CatalogFabric[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Search-first state
  const [mode, setMode] = useState<SearchMode | null>(null);
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Per-card input drafts
  const [constructionQ, setConstructionQ] = useState("");
  const [methodQ, setMethodQ] = useState("");
  const [organismQ, setOrganismQ] = useState("");

  const loadCatalog = useCallback(async () => {
    if (!mode || !query) return;
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (mode === "construction") params.set("search", query);
      else if (mode === "testMethod") params.set("testMethod", query);
      else if (mode === "organism") params.set("organism", query);
      params.set("page", String(page));

      const res = await fetch(`/api/fabric-library?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setCatalog(data.catalog);
        setTotal(data.pagination?.total ?? data.catalog.length);
        setTotalPages(data.pagination?.totalPages ?? 1);
      } else {
        setError(data.error || T.errorFailedDefault);
      }
    } catch {
      setError(T.errorFailedLoad);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, query, page]);

  useEffect(() => {
    if (!user || !hasSearched) return;
    loadCatalog();
  }, [user, hasSearched, loadCatalog]);

  function runSearch(m: SearchMode, value: string) {
    const v = value.trim();
    if (!v) return;
    setExpandedIdx(null);
    setMode(m);
    setQuery(v);
    setPage(1);
    setHasSearched(true);
  }

  function resetSearch() {
    setHasSearched(false);
    setMode(null);
    setQuery("");
    setCatalog([]);
    setExpandedIdx(null);
    setError("");
  }

  const formatReduction = (val?: number) => {
    if (val == null) return "—";
    return val >= 99.9 ? ">99.9%" : `${val.toFixed(1)}%`;
  };
  const formatPpm = (val?: number) => {
    if (val == null) return "—";
    return `${val.toFixed(1)} ppm`;
  };

  const headerFor = (f: CatalogFabric) =>
    f.construction || f.fabricCategory || f.weavePattern || f.knitStitchType || T.fabricGeneric;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 mb-2">{T.pageTitle}</h1>
        <p className="text-slate-600 max-w-2xl">{T.pageSubtitle}</p>
      </div>

      {/* Search-option cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <SearchCard
          icon="🧵"
          searchLabel={T.searchBtn}
          title={T.sbConstructionTitle}
          desc={T.sbConstructionDesc}
          placeholder={T.sbConstructionPlaceholder}
          value={constructionQ}
          onChange={setConstructionQ}
          onSubmit={() => runSearch("construction", constructionQ)}
        />
        <SearchCard
          icon="🧪"
          searchLabel={T.searchBtn}
          title={T.sbMethodTitle}
          desc={T.sbMethodDesc}
          placeholder={T.sbMethodPlaceholder}
          value={methodQ}
          onChange={setMethodQ}
          onSubmit={() => runSearch("testMethod", methodQ)}
        />
        <SearchCard
          icon="🦠"
          searchLabel={T.searchBtn}
          title={T.sbOrganismTitle}
          desc={T.sbOrganismDesc}
          placeholder={T.sbOrganismPlaceholder}
          value={organismQ}
          onChange={setOrganismQ}
          onSubmit={() => runSearch("organism", organismQ)}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results — only after a search is run */}
      {!hasSearched ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
          {T.chooseIntro}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-600">
              {T.resultsFound.replace("{n}", total.toLocaleString()).replace("{q}", query)}
            </p>
            <button onClick={resetSearch} className="text-sm text-[#00b4c3] hover:underline font-medium">
              {T.newSearch}
            </button>
          </div>

          {catalog.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              {T.noResults}
            </div>
          ) : (
            <>
              {/* Fabric Cards */}
              <div className="space-y-3">
                {catalog.map((fabric, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-[#00b4c3]/50 transition-all"
                  >
                    {/* Fabric Header Row */}
                    <button
                      onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className="font-semibold text-slate-900 truncate">{headerFor(fabric)}</span>
                        <div className="hidden sm:flex items-center gap-2 flex-1 min-w-0">
                          {fabric.weightGsm && (
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                              {fabric.weightGsm} GSM
                            </span>
                          )}
                          {fabric.yarnType && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                              {fabric.yarnType}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Test type pills (compact) */}
                        <div className="hidden md:flex items-center gap-1">
                          {[...new Set(fabric.tests.map((tt) => tt.testType))].map((type) => (
                            <span
                              key={type}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${TEST_TYPE_COLORS[type] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                            >
                              {type === "ANTIBACTERIAL" ? "AB" : type}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {fabric.testCount} {fabric.testCount !== 1 ? T.testsSuffix : T.testSuffix}
                        </span>
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform ${expandedIdx === idx ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded Detail */}
                    {expandedIdx === idx && (
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
                                    <td className="px-3 py-2 text-slate-600 text-xs">{test.testMethod || "—"}</td>
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
        </>
      )}
    </div>
  );
}
