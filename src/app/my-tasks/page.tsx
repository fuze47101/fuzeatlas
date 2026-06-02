"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

interface ActionItem {
  id: string;
  description: string;
  priority: string;
  dueDate: string | null;
  status: string;
  createdAt: string;
  meetingNote: { id: string; title: string; meetingDate: string } | null;
  createdBy: { id: string; name: string | null } | null;
}

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "bg-rose-600 text-white",
  HIGH: "bg-amber-500 text-white",
  NORMAL: "bg-slate-200 text-slate-700",
  LOW: "bg-slate-100 text-slate-500",
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-sky-100 text-sky-800",
  DONE: "bg-emerald-100 text-emerald-700",
  BLOCKED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default function MyTasksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sort, setSort] = useState("priority");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function patchItem(itemId: string, patch: any, prevStatus?: string) {
    // Optimistic update — flip local state immediately so the checkbox
    // animates and the user sees the change.
    setError(null);
    setItems((arr) => arr.map((x) => (x.id === itemId ? { ...x, ...patch } : x)));
    try {
      const r = await fetch(`/api/action-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      if (!r.ok || !d.ok) {
        // Revert if we know the prior status.
        if (prevStatus !== undefined) {
          setItems((arr) => arr.map((x) => (x.id === itemId ? { ...x, status: prevStatus } : x)));
        }
        const msg = d.error || `Update failed (HTTP ${r.status})`;
        setError(msg);
        console.error("[my-tasks] PATCH /api/action-items failed:", msg, d);
        return;
      }
      // Success — refresh in the background to pick up server-side
      // computed fields (doneAt, doneBy).
      refresh();
    } catch (e: any) {
      if (prevStatus !== undefined) {
        setItems((arr) => arr.map((x) => (x.id === itemId ? { ...x, status: prevStatus } : x)));
      }
      const msg = e?.message || "Network error";
      setError(msg);
      console.error("[my-tasks] PATCH /api/action-items threw:", e);
    }
  }
  async function toggleDone(item: ActionItem) {
    const next = item.status === "DONE" ? "OPEN" : "DONE";
    await patchItem(item.id, { status: next }, item.status);
  }
  async function setPriority(item: ActionItem, priority: string) {
    await patchItem(item.id, { priority });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
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
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Priority</th>
              <th className="px-3 py-2 text-left">Meeting</th>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={i.status === "DONE"} onChange={() => toggleDone(i)} />
                </td>
                <td className="px-3 py-2">
                  <div className="text-slate-900">{i.description}</div>
                  {i.createdBy?.name && (
                    <div className="text-[10px] text-slate-500">assigned by {i.createdBy.name}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={i.priority}
                    onChange={(e) => setPriority(i, e.target.value)}
                    className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border-0 ${PRIORITY_STYLE[i.priority] || ""}`}
                  >
                    <option value="URGENT">URGENT</option>
                    <option value="HIGH">HIGH</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="LOW">LOW</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  {i.meetingNote ? (
                    <Link href={`/meeting-notes/${i.meetingNote.id}`} className="text-xs text-indigo-600 hover:underline">
                      {i.meetingNote.title}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                  {i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[i.status] || ""}`}>
                    {i.status}
                  </span>
                </td>
              </tr>
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
