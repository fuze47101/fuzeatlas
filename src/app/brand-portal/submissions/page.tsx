"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

function useStages(tx: ReturnType<typeof useI18n>["t"]["brandPortal"]["submissions"]) {
  return [
    { key: "Submitted", label: tx.stageSubmitted, icon: "📥", color: "bg-slate-500" },
    { key: "In Treatment", label: tx.stageInTreatment, icon: "🔬", color: "bg-amber-500" },
    { key: "Testing", label: tx.stageTesting, icon: "🧪", color: "bg-blue-500" },
    { key: "Approved", label: tx.stageApproved, icon: "✅", color: "bg-emerald-500" },
    { key: "Production", label: tx.stageProduction, icon: "🏭", color: "bg-[#00b4c3]" },
    { key: "Complete", label: tx.stageComplete, icon: "🎯", color: "bg-green-600" },
  ];
}

function ProgressBar({
  status,
  stages,
}: {
  status: string;
  stages: ReturnType<typeof useStages>;
}) {
  const idx = stages.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center gap-1.5 w-full">
      {stages.map((stage, i) => {
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

function StatusBadge({
  status,
  stages,
}: {
  status: string;
  stages: ReturnType<typeof useStages>;
}) {
  const stage = stages.find((s) => s.key === status);
  const colors: Record<string, string> = {
    Submitted: "bg-slate-100 text-slate-700",
    "In Treatment": "bg-amber-100 text-amber-700",
    Testing: "bg-blue-100 text-blue-700",
    Approved: "bg-emerald-100 text-emerald-700",
    Production: "bg-cyan-100 text-cyan-700",
    Complete: "bg-green-100 text-green-700",
    Pending: "bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colors[status] || colors.Pending}`}
    >
      {stage?.icon || "⏳"} {stage?.label || status}
    </span>
  );
}

function TestBadge({
  testStatus,
  icpPassed,
  abPassed,
  tx,
}: {
  testStatus: string;
  icpPassed?: boolean;
  abPassed?: boolean;
  tx: ReturnType<typeof useI18n>["t"]["brandPortal"]["submissions"];
}) {
  if (testStatus === "PASSED" || (icpPassed && abPassed)) {
    return (
      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
        {tx.badgeAllPass}
      </span>
    );
  }
  if (icpPassed === true) {
    return (
      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold">
        {tx.badgeIcpPass}
      </span>
    );
  }
  if (testStatus === "FAILED") {
    return (
      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">
        {tx.badgeFailed}
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">
      {tx.badgePending}
    </span>
  );
}

export default function BrandPortalSubmissionsPage() {
  const { t } = useI18n();
  const tx = t.brandPortal.submissions;
  const stages = useStages(tx);
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

  if (loading)
    return <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>;
  if (!data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error || tx.unableToLoad}
      </div>
    );

  const submissions = data.submissions || [];
  const filtered = filter === "all" ? submissions : submissions.filter((s: any) => s.status === filter);
  const stats = data.stats;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {tx.pageSubtitle.replace("{brand}", data.brand.name)}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-slate-900">{stats.totalSubmissions}</div>
          <div className="text-xs text-slate-500">{tx.statTotal}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-emerald-600">{stats.testsPassed}</div>
          <div className="text-xs text-slate-500">{tx.statTestsPassed}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-amber-500">{stats.testsPending}</div>
          <div className="text-xs text-slate-500">{tx.statTestsPending}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-[#00b4c3]">{stats.totalFabrics}</div>
          <div className="text-xs text-slate-500">{tx.statFabrics}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-blue-600">
            {stats.submissionsByStatus["Complete"] || 0}
          </div>
          <div className="text-xs text-slate-500">{tx.statComplete}</div>
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
          {tx.filterAll.replace("{count}", String(submissions.length))}
        </button>
        {stages.map((stage) => {
          const count = submissions.filter((s: any) => s.status === stage.key).length;
          return (
            <button
              key={stage.key}
              onClick={() => setFilter(stage.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                filter === stage.key ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tx.filterStage
                .replace("{icon}", stage.icon)
                .replace("{label}", stage.label)
                .replace("{count}", String(count))}
            </button>
          );
        })}
      </div>

      {/* Submissions List */}
      <div className="space-y-3">
        {filtered.map((s: any) => (
          <div
            key={s.id}
            className="bg-white rounded-xl border border-slate-200 hover:border-[#00b4c3] hover:shadow-md transition-all p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-base font-black text-[#00b4c3]">
                    FUZE {s.fuzeFabricNumber || "—"}
                  </span>
                  <StatusBadge status={s.status} stages={stages} />
                  <TestBadge testStatus={s.testStatus} icpPassed={s.icpPassed} abPassed={s.abPassed} tx={tx} />
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  {s.customerFabricCode && (
                    <span>{tx.codePrefix.replace("{code}", s.customerFabricCode)}</span>
                  )}
                  {s.fabric?.construction && <span>{s.fabric.construction}</span>}
                  {s.fabric?.weightGsm && (
                    <span>{tx.gsmSuffix.replace("{gsm}", String(s.fabric.weightGsm))}</span>
                  )}
                  {s.factory?.name && (
                    <span>{tx.factoryPrefix.replace("{name}", s.factory.name)}</span>
                  )}
                  {s.applicationMethod && (
                    <span>{tx.methodPrefix.replace("{method}", s.applicationMethod)}</span>
                  )}
                  {s.washTarget && (
                    <span>{tx.targetSuffix.replace("{wash}", String(s.washTarget))}</span>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">
                {s.testCount > 0 && (
                  <div className="font-semibold text-slate-600">
                    {(s.testCount === 1 ? tx.testCountSingular : tx.testCountPlural).replace(
                      "{count}",
                      String(s.testCount),
                    )}
                  </div>
                )}
                <div>{new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Progress */}
            <ProgressBar status={s.status} stages={stages} />

            {/* Development stage */}
            {s.developmentStage && (
              <div className="mt-2 text-[11px] text-slate-500">
                {tx.stagePrefix}{" "}
                <span className="font-medium text-slate-700">{s.developmentStage}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border">
          <div className="text-5xl mb-3">📋</div>
          <h3 className="text-lg font-bold text-slate-700">
            {filter === "all"
              ? tx.noSubmissionsTitle
              : tx.noFilteredTitle.replace("{filter}", filter)}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {filter === "all" ? tx.noSubmissionsBlurb : tx.noFilteredBlurb}
          </p>
        </div>
      )}
    </div>
  );
}
