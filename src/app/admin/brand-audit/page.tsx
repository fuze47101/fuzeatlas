"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BrandAudit {
  id: string;
  name: string;
  score: number;
  tier: string;
  recommendation: string;
  source: string;
  pipelineStage: string;
  totalActivity: number;
  contactCount: number;
  flags: string[];
  createdAt: string;
  // detail fields (when details=true)
  positives?: string[];
  website?: string;
  linkedInProfile?: string;
  customerType?: string;
  researchDate?: string;
  activityBreakdown?: Record<string, number>;
  contacts?: { email?: string; linkedinUrl?: string; jobTitle?: string; emailStatus?: string; source?: string }[];
  engagement?: { overallScore: number; engagementTrend: string; daysSinceLastContact?: number } | null;
}

interface Summary {
  total: number;
  avgScore: number;
  byTier: Record<string, number>;
  bySource: Record<string, number>;
  byRecommendation: Record<string, number>;
  byPipelineStage: Record<string, number>;
  scoreDistribution: Record<string, number>;
}

const TIER_COLORS: Record<string, string> = {
  A_active_customer: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B_qualified_lead: "bg-blue-100 text-blue-700 border-blue-200",
  C_needs_validation: "bg-amber-100 text-amber-700 border-amber-200",
  D_low_quality: "bg-orange-100 text-orange-700 border-orange-200",
  F_delete_candidate: "bg-red-100 text-red-700 border-red-200",
};

const TIER_LABELS: Record<string, string> = {
  A_active_customer: "A — Active Customer",
  B_qualified_lead: "B — Qualified Lead",
  C_needs_validation: "C — Needs Validation",
  D_low_quality: "D — Low Quality",
  F_delete_candidate: "F — Delete Candidate",
};

const REC_COLORS: Record<string, string> = {
  keep: "bg-emerald-50 text-emerald-700",
  validate: "bg-amber-50 text-amber-700",
  archive: "bg-orange-50 text-orange-700",
  delete: "bg-red-50 text-red-700",
};

const SOURCE_COLORS: Record<string, string> = {
  legacy_knack: "bg-purple-100 text-purple-700",
  ai_discovery: "bg-cyan-100 text-cyan-700",
  manual: "bg-slate-100 text-slate-700",
  unknown: "bg-slate-50 text-slate-400",
};

const SCORE_BAR_COLOR = (score: number) => {
  if (score >= 60) return "bg-emerald-500";
  if (score >= 35) return "bg-blue-500";
  if (score >= 15) return "bg-amber-500";
  if (score >= 5) return "bg-orange-500";
  return "bg-red-500";
};

export default function BrandAuditPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [brands, setBrands] = useState<BrandAudit[]>([]);
  const [filtered, setFiltered] = useState<BrandAudit[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [recFilter, setRecFilter] = useState("all");

  // Selection for bulk actions
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/brand-audit?details=true")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setSummary(j.summary);
          setBrands(j.brands);
          setFiltered(j.brands);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Apply filters
  useEffect(() => {
    let f = brands;
    if (search) {
      const q = search.toLowerCase();
      f = f.filter((b) => b.name.toLowerCase().includes(q));
    }
    if (tierFilter !== "all") f = f.filter((b) => b.tier === tierFilter);
    if (sourceFilter !== "all") f = f.filter((b) => b.source === sourceFilter);
    if (recFilter !== "all") f = f.filter((b) => b.recommendation === recFilter);
    setFiltered(f);
  }, [search, tierFilter, sourceFilter, recFilter, brands]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = (rec: string) => {
    const ids = filtered.filter((b) => b.recommendation === rec).map((b) => b.id);
    setSelected(new Set([...selected, ...ids]));
  };

  const clearSelection = () => setSelected(new Set());

  const executeBulkAction = async (action: "archive" | "delete") => {
    if (selected.size === 0) return;
    const confirm = window.confirm(
      `${action === "delete" ? "DELETE" : "ARCHIVE"} ${selected.size} brands? ${action === "delete" ? "This cannot be undone." : "They will be moved to ARCHIVE stage."}`
    );
    if (!confirm) return;

    setActionLoading(true);
    setActionResult(null);
    try {
      const res = await fetch("/api/admin/brand-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, brandIds: Array.from(selected) }),
      });
      const j = await res.json();
      setActionResult(j.message);
      // Refresh data
      setSelected(new Set());
      const refresh = await fetch("/api/admin/brand-audit?details=true");
      const rj = await refresh.json();
      if (rj.ok) {
        setSummary(rj.summary);
        setBrands(rj.brands);
      }
    } catch {
      setActionResult("Error executing action");
    } finally {
      setActionLoading(false);
    }
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
          <h1 className="text-2xl font-black text-slate-800">Brand Database Audit</h1>
          <p className="text-sm text-slate-500 mt-1">
            Score, validate, and clean up {summary?.total.toLocaleString()} brands
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black text-cyan-600">{summary?.total.toLocaleString()}</p>
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Total Brands</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setTierFilter(tierFilter === "A_active_customer" ? "all" : "A_active_customer")}>
            <p className="text-2xl font-black text-emerald-700">{summary.byTier.A_active_customer}</p>
            <p className="text-[10px] font-semibold text-emerald-600 uppercase">A — Active</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setTierFilter(tierFilter === "B_qualified_lead" ? "all" : "B_qualified_lead")}>
            <p className="text-2xl font-black text-blue-700">{summary.byTier.B_qualified_lead}</p>
            <p className="text-[10px] font-semibold text-blue-600 uppercase">B — Qualified</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setTierFilter(tierFilter === "C_needs_validation" ? "all" : "C_needs_validation")}>
            <p className="text-2xl font-black text-amber-700">{summary.byTier.C_needs_validation}</p>
            <p className="text-[10px] font-semibold text-amber-600 uppercase">C — Validate</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setTierFilter(tierFilter === "D_low_quality" ? "all" : "D_low_quality")}>
            <p className="text-2xl font-black text-orange-700">{summary.byTier.D_low_quality}</p>
            <p className="text-[10px] font-semibold text-orange-600 uppercase">D — Low Quality</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setTierFilter(tierFilter === "F_delete_candidate" ? "all" : "F_delete_candidate")}>
            <p className="text-2xl font-black text-red-700">{summary.byTier.F_delete_candidate}</p>
            <p className="text-[10px] font-semibold text-red-600 uppercase">F — Delete</p>
          </div>
        </div>
      )}

      {/* Score Distribution + Source Breakdown */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="bg-white border rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Score Distribution</p>
            <div className="space-y-2">
              {Object.entries(summary.scoreDistribution).map(([range, count]) => (
                <div key={range} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500 w-16">{range.replace("_", " ")}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${range === "80+" ? "bg-emerald-500" : range === "60-79" ? "bg-blue-500" : range === "40-59" ? "bg-cyan-500" : range === "20-39" ? "bg-amber-500" : range === "1-19" ? "bg-orange-500" : "bg-red-500"}`}
                      style={{ width: `${Math.max(2, (count / summary.total) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600 w-10 text-right">{count}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Average score: <span className="font-bold text-slate-600">{summary.avgScore}</span></p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Source Breakdown</p>
            <div className="space-y-3">
              {Object.entries(summary.bySource).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${SOURCE_COLORS[source]}`}>
                    {source.replace("_", " ").toUpperCase()}
                  </span>
                  <span className="text-sm font-bold text-slate-600">{count}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 mt-3 pt-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Recommendation</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(summary.byRecommendation).map(([rec, count]) => (
                  <div key={rec} className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${REC_COLORS[rec]}`}>
                      {rec.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-slate-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Tiers</option>
          <option value="A_active_customer">A — Active Customer</option>
          <option value="B_qualified_lead">B — Qualified Lead</option>
          <option value="C_needs_validation">C — Needs Validation</option>
          <option value="D_low_quality">D — Low Quality</option>
          <option value="F_delete_candidate">F — Delete Candidate</option>
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Sources</option>
          <option value="legacy_knack">Legacy (Knack)</option>
          <option value="ai_discovery">AI Discovery</option>
          <option value="manual">Manual</option>
        </select>
        <select value={recFilter} onChange={(e) => setRecFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Recommendations</option>
          <option value="keep">Keep</option>
          <option value="validate">Validate</option>
          <option value="archive">Archive</option>
          <option value="delete">Delete</option>
        </select>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="bg-slate-800 text-white rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">{selected.size} selected</span>
            <button onClick={clearSelection} className="text-xs text-slate-300 hover:text-white underline">Clear</button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => executeBulkAction("archive")}
              disabled={actionLoading}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 transition disabled:opacity-50"
            >
              Archive Selected
            </button>
            <button
              onClick={() => executeBulkAction("delete")}
              disabled={actionLoading}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500 hover:bg-red-600 transition disabled:opacity-50"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Quick select buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => selectAllFiltered("delete")} className="px-2 py-1 text-[10px] font-bold rounded bg-red-50 text-red-600 hover:bg-red-100 transition">
          Select all &quot;Delete&quot; ({filtered.filter((b) => b.recommendation === "delete").length})
        </button>
        <button onClick={() => selectAllFiltered("archive")} className="px-2 py-1 text-[10px] font-bold rounded bg-orange-50 text-orange-600 hover:bg-orange-100 transition">
          Select all &quot;Archive&quot; ({filtered.filter((b) => b.recommendation === "archive").length})
        </button>
      </div>

      {/* Action Result */}
      {actionResult && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 mb-4 text-sm font-bold">
          {actionResult}
        </div>
      )}

      <p className="text-xs text-slate-400 mb-3">
        Showing {filtered.length} of {brands.length} brands
      </p>

      {/* Brand List */}
      <div className="space-y-2">
        {filtered.map((b) => (
          <div key={b.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-sm transition">
            {/* Main row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={selected.has(b.id)}
                onChange={() => toggleSelect(b.id)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {/* Score bar */}
              <div className="w-12 flex-shrink-0">
                <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full ${SCORE_BAR_COLOR(b.score)}`} style={{ width: `${Math.min(100, Math.max(3, b.score))}%` }} />
                </div>
                <p className="text-[10px] font-mono text-slate-500 text-center mt-0.5">{b.score}</p>
              </div>
              {/* Name + details */}
              <div className="flex-1 min-w-0">
                <button onClick={() => setExpanded(expanded === b.id ? null : b.id)} className="text-sm font-bold text-slate-800 hover:text-blue-600 transition text-left truncate block w-full">
                  {b.name}
                </button>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${TIER_COLORS[b.tier]}`}>
                    {TIER_LABELS[b.tier]}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${SOURCE_COLORS[b.source]}`}>
                    {b.source.replace("_", " ")}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">
                    {b.pipelineStage}
                  </span>
                  {b.totalActivity > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                      {b.totalActivity} activity
                    </span>
                  )}
                  {b.contactCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600">
                      {b.contactCount} contacts
                    </span>
                  )}
                  {b.flags.map((f) => (
                    <span key={f} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              {/* Recommendation */}
              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${REC_COLORS[b.recommendation]}`}>
                {b.recommendation}
              </span>
            </div>

            {/* Expanded detail */}
            {expanded === b.id && (
              <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Data Quality */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Data Quality Signals</p>
                    <div className="space-y-1">
                      {b.positives?.map((p) => (
                        <div key={p} className="flex items-center gap-1">
                          <span className="text-emerald-500 text-xs">✓</span>
                          <span className="text-xs text-slate-600">{p.replace(/_/g, " ")}</span>
                        </div>
                      ))}
                      {(!b.positives || b.positives.length === 0) && (
                        <p className="text-xs text-slate-400">No quality signals</p>
                      )}
                    </div>
                  </div>
                  {/* Links */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Links & Info</p>
                    {b.website && (
                      <a href={b.website.startsWith("http") ? b.website : `https://${b.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block truncate">
                        {b.website}
                      </a>
                    )}
                    {b.linkedInProfile && (
                      <a href={b.linkedInProfile} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block truncate">
                        LinkedIn
                      </a>
                    )}
                    {b.customerType && <p className="text-xs text-slate-600 mt-1">Type: {b.customerType}</p>}
                    {b.researchDate && <p className="text-xs text-slate-400 mt-1">Research: {new Date(b.researchDate).toLocaleDateString()}</p>}
                    <p className="text-xs text-slate-400 mt-1">Created: {new Date(b.createdAt).toLocaleDateString()}</p>
                  </div>
                  {/* Contacts */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Contacts ({b.contacts?.length || 0})</p>
                    {b.contacts?.slice(0, 5).map((c, i) => (
                      <div key={i} className="text-xs text-slate-600 mb-1">
                        <span className="font-bold">{c.jobTitle || "No title"}</span>
                        {c.email && <span className="text-slate-400 ml-1">({c.emailStatus || "unknown"})</span>}
                        {c.linkedinUrl && <span className="text-blue-500 ml-1">LI</span>}
                      </div>
                    ))}
                    {(!b.contacts || b.contacts.length === 0) && (
                      <p className="text-xs text-slate-400">No contacts</p>
                    )}
                  </div>
                </div>
                {/* Activity Breakdown */}
                {b.activityBreakdown && b.totalActivity > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Activity Breakdown</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(b.activityBreakdown)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => (
                          <span key={k} className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            {k}: {v}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">No brands match your filters</div>
      )}
    </div>
  );
}
