"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

interface AssigneeGroup {
  assignee: { id: string | null; name: string | null; email: string | null };
  count: number;
  items: Array<{
    id: string;
    description: string;
    priority: string;
    status: string;
    dueDate: string | null;
    meetingNote: { id: string; title: string } | null;
  }>;
}

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "bg-rose-600 text-white",
  HIGH: "bg-amber-500 text-white",
  NORMAL: "bg-slate-200 text-slate-700",
  LOW: "bg-slate-100 text-slate-500",
};

export default function AdminAllTasksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<AssigneeGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  const refresh = () =>
    fetch(`/api/admin/all-tasks?status=${statusFilter}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setGroups(d.groups || []);
          setTotal(d.totalItems || 0);
        }
      });

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function toggleDone(itemId: string, prevStatus: string) {
    const next = prevStatus === "DONE" ? "OPEN" : "DONE";
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        items: g.items.map((i) => (i.id === itemId ? { ...i, status: next } : i)),
      })),
    );
    setError(null);
    try {
      const r = await fetch(`/api/action-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      if (!r.ok || !d.ok) {
        setGroups((gs) =>
          gs.map((g) => ({
            ...g,
            items: g.items.map((i) => (i.id === itemId ? { ...i, status: prevStatus } : i)),
          })),
        );
        setError(d.error || `Update failed (HTTP ${r.status})`);
        console.error("[all-tasks] PATCH /api/action-items failed:", d);
        return;
      }
      refresh();
    } catch (e: any) {
      setGroups((gs) =>
        gs.map((g) => ({
          ...g,
          items: g.items.map((i) => (i.id === itemId ? { ...i, status: prevStatus } : i)),
        })),
      );
      setError(e?.message || "Network error");
      console.error("[all-tasks] PATCH /api/action-items threw:", e);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">All Tasks (admin rollup)</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every action item across every meeting, grouped by assignee. {total} item(s).
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600 text-xs uppercase">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm">
            <option value="OPEN">Open</option>
            <option value="DONE">Done</option>
            <option value="BLOCKED">Blocked</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ALL">All</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button className="underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.assignee.id || "_un"} className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
              <div className="font-medium text-slate-900">
                {g.assignee.name || "Unassigned"}{" "}
                {g.assignee.email && <span className="text-xs text-slate-500">&lt;{g.assignee.email}&gt;</span>}
              </div>
              <div className="text-xs text-slate-500">{g.count} item(s)</div>
            </div>
            <table className="min-w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {g.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 w-[40px]">
                      <input
                        type="checkbox"
                        checked={i.status === "DONE"}
                        onChange={() => toggleDone(i.id, i.status)}
                      />
                    </td>
                    <td className="px-3 py-2 w-[80px]">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[i.priority] || ""}`}>
                        {i.priority}
                      </span>
                    </td>
                    <td className={`px-3 py-2 ${i.status === "DONE" ? "line-through text-slate-400" : "text-slate-800"}`}>
                      {i.description}
                    </td>
                    <td className="px-3 py-2 w-[200px]">
                      {i.meetingNote ? (
                        <Link href={`/meeting-notes/${i.meetingNote.id}`} className="text-xs text-indigo-600 hover:underline">
                          {i.meetingNote.title}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 w-[110px] text-xs text-slate-600 whitespace-nowrap">
                      {i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2 w-[90px] text-xs text-slate-500">{i.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No action items in this view.
          </div>
        )}
      </div>
    </div>
  );
}
