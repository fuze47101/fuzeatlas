"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const STAGES = [
  { key: "Submitted", label: "Submitted", icon: "📥", color: "bg-slate-500" },
  { key: "In Treatment", label: "In Treatment", icon: "🔬", color: "bg-amber-500" },
  { key: "Testing", label: "Testing", icon: "🧪", color: "bg-blue-500" },
  { key: "Approved", label: "Approved", icon: "✅", color: "bg-emerald-500" },
  { key: "Production", label: "Production", icon: "🏭", color: "bg-[#00b4c3]" },
  { key: "Complete", label: "Complete", icon: "🎯", color: "bg-green-600" },
];

function ProgressBar({ status }: { status: string }) {
  const idx = STAGES.findIndex((s) => s.key === status);
  const progress = idx >= 0 ? ((idx + 1) / STAGES.length) * 100 : 10;

  return (
    <div className="flex items-center gap-1.5 w-full">
      {STAGES.map((stage, i) => {
        const reached = i <= idx;
        return (
          <div key={stage.key} className="flex-1 relative group">
            <div
              className={`h-1.5 rounded-full transition-all ${
                reached ? stage.color : "bg-slate-200"
              }`}
            />
            <div className="hidden group-hover:block absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
              {stage.icon} {stage.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const stage = STAGES.find((s) => s.key === status);
  const colors: Record<string, string> = {
    "Submitted": "bg-slate-100 text-slate-700",
    "In Treatment": "bg-amber-100 text-amber-700",
    "Testing": "bg-blue-100 text-blue-700",
    "Approved": "bg-emerald-100 text-emerald-700",
    "Production": "bg-cyan-100 text-cyan-700",
    "Complete": "bg-green-100 text-green-700",
    "Pending": "bg-slate-100 text-slate-500",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colors[status] || colors.Pending}`}>
      {stage?.icon || "⏳"} {status}
    </span>
  );
}

function TestBadge({ testStatus, icpPassed, abPassed }: { testStatus: string; icpPassed?: boolean; abPassed?: boolean }) {
  const hasResults = icpPassed !== null || abPassed !== null;

  if (testStatus === "PASSED" || (icpPassed && abPassed)) {
    return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">ALL PASS</span>;
  }
  if (icpPassed === true) {
    return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold">ICP ✓</span>;
  }
  if (testStatus === "FAILED") {
    return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">FAILED</span>;
  }
  return <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">PENDING</span>;
}

export default function BrandPortalSubmissionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/brand-portal")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading submissions...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-red-400">{error || "Unable to load"}</div>;

  const submissions = data.submissions || [];
  const filtered = filter === "all" ? submissions : submissions.filter((s: any) => s.status === filter);
  const stats = data.stats;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Submissions & Workflow</h1>
        <p className="text-sm text-slate-500 mt-1">
          {data.brand.name} — Track your fabric submissions through the FUZE treatment pipeline
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-slate-900">{stats.totalSubmissions}</div>
          <div className="text-xs text-slate-500">Total Submissions</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-emerald-600">{stats.testsPassed}</div>
          <div className="text-xs text-slate-500">Tests Passed</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-amber-500">{stats.testsPending}</div>
          <div className="text-xs text-slate-500">Tests Pending</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-[#00b4c3]">{stats.totalFabrics}</div>
          <div className="text-xs text-slate-500">Fabrics</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-blue-600">
            {stats.submissionsByStatus["Complete"] || 0}
          </div>
          <div className="text-xs text-slate-500">Complete</div>
        </div>
      </div>

      {/* Pipeline View */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
            filter === "all" ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"
          }`}
        >
          All ({submissions.length})
        </button>
        {STAGES.map((stage) => {
          const count = submissions.filter((s: any) => s.status === stage.key).length;
          return (
            <button
              key={stage.key}
              onClick={() => setFilter(stage.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                filter === stage.key ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"
              }`}
            >
              {stage.icon} {stage.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Submissions List */}
      <div className="space-y-3">
        {filtered.map((s: any) => (
          <div
            key={s.id}
            className="bg-white rounded-xl border border-slate-200 hover:border-[#00b4c3] hover:shadow-md transition-all p-5 cursor-pointer"
            onClick={() => router.push(`/fabrics/${s.fabric?.id || ""}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-base font-black text-[#00b4c3]">
                    FUZE {s.fuzeFabricNumber || "—"}
                  </span>
                  <StatusBadge status={s.status} />
                  <TestBadge testStatus={s.testStatus} icpPassed={s.icpPassed} abPassed={s.abPassed} />
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  {s.customerFabricCode && <span>Code: {s.customerFabricCode}</span>}
                  {s.fabric?.construction && <span>{s.fabric.construction}</span>}
                  {s.fabric?.weightGsm && <span>{s.fabric.weightGsm} GSM</span>}
                  {s.factory?.name && <span>Factory: {s.factory.name}</span>}
                  {s.applicationMethod && <span>Method: {s.applicationMethod}</span>}
                  {s.washTarget && <span>Target: {s.washTarget}w</span>}
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">
                {s.testCount > 0 && <div className="font-semibold text-slate-600">{s.testCount} test{s.testCount !== 1 ? "s" : ""}</div>}
                <div>{new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Progress */}
            <ProgressBar status={s.status} />

            {/* Development stage */}
            {s.developmentStage && (
              <div className="mt-2 text-[11px] text-slate-500">
                Stage: <span className="font-medium text-slate-700">{s.developmentStage}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border">
          <div className="text-5xl mb-3">📋</div>
          <h3 className="text-lg font-bold text-slate-700">
            {filter === "all" ? "No submissions yet" : `No ${filter} submissions`}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {filter === "all"
              ? "Add fabrics first, then they'll appear here as submissions progress through the pipeline"
              : "Try a different filter to see your other submissions"}
          </p>
        </div>
      )}
    </div>
  );
}
