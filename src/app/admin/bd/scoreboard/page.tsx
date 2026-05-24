"use client";
/**
 * /admin/bd/scoreboard — BD Wizard Phase 5 leaderboard.
 *
 * Shows per-rep BD outreach + conversion metrics over a rolling window.
 * Managers / admins see all reps; individual reps see just their own row
 * (this page redirects them to /home in that case, since their card on
 * /home covers it). Refreshes every 5 minutes.
 */
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useI18n } from "@/i18n";

interface RepRow {
  rep: { id: string; name: string | null; email: string; role: string };
  emailsSent: number;
  linkedinSent: number;
  contactsWorked: number;
  sequencesStarted: number;
  stepsSent: number;
  stepsReady: number;
  replies: number;
  meetingsBooked: number;
  brandsConverted: number;
  replyRate: number;
  // Phase 9D
  opens?: number;
  clicks?: number;
  openRate?: number;
  clickRate?: number;
  replyRateTracked?: number;
  activeSequences?: number;
  pipelineCreatedUSD?: number;
  closedWonContribution?: number;
  pipelineVelocityDays?: number | null;
  // Phase 9I
  referralsDriven?: number;
}

interface Scoreboard {
  ok: boolean;
  windowDays: number;
  since: string;
  rows: RepRow[];
  totals: {
    emailsSent: number;
    linkedinSent: number;
    contactsWorked: number;
    sequencesStarted: number;
    stepsSent: number;
    stepsReady: number;
    replies: number;
    meetingsBooked: number;
    brandsConverted: number;
    replyRate: number;
  };
}

export default function BDScoreboardPage() {
  const { t } = useI18n();
  const T = t.bdScoreboard;
  const WINDOW_OPTIONS = [
    { days: 7, label: T.win7 },
    { days: 30, label: T.win30 },
    { days: 90, label: T.win90 },
    { days: 365, label: T.winYear },
  ];
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Scoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState(30);

  const isManager =
    user?.role === "ADMIN" ||
    user?.role === "EMPLOYEE" ||
    user?.role === "SALES_MANAGER";

  useEffect(() => {
    if (!user) return;
    const allowed =
      user.role === "ADMIN" ||
      user.role === "EMPLOYEE" ||
      user.role === "SALES_MANAGER" ||
      user.role === "SALES_REP" ||
      user.role === "BD_REP" ||
      user.role === "DISTRIBUTOR_USER";
    if (!allowed) {
      router.push("/dashboard");
      return;
    }
    if (!isManager) {
      // Reps see their card on /home — no point in a single-row leaderboard.
      router.push("/home");
    }
  }, [user, isManager, router]);

  const load = useCallback(async () => {
    try {
      const url = `/api/admin/bd/scoreboard?all=1&days=${windowDays}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) setData(json);
    } catch (e) {
      console.error("Scoreboard load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    setLoading(true);
    load();
    const i = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(i);
  }, [load]);

  if (!user || !isManager) return null;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Breadcrumbs
            className="mb-2"
            items={[
              { label: T.crumbSales },
              { label: T.crumbCurrent },
            ]}
          />
          <h1 className="text-3xl font-black text-slate-900">{T.title}</h1>
          <p className="text-slate-600 mt-1">
            {T.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">{T.windowLabel}</label>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00b4c3]"
          >
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <span className="text-4xl mb-3 block">📊</span>
          <p className="text-slate-600">{T.emptyText}</p>
        </div>
      ) : (
        <>
          {/* Totals — top row is the broad outreach activity picture
              (every email/LI/contact the team touched, regardless of
              whether it ran through the sequence engine). Second row
              is the funnel outcome + the sequence-specific counters so
              managers can still see cadence health. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
            <TotalCard label={T.totalEmails} value={data.totals.emailsSent} icon="✉️" />
            <TotalCard label={T.totalLinkedIn} value={data.totals.linkedinSent} icon="🔗" />
            <TotalCard label={T.totalContactsWorked} value={data.totals.contactsWorked} icon="👥" />
            <TotalCard label={T.totalReplies} value={data.totals.replies} icon="💬" />
            <TotalCard
              label={T.totalReplyRate}
              value={`${(data.totals.replyRate * 100).toFixed(1)}%`}
              icon="📈"
            />
            <TotalCard label={T.totalConverted} value={data.totals.brandsConverted} icon="🏆" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <TotalCard label={T.totalSequencesStarted} value={data.totals.sequencesStarted} icon="📨" />
            <TotalCard label={T.totalStepsSent} value={data.totals.stepsSent} icon="📤" />
            <TotalCard label={T.totalMeetings} value={data.totals.meetingsBooked} icon="🤝" />
          </div>

          {/* Leaderboard */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">{T.colRep}</th>
                  <th className="text-right px-3 py-3">{T.colEmails}</th>
                  <th className="text-right px-3 py-3">{T.colOpenPct}</th>
                  <th className="text-right px-3 py-3">{T.colClickPct}</th>
                  <th className="text-right px-3 py-3">{T.colReplyPct}</th>
                  <th className="text-right px-3 py-3">{T.colSeqActive}</th>
                  <th className="text-right px-3 py-3">{T.colReady}</th>
                  <th className="text-right px-3 py-3">{T.colMeetings}</th>
                  <th className="text-right px-3 py-3">{T.colVelocity}</th>
                  <th className="text-right px-3 py-3">{T.colPipeline}</th>
                  <th className="text-right px-3 py-3">{T.colRefs}</th>
                  <th className="text-right px-4 py-3">{T.colWon}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr
                    key={row.rep.id}
                    className={
                      idx % 2 === 0
                        ? "bg-white border-b border-slate-100"
                        : "bg-slate-50/40 border-b border-slate-100"
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {row.rep.name || row.rep.email}
                      </div>
                      <div className="text-xs text-slate-600">
                        {row.rep.role.replace("_", " ")}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">
                      {row.emailsSent}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {((row.openRate || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {((row.clickRate || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {(((row.replyRateTracked ?? row.replyRate) || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.activeSequences ?? row.sequencesStarted}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.stepsReady > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                          {row.stepsReady}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.meetingsBooked}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.pipelineVelocityDays != null
                        ? `${row.pipelineVelocityDays.toFixed(1)}d`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {(row.pipelineCreatedUSD || 0) > 0
                        ? `$${Math.round((row.pipelineCreatedUSD || 0) / 1000)}K`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.referralsDriven ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">
                      {row.closedWonContribution ?? row.brandsConverted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-600 mt-3">
            {T.footerTpl.replace("{date}", new Date(data.since).toLocaleDateString())}
          </p>
        </>
      )}
    </div>
  );
}

function TotalCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-slate-600 uppercase tracking-wide">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-black text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
