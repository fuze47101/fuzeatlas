"use client";

import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface TestReport {
  testRunId: string;
  documentId: string | null;
  filename: string | null;
  sizeBytes: number | null;
  downloadUrl: string | null;
  testType: string;
  testMethodStd: string | null;
  reportNumber: string | null;
  washCount: number | null;
  testDate: string | null;
  labName: string | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string; country?: string } | null;
  fuzeNumber: number | null;
  customerFabricCode: string | null;
  factoryFabricCode: string | null;
  fabricCategory: string | null;
  color: string | null;
  projectName: string | null;
  createdAt: string;
}

// TestType enum values from prisma/schema.prisma
const TEST_TYPE_LABELS: Record<string, string> = {
  ICP: "ICP",
  ANTIBACTERIAL: "Antibacterial",
  FUNGAL: "Antifungal",
  ODOR: "Odor",
  UV: "UV",
  MICROFIBER: "Microfiber",
  OTHER: "Other",
};

const TEST_TYPE_COLORS: Record<string, string> = {
  ICP: "bg-violet-100 text-violet-800 border-violet-200",
  ANTIBACTERIAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FUNGAL: "bg-lime-100 text-lime-800 border-lime-200",
  ODOR: "bg-blue-100 text-blue-800 border-blue-200",
  UV: "bg-amber-100 text-amber-800 border-amber-200",
  MICROFIBER: "bg-cyan-100 text-cyan-800 border-cyan-200",
  OTHER: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function DistributorTestReportsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.distributorPortal.testReportsPage;
  const router = useRouter();
  const [reports, setReports] = useState<TestReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [testTypeFilter, setTestTypeFilter] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.role !== "DISTRIBUTOR_USER" && user.role !== "ADMIN" && user.role !== "EMPLOYEE") {
      router.push("/dashboard");
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (testTypeFilter) params.set("testType", testTypeFilter);
        const res = await fetch(`/api/distributor-portal/test-reports?${params.toString()}`);
        const data = await res.json();
        if (data.ok) setReports(data.reports);
        else setError(data.error || "Failed to load reports");
      } catch {
        setError("Failed to load test reports");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, router, search, testTypeFilter]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/distributor-portal" className="hover:text-[#00b4c3]">
            {t.distributorPortal.crumb}
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Lab reports (ICP, antibacterial, antifungal, odor, wash) for the brands and factories you
          serve
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by brand, factory, FUZE#, customer code, report#..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
          />
        </div>
        <select
          value={testTypeFilter}
          onChange={(e) => setTestTypeFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-w-[200px] focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
        >
          <option value="">All Test Types</option>
          {Object.entries(TEST_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">
            {search || testTypeFilter
              ? "No test reports match your filters"
              : "No test reports for your brands and factories yet"}
          </p>
          {(search || testTypeFilter) && (
            <button
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setTestTypeFilter("");
              }}
              className="text-[#00b4c3] hover:underline font-medium text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div
              key={r.testRunId}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-[#00b4c3]/50 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${TEST_TYPE_COLORS[r.testType] || TEST_TYPE_COLORS.OTHER}`}
                    >
                      {TEST_TYPE_LABELS[r.testType] || r.testType}
                    </span>
                    {r.testMethodStd && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {r.testMethodStd}
                      </span>
                    )}
                    {r.washCount !== null && r.washCount !== undefined && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-50 text-cyan-700 border border-cyan-200">
                        {r.washCount}× wash
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">
                    {r.brand?.name || "Unbranded"}
                    {r.factory?.name && (
                      <span className="text-slate-500 font-normal"> · {r.factory.name}</span>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {r.fuzeNumber !== null && (
                      <span>
                        FUZE#:{" "}
                        <span className="text-slate-800 font-mono font-semibold">
                          FUZE-{r.fuzeNumber}
                        </span>
                      </span>
                    )}
                    {r.customerFabricCode && (
                      <span>
                        Brand item #:{" "}
                        <span className="text-slate-800 font-mono">{r.customerFabricCode}</span>
                      </span>
                    )}
                    {r.factoryFabricCode && (
                      <span>
                        Factory item #:{" "}
                        <span className="text-slate-800 font-mono">{r.factoryFabricCode}</span>
                      </span>
                    )}
                    {r.fabricCategory && (
                      <span>
                        {r.fabricCategory}
                        {r.color ? ` · ${r.color}` : ""}
                      </span>
                    )}
                    {r.labName && (
                      <span>
                        Lab: <span className="text-slate-700 font-medium">{r.labName}</span>
                      </span>
                    )}
                    {r.reportNumber && (
                      <span>
                        Report#: <span className="text-slate-800 font-mono">{r.reportNumber}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs text-slate-500">
                    Test date: {formatDate(r.testDate)}
                  </span>
                  {r.filename && (
                    <span className="text-xs text-slate-400">
                      {r.filename} {r.sizeBytes ? `(${formatSize(r.sizeBytes)})` : ""}
                    </span>
                  )}
                  {r.downloadUrl ? (
                    <a
                      href={r.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#00b4c3] text-white rounded-lg text-xs font-semibold hover:bg-[#009ba8] transition-colors"
                    >
                      View report
                    </a>
                  ) : (
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-xs font-medium">
                      No file
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
