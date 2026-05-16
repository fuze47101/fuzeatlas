"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * MB-4 dashboard widget: top 10 brands ranked by predicted 12-month
 * FUZE value. Pulls from /api/admin/top-pipeline-potential which
 * reads the cron-stamped Brand.predictedValueUSD column (recomputed
 * nightly at 04:00 UTC).
 *
 * Standing rule: explicit error state — never silently render zeros.
 */

interface Row {
  id: string;
  name: string;
  pipelineStage: string;
  textileCategory: string | null;
  fuzeRelevance: string | null;
  predictedValueUSD: number;
  predictedValueComputedAt: string | null;
  predictedValueFactors: any;
  salesRep: { id: string; name: string } | null;
}

const STAGE_COLORS: Record<string, string> = {
  LEAD: "bg-indigo-100 text-indigo-700",
  PRESENTATION: "bg-purple-100 text-purple-700",
  BRAND_TESTING: "bg-sky-100 text-sky-700",
  FACTORY_ONBOARDING: "bg-amber-100 text-amber-700",
  FACTORY_TESTING: "bg-orange-100 text-orange-700",
  PRODUCTION: "bg-green-100 text-green-700",
  BRAND_EXPANSION: "bg-emerald-100 text-emerald-700",
  CUSTOMER_WON: "bg-teal-100 text-teal-700",
};

export default function TopPipelinePotential() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [brandCount, setBrandCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/top-pipeline-potential");
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || `HTTP ${res.status}`);
        return;
      }
      setRows(j.rows || []);
      setTotal(j.totalPredictedUSD || 0);
      setBrandCount(j.brandCount || 0);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <p className="text-sm text-slate-500">Loading top pipeline potential…</p>
      </div>
    );
  }

  // Explicit error state — never silently render zeros.
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
        <p className="font-bold text-red-700 mb-1">
          Couldn't load top pipeline potential
        </p>
        <p className="text-red-600 text-xs mb-2">{error}</p>
        <button
          onClick={load}
          className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state — predictions cron hasn't run yet (or all brands
  // are in ARCHIVE/CUSTOMER_WON).
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Top 10 by Potential</h3>
        <p className="text-sm text-slate-500">
          No predictions stamped yet. The recompute cron runs daily at 04:00 UTC, or admins can
          fire it manually via <code className="font-mono text-xs">fzcron recompute-pipeline-predictions</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Top 10 by Potential</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Predicted 12-month value × stage probability — call list for BD.
          </p>
        </div>
        {total != null && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-slate-500">Pipeline total</p>
            <p className="text-2xl font-black text-slate-900">
              ${Math.round(total / 1000).toLocaleString()}k
            </p>
            <p className="text-[10px] text-slate-400">{brandCount} open brands</p>
          </div>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 uppercase tracking-wider">
          <tr>
            <th className="text-left pb-2">#</th>
            <th className="text-left pb-2">Brand</th>
            <th className="text-left pb-2">Stage</th>
            <th className="text-left pb-2 hidden md:table-cell">Rep</th>
            <th className="text-right pb-2">Potential</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((b, i) => {
            const f = (b.predictedValueFactors || {}) as any;
            return (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="py-1.5 text-slate-400 font-mono text-xs">{i + 1}</td>
                <td className="py-1.5">
                  <Link
                    href={`/brands/${b.id}`}
                    className="font-semibold text-slate-900 hover:text-[#00b4c3]"
                  >
                    {b.name}
                  </Link>
                  {b.textileCategory && (
                    <span className="ml-2 text-[10px] text-slate-400">
                      {b.textileCategory.replace(/_/g, " ")}
                    </span>
                  )}
                </td>
                <td className="py-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${STAGE_COLORS[b.pipelineStage] || "bg-slate-100 text-slate-600"}`}
                  >
                    {b.pipelineStage.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-1.5 text-xs text-slate-500 hidden md:table-cell">
                  {b.salesRep?.name || "—"}
                </td>
                <td className="py-1.5 text-right font-mono font-bold text-slate-900">
                  ${Math.round(b.predictedValueUSD / 1000).toLocaleString()}k
                  <p className="text-[10px] font-normal text-slate-400">
                    {Math.round((f.stageProbability || 0) * 100)}% prob
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
        <span>
          {rows[0]?.predictedValueComputedAt
            ? `Updated ${new Date(rows[0].predictedValueComputedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : "Not yet stamped"}
        </span>
        <Link href="/admin/brand-pipeline" className="text-[#00b4c3] font-semibold hover:underline">
          See full pipeline →
        </Link>
      </div>
    </div>
  );
}
