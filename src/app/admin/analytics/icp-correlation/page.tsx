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

export default function AdminIcpCorrelationPage() {
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
        setLoadError(j?.error || `Couldn't load correlation data (HTTP ${r.status}).`);
        return;
      }
      setPoints(j.points || []);
      setRegression(j.regression || null);
    } catch (e: any) {
      setLoadError(e?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/admin" className="hover:text-[#00b4c3]">
            Admin
          </Link>
          <span>›</span>
          <span>ICP correlation</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">ICP × AB correlation</h1>
        <p className="text-sm text-slate-500 mt-1">
          The chart Joseph (KUIU) asked about. FUZE residual on fabric (ICP-measured)
          plotted against antibacterial kill rate across every brand-visible test run
          in Atlas. Best-fit line + R² overlaid.
        </p>
      </div>

      {loadError && (
        <div className="mb-4">
          <ErrorPanel context="Load ICP correlation" error={loadError} onRetry={load} />
        </div>
      )}

      {loading ? (
        <div className="h-96 flex items-center justify-center text-slate-400">
          Loading correlation data…
        </div>
      ) : (
        <IcpCorrelationChart
          points={points}
          regression={regression}
          showBrand
        />
      )}

      <p className="text-[11px] text-slate-500 mt-4">
        Customer-facing copy uses "FUZE residual" — the metamaterial measurement
        from the lab's ICP report. NEVER labelled "silver" or "Ag" in customer
        deliverables (CLAUDE.md brand-voice rule).
      </p>
    </div>
  );
}
