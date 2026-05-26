"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATE_OPTIONS = [
  "",
  "REQUEST_SUBMITTED",
  "REQUEST_APPROVED",
  "SAMPLE_SHIPPED",
  "SAMPLE_IN_TRANSIT",
  "SAMPLE_RECEIVED",
  "LAB_IN_QUEUE",
  "LAB_TESTING",
  "RESULTS_AVAILABLE",
  "BRAND_VISIBLE",
];

interface Row {
  id: string;
  poNumber: string | null;
  status: string;
  trackingState: string;
  trackingUpdatedAt: string | null;
  brandName: string | null;
  labName: string | null;
  token: string | null;
  medianHoursToNext: number | null;
  stuck: boolean;
}

export default function TestTrackingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [stuckOnly, setStuckOnly] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (stateFilter) qs.set("state", stateFilter);
      if (stuckOnly) qs.set("stuckOnly", "true");
      const r = await fetch(`/api/admin/test-tracking?${qs.toString()}`);
      const d = await r.json();
      if (!d.ok) setErr(d.error || "Load failed");
      else setRows(d.items || []);
    } catch (e: any) {
      setErr(e?.message || "Load failed");
    } finally {
      setBusy(false);
    }
  }, [stateFilter, stuckOnly]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Test tracking dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            All in-flight tests by tracking state. Stuck tests flagged when current state exceeds
            2× median dwell time.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-slate-600">State</span>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {STATE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s || "All"}
              </option>
            ))}
          </select>
        </label>
        <label className="ml-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={stuckOnly}
            onChange={(e) => setStuckOnly(e.target.checked)}
          />
          <span className="text-slate-600">Stuck tests only</span>
        </label>
        <div className="ml-auto text-xs text-slate-500">{rows.length} test(s)</div>
      </div>

      {err && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {err}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">PO #</th>
              <th className="px-3 py-2 text-left">Brand</th>
              <th className="px-3 py-2 text-left">Lab</th>
              <th className="px-3 py-2 text-left">Tracking state</th>
              <th className="px-3 py-2 text-left">In state since</th>
              <th className="px-3 py-2 text-left">Median to next</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className={r.stuck ? "bg-amber-50" : ""}>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/admin/test-requests/${r.id}`} className="text-indigo-600 hover:underline">
                    {r.poNumber || r.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.brandName || "—"}</td>
                <td className="px-3 py-2">{r.labName || "—"}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                    {r.trackingState}
                  </span>
                  {r.stuck && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      stuck
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {r.trackingUpdatedAt ? new Date(r.trackingUpdatedAt).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {r.medianHoursToNext != null ? `${Math.round(r.medianHoursToNext)}h` : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.token && (
                    <a
                      href={`/track/${r.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      Public link ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !busy && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                  No tests in flight.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
