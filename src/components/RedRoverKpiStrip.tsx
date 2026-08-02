import type { ReactNode } from "react";

export interface RedRoverKpis {
  execMeetings: number;
  lois: number;
  draftContracts: number;
  ndasExecuted: number;
  advancedThisMonth: number;
  totalTargets: number;
}

/**
 * Agreement-progress KPI strip (derived from activity types + agreement
 * text). Shared by the dashboard and the read-only exec view.
 */
export function KpiStrip({ kpis }: { kpis: RedRoverKpis }) {
  const items: { label: string; value: number; hint?: string }[] = [
    { label: "Exec meetings", value: kpis.execMeetings },
    { label: "LOIs", value: kpis.lois },
    { label: "Draft contracts", value: kpis.draftContracts },
    { label: "NDAs executed", value: kpis.ndasExecuted },
    { label: "Advanced a stage (mo.)", value: kpis.advancedThisMonth },
    { label: "Targets", value: kpis.totalTargets, hint: "in the book" },
  ];
  return (
    <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-gradient-to-r from-rose-50 to-white p-3 sm:grid-cols-6">
      {items.map((it) => (
        <Metric key={it.label} label={it.label} value={it.value} hint={it.hint} />
      ))}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint?: string }): ReactNode {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
}
