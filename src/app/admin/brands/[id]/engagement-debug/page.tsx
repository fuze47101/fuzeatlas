"use client";

/**
 * /admin/brands/[id]/engagement-debug — Phase 9F.
 *
 * Surfaces the inputs + factor breakdown behind BrandEngagement.overallScore.
 * Read-only — re-calculation happens via /api/brand-engagement.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";

interface Factor {
  name: string;
  weight: number;
  score: number;
  contribution: number;
  rationale: string;
  if: string;
}

interface Explanation {
  brandId: string;
  brandName: string;
  overallScore: number;
  trend: string;
  factors: Factor[];
  inputs: {
    daysSinceLastContact: number | null;
    testsLast30Days: number;
    testsLast90Days: number;
    avgInvoicePayDays: number | null;
    overdueInvoices: number;
  };
  calculatedAt: string;
}

const TREND_COLORS: Record<string, string> = {
  RISING: "bg-emerald-100 text-emerald-700",
  STABLE: "bg-slate-100 text-slate-700",
  DECLINING: "bg-amber-100 text-amber-700",
  AT_RISK: "bg-red-100 text-red-700",
};

export default function EngagementDebugPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Explanation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/brands/${id}/engagement-debug`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "Failed to load");
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6 text-slate-500">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Link href={`/brands/${id}`} className="hover:text-[#00b4c3]">
            {data.brandName}
          </Link>
          <span>·</span>
          <span className="text-slate-800 font-medium">Engagement debug</span>
        </div>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-slate-900">
            {data.brandName} engagement
          </h1>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${TREND_COLORS[data.trend] || "bg-slate-100"}`}
          >
            {data.trend.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Calculated {new Date(data.calculatedAt).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl bg-gradient-to-br from-[#00b4c3] to-[#009ba8] text-white p-5">
          <p className="text-xs uppercase tracking-wider text-white/80">Overall score</p>
          <p className="text-5xl font-black mt-1">{data.overallScore}</p>
          <p className="text-xs text-white/80 mt-1">out of 100</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">Inputs</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">Days since contact</dt>
            <dd className="text-right font-mono tabular-nums">
              {data.inputs.daysSinceLastContact ?? "—"}
            </dd>
            <dt className="text-slate-500">Tests (30d)</dt>
            <dd className="text-right font-mono tabular-nums">
              {data.inputs.testsLast30Days}
            </dd>
            <dt className="text-slate-500">Tests (90d)</dt>
            <dd className="text-right font-mono tabular-nums">
              {data.inputs.testsLast90Days}
            </dd>
            <dt className="text-slate-500">Avg pay days</dt>
            <dd className="text-right font-mono tabular-nums">
              {data.inputs.avgInvoicePayDays?.toFixed(1) ?? "—"}
            </dd>
            <dt className="text-slate-500">Overdue invoices</dt>
            <dd className="text-right font-mono tabular-nums">
              {data.inputs.overdueInvoices}
            </dd>
          </dl>
        </div>
      </div>

      <h2 className="text-lg font-bold text-slate-900 mb-3">Factor breakdown</h2>
      <div className="space-y-3">
        {data.factors.map((f) => (
          <div key={f.name} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold text-slate-900">{f.name}</h3>
              <div className="text-right">
                <div className="text-2xl font-black text-slate-900">
                  {f.score}
                  <span className="text-sm font-normal text-slate-500">/100</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  weight {(f.weight * 100).toFixed(0)}% · contributes {f.contribution.toFixed(1)} pts
                </p>
              </div>
            </div>
            <div className="mt-2 w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-[#00b4c3]"
                style={{ width: `${f.score}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-700">{f.rationale}</p>
            <p className="mt-1 text-xs text-slate-500 italic">{f.if}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
