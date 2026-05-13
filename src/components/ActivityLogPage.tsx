"use client";

/**
 * <ActivityLogPage /> — NEED-4 shared portal-side audit log surface.
 *
 * Used by /brand-portal/activity-log, /factory-portal/activity-log,
 * /distributor-portal/activity-log, /lab-portal/activity-log.
 * Each portal page passes the API endpoint + portal labels; the
 * server scopes the audit rows to the caller's own org.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ErrorPanel from "@/components/ErrorPanel";

interface ActivityRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  description: string;
  changes?: Record<string, { old: any; new: any }> | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

interface Props {
  apiPath: string;
  portalLabel: string;
  portalHref: string;
}

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  APPROVE: "bg-cyan-100 text-cyan-700",
  REJECT: "bg-amber-100 text-amber-700",
  STAMP: "bg-slate-100 text-slate-700",
  LOGIN: "bg-purple-100 text-purple-700",
  EXPORT: "bg-purple-100 text-purple-700",
};

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function summarizeValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 77) + "…" : v;
  if (typeof v === "number") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  } catch {
    return "[complex]";
  }
}

export default function ActivityLogPage({ apiPath, portalLabel, portalHref }: Props) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [entityFilter, setEntityFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(apiPath);
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setLoadError(j?.error || `Couldn't load activity log (HTTP ${res.status}).`);
        return;
      }
      setRows(j.rows || []);
    } catch (e: any) {
      setLoadError(e?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (actionFilter && r.action !== actionFilter) return false;
    if (entityFilter && r.entity !== entityFilter) return false;
    return true;
  });

  const uniqueActions = Array.from(new Set(rows.map((r) => r.action))).sort();
  const uniqueEntities = Array.from(new Set(rows.map((r) => r.entity))).sort();

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href={portalHref} className="hover:text-[#00b4c3]">
            {portalLabel}
          </Link>
          <span>›</span>
          <span>Activity log</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Activity log</h1>
        <p className="text-sm text-slate-500 mt-1">
          Who changed what, and when. Last 90 days. Scoped to your organization.
        </p>
      </div>

      {loadError && (
        <div className="mb-4">
          <ErrorPanel context="Load activity log" error={loadError} onRetry={load} />
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">All actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">All entities</option>
            {uniqueEntities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            {filtered.length} of {rows.length}
          </span>
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400">
          Loading activity…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-700 font-semibold mb-1">
            {rows.length === 0
              ? "No activity recorded yet."
              : "No rows match your filters."}
          </p>
          <p className="text-xs text-slate-500">
            {rows.length === 0
              ? "When team members edit your spec, pricing, or supply chain, the entries land here."
              : "Clear the filters to see everything."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      ACTION_STYLES[r.action] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {r.action}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">{r.entity}</span>
                </div>
                <span className="text-[11px] text-slate-400">{fmtDateTime(r.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-800 mt-1">{r.description}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                by {r.actor?.name || r.actor?.email || "System"}
              </p>

              {r.changes && Object.keys(r.changes).length > 0 && (
                <details className="mt-2">
                  <summary className="text-[11px] text-slate-500 cursor-pointer hover:text-[#00b4c3]">
                    {Object.keys(r.changes).length} field
                    {Object.keys(r.changes).length === 1 ? "" : "s"} changed
                  </summary>
                  <table className="mt-2 w-full text-[11px]">
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(r.changes).map(([k, v]) => (
                        <tr key={k}>
                          <td className="py-1 pr-3 font-mono text-slate-500 align-top">{k}</td>
                          <td className="py-1 pr-2 align-top">
                            <span className="px-1 rounded bg-red-50 text-red-700">
                              {summarizeValue(v.old)}
                            </span>
                          </td>
                          <td className="py-1 text-slate-400 align-top">→</td>
                          <td className="py-1 align-top">
                            <span className="px-1 rounded bg-emerald-50 text-emerald-700">
                              {summarizeValue(v.new)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
