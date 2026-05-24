"use client";

/**
 * /admin/bd/sequences/[id]/analytics — Phase 9C.
 *
 * Step-by-step funnel view for one sequence (or one cadence template
 * if the id matches a cadenceKey rather than a specific row). Each
 * step row shows the standard funnel metrics + the subject-line
 * variants used at that step so the operator can A/B which subject
 * to keep.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { useI18n } from "@/i18n";

interface SubjectVariant {
  subject: string;
  sent: number;
  opens: number;
  openRate: number;
}

interface StepRow {
  step: number;
  channel: string;
  sentCount: number;
  openCount: number;
  openRate: number;
  clickCount: number;
  clickRate: number;
  replyCount: number;
  replyRate: number;
  meetingsBooked: number;
  meetingsBookedRate: number;
  averageDaysToReply: number | null;
  averageDaysToMeeting: number | null;
  subjectVariants: SubjectVariant[];
}

interface Payload {
  ok: boolean;
  mode: "sequence" | "cadence";
  cadenceKey: string;
  totalSequences: number;
  steps: StepRow[];
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function days(n: number | null) {
  if (n == null) return "—";
  if (n < 1) return `${(n * 24).toFixed(0)}h`;
  return `${n.toFixed(1)}d`;
}

export default function SequenceAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const T = t.bdSequenceAnalytics;
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/bd/sequences/${id}/analytics`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.ok) setError(j.error || T.errLoadFailed);
        else setData(j);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id, T.errLoadFailed]);

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }
  if (!data) {
    return <div className="p-6 text-slate-500">{T.loading}</div>;
  }

  return (
    <div className="max-w-[1280px] mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/admin/bd/sequences" className="hover:text-[#00b4c3]">{T.crumbBdSequences}</Link>
            <span>·</span>
            <Link href={`/admin/bd/sequences/${id}`} className="hover:text-[#00b4c3]">
              {data.mode === "sequence" ? T.modeSequence : T.modeCadence} {data.cadenceKey}
            </Link>
            <span>·</span>
            <span className="text-slate-800 font-medium">{T.crumbAnalytics}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">{T.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {T.aggregatedAcross} <span className="font-bold">{data.totalSequences}</span>{" "}
            {data.totalSequences === 1 ? T.sequenceSingular : T.sequencePlural} {T.onCadenceLabel}{" "}
            <span className="font-mono text-slate-700">{data.cadenceKey}</span>
          </p>
        </div>
      </div>

      {data.steps.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          {T.emptyBefore} {data.mode}.
        </div>
      ) : (
        <div className="space-y-4">
          {data.steps.map((s) => (
            <div
              key={s.step}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-500">
                    {T.stepLabel} {s.step + 1}
                  </span>
                  <span className="ml-3 text-sm font-bold text-slate-900">
                    {s.channel}
                  </span>
                </div>
                <span className="text-xs text-slate-600">
                  {s.sentCount} {T.sentSuffix}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 p-5">
                <Metric label={T.mSent} value={s.sentCount} />
                <Metric label={T.mOpens} value={`${s.openCount} (${pct(s.openRate)})`} />
                <Metric label={T.mClicks} value={`${s.clickCount} (${pct(s.clickRate)})`} />
                <Metric label={T.mReplies} value={`${s.replyCount} (${pct(s.replyRate)})`} />
                <Metric
                  label={T.mMeetings}
                  value={`${s.meetingsBooked} (${pct(s.meetingsBookedRate)})`}
                />
                <Metric
                  label={T.mAvgDaysReply}
                  value={days(s.averageDaysToReply)}
                />
              </div>
              {s.subjectVariants.length > 0 && (
                <div className="px-5 pb-5">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                    {T.subjectVariantsTitle}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-semibold">{T.colSubject}</th>
                          <th className="text-right px-3 py-1.5 font-semibold">{T.colSent}</th>
                          <th className="text-right px-3 py-1.5 font-semibold">{T.colOpens}</th>
                          <th className="text-right px-3 py-1.5 font-semibold">{T.colOpenRate}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {s.subjectVariants.map((v) => (
                          <tr key={v.subject}>
                            <td className="px-3 py-1.5 text-slate-800 max-w-[28ch] truncate">
                              {v.subject}
                            </td>
                            <td className="px-3 py-1.5 text-right">{v.sent}</td>
                            <td className="px-3 py-1.5 text-right">{v.opens}</td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {pct(v.openRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </p>
      <p className="text-base font-black text-slate-900">{value}</p>
    </div>
  );
}
