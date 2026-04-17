// @ts-nocheck
"use client";

/**
 * Dashboard widget — shows the logged-in user's next 5-7 OPEN CRM tasks,
 * sorted by due-date ascending. Overdue items get a red stripe. One-click
 * complete without leaving the dashboard. "See all" links to /crm/tasks.
 *
 * Drop onto any dashboard like:
 *   <MyTasksPanel />
 */

import { useEffect, useState } from "react";
import Link from "next/link";

type Task = {
  id: string;
  title: string;
  dueAt: string;
  status: "OPEN" | "DONE" | "SNOOZED" | "CANCELLED";
  priority: "LOW" | "NORMAL" | "HIGH";
  brandId: string | null;
  brandName: string | null;
};

export default function MyTasksPanel({ limit = 6 }: { limit?: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/crm/tasks?status=OPEN&mine=true&take=${limit * 2}`);
        const j = await res.json();
        if (!j.ok) throw new Error(j.error);
        if (!cancelled) {
          // Sort ascending by dueAt and trim
          const sorted = [...j.tasks].sort(
            (a: Task, b: Task) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
          );
          setTasks(sorted.slice(0, limit));
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [limit, refreshKey]);

  const complete = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/crm/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      setRefreshKey((x) => x + 1);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">🗓️ My Tasks</h3>
        <Link
          href="/crm/tasks"
          className="text-xs text-[#00b4c3] hover:text-[#009ba8] font-semibold"
        >
          See all →
        </Link>
      </div>

      {loading && <p className="text-xs text-slate-400">Loading…</p>}

      {error && <p className="text-xs text-red-600">❌ {error}</p>}

      {!loading && !error && tasks.length === 0 && (
        <div className="text-xs text-slate-400 italic py-4 text-center">
          Nothing due. Go break something.
        </div>
      )}

      {!loading && !error && tasks.length > 0 && (
        <ul className="space-y-1.5">
          {tasks.map((t) => {
            const due = new Date(t.dueAt);
            const overdue = due.getTime() < Date.now();
            return (
              <li
                key={t.id}
                className={`flex items-center gap-2 p-2 rounded-md border ${
                  overdue ? "border-red-200 bg-red-50/40" : "border-slate-100 hover:bg-slate-50"
                }`}
              >
                <button
                  onClick={() => complete(t.id)}
                  disabled={busyId === t.id}
                  className="w-4 h-4 border-2 border-slate-300 hover:border-[#00b4c3] hover:bg-cyan-50 rounded-sm flex-shrink-0 flex items-center justify-center text-[10px] text-slate-300 hover:text-[#00b4c3]"
                  title="Mark done"
                >
                  ✓
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{t.title}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    <span className={overdue ? "text-red-600 font-semibold" : ""}>
                      {formatRelative(due)}
                    </span>
                    {t.brandName && ` · ${t.brandName}`}
                  </div>
                </div>
                {t.priority === "HIGH" && (
                  <span className="px-1 py-0.5 text-[9px] font-bold bg-rose-100 text-rose-700 rounded">
                    HIGH
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatRelative(d: Date) {
  const diffMs = d.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays <= 7) return `in ${diffDays}d`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}
