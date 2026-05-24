"use client";

/**
 * /admin/audit-log — NEED-4 admin-side filterable audit log.
 *
 * Mirrors the per-portal ActivityLogPage but with full DB scope and
 * action / entity / actor / since filters. Read-only.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ErrorPanel from "@/components/ErrorPanel";
import { useI18n } from "@/i18n";

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

export default function AdminAuditLogPage() {
  const { t } = useI18n();
  const T = t.adminAuditLog;
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [sinceFilter, setSinceFilter] = useState(""); // ISO date

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entity", entityFilter);
      if (sinceFilter) params.set("since", sinceFilter);
      params.set("take", "500");
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setLoadError(j?.error || `${T.couldntLoadPrefix} (HTTP ${res.status}).`);
        return;
      }
      setRows(j.rows || []);
      // Distinct lists are derived from the current filtered set;
      // we only refresh them when the page first loads so the
      // dropdowns don't shrink as the user narrows the result set.
      if (entities.length === 0) setEntities(j.distinctEntities || []);
      if (actions.length === 0) setActions(j.distinctActions || []);
    } catch (e: any) {
      setLoadError(e?.message || T.networkError);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, sinceFilter, entities.length, actions.length]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
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

      <div className="flex flex-wrap items-end gap-3 mb-4 bg-white border border-slate-200 rounded-lg p-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {T.actionLabel}
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">{T.allActionsOption}</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {T.entityLabel}
          </label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">{T.allEntitiesOption}</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {T.sinceLabel}
          </label>
          <input
            type="date"
            value={sinceFilter}
            onChange={(e) => setSinceFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
          />
        </div>
        <button
          onClick={() => {
            setActionFilter("");
            setEntityFilter("");
            setSinceFilter("");
          }}
          className="text-xs text-slate-500 hover:text-[#00b4c3] underline px-2 py-1"
        >
          {T.resetBtn}
        </button>
        <span className="text-xs text-slate-500 ml-auto">{rows.length} {T.rowsSuffix}</span>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400">
          {T.loadingState}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          {T.emptyState}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
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
                  {r.entityId && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {r.entityId.slice(0, 10)}…
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">{fmtDateTime(r.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-800 mt-1">{r.description}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {T.byPrefix} {r.actor?.name || r.actor?.email || T.systemActor}
              </p>

              {r.changes && Object.keys(r.changes).length > 0 && (
                <details className="mt-2">
                  <summary className="text-[11px] text-slate-500 cursor-pointer hover:text-[#00b4c3]">
                    {Object.keys(r.changes).length} {Object.keys(r.changes).length === 1 ? T.fieldChangedSingular : T.fieldChangedPlural}
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
