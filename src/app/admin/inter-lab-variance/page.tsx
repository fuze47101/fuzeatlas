"use client";

import { useEffect, useState } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { useI18n } from "@/i18n";

interface LabResult {
  labId: string;
  labName: string;
  value: number;
  runId: string;
}
interface Group {
  fabricKey: string;
  fuzeNumber: number | null;
  testType: string;
  method: string;
  results: LabResult[];
  mean: number | null;
  std: number | null;
  range: number;
}
interface PerLab {
  labName: string;
  method: string;
  sampleCount: number;
  avgBias: number;
  expectedAnnotation: string | null;
}
interface Payload {
  ok: boolean;
  windowDays: number;
  multiLabGroups: Group[];
  perLab: PerLab[];
}

export default function InterLabVariancePage() {
  const { t } = useI18n();
  const T = t.interLabVariance;
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/inter-lab-variance")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!data) return <LoadingSkeleton variant="page" lines={6} label={T.loadingLabel} />;

  return (
    <div className="max-w-[1280px] mx-auto p-4 sm:p-6">
      <Breadcrumbs
        className="mb-2"
        items={[
          { label: T.crumbQualityLabs },
          { label: T.crumbInterLabVariance },
        ]}
      />
      <h1 className="text-2xl font-black text-slate-900 mb-1">{T.title}</h1>
      <p className="text-sm text-slate-600 mb-6">
        {T.subtitleBefore} {data.windowDays} {T.subtitleAfter}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b">
              <tr>
                <th className="text-left px-4 py-2">{T.colFabric}</th>
                <th className="text-left px-3 py-2">{T.colMethod}</th>
                <th className="text-right px-3 py-2">{T.colRange}</th>
                <th className="text-right px-3 py-2">{T.colMeanSigma}</th>
                <th className="text-left px-3 py-2">{T.colPerLab}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.multiLabGroups.map((g) => (
                <tr key={g.fabricKey}>
                  <td className="px-4 py-2 font-mono text-xs font-bold">
                    FUZE-{g.fuzeNumber}
                    <div className="text-[10px] text-slate-500 font-normal">
                      {g.testType}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{g.method}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {g.range.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                    {g.mean?.toFixed(2) ?? "—"} ± {g.std?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {g.results.map((r) => (
                      <div key={r.runId}>
                        <span className="font-bold text-slate-900">{r.labName}</span>{" "}
                        <span className="font-mono">{r.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
              {data.multiLabGroups.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10">
                    <div className="max-w-md mx-auto text-center">
                      <p className="text-3xl mb-2" aria-hidden="true">⚖️</p>
                      <p className="font-bold text-slate-900">{T.emptyTitle}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        {T.emptyBodyBefore} {data.windowDays} {T.emptyBodyAfter}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">{T.biasTitle}</h2>
          <p className="text-xs text-slate-500 mb-3">
            {T.biasHint}
          </p>
          <ul className="space-y-3 text-sm">
            {data.perLab.map((p) => (
              <li key={`${p.labName}|${p.method}`} className="border-b border-slate-100 pb-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-slate-900">{p.labName}</span>
                  <span
                    className={`font-mono tabular-nums ${p.avgBias > 0 ? "text-amber-700" : "text-blue-700"}`}
                  >
                    {p.avgBias > 0 ? "+" : ""}
                    {p.avgBias.toFixed(2)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {p.method} · n={p.sampleCount}
                </div>
                {p.expectedAnnotation && (
                  <div className="text-[11px] text-indigo-700 mt-1 italic">
                    {p.expectedAnnotation}
                  </div>
                )}
              </li>
            ))}
            {data.perLab.length === 0 && (
              <li className="text-slate-400 text-xs">{T.emptyBias}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
