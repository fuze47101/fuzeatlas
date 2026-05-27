"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

interface ActionItem {
  id: string;
  description: string;
  priority: string;
  dueDate: string | null;
  status: string;
  assignee: { id: string; name: string | null } | null;
  createdBy: { id: string; name: string | null } | null;
}
interface Entry {
  id: string;
  bodyMd: string;
  createdAt: string;
  isEdit: boolean;
  editsId: string | null;
  author: { id: string; name: string | null; email: string | null };
}
interface MeetingDetail {
  id: string;
  title: string;
  meetingDate: string;
  status: string;
  notesMd: string;
  series: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string } | null;
  createdBy: { id: string; name: string | null } | null;
  entries: Entry[];
  actionItems: ActionItem[];
}

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "bg-rose-600 text-white",
  HIGH: "bg-amber-500 text-white",
  NORMAL: "bg-slate-200 text-slate-700",
  LOW: "bg-slate-100 text-slate-500",
};
const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  ARCHIVED: "bg-slate-200 text-slate-500",
};

export default function MeetingNotePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [newEntry, setNewEntry] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/meeting-notes/${id}`);
      const d = await r.json();
      if (d.ok) setMeeting(d.meetingNote);
      else setError(d.error || "Failed to load");
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!newEntry.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/meeting-notes/${id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyMd: newEntry.trim() }),
      });
      const d = await r.json();
      if (!d.ok) setError(d.error || "Save failed");
      else {
        setNewEntry("");
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await fetch(`/api/meeting-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone(item: ActionItem) {
    const nextStatus = item.status === "DONE" ? "OPEN" : "DONE";
    await fetch(`/api/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    refresh();
  }

  if (!meeting) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        ) : (
          <div className="text-sm text-slate-500">Loading…</div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-2">
        <Link href="/meeting-notes" className="text-xs text-indigo-600 hover:underline">← All meetings</Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{meeting.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {new Date(meeting.meetingDate).toLocaleString()}
            {meeting.series && <> · <Link href={`/meeting-notes?seriesId=${meeting.series.id}`} className="text-indigo-600 hover:underline">{meeting.series.name}</Link></>}
            {meeting.brand && <> · brand <strong>{meeting.brand.name}</strong></>}
            {meeting.factory && <> · factory <strong>{meeting.factory.name}</strong></>}
            {meeting.createdBy?.name && <> · created by {meeting.createdBy.name}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[meeting.status] || "bg-slate-100"}`}>
            {meeting.status}
          </span>
          {meeting.status !== "COMPLETED" && (
            <button
              onClick={() => setStatus("COMPLETED")}
              disabled={busy}
              className="px-2 py-1 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              Mark completed
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <section>
          <div className="rounded-lg border border-slate-200 bg-white p-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Notes</h2>
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed">
              {meeting.notesMd || <span className="text-slate-400">No notes yet.</span>}
            </pre>
          </div>

          <form onSubmit={saveEntry} className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Add a note (use @username to assign action items; URGENT/HIGH for priority; "by Friday" / "by 2026-06-01" for due dates)
            </label>
            <textarea
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              rows={4}
              placeholder="e.g. @tina to send Silvadur SDS by Friday URGENT"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="submit"
                disabled={busy || !newEntry.trim()}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save note"}
              </button>
            </div>
          </form>
        </section>

        <aside>
          <div className="rounded-lg border border-slate-200 bg-white p-3 sticky top-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">
              Action items ({meeting.actionItems.length})
            </h2>
            {meeting.actionItems.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Use <code className="font-mono">@username</code> in a note to spawn one.
              </p>
            ) : (
              <ul className="space-y-2">
                {meeting.actionItems.map((a) => (
                  <li key={a.id} className="border-b border-slate-100 pb-2 last:border-0">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={a.status === "DONE"}
                        onChange={() => toggleDone(a)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-800">{a.description}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-semibold ${PRIORITY_STYLE[a.priority] || ""}`}>
                            {a.priority}
                          </span>
                          {a.assignee?.name && <span className="text-slate-600">→ {a.assignee.name}</span>}
                          {a.dueDate && <span className="text-slate-500">· due {new Date(a.dueDate).toLocaleDateString()}</span>}
                          <span className="text-slate-400">· {a.status}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
