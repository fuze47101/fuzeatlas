// @ts-nocheck
"use client";

/**
 * /admin/sows/dashboard
 *
 * Ryan's SOW oversight surface. Single-screen view of every SOW
 * across every brand with the stale flags, milestone progress, and
 * AM attribution he needs to keep customer engagements moving.
 *
 * Sorted: stale + signed-no-progress at the top (worst-aged first),
 * then by days-since-activity desc.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

interface SOW {
  id: string;
  title: string | null;
  status: string;
  signatory: string | null;
  signatoryEmail: string | null;
  brand: {
    id: string;
    name: string;
    pipelineStage: string | null;
    salesRep: { id: string; name: string; email: string } | null;
  };
  createdAt: string;
  lastActivityAt: string;
  daysSinceActivity: number;
  milestonesTotal: number;
  milestonesDone: number;
  milestonesPct: number | null;
  nextMilestone: { id: string; title: string; dueDate: string | null } | null;
  overdueMilestones: number;
  testRequestCount: number;
  documentCount: number;
  isStale: boolean;
  signedNoProgress: boolean;
  ageDays: number;
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  stale: number;
  signedNoProgress: number;
  overdueMilestones: number;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-100 text-blue-700",
  SIGNED: "bg-emerald-100 text-emerald-700",
  ACTIVE: "bg-purple-100 text-purple-700",
  COMPLETE: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function SOWDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const T = t.sowsDashboard;
  const [sows, setSows] = useState<SOW[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [staleOnly, setStaleOnly] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (
      !["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"].includes(
        user.role,
      )
    ) {
      router.push("/home");
      return;
    }
    load();
    // eslint-disable-next-line
  }, [user, statusFilter, staleOnly]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("all", "1");
      if (statusFilter) params.set("status", statusFilter);
      if (staleOnly) params.set("staleOnly", "1");
      const res = await fetch(`/api/admin/sows/dashboard?${params}`);
      const json = await res.json();
      if (json.ok) {
        setSows(json.sows);
        setSummary(json.summary);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/admin" className="hover:text-[#00b4c3]">
              {T.crumbAdmin}
            </Link>
            <span>/</span>
            <span>{T.crumbSOWs}</span>
            <span>/</span>
            <span>{T.crumbDashboard}</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900">{T.title}</h1>
          <p className="text-slate-600 mt-1 max-w-2xl">
            {T.subtitle}
          </p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Card label={T.cardTotal} value={summary.total} icon="📄" />
          <Card
            label={T.cardStale}
            value={summary.stale}
            icon="⚠"
            warn={summary.stale > 0}
          />
          <Card
            label={T.cardSignedNoProgress}
            value={summary.signedNoProgress}
            icon="🐢"
            warn={summary.signedNoProgress > 0}
          />
          <Card
            label={T.cardOverdue}
            value={summary.overdueMilestones}
            icon="⏰"
            warn={summary.overdueMilestones > 0}
          />
          <Card label={T.cardActive} value={summary.byStatus.ACTIVE || 0} icon="✅" />
          <Card label={T.cardSigned} value={summary.byStatus.SIGNED || 0} icon="✍" />
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 uppercase font-bold">
          {T.statusLabel}
        </span>
        {["", "DRAFT", "SENT", "SIGNED", "ACTIVE", "COMPLETE", "CANCELLED"].map(
          (s) => (
            <button
              key={s || "all"}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 rounded text-xs font-semibold ${
                statusFilter === s
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s || T.allBtn}
            </button>
          ),
        )}
        <span className="ml-auto" />
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={staleOnly}
            onChange={(e) => setStaleOnly(e.target.checked)}
          />
          {T.staleOnlyToggle}
        </label>
      </div>

      {sows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <span className="text-4xl mb-3 block">📄</span>
          <p className="text-slate-600">{T.emptyState}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">{T.colBrandTitle}</th>
                <th className="text-left px-3 py-3">{T.colStatus}</th>
                <th className="text-right px-3 py-3">{T.colMilestones}</th>
                <th className="text-left px-3 py-3">{T.colNextMilestone}</th>
                <th className="text-left px-3 py-3">{T.colAm}</th>
                <th className="text-right px-3 py-3">{T.colLastActivity}</th>
                <th className="text-left px-4 py-3">{T.colFlags}</th>
              </tr>
            </thead>
            <tbody>
              {sows.map((s, idx) => {
                const flags: string[] = [];
                if (s.isStale) flags.push(`${T.flagStale} ${s.daysSinceActivity}d`);
                if (s.signedNoProgress)
                  flags.push(`${T.flagNoProgress} ${s.ageDays}d`);
                if (s.overdueMilestones > 0)
                  flags.push(`${s.overdueMilestones} ${T.flagOverdue}`);
                const flaggedRow = flags.length > 0;

                return (
                  <tr
                    key={s.id}
                    className={
                      flaggedRow
                        ? "bg-red-50/40 border-b border-slate-100"
                        : idx % 2 === 0
                          ? "bg-white border-b border-slate-100"
                          : "bg-slate-50/40 border-b border-slate-100"
                    }
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/brands/${s.brand.id}`}
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        {s.brand.name}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {s.title || T.untitled}
                        {s.signatoryEmail && (
                          <> · {s.signatoryEmail}</>
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_BADGE[s.status] || "bg-slate-100 text-slate-700"}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs">
                      {s.milestonesTotal === 0 ? (
                        <span className="text-slate-400">{T.noneLabel}</span>
                      ) : (
                        <>
                          <span className="font-semibold">
                            {s.milestonesDone}
                          </span>
                          <span className="text-slate-400">
                            /{s.milestonesTotal}
                          </span>
                          {s.milestonesPct != null && (
                            <span className="text-slate-500 ml-1">
                              ({s.milestonesPct}%)
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {s.nextMilestone ? (
                        <>
                          <p className="font-semibold text-slate-700 truncate max-w-[180px]">
                            {s.nextMilestone.title}
                          </p>
                          {s.nextMilestone.dueDate && (
                            <p
                              className={
                                new Date(s.nextMilestone.dueDate).getTime() <
                                Date.now()
                                  ? "text-red-600 font-semibold"
                                  : "text-slate-500"
                              }
                            >
                              {T.duePrefix} {fmtDate(s.nextMilestone.dueDate)}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {s.brand.salesRep?.name ||
                        s.brand.salesRep?.email ||
                        "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-slate-600">
                      {fmtDate(s.lastActivityAt)}
                      <p
                        className={
                          s.daysSinceActivity >= 14
                            ? "text-red-600 font-semibold"
                            : "text-slate-400"
                        }
                      >
                        {s.daysSinceActivity}{T.daysAgoSuffix}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {flaggedRow ? (
                        <div className="flex flex-wrap gap-1">
                          {flags.map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-emerald-600 text-xs font-bold">
                          {T.healthyLabel}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-3">
        {T.footerHint}
      </p>
    </div>
  );
}

function Card({
  label,
  value,
  icon,
  warn,
}: {
  label: string;
  value: number | string;
  icon: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        warn ? "bg-red-50 border-red-300" : "bg-white border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-slate-600 uppercase tracking-wide">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p
        className={`text-2xl font-black tabular-nums ${
          warn ? "text-red-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
