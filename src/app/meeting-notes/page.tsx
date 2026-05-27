"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

interface MeetingNoteRow {
  id: string;
  title: string;
  meetingDate: string;
  status: string;
  series: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  _count: { entries: number; actionItems: number };
}

interface SeriesRow {
  id: string;
  name: string;
  cadence: string | null;
  brand: { name: string } | null;
  factory: { name: string } | null;
  active: boolean;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  ARCHIVED: "bg-slate-200 text-slate-500",
};

export default function MeetingNotesIndex() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<MeetingNoteRow[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [seriesFilter, setSeriesFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSeriesId, setNewSeriesId] = useState("");

  useEffect(() => {
    if (loading) return;
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "TESTING_MANAGER", "FABRIC_MANAGER", "FACTORY_MANAGER"];
    if (!user || !allowed.includes(user.role)) router.replace("/home");
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const qs = seriesFilter ? `?seriesId=${seriesFilter}` : "";
      const [notesRes, seriesRes] = await Promise.all([
        fetch(`/api/meeting-notes${qs}`).then((r) => r.json()),
        fetch("/api/meeting-series").then((r) => r.json()).catch(() => ({ ok: false })),
      ]);
      if (notesRes.ok) setNotes(notesRes.notes || []);
      if (seriesRes.ok) setSeries(seriesRes.series || []);
    } finally {
      setBusy(false);
    }
  }, [seriesFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/meeting-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          seriesId: newSeriesId || undefined,
          meetingDate: new Date().toISOString(),
        }),
      });
      const d = await res.json();
      if (d.ok) {
        router.push(`/meeting-notes/${d.meetingNote.id}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Meetings</h1>
          <p className="mt-1 text-sm text-slate-600">
            Meeting notes, action items, and recurring series. FUZE internal only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/meeting-notes/series"
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
          >
            Series
          </Link>
          <Link
            href="/my-tasks"
            className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
          >
            My Tasks
          </Link>
          <button
            onClick={() => setShowNew(!showNew)}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            + New Meeting Note
          </button>
        </div>
      </div>

      {showNew && (
        <form onSubmit={createNote} className="mb-4 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Penfabric Check-in 2026-W22"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Series (optional)</label>
            <select
              value={newSeriesId}
              onChange={(e) => setNewSeriesId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">— Ad-hoc, no series —</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        <aside className="rounded-lg border border-slate-200 bg-white p-3 self-start">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Series</h2>
          <button
            onClick={() => setSeriesFilter(null)}
            className={`block w-full text-left px-2 py-1.5 rounded text-sm ${seriesFilter === null ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-50 text-slate-700"}`}
          >
            All meetings
          </button>
          {series.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeriesFilter(s.id)}
              className={`block w-full text-left px-2 py-1.5 rounded text-sm ${seriesFilter === s.id ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-50 text-slate-700"}`}
            >
              <div>{s.name}</div>
              {(s.brand || s.factory || s.cadence) && (
                <div className="text-[10px] text-slate-500">
                  {s.cadence ? s.cadence : ""}
                  {s.brand ? ` · ${s.brand.name}` : ""}
                  {s.factory ? ` · ${s.factory.name}` : ""}
                </div>
              )}
            </button>
          ))}
        </aside>

        <section>
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Meeting</th>
                  <th className="px-3 py-2 text-left">Series / Tags</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Entries</th>
                  <th className="px-3 py-2 text-right">Action items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notes.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={`/meeting-notes/${n.id}`} className="text-indigo-600 hover:underline font-medium">
                        {n.title}
                      </Link>
                      <div className="text-xs text-slate-500">{new Date(n.meetingDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {n.series ? <div>{n.series.name}</div> : <div className="text-slate-400">ad-hoc</div>}
                      {n.brand && <div className="text-[10px]">brand: {n.brand.name}</div>}
                      {n.factory && <div className="text-[10px]">factory: {n.factory.name}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[n.status] || "bg-slate-100 text-slate-700"}`}>
                        {n.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{n._count.entries}</td>
                    <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{n._count.actionItems}</td>
                  </tr>
                ))}
                {notes.length === 0 && !busy && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                      No meeting notes yet. Click "+ New Meeting Note" to start one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
