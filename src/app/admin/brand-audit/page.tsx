"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ErrorPanel from "@/components/ErrorPanel";

interface Brand {
  id: string;
  name: string;
  validationStatus: string | null;
  validationReason: string | null;
  validationDate: string | null;
  fuzeRelevance: string | null;
  textileCategory: string | null;
  companyStatus: string | null;
  website: string | null;
  backgroundInfo: string | null;
  pipelineStage: string;
  customerType: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  validated: number;
  unvalidated: number;
  percentComplete: number;
  byStatus: Record<string, number>;
  byRelevance: Record<string, number>;
  byCategory: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-700",
  irrelevant: "bg-orange-100 text-orange-700",
  dead: "bg-red-100 text-red-700",
  unknown: "bg-slate-100 text-slate-500",
  pending: "bg-blue-100 text-blue-700",
};

const RELEVANCE_COLORS: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-cyan-100 text-cyan-700",
  low: "bg-amber-100 text-amber-700",
  none: "bg-red-100 text-red-700",
};

export default function BrandAuditPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filtered, setFiltered] = useState<Brand[]>([]);
  const [validating, setValidating] = useState(false);
  // Silent-zero sweep — surface API failures explicitly instead of
  // hiding the stats panel and rendering an empty table that looks
  // like "no brands need validation."
  const [loadError, setLoadError] = useState<string | null>(null);
  const [validationLog, setValidationLog] = useState<string[]>([]);
  const [actionResult, setActionResult] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [relevanceFilter, setRelevanceFilter] = useState("all");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [statsRes, brandsRes] = await Promise.all([
        fetch("/api/admin/brand-validate"),
        fetch("/api/brands"),
      ]);
      const statsData = await statsRes.json().catch(() => null);
      const brandsData = await brandsRes.json().catch(() => null);

      if (!statsRes.ok || !statsData || statsData.ok === false || !statsData.stats) {
        setLoadError(
          (statsData && (statsData.error || statsData.message)) ||
            `Couldn't load brand validation stats (HTTP ${statsRes.status}).`,
        );
        return;
      }
      setStats(statsData.stats);
      if (brandsData?.ok && brandsData.brands) {
        setBrands(brandsData.brands);
        setFiltered(brandsData.brands);
      }
    } catch (e: any) {
      setLoadError(e?.message || "Network error while loading brand audit.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter
  useEffect(() => {
    let f = brands;
    if (search) {
      const q = search.toLowerCase();
      f = f.filter((b) => b.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      if (statusFilter === "unvalidated") {
        f = f.filter((b) => !b.validationStatus);
      } else {
        f = f.filter((b) => b.validationStatus === statusFilter);
      }
    }
    if (relevanceFilter !== "all") {
      f = f.filter((b) => b.fuzeRelevance === relevanceFilter);
    }
    setFiltered(f);
  }, [search, statusFilter, relevanceFilter, brands]);

  // Run validation batch
  const runValidation = async (batchSize: number) => {
    setValidating(true);
    setValidationLog((prev) => [...prev, `Starting validation batch (${batchSize} brands)...`]);

    try {
      const res = await fetch("/api/admin/brand-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "batch", batchSize }),
      });
      const data = await res.json();

      if (data.ok) {
        setValidationLog((prev) => [
          ...prev,
          `Processed ${data.processed} brands — ${data.updated} updated, ${data.errors} errors`,
          `Progress: ${data.stats?.validated}/${data.stats?.total} (${data.stats?.percentComplete}%)`,
        ]);

        // Show individual results
        if (data.results) {
          for (const r of data.results) {
            const icon = r.status === "verified" ? "✅" : r.status === "irrelevant" ? "⚠️" : r.status === "dead" ? "💀" : "❓";
            setValidationLog((prev) => [
              ...prev,
              `  ${icon} ${r.name} → ${r.status} (${r.fuzeRelevance}) — ${r.reason?.slice(0, 100)}`,
            ]);
          }
        }

        setStats(data.stats);
        loadData(); // Refresh
      } else {
        setValidationLog((prev) => [...prev, `Error: ${data.error}`]);
      }
    } catch (e: any) {
      setValidationLog((prev) => [...prev, `Error: ${e.message}`]);
    } finally {
      setValidating(false);
    }
  };

  // Cleanup actions
  const runCleanup = async (action: string) => {
    const messages: Record<string, string> = {
      delete_dead: "DELETE all dead/non-existent brands with no activity? This cannot be undone.",
      delete_irrelevant: "DELETE all irrelevant brands with no activity? This cannot be undone.",
      delete_unknown: "DELETE all unknown brands with no activity? This cannot be undone.",
      archive_irrelevant: "ARCHIVE all irrelevant LEAD brands? They will be moved to Archive stage.",
      archive_unknown: "ARCHIVE all unknown LEAD brands? They will be moved to Archive stage.",
    };
    const ok = window.confirm(messages[action] || `Run cleanup action: ${action}?`);
    if (!ok) return;

    const res = await fetch("/api/admin/brand-validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "cleanup", action }),
    });
    const data = await res.json();
    setActionResult(data.message);
    loadData();
  };

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/admin" className="hover:text-slate-600">Dashboard</Link>
            <span>/</span>
            <span>Brand Audit</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800">Brand Validation & Cleanup</h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-powered validation — is each brand real, active, and relevant for FUZE?
          </p>
        </div>
        {stats && (
          <div className="text-right">
            <p className="text-4xl font-black text-cyan-600">{stats.total.toLocaleString()}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Total Brands</p>
          </div>
        )}
      </div>

      {loadError && (
        <div className="mb-4">
          <ErrorPanel context="Load brand audit" error={loadError} onRetry={loadData} />
        </div>
      )}

      {/* Progress + Stats */}
      {stats && (
        <>
          {/* Progress Bar */}
          <div className="bg-white border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-700">Validation Progress</p>
              <p className="text-sm font-bold text-slate-700">{stats.percentComplete}%</p>
            </div>
            <div className="bg-slate-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${stats.percentComplete}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {stats.validated} validated / {stats.unvalidated} remaining
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter(statusFilter === "verified" ? "all" : "verified")}>
              <p className="text-2xl font-black text-emerald-700">{stats.byStatus.verified || 0}</p>
              <p className="text-[10px] font-semibold text-emerald-600 uppercase">Verified</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter(statusFilter === "irrelevant" ? "all" : "irrelevant")}>
              <p className="text-2xl font-black text-orange-700">{stats.byStatus.irrelevant || 0}</p>
              <p className="text-[10px] font-semibold text-orange-600 uppercase">Irrelevant</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter(statusFilter === "dead" ? "all" : "dead")}>
              <p className="text-2xl font-black text-red-700">{stats.byStatus.dead || 0}</p>
              <p className="text-[10px] font-semibold text-red-600 uppercase">Dead</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter(statusFilter === "unknown" ? "all" : "unknown")}>
              <p className="text-2xl font-black text-slate-700">{stats.byStatus.unknown || 0}</p>
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Unknown</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter(statusFilter === "unvalidated" ? "all" : "unvalidated")}>
              <p className="text-2xl font-black text-blue-700">{stats.unvalidated}</p>
              <p className="text-[10px] font-semibold text-blue-600 uppercase">Unvalidated</p>
            </div>
          </div>

          {/* Relevance Breakdown */}
          {Object.keys(stats.byRelevance).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {["high", "medium", "low", "none"].map((rel) => (
                <div key={rel} className={`border rounded-xl p-3 text-center cursor-pointer hover:shadow-md transition ${rel === "high" ? "bg-emerald-50 border-emerald-200" : rel === "medium" ? "bg-cyan-50 border-cyan-200" : rel === "low" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`} onClick={() => setRelevanceFilter(relevanceFilter === rel ? "all" : rel)}>
                  <p className="text-xl font-black">{stats.byRelevance[rel] || 0}</p>
                  <p className="text-[10px] font-semibold uppercase">FUZE {rel}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Action Buttons */}
      <div className="bg-white border rounded-xl p-4 mb-6 space-y-3">
        {/* Validate */}
        <div className="flex flex-wrap gap-3 items-center">
          <p className="text-sm font-bold text-slate-700 w-20">Validate:</p>
          <button
            onClick={() => runValidation(25)}
            disabled={validating}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            {validating ? "Validating..." : "Next 25"}
          </button>
          <button
            onClick={() => runValidation(50)}
            disabled={validating}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50"
          >
            {validating ? "Validating..." : "Next 50"}
          </button>
        </div>
        {/* Archive */}
        <div className="flex flex-wrap gap-3 items-center">
          <p className="text-sm font-bold text-slate-700 w-20">Archive:</p>
          <button
            onClick={() => runCleanup("archive_irrelevant")}
            className="px-3 py-2 text-sm font-bold rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition"
          >
            Irrelevant ({stats?.byStatus.irrelevant || 0})
          </button>
          <button
            onClick={() => runCleanup("archive_unknown")}
            className="px-3 py-2 text-sm font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
          >
            Unknown ({stats?.byStatus.unknown || 0})
          </button>
        </div>
        {/* Delete */}
        <div className="flex flex-wrap gap-3 items-center">
          <p className="text-sm font-bold text-red-600 w-20">Delete:</p>
          <button
            onClick={() => runCleanup("delete_dead")}
            className="px-3 py-2 text-sm font-bold rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
          >
            Dead ({stats?.byStatus.dead || 0})
          </button>
          <button
            onClick={() => runCleanup("delete_irrelevant")}
            className="px-3 py-2 text-sm font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
          >
            Irrelevant ({stats?.byStatus.irrelevant || 0})
          </button>
          <button
            onClick={() => runCleanup("delete_unknown")}
            className="px-3 py-2 text-sm font-bold rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition"
          >
            Unknown ({stats?.byStatus.unknown || 0})
          </button>
          <span className="text-[10px] text-slate-400 italic">Only brands with zero activity are deleted</span>
        </div>
      </div>

      {/* Action Result */}
      {actionResult && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 mb-4 text-sm font-bold">
          {actionResult}
          <button onClick={() => setActionResult(null)} className="ml-3 text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* Validation Log */}
      {validationLog.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 mb-6 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase">Validation Log</p>
            <button onClick={() => setValidationLog([])} className="text-xs text-slate-500 hover:text-white">Clear</button>
          </div>
          {validationLog.map((line, i) => (
            <p key={i} className="text-xs text-green-400 font-mono leading-relaxed">{line}</p>
          ))}
          {validating && <p className="text-xs text-cyan-400 font-mono animate-pulse mt-1">Processing...</p>}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search brands..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Statuses</option>
          <option value="verified">Verified</option>
          <option value="irrelevant">Irrelevant</option>
          <option value="dead">Dead</option>
          <option value="unknown">Unknown</option>
          <option value="unvalidated">Not Yet Validated</option>
        </select>
        <select value={relevanceFilter} onChange={(e) => setRelevanceFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Relevance</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="none">None</option>
        </select>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Showing {filtered.length} of {brands.length} brands
      </p>

      {/* Brand List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Brand</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">Status</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">FUZE Fit</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">Category</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">Reason</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 100).map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div>
                      <Link href={`/brands/${b.id}`} className="font-bold text-blue-700 hover:text-blue-900 hover:underline">
                        {b.name}
                      </Link>
                      {b.website && (
                        <a href={b.website.startsWith("http") ? b.website : `https://${b.website}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate block max-w-[200px]">
                          {b.website}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {b.validationStatus ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[b.validationStatus] || STATUS_COLORS.unknown}`}>
                        {b.validationStatus.toUpperCase()}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-300">
                        PENDING
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {b.fuzeRelevance ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${RELEVANCE_COLORS[b.fuzeRelevance] || ""}`}>
                        {b.fuzeRelevance.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-slate-600">{b.textileCategory?.replace(/_/g, " ") || "—"}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-slate-500 line-clamp-2">{b.validationReason || "—"}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                      {b.pipelineStage}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2 p-3">
          {filtered.slice(0, 50).map((b) => (
            <Link key={b.id} href={`/brands/${b.id}`} className="block rounded-xl p-3 border border-slate-100 hover:bg-slate-50 transition">
              <p className="font-bold text-sm text-blue-700">{b.name}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {b.validationStatus && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${STATUS_COLORS[b.validationStatus] || STATUS_COLORS.unknown}`}>
                    {b.validationStatus}
                  </span>
                )}
                {b.fuzeRelevance && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${RELEVANCE_COLORS[b.fuzeRelevance] || ""}`}>
                    FUZE: {b.fuzeRelevance}
                  </span>
                )}
              </div>
              {b.validationReason && (
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{b.validationReason}</p>
              )}
            </Link>
          ))}
        </div>
      </div>

      {filtered.length > 100 && (
        <p className="text-xs text-slate-400 text-center mt-3">
          Showing first 100 of {filtered.length} brands. Use filters to narrow down.
        </p>
      )}
    </div>
  );
}
