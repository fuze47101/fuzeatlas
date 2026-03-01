"use client";
import { useEffect, useState } from "react";

type DashData = {
  counts: Record<string, number>;
  pipeline: { stage: string; count: number }[];
  testTypes: { type: string; count: number }[];
  recentFabrics: any[];
  recentTests: any[];
};

const STAGE_COLORS: Record<string, string> = {
  LEAD: "#94a3b8",
  PRESENTATION: "#60a5fa",
  BRAND_TESTING: "#a78bfa",
  FACTORY_ONBOARDING: "#f59e0b",
  FACTORY_TESTING: "#fb923c",
  PRODUCTION: "#34d399",
  BRAND_EXPANSION: "#2dd4bf",
  ARCHIVE: "#6b7280",
  CUSTOMER_WON: "#22c55e",
};

const STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  PRESENTATION: "Presentation",
  BRAND_TESTING: "Brand Testing",
  FACTORY_ONBOARDING: "Factory Onboard",
  FACTORY_TESTING: "Factory Testing",
  PRODUCTION: "Production",
  BRAND_EXPANSION: "Expansion",
  ARCHIVE: "Archive",
  CUSTOMER_WON: "Won",
};

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{typeof value === "number" ? value.toLocaleString() : value}</p>
        </div>
        <div className="text-3xl" style={{ opacity: 0.15 }}>{icon}</div>
      </div>
      <div className="mt-3 h-1 rounded-full" style={{ background: color, opacity: 0.6 }} />
    </div>
  );
}

function PipelineBar({ data }: { data: { stage: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4">Brand Pipeline</h3>
      <div className="space-y-2.5">
        {data.map((d) => (
          <div key={d.stage} className="flex items-center gap-3">
            <div className="w-28 text-xs font-semibold text-slate-600 text-right truncate">
              {STAGE_LABELS[d.stage] || d.stage}
            </div>
            <div className="flex-1 bg-slate-100 rounded-full h-7 relative overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                style={{
                  width: `${Math.max((d.count / max) * 100, 2)}%`,
                  background: STAGE_COLORS[d.stage] || "#94a3b8",
                }}
              >
                <span className="text-[11px] font-bold text-white drop-shadow">{d.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestTypeChart({ data }: { data: { type: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const colors = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#6366f1", "#ec4899"];
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4">Tests by Type</h3>
      <div className="flex gap-1 h-8 rounded-lg overflow-hidden mb-4">
        {data.map((d, i) => (
          <div
            key={d.type}
            className="transition-all duration-500 hover:opacity-80"
            style={{ width: `${(d.count / total) * 100}%`, background: colors[i % colors.length] }}
            title={`${d.type}: ${d.count}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {data.map((d, i) => (
          <div key={d.type} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="font-semibold text-slate-600">{d.type}</span>
            <span className="text-slate-400 ml-auto">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setData(j); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-lg">Loading dashboard...</div>;
  if (!data) return <div className="text-red-500 p-6">Failed to load dashboard data.</div>;

  const c = data.counts;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">FUZE Atlas overview — all data at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Fabrics" value={c.fabrics} icon="🧵" color="#3b82f6" />
        <StatCard label="Brands" value={c.brands} icon="🎯" color="#8b5cf6" />
        <StatCard label="Factories" value={c.factories} icon="🏭" color="#f59e0b" />
        <StatCard label="Test Runs" value={c.testRuns} icon="🧪" color="#10b981" />
      </div>

      {/* Second row - more stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-blue-600">{c.icpResults}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">ICP Results</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-purple-600">{c.antibacterialResults}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">Antibacterial</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-amber-600">{c.fungalResults}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">Fungal</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-emerald-600">{c.submissions}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">Submissions</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-slate-600">{c.labs}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">Labs</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-slate-600">{c.distributors}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">Distributors</p>
        </div>
      </div>

      {/* Pipeline + Test Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <PipelineBar data={data.pipeline} />
        </div>
        <TestTypeChart data={data.testTypes} />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Fabrics */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Recent Fabrics</h3>
          <div className="space-y-2">
            {data.recentFabrics.map((f: any) => (
              <a
                key={f.id}
                href={`/fabrics/${f.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div>
                  <span className="font-bold text-sm text-slate-900">
                    {f.fuzeNumber ? `FUZE ${f.fuzeNumber}` : "—"}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">{f.construction || ""}</span>
                  {f.brand?.name && (
                    <span className="text-xs text-blue-600 ml-2">{f.brand.name}</span>
                  )}
                </div>
                <span className="text-xs text-slate-400 group-hover:text-blue-500">&rarr;</span>
              </a>
            ))}
          </div>
        </div>

        {/* Recent Tests */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Recent Test Runs</h3>
          <div className="space-y-2">
            {data.recentTests.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold mr-2 ${
                    t.testType === "ICP" ? "bg-blue-100 text-blue-700" :
                    t.testType === "ANTIBACTERIAL" ? "bg-purple-100 text-purple-700" :
                    t.testType === "FUNGAL" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {t.testType}
                  </span>
                  <span className="text-xs text-slate-600">
                    {t.submission?.brand?.name || ""}
                    {t.submission?.fuzeFabricNumber ? ` #${t.submission.fuzeFabricNumber}` : ""}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {t.lab?.name || ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
