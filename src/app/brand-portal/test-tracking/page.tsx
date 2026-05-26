"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  poNumber: string | null;
  status: string;
  trackingState: string | null;
  trackingUpdatedAt: string | null;
  fuzeFabricNumber: string | null;
  customerFabricCode: string | null;
  labName: string | null;
  token: string | null;
  nextState: string | null;
  medianHoursToNext: number | null;
  watching: boolean;
}

function fmtEta(updatedAt: string | null, medianHours: number | null): string {
  if (!updatedAt || !medianHours) return "—";
  const eta = new Date(new Date(updatedAt).getTime() + medianHours * 36e5);
  return eta.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function BrandPortalTestTrackingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/brand-portal/test-tracking");
      const d = await r.json();
      if (!d.ok) setErr(d.error || "Load failed");
      else setRows(d.items || []);
    } catch (e: any) {
      setErr(e?.message || "Load failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleWatch = async (row: Row) => {
    setBusy(true);
    try {
      await fetch("/api/brand-portal/test-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: row.watching ? "unwatch" : "watch",
          testRequestId: row.id,
        }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Test tracking</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live state for every test request from your brand. Click "Watch" to receive in-app +
            email updates on state transitions.
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
              <th className="px-3 py-2 text-left">Fabric</th>
              <th className="px-3 py-2 text-left">Lab</th>
              <th className="px-3 py-2 text-left">State</th>
              <th className="px-3 py-2 text-left">ETA next</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-mono text-xs">{r.poNumber || r.id.slice(0, 8)}</td>
                <td className="px-3 py-2">
                  <div className="text-slate-900">{r.fuzeFabricNumber || "—"}</div>
                  <div className="text-xs text-slate-500">{r.customerFabricCode || ""}</div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{r.labName || "—"}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                    {r.trackingState || r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {r.nextState ? (
                    <>
                      <div>{r.nextState}</div>
                      <div className="text-slate-400">
                        ≈ {fmtEta(r.trackingUpdatedAt, r.medianHoursToNext)}
                      </div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="flex flex-wrap gap-2">
                    {r.token && (
                      <a
                        href={`/track/${r.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        Public link
                      </a>
                    )}
                    <button
                      onClick={() => toggleWatch(r)}
                      disabled={busy}
                      className={`rounded px-2 py-1 font-medium ${
                        r.watching
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {r.watching ? "Watching" : "Watch"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !busy && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
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
