"use client";

/**
 * /admin/bd/funnel — Phase 9E.
 *
 * Pipeline funnel view. One row per PipelineStage with current count,
 * 30/60/90-day inflow vs outflow, average days at stage, and the
 * conversion rate to the next stage. Surfaces leaks visually — if
 * 90 brands hit LEAD but only 12 made PRESENTATION, the gap is
 * obvious in the conversion column.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface StageRow {
  stage: string;
  next: string | null;
  currentCount: number;
  inflow30: number;
  inflow60: number;
  inflow90: number;
  outflow30: number;
  outflow60: number;
  outflow90: number;
  avgDaysAtStage: number | null;
  conversionToNext: number;
  conversionDenom: number;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function days(n: number | null) {
  if (n == null) return "—";
  if (n < 1) return `${(n * 24).toFixed(0)}h`;
  return `${n.toFixed(1)}d`;
}

export default function FunnelPage() {
  const [rows, setRows] = useState<StageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/bd/funnel")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setRows(j.stages);
        else setError(j.error || "Failed to load funnel");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-slate-500">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  const maxCount = Math.max(1, ...rows.map((r) => r.currentCount));

  return (
    <div className="max-w-[1280px] mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Link href="/admin/bd" className="hover:text-[#00b4c3]">BD</Link>
          <span>·</span>
          <span className="text-slate-800 font-medium">Funnel</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Pipeline funnel</h1>
        <p className="text-sm text-slate-500 mt-1">
          Inflow / outflow over the last 30 / 60 / 90 days, plus stage-to-stage
          conversion rate. Sourced from BrandStageTransition rows written on every
          Brand.pipelineStage flip.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead className="bg-slate-50 border-b text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Stage</th>
              <th className="text-right px-3 py-3">Current</th>
              <th className="text-right px-3 py-3">In 30d</th>
              <th className="text-right px-3 py-3">In 60d</th>
              <th className="text-right px-3 py-3">In 90d</th>
              <th className="text-right px-3 py-3">Out 30d</th>
              <th className="text-right px-3 py-3">Out 60d</th>
              <th className="text-right px-3 py-3">Out 90d</th>
              <th className="text-right px-3 py-3">Avg dwell</th>
              <th className="text-right px-4 py-3">→ next</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const width = (r.currentCount / maxCount) * 100;
              return (
                <tr key={r.stage} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">
                      {r.stage.replace(/_/g, " ")}
                    </div>
                    {r.next && (
                      <div className="text-[11px] text-slate-500">
                        → {r.next.replace(/_/g, " ")}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden sm:block w-32 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-[#00b4c3]"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="tabular-nums font-semibold w-10 text-right">
                        {r.currentCount}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.inflow30}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.inflow60}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.inflow90}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.outflow30}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.outflow60}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.outflow90}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {days(r.avgDaysAtStage)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.next ? (
                      <div>
                        <div
                          className={`font-bold tabular-nums ${
                            r.conversionToNext >= 0.5
                              ? "text-emerald-700"
                              : r.conversionToNext >= 0.2
                                ? "text-amber-700"
                                : "text-red-700"
                          }`}
                        >
                          {pct(r.conversionToNext)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          n={r.conversionDenom}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        Conversion = exits that landed on the canonical next stage / total exits
        observed in the last 90 days. Stages with no exits in the window show
        n=0 — they're slow or stable, not bad.
      </p>
    </div>
  );
}
