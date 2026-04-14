// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Accounts — brands that have moved past the LEAD stage.
 * These are the ones receiving presentations, testing, producing, or
 * in active customer relationships. Pipeline page shows LEAD only.
 *
 * Stages shown here (in order):
 *   PRESENTATION → BRAND_TESTING → FACTORY_ONBOARDING → FACTORY_TESTING →
 *   PRODUCTION → BRAND_EXPANSION → CUSTOMER_WON
 */

const STAGE_ORDER = [
  "PRESENTATION",
  "BRAND_TESTING",
  "FACTORY_ONBOARDING",
  "FACTORY_TESTING",
  "PRODUCTION",
  "BRAND_EXPANSION",
  "CUSTOMER_WON",
];

const STAGE_META: Record<string, { label: string; color: string; icon: string }> = {
  PRESENTATION: { label: "Presentation", color: "bg-blue-100 text-blue-800 border-blue-200", icon: "📊" },
  BRAND_TESTING: { label: "Brand Testing", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: "🧪" },
  FACTORY_ONBOARDING: { label: "Factory Onboarding", color: "bg-purple-100 text-purple-800 border-purple-200", icon: "🏭" },
  FACTORY_TESTING: { label: "Factory Testing", color: "bg-violet-100 text-violet-800 border-violet-200", icon: "🔬" },
  PRODUCTION: { label: "Production", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: "✅" },
  BRAND_EXPANSION: { label: "Brand Expansion", color: "bg-teal-100 text-teal-800 border-teal-200", icon: "🚀" },
  CUSTOMER_WON: { label: "Customer Won", color: "bg-amber-100 text-amber-800 border-amber-200", icon: "🏆" },
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stageSummary, setStageSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, [stageFilter, search]);

  async function load() {
    const params = new URLSearchParams();
    params.set("mode", "accounts");
    params.set("view", "everything");
    if (stageFilter !== "all") params.set("stage", stageFilter);
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/admin/brand-pipeline?${params}`);
      const data = await res.json();
      if (data.ok) {
        setAccounts(data.pipeline || []);
        setStageSummary(data.stageSummary || {});
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateStage(brandId: string, newStage: string) {
    await fetch(`/api/brands/${brandId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineStage: newStage }),
    });
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Group by stage
  const byStage: Record<string, any[]> = {};
  for (const s of STAGE_ORDER) byStage[s] = [];
  for (const a of accounts) {
    if (byStage[a.stage]) byStage[a.stage].push(a);
  }

  const totalAccounts = accounts.length;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900 mb-1">Accounts</h1>
        <p className="text-slate-600">
          Brands past the Lead stage — received a presentation, in testing, producing, or already customers.
          For new prospects, go to <Link href="/admin/brand-pipeline" className="text-[#00b4c3] font-semibold">Brand Pipeline</Link>.
        </p>
      </div>

      {/* Stage pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
        <button
          onClick={() => setStageFilter("all")}
          className={`p-3 rounded-lg border text-left transition-all ${
            stageFilter === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">All</p>
          <p className="text-2xl font-black">{totalAccounts}</p>
        </button>
        {STAGE_ORDER.map((s) => {
          const count = stageSummary[s] || 0;
          const meta = STAGE_META[s];
          const active = stageFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStageFilter(active ? "all" : s)}
              className={`p-3 rounded-lg border text-left transition-all ${
                active ? "ring-2 ring-offset-1 ring-[#00b4c3]" : ""
              } ${meta.color}`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-xs">{meta.icon}</span>
                <p className="text-[10px] font-bold uppercase tracking-wide">{meta.label}</p>
              </div>
              <p className="text-2xl font-black">{count}</p>
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
          placeholder="Search accounts by name or contact..."
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
        />
      </div>

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">⭐</p>
          <h3 className="font-bold text-slate-900 text-lg mb-1">No accounts yet in this view</h3>
          <p className="text-sm text-slate-500">Accounts appear when brands move from LEAD to PRESENTATION or later.</p>
          <Link href="/admin/brand-pipeline" className="inline-block mt-4 px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-semibold hover:bg-[#009aa8]">
            Go to Brand Pipeline
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((a: any) => {
            const meta = STAGE_META[a.stage] || STAGE_META.PRESENTATION;
            const enrichedCount = a.contacts?.filter((c: any) => c.email || c.linkedinUrl).length || 0;
            return (
              <Link
                key={a.id}
                href={`/brands/${a.id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-[#00b4c3]/50 hover:shadow-md transition-all"
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${meta.color} border flex items-center justify-center text-lg`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900 truncate">{a.name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${meta.color} border`}>
                      {meta.label}
                    </span>
                    {a.fuzeRelevance === "high" && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-full">🔥 High relevance</span>
                    )}
                    {a.salesRep?.name && (
                      <span className="text-xs text-slate-500">· AM: {a.salesRep.name}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600 mt-1">
                    {a.textileCategory && <span>{a.textileCategory}</span>}
                    {a.contacts?.length > 0 && <span>{a.contacts.length} contacts{enrichedCount > 0 ? ` (${enrichedCount} enriched)` : ""}</span>}
                    {a.website && <span className="truncate">{a.website}</span>}
                  </div>
                </div>
                <div className="flex-shrink-0 flex gap-2 items-center">
                  <select
                    value={a.stage}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateStage(a.id, e.target.value);
                    }}
                    className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    {STAGE_ORDER.map((s) => (
                      <option key={s} value={s}>{STAGE_META[s].label}</option>
                    ))}
                    <option value="LEAD">← Back to Lead</option>
                  </select>
                  <span className="text-slate-400">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
