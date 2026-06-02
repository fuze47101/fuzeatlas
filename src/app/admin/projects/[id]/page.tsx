"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

type Tab = "overview" | "grid" | "tasks" | "meetings";

interface ProjectMeta {
  id: string;
  name: string;
  projectType: string;
  stage: string;
  goalMd: string | null;
  ownerId: string | null;
  owner: { id: string; name: string | null; email: string | null } | null;
  brandId: string | null;
  brandName: string | null;
  factoryId: string | null;
  factoryName: string | null;
  kickoffMeetingNoteId: string | null;
  projectedValue: number | null;
  annualVolumeMeters: number | null;
  fuzeTier: string | null;
  createdAt: string;
}
interface ActionItemRow {
  id: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string | null;
  assignee: { id: string; name: string | null; email: string | null } | null;
  meetingNote: { id: string; title: string } | null;
}
interface MeetingRow {
  id: string;
  title: string;
  status: string;
  meetingDate: string;
  _count: { entries: number; actionItems: number };
}
interface ColumnDef {
  key: string;
  label: string;
  testType: string;
  testMethod: string | null;
  organisms: string | null;
}
interface CellData {
  status: string;
  value: string | null;
  testRunId: string | null;
}
interface SampleRow {
  fabricId: string;
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  washCount: number | null;
  cells: Record<string, CellData>;
}

const STAGE_COLORS: Record<string, string> = {
  DEVELOPMENT: "bg-amber-100 text-amber-800",
  SAMPLING: "bg-sky-100 text-sky-800",
  TESTING: "bg-indigo-100 text-indigo-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  COMMERCIALIZATION: "bg-cyan-100 text-cyan-800",
  PRODUCTION: "bg-emerald-200 text-emerald-900 font-semibold",
  COMPLETE: "bg-slate-200 text-slate-700",
};
const TYPE_BADGE: Record<string, string> = {
  BRAND: "bg-indigo-100 text-indigo-800",
  FACTORY: "bg-fuchsia-100 text-fuchsia-800",
  INTERNAL: "bg-slate-200 text-slate-700",
};
const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-sky-100 text-sky-800",
  DONE: "bg-emerald-100 text-emerald-700",
  BLOCKED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-slate-100 text-slate-500",
  PASS: "bg-emerald-100 text-emerald-800",
  FAIL: "bg-rose-100 text-rose-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  NOT_TESTED: "bg-slate-100 text-slate-500",
};
const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "bg-rose-600 text-white",
  HIGH: "bg-amber-500 text-white",
  NORMAL: "bg-slate-200 text-slate-700",
  LOW: "bg-slate-100 text-slate-500",
};

export default function AdminProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [tab, setTab] = useState<Tab>("overview");
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [counts, setCounts] = useState<any>({});
  const [actionItems, setActionItems] = useState<ActionItemRow[]>([]);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [gridColumns, setGridColumns] = useState<ColumnDef[]>([]);
  const [gridSamples, setGridSamples] = useState<SampleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Owner change modal
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);
  const [newOwnerId, setNewOwnerId] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/projects/${id}`);
      const d = await r.json();
      if (!d.ok) setErr(d.error || "Load failed");
      else {
        setProject(d.project);
        setCounts(d.counts || {});
        setActionItems(d.actionItems || []);
        setMeetings(d.meetings || []);
      }
    } catch (e: any) {
      setErr(e?.message || "Load failed");
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sample grid lazy-loads when tab opens
  useEffect(() => {
    if (tab !== "grid" || !id || gridColumns.length > 0 || gridSamples.length > 0) return;
    fetch(`/api/admin/projects/${id}/grid`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setGridColumns(d.columns || []);
          setGridSamples(d.samples || []);
        }
      })
      .catch(() => {});
  }, [tab, id, gridColumns.length, gridSamples.length]);

  async function toggleDone(row: ActionItemRow) {
    const prev = row.status;
    const next = row.status === "DONE" ? "OPEN" : "DONE";
    // Optimistic UI flip so the checkbox animates immediately.
    setActionItems((arr) => arr.map((x) => (x.id === row.id ? { ...x, status: next } : x)));
    setErr(null);
    try {
      const r = await fetch(`/api/action-items/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      if (!r.ok || !d.ok) {
        setActionItems((arr) => arr.map((x) => (x.id === row.id ? { ...x, status: prev } : x)));
        setErr(d.error || `Update failed (HTTP ${r.status})`);
        console.error("[project-tasks] PATCH /api/action-items failed:", d);
        return;
      }
      refresh();
    } catch (e: any) {
      setActionItems((arr) => arr.map((x) => (x.id === row.id ? { ...x, status: prev } : x)));
      setErr(e?.message || "Network error");
      console.error("[project-tasks] PATCH /api/action-items threw:", e);
    }
  }

  function openOwnerModal() {
    if (users.length === 0) {
      fetch("/api/settings/users")
        .then((r) => r.json())
        .then((d) => {
          const list = (d.users || []).filter((u: any) =>
            ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"].includes(u.role),
          );
          setUsers(list);
        });
    }
    setNewOwnerId(project?.ownerId || "");
    setShowOwnerModal(true);
  }
  async function saveOwner() {
    if (!newOwnerId) return;
    await fetch(`/api/admin/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: newOwnerId }),
    });
    setShowOwnerModal(false);
    refresh();
  }

  if (busy && !project) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (err && !project)
    return (
      <div className="p-6">
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div>
      </div>
    );
  if (!project) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-2">
        <Link href="/admin/projects" className="text-xs text-indigo-600 hover:underline">← All projects</Link>
      </div>

      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_BADGE[project.projectType] || ""}`}>
                {project.projectType}
              </span>{" "}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ml-1 ${STAGE_COLORS[project.stage] || "bg-slate-100"}`}>
                {project.stage}
              </span>
              {project.brandName && <> · brand <strong>{project.brandName}</strong></>}
              {project.factoryName && <> · factory <strong>{project.factoryName}</strong></>}
              {project.fuzeTier && <> · tier {project.fuzeTier}</>}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Owner:{" "}
              <strong className="text-slate-700">
                {project.owner?.name || project.owner?.email || <span className="text-slate-400">(unassigned)</span>}
              </strong>{" "}
              <button onClick={openOwnerModal} className="text-indigo-600 hover:underline">change ▾</button>
              {" · "}created {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {project.kickoffMeetingNoteId && (
              <Link
                href={`/meeting-notes/${project.kickoffMeetingNoteId}`}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Kickoff note →
              </Link>
            )}
            {project.stage !== "COMPLETE" && (
              <button
                onClick={async () => {
                  const notes = prompt("Closing notes (optional) — summary of what closed this project:");
                  if (notes === null) return;
                  const r = await fetch(`/api/admin/projects/${project.id}/weekly-update`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ markComplete: true, closingNotes: notes || undefined }),
                  });
                  const d = await r.json();
                  if (!d.ok) alert(d.error || "Mark complete failed");
                  else router.refresh();
                }}
                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 whitespace-nowrap"
              >
                Mark complete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 mb-4 flex items-center gap-1">
        {(["overview", "grid", "tasks", "meetings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${
              tab === t
                ? "border-indigo-500 text-indigo-700 font-medium"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {t === "overview" ? "Overview" : t === "grid" ? "Sample Grid" : t === "tasks" ? `Tasks (${counts.openActionItems || 0})` : `Meetings (${counts.meetings || 0})`}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Goal</h2>
            {project.goalMd ? (
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed">
                {project.goalMd}
              </pre>
            ) : (
              <p className="text-sm text-slate-400 italic">No goal narrative recorded yet.</p>
            )}
          </section>
          <aside className="space-y-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs uppercase text-slate-500">Open action items</div>
              <div className="text-2xl font-bold text-slate-900">{counts.openActionItems ?? 0}</div>
              <div className="text-[10px] text-slate-500">of {counts.totalActionItems ?? 0} total</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs uppercase text-slate-500">Meetings</div>
              <div className="text-2xl font-bold text-slate-900">{counts.meetings ?? 0}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs uppercase text-slate-500">Test requests</div>
              <div className="text-2xl font-bold text-slate-900">{counts.testRequests ?? 0}</div>
            </div>
            {project.projectType !== "INTERNAL" && project.projectedValue != null && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs uppercase text-slate-500">Projected value</div>
                <div className="text-2xl font-bold text-slate-900">
                  ${Math.round(project.projectedValue).toLocaleString()}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === "grid" && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          {gridColumns.length === 0 && gridSamples.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No samples yet on this project.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">Sample</th>
                  <th className="px-2 py-2 text-left">Wash</th>
                  {gridColumns.map((c) => (
                    <th key={c.key} className="px-2 py-2 text-left">
                      <div className="text-[10px]">{c.testType}</div>
                      {c.testMethod && <div className="text-[9px] text-slate-500">{c.testMethod}</div>}
                      {c.organisms && <div className="text-[9px] text-slate-500">{c.organisms}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gridSamples.map((s) => (
                  <tr key={`${s.fabricId}-${s.washCount ?? "x"}`}>
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                      <Link href={`/fabrics/${s.fabricId}/edit`} className="text-indigo-600 hover:underline">
                        FUZE {s.fuzeNumber ?? s.fabricId.slice(-6)}
                      </Link>
                      {s.customerCode && <div className="text-[10px] text-slate-500">{s.customerCode}</div>}
                    </td>
                    <td className="px-2 py-2 text-slate-600">{s.washCount != null ? `${s.washCount}w` : "—"}</td>
                    {gridColumns.map((c) => {
                      const cell = s.cells[c.key];
                      return (
                        <td key={c.key} className="px-2 py-2 whitespace-nowrap">
                          {cell ? (
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[cell.status] || ""}`}>
                              {cell.status}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Assignee</th>
                <th className="px-3 py-2 text-left">Priority</th>
                <th className="px-3 py-2 text-left">Due</th>
                <th className="px-3 py-2 text-left">Meeting</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {actionItems.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={a.status === "DONE"} onChange={() => toggleDone(a)} />
                  </td>
                  <td className="px-3 py-2 text-slate-900">{a.description}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">{a.assignee?.name || a.assignee?.email || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[a.priority] || ""}`}>
                      {a.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                    {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {a.meetingNote ? (
                      <Link href={`/meeting-notes/${a.meetingNote.id}`} className="text-indigo-600 hover:underline">
                        {a.meetingNote.title}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[a.status] || ""}`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
              {actionItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                    No tasks yet. Tasks come from the kickoff or any meeting tagged to this project.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "meetings" && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Meeting</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Entries</th>
                <th className="px-3 py-2 text-right">Action items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {meetings.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={`/meeting-notes/${m.id}`} className="text-indigo-600 hover:underline">
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{new Date(m.meetingDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-xs">{m.status}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{m._count?.entries ?? 0}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{m._count?.actionItems ?? 0}</td>
                </tr>
              ))}
              {meetings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                    No meetings tagged to this project yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showOwnerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setShowOwnerModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Change project owner</h3>
            <select value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setShowOwnerModal(false)} className="px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50">Cancel</button>
              <button onClick={saveOwner} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Reassign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
