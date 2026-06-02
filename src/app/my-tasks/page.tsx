"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { TaskInlineRow, TaskInlineRowItem, UserLite } from "@/components/TaskInlineRow";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";

interface ActionItem {
  id: string;
  description: string;
  priority: string;
  dueDate: string | null;
  status: string;
  createdAt: string;
  meetingNote: { id: string; title: string; meetingDate: string } | null;
  createdBy: { id: string; name: string | null } | null;
  assignee?: UserLite | null;
}

export default function MyTasksPageOuter() {
  return (
    <HydrationFrame name="/my-tasks">
      <MyTasksPage />
    </HydrationFrame>
  );
}

function MyTasksPage() {
  useMountLog("my-tasks");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sort, setSort] = useState("priority");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);

  useEffect(() => {
    fetch("/api/settings/users")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.users || []).filter((u: any) =>
          ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"].includes(u.role),
        );
        setUsers(list);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      qs.set("status", statusFilter);
      if (priorityFilter) qs.set("priority", priorityFilter);
      qs.set("sort", sort);
      const r = await fetch(`/api/my-tasks?${qs.toString()}`);
      const d = await r.json();
      if (d.ok) setItems(d.items || []);
    } finally {
      setBusy(false);
    }
  }, [statusFilter, priorityFilter, sort]);

  useEffect(() => {
    refresh();
  }, [refresh]);


  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
        <strong>Diagnostic mode</strong> — click logging enabled. Open DevTools Console to verify
        clicks fire. <code>window.__lastClick</code> + <code>window.__lastClickResult</code> capture the latest event.
      </div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Tasks</h1>
          <p className="mt-1 text-sm text-slate-600">
            Action items assigned to you from meeting notes. Sorted by priority by default.
          </p>
        </div>
        <Link
          href="/meeting-notes"
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
        >
          ← Meetings
        </Link>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button className="underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-slate-600 text-xs uppercase">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm">
            <option value="OPEN">Open</option>
            <option value="DONE">Done</option>
            <option value="BLOCKED">Blocked</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ALL">All</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-slate-600 text-xs uppercase">Priority</span>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm">
            <option value="">Any</option>
            <option value="URGENT">URGENT</option>
            <option value="HIGH">HIGH</option>
            <option value="NORMAL">NORMAL</option>
            <option value="LOW">LOW</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-slate-600 text-xs uppercase">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm">
            <option value="priority">Priority</option>
            <option value="due">Due date</option>
            <option value="created">Created</option>
            <option value="meeting">Meeting date</option>
          </select>
        </label>
        <div className="ml-auto text-xs text-slate-500">{items.length} task(s)</div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-2"></th>
              <th className="px-2 py-2 text-left">Description</th>
              <th className="px-2 py-2 text-left">Priority</th>
              <th className="px-2 py-2 text-left">Assignee</th>
              <th className="px-2 py-2 text-left">Due</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <TaskInlineRow
                key={i.id}
                item={{
                  id: i.id,
                  description: i.description,
                  priority: i.priority,
                  status: i.status,
                  dueDate: i.dueDate,
                  assignee: i.assignee || null,
                  meetingNote: i.meetingNote,
                }}
                users={users}
                showMeeting
                surfaceTag="my-tasks"
                onPatched={(updated) => {
                  setItems((arr) =>
                    arr.map((x) =>
                      x.id === updated.id ? ({ ...x, ...updated } as ActionItem) : x,
                    ),
                  );
                  // Background refresh to pick up server-computed
                  // fields (doneAt, etc).
                  refresh();
                }}
                onError={setError}
              />
            ))}
            {items.length === 0 && !busy && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                  Nothing here. Action items show up when somebody @mentions you in a meeting note.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
