"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { TaskInlineRow, UserLite } from "@/components/TaskInlineRow";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";

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
    assignee?: UserLite | null;
    createdAt?: string | null;
  }>;
}

export default function AdminAllTasksPageOuter() {
  return (
    <HydrationFrame name="/admin/all-tasks">
      <AdminAllTasksPage />
    </HydrationFrame>
  );
}

function AdminAllTasksPage() {
  useMountLog("all-tasks");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<AssigneeGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("OPEN");
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

  function onPatched(itemId: string, updates: any) {
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        items: g.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
      })),
    );
    refresh();
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
                      createdAt: i.createdAt || null,
                    }}
                    users={users}
                    showMeeting
                    surfaceTag="all-tasks"
                    onPatched={(updated) => onPatched(i.id, updated)}
                    onError={setError}
                  />
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
