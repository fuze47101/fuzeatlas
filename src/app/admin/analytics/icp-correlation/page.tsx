"use client";

/**
 * /admin/analytics/icp-correlation — MB-1 admin view.
 *
 * All brand-visible TestRuns with both ICP residual + AB percent-
 * reduction. The chart Joseph (KUIU) asked for in May 2026.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import IcpCorrelationChart from "@/components/IcpCorrelationChart";
import ErrorPanel from "@/components/ErrorPanel";
import { useI18n } from "@/i18n";

export default function AdminIcpCorrelationPage() {
  const { t } = useI18n();
  const T = t.icpCorrelation;
  const [points, setPoints] = useState<any[]>([]);
  const [regression, setRegression] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch("/api/analytics/icp-correlation");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setLoadError(j?.error || `${T.couldntLoadPrefix} (HTTP ${r.status}).`);
        return;
      }
      setPoints(j.points || []);
      setRegression(j.regression || null);
    } catch (e: any) {
      setLoadError(e?.message || T.networkError);
    } finally {
      setLoading(false);
    }
  }, [T]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/admin" className="hover:text-[#00b4c3]">
            {T.adminCrumb}
          </Link>
          <span>›</span>
          <span>{T.crumb}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{T.heading}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {T.subtitle}
        </p>
      </div>

      {loadError && (
        <div className="mb-4">
          <ErrorPanel context={T.errorContext} error={loadError} onRetry={load} />
        </div>
      )}

      {loading ? (
        <div className="h-96 flex items-center justify-center text-slate-400">
          {T.loadingState}
        </div>
      ) : (
        <IcpCorrelationChart
          points={points}
          regression={regression}
          showBrand
        />
      )}

      <p className="text-[11px] text-slate-500 mt-4">
        {T.footnote}
      </p>
    </div>
  );
}
