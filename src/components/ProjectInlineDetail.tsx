"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TaskInlineRow, TaskInlineRowItem, UserLite } from "./TaskInlineRow";

/**
 * Inline expandable detail for a Project row.
 *
 *  - Fetches /api/admin/projects/[id] once on mount + on refresh
 *  - Renders goalMd (whitespace-preserving), action items grouped
 *    by status, last 5 MeetingNoteEntry rows, Edit Goal toggle, and
 *    deep-links to attached meeting notes
 *  - Reuses TaskInlineRow so the same inline-edit + diagnostic
 *    instrumentation lives in every task surface
 */

export function ProjectInlineDetail({ projectId, surfaceTag }: { projectId: string; surfaceTag: string }) {
  const [data, setData] = useState<any | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/projects/${projectId}`);
      const d = await r.json();
      if (d.ok) {
        setData(d);
        setGoalDraft(d.project?.goalMd || "");
      } else {
        setError(d.error || "Failed to load");
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

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

  async function saveGoal() {
    setEditingGoal(false);
    if (goalDraft === (data?.project?.goalMd || "")) return;
    try {
      const r = await fetch(`/api/admin/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalMd: goalDraft || null }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Save failed");
        return;
      }
      load();
    } catch (e: any) {
      setError(e?.message || "Network error");
    }
  }

  if (busy && !data) {
    return <div className="border-t border-slate-200 p-3 text-xs text-slate-500">Loading detail…</div>;
  }
  if (!data) {
    return <div className="border-t border-slate-200 p-3 text-xs text-rose-600">{error || "No data"}</div>;
  }

  const allItems: TaskInlineRowItem[] = (data.actionItems || []).map((a: any) => ({
    id: a.id,
    description: a.description,
    priority: a.priority,
    status: a.status,
    dueDate: a.dueDate,
    assignee: a.assignee,
    meetingNote: a.meetingNote,
  }));
  const byStatus: Record<string, TaskInlineRowItem[]> = { OPEN: [], DONE: [], BLOCKED: [], CANCELLED: [] };
  for (const it of allItems) {
    const bucket = byStatus[it.status] || (byStatus[it.status] = []);
    bucket.push(it);
  }

  function onPatched(updated: TaskInlineRowItem) {
    setData((d: any) =>
      d ? { ...d, actionItems: d.actionItems.map((x: any) => (x.id === updated.id ? { ...x, ...updated } : x)) } : d,
    );
  }

  return (
    <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-4">
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button className="underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Goal</h4>
          {!editingGoal && (
            <button onClick={() => setEditingGoal(true)} className="text-xs text-indigo-600 hover:underline">
              Edit Goal
            </button>
          )}
        </div>
        {editingGoal ? (
          <div>
            <textarea
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              rows={Math.min(20, Math.max(4, goalDraft.split("\n").length + 1))}
              className="w-full px-3 py-2 border border-indigo-300 rounded-md text-sm font-mono"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={saveGoal}
                className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
              >
                Save goal
              </button>
              <button
                onClick={() => {
                  setEditingGoal(false);
                  setGoalDraft(data.project?.goalMd || "");
                }}
                className="text-xs text-slate-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 leading-relaxed bg-white border border-slate-200 rounded-md p-3 max-h-[40vh] overflow-auto">
            {data.project?.goalMd || <span className="text-slate-400 italic">No goal narrative yet — click Edit Goal to add one.</span>}
          </pre>
        )}
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Action items ({allItems.length} total)
        </h4>
        {(["OPEN", "DONE", "BLOCKED", "CANCELLED"] as const).map((s) =>
          (byStatus[s] || []).length === 0 ? null : (
            <div key={s} className="mb-3">
              <div className="text-[10px] font-semibold uppercase text-slate-500 mb-1">
                {s} ({byStatus[s].length})
              </div>
              <table className="min-w-full text-xs bg-white border border-slate-200 rounded-md">
                <tbody className="divide-y divide-slate-100">
                  {byStatus[s].map((it) => (
                    <TaskInlineRow
                      key={it.id}
                      item={it}
                      users={users}
                      onPatched={onPatched}
                      onError={setError}
                      showMeeting
                      surfaceTag={surfaceTag}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ),
        )}
        {allItems.length === 0 && (
          <div className="text-xs text-slate-500 italic">No action items yet.</div>
        )}
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Recent activity
        </h4>
        {(data.recentEntries || []).length === 0 ? (
          <div className="text-xs text-slate-500 italic">No entries yet.</div>
        ) : (
          <ul className="space-y-2">
            {data.recentEntries.map((e: any) => (
              <li key={e.id} className="bg-white border border-slate-200 rounded-md p-2">
                <div className="text-[10px] text-slate-500 mb-0.5">
                  {e.author?.name || e.author?.email || "—"} ·{" "}
                  {new Date(e.createdAt).toLocaleString()} ·{" "}
                  <Link
                    href={`/meeting-notes/${e.meetingNote?.id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {e.meetingNote?.title || "(meeting)"}
                  </Link>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 leading-snug">
                  {String(e.bodyMd || "").slice(0, 600)}
                  {String(e.bodyMd || "").length > 600 ? "…" : ""}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Linked meetings ({(data.meetings || []).length})
        </h4>
        {(data.meetings || []).length === 0 ? (
          <div className="text-xs text-slate-500 italic">No meeting notes yet.</div>
        ) : (
          <ul className="space-y-1">
            {data.meetings.map((m: any) => (
              <li key={m.id} className="text-xs">
                <Link href={`/meeting-notes/${m.id}`} className="text-indigo-600 hover:underline">
                  {m.title}
                </Link>{" "}
                <span className="text-slate-500">
                  · {new Date(m.meetingDate).toLocaleDateString()} · {m.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
