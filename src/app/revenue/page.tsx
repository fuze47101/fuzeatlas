"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/revenue-calc";
import { useI18n } from "@/i18n";

type QuarterData = {
  quarter: string;
  projected: number;
  weighted: number;
  actual: number;
  invoiced: number;
  projectCount: number;
  invoiceCount: number;
  breakdown: { id: string; name: string; projected: number; weighted: number; actual: number }[];
};

type DistSummary = {
  distributorId: string;
  name: string;
  projectedRevenue: number;
  weightedRevenue: number;
  actualRevenue: number;
  projectCount: number;
};

export default function RevenueForecastPage() {
  const { t } = useI18n();
  const T = t.revenuePage;
  const [year, setYear] = useState(new Date().getFullYear());
  const [groupBy, setGroupBy] = useState<"distributor" | "brand" | "factory">("distributor");
  const [forecast, setForecast] = useState<QuarterData[]>([]);
  const [annual, setAnnual] = useState<any>(null);
  const [distSummary, setDistSummary] = useState<DistSummary[]>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/revenue/forecast?year=${year}&groupBy=${groupBy}`).then((r) => r.json()),
      fetch("/api/invoices?page=1").then((r) => r.json()),
    ])
      .then(([fj, ij]) => {
        if (fj.ok) {
          setForecast(fj.forecast || []);
          setAnnual(fj.annual);
          setDistSummary(fj.distributorSummary || []);
        }
        if (ij.ok) setInvoiceSummary(ij.summary);
      })
      .finally(() => setLoading(false));
  }, [year, groupBy]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">{T.loading}</div>;
  }

  const maxBar = Math.max(
    ...forecast.map((q) => Math.max(q.projected, q.actual, q.weighted, 1))
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{T.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{T.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <select
            className="px-3 py-1.5 text-sm border rounded-lg"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            className="px-3 py-1.5 text-sm border rounded-lg"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
          >
            <option value="distributor">{T.byDistributor}</option>
            <option value="brand">{T.byBrand}</option>
            <option value="factory">{T.byFactory}</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {annual && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-[10px] font-medium text-slate-400 uppercase">{T.kpiPipeline}</p>
            <p className="text-xl font-bold text-slate-900">{formatMoney(annual.projected)}</p>
            <p className="text-xs text-slate-400">{annual.projectCount} {T.dealsLabel}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-[10px] font-medium text-slate-400 uppercase">{T.kpiWeighted}</p>
            <p className="text-xl font-bold text-emerald-600">{formatMoney(annual.weighted)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-[10px] font-medium text-slate-400 uppercase">{T.kpiYtdInvoiced}</p>
            <p className="text-xl font-bold text-blue-600">{formatMoney(annual.invoiced)}</p>
            <p className="text-xs text-slate-400">{annual.invoiceCount} {T.invoicesLabel}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-[10px] font-medium text-slate-400 uppercase">{T.kpiYtdCollected}</p>
            <p className="text-xl font-bold text-green-600">{formatMoney(annual.actual)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-[10px] font-medium text-slate-400 uppercase">{T.kpiOutstanding}</p>
            <p className="text-xl font-bold text-amber-600">{formatMoney(invoiceSummary?.totalOutstanding || 0)}</p>
            <p className="text-xs text-slate-400">
              {invoiceSummary?.collectionRate || 0}{T.pctCollectedSuffix}
            </p>
          </div>
        </div>
      )}

      {/* Quarterly Chart */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4">{T.quarterlyBreakdownTpl.replace("{year}", String(year))}</h2>
        <div className="grid grid-cols-4 gap-4">
          {forecast.map((q) => (
            <div key={q.quarter} className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-600 text-center">{q.quarter}</h3>

              {/* Bar chart */}
              <div className="flex items-end gap-1 h-32 justify-center">
                {/* Projected */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-6 bg-slate-200 rounded-t"
                    style={{ height: `${Math.max((q.projected / maxBar) * 120, 2)}px` }}
                  />
                  <span className="text-[8px] text-slate-400 mt-0.5">{T.barProj}</span>
                </div>
                {/* Weighted */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-6 bg-emerald-300 rounded-t"
                    style={{ height: `${Math.max((q.weighted / maxBar) * 120, 2)}px` }}
                  />
                  <span className="text-[8px] text-emerald-500 mt-0.5">{T.barWt}</span>
                </div>
                {/* Actual */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-6 bg-blue-400 rounded-t"
                    style={{ height: `${Math.max((q.actual / maxBar) * 120, 2)}px` }}
                  />
                  <span className="text-[8px] text-blue-500 mt-0.5">{T.barActual}</span>
                </div>
              </div>

              <div className="text-center space-y-0.5">
                <p className="text-xs font-semibold text-slate-700">{formatMoney(q.projected)}</p>
                <p className="text-[10px] text-emerald-600">{T.barWtPrefix} {formatMoney(q.weighted)}</p>
                <p className="text-[10px] text-blue-600">{T.barActPrefix} {formatMoney(q.actual)}</p>
                <p className="text-[10px] text-slate-400">{q.projectCount} {T.dealsLabel} · {q.invoiceCount} {T.invShort}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distributor Summary Table */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-3">
          {T.distSummaryTpl.replace("{year}", String(year))}
        </h2>
        {distSummary.length === 0 ? (
          <p className="text-sm text-slate-400">{T.noDistData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-400 uppercase">
                  <th className="py-2 pr-3">{T.colDistributor}</th>
                  <th className="py-2 pr-3 text-right">{T.colProjected}</th>
                  <th className="py-2 pr-3 text-right">{T.colWeighted}</th>
                  <th className="py-2 pr-3 text-right">{T.colActual}</th>
                  <th className="py-2 pr-3 text-right">{T.colDeals}</th>
                  <th className="py-2 text-right">{T.colConversion}</th>
                </tr>
              </thead>
              <tbody>
                {distSummary.map((d) => (
                  <tr key={d.distributorId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 pr-3 font-medium text-slate-800">{d.name}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">{formatMoney(d.projectedRevenue)}</td>
                    <td className="py-2 pr-3 text-right text-emerald-600">{formatMoney(d.weightedRevenue)}</td>
                    <td className="py-2 pr-3 text-right text-blue-600">{formatMoney(d.actualRevenue)}</td>
                    <td className="py-2 pr-3 text-right text-slate-500">{d.projectCount}</td>
                    <td className="py-2 text-right font-medium">
                      {d.projectedRevenue > 0
                        ? `${Math.round((d.actualRevenue / d.projectedRevenue) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quarterly Breakdowns by Group */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-3">
          {T.quarterlyByGroupTpl.replace("{group}", groupBy.charAt(0).toUpperCase() + groupBy.slice(1))}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {forecast.map((q) => (
            <div key={q.quarter} className="border rounded-lg p-3">
              <h3 className="text-xs font-bold text-slate-600 mb-2">{q.quarter}</h3>
              {q.breakdown.length === 0 ? (
                <p className="text-xs text-slate-400">{T.noData}</p>
              ) : (
                <div className="space-y-1.5">
                  {q.breakdown.map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 truncate flex-1">{b.name}</span>
                      <span className="text-slate-500 ml-2">{formatMoney(b.projected)}</span>
                      <span className="text-emerald-600 ml-2">{formatMoney(b.weighted)}</span>
                      <span className="text-blue-600 ml-2">{formatMoney(b.actual)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
