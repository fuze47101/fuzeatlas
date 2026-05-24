// @ts-nocheck
"use client";

/**
 * ACM Tasks dashboard.
 *
 * Shows the user's (or team's) ACM (Atlas Customer Management) tasks in
 * three buckets:
 *   - Overdue
 *   - Due this week (incl. today)
 *   - Upcoming (more than 7 days out)
 *
 * Also has a simple "Done / Cancelled" tab for recently-closed tasks so
 * Barth + Viktor can see the before/after on demo day.
 *
 * NOTE: renamed from /crm/tasks as part of the CRM → ACM rebrand
 * (2026-04-20). /crm/tasks still resolves via a redirect stub.
 */

import { useEffect, useMemo, useState } from "react";
import AddTaskButton from "@/components/AddTaskButton";
import { useI18n } from "@/i18n";

type Task = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string;
  status: "OPEN" | "DONE" | "SNOOZED" | "CANCELLED";
  priority: "LOW" | "NORMAL" | "HIGH";
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  brandId: string | null;
  brandName: string | null;
  completedAt: string | null;
  createdAt: string;
};

export default function TasksPage() {
  const { t } = useI18n();
  const T = t.acmTasks;
  const [tab, setTab] = useState<"open" | "done">("open");
  const [mineOnly, setMineOnly] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const qp = new URLSearchParams();
        if (tab === "open") qp.set("status", "OPEN");
        if (tab === "done") qp.set("status", "DONE");
        if (mineOnly) qp.set("mine", "true");
        qp.set("take", "200");
        const res = await fetch(`/api/acm/tasks?${qp.toString()}`);
        const j = await res.json();
        if (!j.ok) throw new Error(j.error);
        if (!cancelled) setTasks(j.tasks);
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
  }, [tab, mineOnly, refreshKey]);

  const refresh = () => setRefreshKey((x) => x + 1);

  const bucketed = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const end7 = now + 7 * dayMs;
    const overdue: Task[] = [];
    const week: Task[] = [];
    const later: Task[] = [];
    for (const t of tasks) {
      if (t.status !== "OPEN") continue;
      const due = new Date(t.dueAt).getTime();
      if (due < now) overdue.push(t);
      else if (due <= end7) week.push(t);
      else later.push(t);
    }
    return { overdue, week, later };
  }, [tasks]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{T.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {T.subtitle}
          </p>
        </div>
        <AddTaskButton onCreated={refresh} />
      </div>

      {/* Tabs + filter */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <TabBtn active={tab === "open"} onClick={() => setTab("open")}>
            {T.tabOpen}
          </TabBtn>
          <TabBtn active={tab === "done"} onClick={() => setTab("done")}>
            {T.tabCompleted}
          </TabBtn>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="rounded"
          />
          {T.onlyMine}
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
          ❌ {error}
        </div>
      )}

      {loading && <p className="text-sm text-slate-400">{T.loading}</p>}

      {!loading && tab === "open" && (
        <div className="space-y-6">
          <Bucket
            title={T.overdueTitle}
            subtitle={T.overdueSubtitle}
            tone="red"
            tasks={bucketed.overdue}
            refresh={refresh}
            T={T}
          />
          <Bucket
            title={T.dueWeekTitle}
            subtitle={T.dueWeekSubtitle}
            tone="cyan"
            tasks={bucketed.week}
            refresh={refresh}
            T={T}
          />
          <Bucket
            title={T.upcomingTitle}
            subtitle={T.upcomingSubtitle}
            tone="slate"
            tasks={bucketed.later}
            refresh={refresh}
            T={T}
          />
        </div>
      )}

      {!loading && tab === "done" && (
        <Bucket
          title={T.completedTitle}
          subtitle={T.completedSubtitle}
          tone="green"
          tasks={tasks}
          refresh={refresh}
          T={T}
        />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-bold rounded-md ${
        active
          ? "bg-[#00b4c3] text-white"
          : "bg-white border border-slate-200 text-slate-700 hover:border-slate-400"
      }`}
    >
      {children}
    </button>
  );
}

function Bucket({
  title,
  subtitle,
  tone,
  tasks,
  refresh,
  T,
}: {
  title: string;
  subtitle: string;
  tone: "red" | "cyan" | "slate" | "green";
  tasks: Task[];
  refresh: () => void;
  T: any;
}) {
  const toneMap = {
    red: "text-red-700",
    cyan: "text-[#00b4c3]",
    slate: "text-slate-500",
    green: "text-emerald-700",
  }[tone];

  return (
    <div>
      <h2 className={`text-xs font-bold uppercase ${toneMap}`}>{title}</h2>
      <p className="text-[11px] text-slate-400 mb-2">{subtitle}</p>
      {tasks.length === 0 ? (
        <div className="p-4 border border-dashed border-slate-200 rounded-lg text-sm text-slate-400 italic">
          {T.nothingHere}
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} refresh={refresh} T={T} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task, refresh, T }: { task: Task; refresh: () => void; T: any }) {
  const [busy, setBusy] = useState(false);

  const doAction = async (action: "complete" | "reopen" | "cancel") => {
    setBusy(true);
    try {
      await fetch(`/api/acm/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const due = new Date(task.dueAt);
  const now = Date.now();
  const overdue = task.status === "OPEN" && due.getTime() < now;

  return (
    <li
      className={`p-3 border rounded-lg bg-white flex items-start gap-3 ${
        overdue ? "border-red-200" : "border-slate-200"
      } ${task.status !== "OPEN" ? "opacity-70" : ""}`}
    >
      {task.status === "OPEN" ? (
        <button
          onClick={() => doAction("complete")}
          disabled={busy}
          className="mt-1 w-5 h-5 border-2 border-slate-300 hover:border-[#00b4c3] hover:bg-cyan-50 rounded-sm flex items-center justify-center text-slate-300 hover:text-[#00b4c3]"
          title={T.markDoneTitle}
        >
          ✓
        </button>
      ) : (
        <div className="mt-1 w-5 h-5 border-2 border-emerald-400 bg-emerald-50 text-emerald-600 rounded-sm flex items-center justify-center text-xs">
          ✓
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <div
            className={`text-sm font-bold text-slate-900 ${
              task.status !== "OPEN" ? "line-through text-slate-500" : ""
            }`}
          >
            {task.title}
          </div>
          {task.priority === "HIGH" && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded">
              {T.highPriorityBadge}
            </span>
          )}
          {task.brandName && (
            <a
              href={`/brands/${task.brandId}`}
              className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
            >
              {task.brandName}
            </a>
          )}
        </div>

        <div className="text-xs text-slate-500 mt-0.5">
          <span className={overdue ? "text-red-600 font-semibold" : ""}>
            {overdue ? T.overdueRowPrefix : ""}{T.duePrefix} {formatRelative(due, T)}
          </span>
          {task.ownerName ? ` · ${T.ownerLabel} ${task.ownerName}` : ""}
        </div>

        {task.notes && (
          <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{task.notes}</div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {task.status === "OPEN" && (
          <button
            onClick={() => doAction("cancel")}
            disabled={busy}
            className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded"
            title={T.cancelTaskTitle}
          >
            ✕
          </button>
        )}
        {task.status === "DONE" && (
          <button
            onClick={() => doAction("reopen")}
            disabled={busy}
            className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded"
            title={T.reopenTitle}
          >
            ↻
          </button>
        )}
      </div>
    </li>
  );
}

function formatRelative(d: Date, T: any) {
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (diffDays === 0) return `${T.relToday}, ${fmt.format(d)}`;
  if (diffDays === 1) return `${T.relTomorrow}, ${fmt.format(d)}`;
  if (diffDays === -1) return T.relYesterday;
  if (diffDays > 0 && diffDays <= 7) return `${T.relInPrefix} ${diffDays} ${T.relDaysSuffix} — ${fmt.format(d)}`;
  if (diffDays < 0) return `${Math.abs(diffDays)} ${T.relDaysAgo}`;
  return fmt.format(d);
}
