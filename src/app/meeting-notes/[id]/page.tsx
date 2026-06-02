"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";

type UserLite = { id: string; name: string | null; email: string | null };
type ActionItem = {
  id: string;
  description: string;
  priority: string;
  dueDate: string | null;
  status: string;
  assignee: UserLite | null;
  projectBlockId?: string | null;
};
type ProjectBlock = {
  id: string;
  customerType: "BRAND" | "FACTORY" | "OTHER";
  brandId: string | null;
  factoryId: string | null;
  internalLabel: string | null;
  ownerId: string | null;
  priority: "A" | "B" | "C" | "D" | null;
  sortOrder: number;
  discussionMd: string;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string } | null;
  owner: UserLite | null;
  actionItems: ActionItem[];
  projectId?: string | null;
  project?: { id: string; name: string; stage: string } | null;
  createdAt: string;
};
type Entry = {
  id: string;
  bodyMd: string;
  createdAt: string;
  author: UserLite;
};
type MeetingDetail = {
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
  projectBlocks: ProjectBlock[];
};
type Options = {
  users: UserLite[];
  brands: { id: string; name: string }[];
  factories: { id: string; name: string }[];
};

const PRIORITY_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
const PRIORITY_LABEL: Record<string, string> = {
  A: "A — Critical / This week",
  B: "B — High / This sprint",
  C: "C — Standard cadence",
  D: "D — Watch / Parked",
};
const PRIORITY_BG: Record<string, string> = {
  A: "border-rose-300 bg-rose-50",
  B: "border-amber-300 bg-amber-50",
  C: "border-sky-300 bg-sky-50",
  D: "border-slate-300 bg-slate-50",
};
const PRIORITY_CHIP: Record<string, string> = {
  A: "bg-rose-600 text-white",
  B: "bg-amber-500 text-white",
  C: "bg-sky-600 text-white",
  D: "bg-slate-500 text-white",
};
const TASK_PRIORITY_CHIP: Record<string, string> = {
  URGENT: "bg-rose-600 text-white",
  HIGH: "bg-amber-500 text-white",
  NORMAL: "bg-slate-300 text-slate-800",
  LOW: "bg-slate-100 text-slate-500",
};

function sortBlocks(blocks: ProjectBlock[]): ProjectBlock[] {
  return [...blocks].sort((a, b) => {
    const ra = PRIORITY_RANK[a.priority || ""] || 99;
    const rb = PRIORITY_RANK[b.priority || ""] || 99;
    if (ra !== rb) return ra - rb;
    if ((a.sortOrder || 0) !== (b.sortOrder || 0)) return (a.sortOrder || 0) - (b.sortOrder || 0);
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function labelForBlock(b: ProjectBlock): string {
  if (b.customerType === "BRAND") return b.brand?.name || "(unassigned brand)";
  if (b.customerType === "FACTORY") return b.factory?.name || "(unassigned factory)";
  return b.internalLabel || "(unnamed internal project)";
}

export default function MeetingNotePageOuter() {
  return (
    <HydrationFrame name="/meeting-notes/[id]">
      <MeetingNotePage />
    </HydrationFrame>
  );
}

function MeetingNotePage() {
  useMountLog("meeting-note-detail");
  const { id } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightBlockId, setHighlightBlockId] = useState<string | null>(null);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<{ blockId: string; projectId: string; projectName: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/meeting-notes/${id}?_=${Date.now()}`, { cache: "no-store" });
      const d = await r.json();
      if (d.ok) {
        const blockCount = (d.meetingNote?.projectBlocks || []).length;
        // eslint-disable-next-line no-console
        console.log("[refresh] meeting-notes fetched blockCount=" + blockCount);
        setMeeting(d.meetingNote);
      } else setError(d.error || "Failed to load");
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    refresh();
    fetch("/api/meeting-notes/options")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setOptions(d);
      })
      .catch(() => null);
  }, [refresh]);

  async function addBlock() {
    // eslint-disable-next-line no-console
    console.log("[CLICK]", new Date().toISOString(), "handler=meeting-note.addBlock", "id=" + id);
    if (typeof window !== "undefined") {
      (window as any).__lastClick = { handler: "meeting-note.addBlock", id, ts: Date.now() };
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/meeting-notes/${id}/project-blocks?_=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ customerType: "OTHER", priority: "A" }),
      });
      // eslint-disable-next-line no-console
      console.log("[FETCH-RESULT]", new Date().toISOString(), "POST project-blocks", "status=" + r.status);
      const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      if (!r.ok || !d.ok) {
        const msg = d.error || `Add block failed (HTTP ${r.status})`;
        setError(msg);
        // eslint-disable-next-line no-console
        console.error("[addBlock] failed:", msg, d);
        return;
      }
      const newBlock = d.block;
      const newBlockId: string | null = newBlock?.id || null;
      // eslint-disable-next-line no-console
      console.log("[addBlock] server returned block id=" + newBlockId, "priority=" + newBlock?.priority);

      // Optimistic update — prepend the new block straight into local
      // state. Bypasses every cache layer (Vercel edge, browser HTTP,
      // fetch deduper). The earlier refetch-after-POST path was
      // racing with no-store-headers-not-yet-deployed.
      if (newBlock) {
        setMeeting((m) => {
          if (!m) return m;
          const already = (m.projectBlocks || []).some((b) => b.id === newBlock.id);
          if (already) return m;
          return { ...m, projectBlocks: [newBlock, ...(m.projectBlocks || [])] };
        });
      }

      // Belt-and-suspenders refetch too, so any other client that's
      // open also sees the row eventually.
      refresh().catch(() => null);

      if (newBlockId) {
        setHighlightBlockId(newBlockId);
        setTimeout(() => {
          const el = document.querySelector(`[data-block-id="${newBlockId}"]`);
          // eslint-disable-next-line no-console
          console.log("[addBlock] scrollIntoView target=" + (el ? "found" : "MISSING"), "id=" + newBlockId);
          el?.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 100);
        setTimeout(() => setHighlightBlockId(null), 4000);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[addBlock] threw:", e);
      setError(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  }

  /** Optimistic block patch — local state first, fetch in background. */
  async function patchBlock(blockId: string, patch: any) {
    const prev = meeting?.projectBlocks?.find((b) => b.id === blockId);
    setMeeting((m) => {
      if (!m) return m;
      return {
        ...m,
        projectBlocks: (m.projectBlocks || []).map((b) =>
          b.id === blockId ? ({ ...b, ...patch } as ProjectBlock) : b,
        ),
      };
    });
    try {
      const r = await fetch(`/api/meeting-notes/${id}/project-blocks/${blockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(patch),
      });
      const d = await r.json();
      if (!d.ok) {
        // Revert.
        setMeeting((m) => {
          if (!m || !prev) return m;
          return {
            ...m,
            projectBlocks: (m.projectBlocks || []).map((b) => (b.id === blockId ? prev : b)),
          };
        });
        setError(d.error || "Update failed");
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    }
  }

  /** Optimistic block delete (used by the per-block × — non-archive). */
  async function deleteBlock(blockId: string) {
    const snapshot = meeting?.projectBlocks || [];
    setMeeting((m) => (m ? { ...m, projectBlocks: snapshot.filter((b) => b.id !== blockId) } : m));
    setExpandedBlockId((cur) => (cur === blockId ? null : cur));
    try {
      const r = await fetch(`/api/meeting-notes/${id}/project-blocks/${blockId}`, { method: "DELETE", cache: "no-store" });
      const d = await r.json();
      if (!d.ok) {
        setMeeting((m) => (m ? { ...m, projectBlocks: snapshot } : m));
        setError(d.error || "Delete failed");
      }
    } catch (e: any) {
      setMeeting((m) => (m ? { ...m, projectBlocks: snapshot } : m));
      setError(e?.message || "Network error");
    }
  }

  async function addTask(blockId: string, payload: any) {
    try {
      const r = await fetch(`/api/meeting-notes/${id}/project-blocks/${blockId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error);
        return false;
      }
      const newTask = d.task;
      if (newTask) {
        setMeeting((m) => {
          if (!m) return m;
          return {
            ...m,
            projectBlocks: (m.projectBlocks || []).map((b) =>
              b.id === blockId ? { ...b, actionItems: [newTask, ...(b.actionItems || [])] } : b,
            ),
          };
        });
      }
      return true;
    } catch (e: any) {
      setError(e?.message || "Network error");
      return false;
    }
  }

  async function patchTask(blockId: string, taskId: string, patch: any) {
    const prev = meeting?.projectBlocks
      ?.find((b) => b.id === blockId)
      ?.actionItems?.find((t) => t.id === taskId);
    setMeeting((m) => {
      if (!m) return m;
      return {
        ...m,
        projectBlocks: (m.projectBlocks || []).map((b) =>
          b.id === blockId
            ? {
                ...b,
                actionItems: (b.actionItems || []).map((t) =>
                  t.id === taskId ? ({ ...t, ...patch } as ActionItem) : t,
                ),
              }
            : b,
        ),
      };
    });
    try {
      const r = await fetch(`/api/meeting-notes/${id}/project-blocks/${blockId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(patch),
      });
      const d = await r.json();
      if (!d.ok) {
        setMeeting((m) => {
          if (!m || !prev) return m;
          return {
            ...m,
            projectBlocks: (m.projectBlocks || []).map((b) =>
              b.id === blockId
                ? { ...b, actionItems: (b.actionItems || []).map((t) => (t.id === taskId ? prev : t)) }
                : b,
            ),
          };
        });
        setError(d.error || "Update failed");
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    }
  }

  async function deleteTask(blockId: string, taskId: string) {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    const prevTask = meeting?.projectBlocks
      ?.find((b) => b.id === blockId)
      ?.actionItems?.find((t) => t.id === taskId);
    setMeeting((m) => {
      if (!m) return m;
      return {
        ...m,
        projectBlocks: (m.projectBlocks || []).map((b) =>
          b.id === blockId
            ? { ...b, actionItems: (b.actionItems || []).filter((t) => t.id !== taskId) }
            : b,
        ),
      };
    });
    try {
      const r = await fetch(`/api/meeting-notes/${id}/project-blocks/${blockId}/tasks/${taskId}`, {
        method: "DELETE",
        cache: "no-store",
      });
      const d = await r.json();
      if (!d.ok) {
        // Revert.
        setMeeting((m) => {
          if (!m || !prevTask) return m;
          return {
            ...m,
            projectBlocks: (m.projectBlocks || []).map((b) =>
              b.id === blockId
                ? { ...b, actionItems: [prevTask, ...(b.actionItems || [])] }
                : b,
            ),
          };
        });
        setError(d.error || "Delete failed");
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    }
  }

  /** Phase 56 — "✓ Project Complete" archives the linked Project + removes the block. */
  async function markProjectComplete(blockId: string, projectId: string | null) {
    // Optimistic: remove the block from view immediately.
    const snapshot = meeting?.projectBlocks || [];
    setMeeting((m) => (m ? { ...m, projectBlocks: snapshot.filter((b) => b.id !== blockId) } : m));
    setExpandedBlockId((cur) => (cur === blockId ? null : cur));
    try {
      if (projectId) {
        const r = await fetch(`/api/admin/projects/${projectId}/weekly-update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ markComplete: true, closingNotes: "Marked complete from meeting block" }),
        });
        const d = await r.json();
        if (!r.ok || !d.ok) {
          setMeeting((m) => (m ? { ...m, projectBlocks: snapshot } : m));
          setError(d.error || "Project complete failed");
          return;
        }
      }
      // Also remove the meeting block server-side.
      await fetch(`/api/meeting-notes/${id}/project-blocks/${blockId}`, { method: "DELETE", cache: "no-store" }).catch(() => null);
    } catch (e: any) {
      setMeeting((m) => (m ? { ...m, projectBlocks: snapshot } : m));
      setError(e?.message || "Network error");
    }
  }

  /** Phase 56 — destructive delete with confirmation. */
  async function doDeleteProject(blockId: string, projectId: string) {
    const snapshot = meeting?.projectBlocks || [];
    setMeeting((m) => (m ? { ...m, projectBlocks: snapshot.filter((b) => b.id !== blockId) } : m));
    setExpandedBlockId((cur) => (cur === blockId ? null : cur));
    setConfirmDeleteProject(null);
    try {
      const r = await fetch(`/api/admin/projects/${projectId}`, { method: "DELETE", cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMeeting((m) => (m ? { ...m, projectBlocks: snapshot } : m));
        setError(d.error || "Delete project failed");
        return;
      }
      await fetch(`/api/meeting-notes/${id}/project-blocks/${blockId}`, { method: "DELETE", cache: "no-store" }).catch(() => null);
    } catch (e: any) {
      setMeeting((m) => (m ? { ...m, projectBlocks: snapshot } : m));
      setError(e?.message || "Network error");
    }
  }

  async function setStatus(status: string) {
    await fetch(`/api/meeting-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
  }

  const sortedBlocks = useMemo(
    () => (meeting ? sortBlocks(meeting.projectBlocks || []) : []),
    [meeting],
  );
  const debugBlocks = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("debugBlocks") === "1";
  const orphanTasks = useMemo(
    () => (meeting ? (meeting.actionItems || []).filter((a) => !a.projectBlockId) : []),
    [meeting],
  );

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
            {meeting.createdBy?.name && <> · created by {meeting.createdBy.name}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
            {meeting.status}
          </span>
          {meeting.status !== "COMPLETED" && (
            <button
              onClick={() => setStatus("COMPLETED")}
              className="px-2 py-1 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              Mark completed
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Project blocks ({sortedBlocks.length})</h2>
          <p className="text-xs text-slate-600">Sorted A → D. Each block = one customer / project discussed in this meeting.</p>
        </div>
        <button
          onClick={addBlock}
          disabled={busy}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          + Add project block
        </button>
      </div>

      {debugBlocks && (
        <div className="mb-4 rounded-md border border-sky-300 bg-sky-50 p-3 text-[11px] text-sky-900">
          <div className="font-semibold mb-1">debugBlocks=1 probe</div>
          <div>raw projectBlocks fetched: {(meeting?.projectBlocks || []).length}</div>
          <div>sortedBlocks rendered: {sortedBlocks.length}</div>
          <div>highlightBlockId: {highlightBlockId || "—"}</div>
          <div className="mt-1">
            sort order:
            <ol className="ml-4 list-decimal">
              {sortedBlocks.slice(0, 30).map((b) => (
                <li key={b.id}>
                  <code>{b.id.slice(-6)}</code> · pri <strong>{b.priority || "—"}</strong> · {b.customerType} · {b.internalLabel || b.brand?.name || b.factory?.name || "(unset)"}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {sortedBlocks.map((b, idx) => {
          const isExpanded = expandedBlockId === b.id;
          const prev = idx > 0 ? sortedBlocks[idx - 1] : null;
          const next = idx < sortedBlocks.length - 1 ? sortedBlocks[idx + 1] : null;
          return (
            <div
              key={b.id}
              data-block-id={b.id}
              className={`${highlightBlockId === b.id ? "ring-2 ring-emerald-400" : ""} border-b border-slate-100 last:border-0`}
            >
              <BlockRow
                block={b}
                isExpanded={isExpanded}
                onToggle={() =>
                  setExpandedBlockId((cur) => (cur === b.id ? null : b.id))
                }
              />
              {isExpanded && (
                <BlockCard
                  block={b}
                  options={options}
                  onPatch={(patch) => patchBlock(b.id, patch)}
                  onProjectComplete={() => markProjectComplete(b.id, b.projectId || b.project?.id || null)}
                  onDeleteProject={() => {
                    const pid = b.projectId || b.project?.id;
                    if (!pid) {
                      setError("This block isn't linked to a project — nothing to delete. Use the meeting-block delete via API if needed.");
                      return;
                    }
                    setConfirmDeleteProject({
                      blockId: b.id,
                      projectId: pid,
                      projectName: b.project?.name || labelForBlock(b),
                    });
                  }}
                  onAddTask={(payload) => addTask(b.id, payload)}
                  onPatchTask={(taskId, patch) => patchTask(b.id, taskId, patch)}
                  onDeleteTask={(taskId) => deleteTask(b.id, taskId)}
                  prev={prev}
                  next={next}
                  onGotoPrev={() => prev && setExpandedBlockId(prev.id)}
                  onGotoNext={() => next && setExpandedBlockId(next.id)}
                  onCloseAndNext={() => {
                    if (next) setExpandedBlockId(next.id);
                    else setExpandedBlockId(null);
                  }}
                />
              )}
            </div>
          );
        })}
        {sortedBlocks.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">
            No project blocks yet. Click <strong>+ Add project block</strong> to start structuring this meeting.
          </div>
        )}
      </div>

      {confirmDeleteProject && (
        <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
            <h3 className="text-base font-semibold text-rose-700 mb-2">Permanently delete this project?</h3>
            <p className="text-sm text-slate-700 mb-1"><strong>{confirmDeleteProject.projectName}</strong></p>
            <p className="text-xs text-slate-600 mb-4">
              This deletes the project and all its data (kickoff meeting note, action items, etc.) — <strong>this cannot be undone</strong>. The meeting block here is also removed.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDeleteProject(null)} className="px-3 py-1.5 text-xs text-slate-700 hover:underline">
                Cancel
              </button>
              <button
                onClick={() => doDeleteProject(confirmDeleteProject.blockId, confirmDeleteProject.projectId)}
                className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded-md hover:bg-rose-700"
              >
                🗑 Permanently delete
              </button>
            </div>
          </div>
        </div>
      )}

      {orphanTasks.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">
            Loose action items not yet bucketed ({orphanTasks.length})
          </h2>
          <ul className="space-y-1 rounded-md border border-slate-200 bg-white p-3">
            {orphanTasks.map((a) => (
              <li key={a.id} className="text-xs text-slate-700 flex items-start gap-2">
                <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${TASK_PRIORITY_CHIP[a.priority] || ""}`}>
                  {a.priority}
                </span>
                <span>{a.description}</span>
                {a.assignee?.name && <span className="text-slate-500">→ {a.assignee.name}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {meeting.notesMd && (
        <details className="mt-8 rounded-md border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">
            Raw seeded notes (markdown) — for reference
          </summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-slate-600 leading-relaxed">
            {meeting.notesMd}
          </pre>
        </details>
      )}
    </div>
  );
}

function BlockRow({
  block,
  isExpanded,
  onToggle,
}: {
  block: ProjectBlock;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const open = block.actionItems.filter((t) => t.status !== "DONE").length;
  const total = block.actionItems.length;
  const customerIcon =
    block.customerType === "BRAND" ? "🏷" : block.customerType === "FACTORY" ? "🏭" : "🔬";
  const ownerInitials = block.owner?.name
    ? block.owner.name
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase()
    : "?";
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left ${isExpanded ? "bg-indigo-50" : "hover:bg-slate-50"}`}
    >
      <span className="text-base" title={block.customerType}>{customerIcon}</span>
      <span className="text-sm font-medium text-slate-900 flex-1 truncate">
        {labelForBlock(block)}
      </span>
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold"
        title={block.owner?.name || "no owner"}
      >
        {ownerInitials}
      </span>
      {block.priority && (
        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_CHIP[block.priority] || ""}`}>
          {block.priority}
        </span>
      )}
      <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
        {open}/{total} tasks
      </span>
      <span className="text-slate-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
    </button>
  );
}

function BlockCard({
  block,
  options,
  onPatch,
  onProjectComplete,
  onDeleteProject,
  onAddTask,
  onPatchTask,
  onDeleteTask,
  prev,
  next,
  onGotoPrev,
  onGotoNext,
  onCloseAndNext,
}: {
  block: ProjectBlock;
  options: Options | null;
  onPatch: (patch: any) => Promise<void>;
  onProjectComplete: () => Promise<void>;
  onDeleteProject: () => void;
  onAddTask: (payload: any) => Promise<boolean>;
  onPatchTask: (taskId: string, patch: any) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  prev: ProjectBlock | null;
  next: ProjectBlock | null;
  onGotoPrev: () => void;
  onGotoNext: () => void;
  onCloseAndNext: () => void;
}) {
  const [discussionDraft, setDiscussionDraft] = useState(block.discussionMd);
  const [discussionDirty, setDiscussionDirty] = useState(false);
  const [labelDraft, setLabelDraft] = useState(block.internalLabel || "");

  useEffect(() => {
    setDiscussionDraft(block.discussionMd);
    setDiscussionDirty(false);
  }, [block.discussionMd]);
  useEffect(() => setLabelDraft(block.internalLabel || ""), [block.internalLabel]);

  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("NORMAL");
  const [newTaskDue, setNewTaskDue] = useState("");

  async function submitNewTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskDesc.trim()) return;
    const ok = await onAddTask({
      description: newTaskDesc.trim(),
      assigneeId: newTaskAssignee || null,
      priority: newTaskPriority,
      dueDate: newTaskDue || null,
    });
    if (ok) {
      setNewTaskDesc("");
      setNewTaskAssignee("");
      setNewTaskPriority("NORMAL");
      setNewTaskDue("");
    }
  }

  const bg = PRIORITY_BG[block.priority || ""] || "border-slate-300 bg-white";
  const chip = PRIORITY_CHIP[block.priority || ""] || "bg-slate-300 text-slate-700";

  return (
    <div className={`border-l-4 ${bg} p-4`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${chip}`}>
          {block.priority || "—"}
        </span>
        <h3 className="text-base font-semibold text-slate-900">{labelForBlock(block)}</h3>
        <button
          onClick={onProjectComplete}
          className="ml-auto px-3 py-1 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
          title="Archive this project — appears under Completed for later reference"
        >
          ✓ Project Complete
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <Dropdown
          label="Customer type"
          value={block.customerType}
          onChange={(v) => onPatch({ customerType: v })}
          options={[
            { value: "BRAND", label: "Brand" },
            { value: "FACTORY", label: "Factory" },
            { value: "OTHER", label: "Other (internal project)" },
          ]}
        />
        {block.customerType === "BRAND" && (
          <Dropdown
            label="Brand"
            value={block.brandId || ""}
            onChange={(v) => onPatch({ brandId: v })}
            options={[
              { value: "", label: "— select brand —" },
              ...(options?.brands || []).map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        )}
        {block.customerType === "FACTORY" && (
          <Dropdown
            label="Factory"
            value={block.factoryId || ""}
            onChange={(v) => onPatch({ factoryId: v })}
            options={[
              { value: "", label: "— select factory —" },
              ...(options?.factories || []).map((f) => ({ value: f.id, label: f.name })),
            ]}
          />
        )}
        {block.customerType === "OTHER" && (
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-0.5">
              Internal project label
            </label>
            <input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={() => {
                if (labelDraft !== (block.internalLabel || "")) onPatch({ internalLabel: labelDraft });
              }}
              placeholder="e.g. SLC HQ buildout"
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded-md bg-white"
            />
          </div>
        )}
        <Dropdown
          label="Owner (FUZE lead)"
          value={block.ownerId || ""}
          onChange={(v) => onPatch({ ownerId: v })}
          options={[
            { value: "", label: "— unassigned —" },
            ...(options?.users || []).map((u) => ({
              value: u.id,
              label: u.name || u.email || u.id,
            })),
          ]}
        />
        <Dropdown
          label="Priority"
          value={block.priority || ""}
          onChange={(v) => onPatch({ priority: v || null })}
          options={[
            { value: "", label: "— none —" },
            { value: "A", label: PRIORITY_LABEL.A },
            { value: "B", label: PRIORITY_LABEL.B },
            { value: "C", label: PRIORITY_LABEL.C },
            { value: "D", label: PRIORITY_LABEL.D },
          ]}
        />
      </div>

      <div className="mb-3">
        <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-0.5">
          Discussion
        </label>
        <textarea
          value={discussionDraft}
          onChange={(e) => {
            setDiscussionDraft(e.target.value);
            setDiscussionDirty(e.target.value !== block.discussionMd);
          }}
          rows={3}
          placeholder="Notes from the meeting on this project — context, decisions, status."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
        />
        {discussionDirty && (
          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={async () => {
                await onPatch({ discussionMd: discussionDraft });
                setDiscussionDirty(false);
              }}
              className="px-2 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Save discussion
            </button>
            <button
              onClick={() => {
                setDiscussionDraft(block.discussionMd);
                setDiscussionDirty(false);
              }}
              className="px-2 py-1 text-xs text-slate-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-slate-700 mb-1.5">
          Tasks ({block.actionItems.length})
        </h4>
        <ul className="space-y-1.5 mb-2">
          {block.actionItems.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              options={options}
              onPatch={(patch) => onPatchTask(t.id, patch)}
              onDelete={() => onDeleteTask(t.id)}
            />
          ))}
          {block.actionItems.length === 0 && (
            <li className="text-xs text-slate-500 italic">No tasks yet.</li>
          )}
        </ul>
        <form onSubmit={submitNewTask} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
          <input
            value={newTaskDesc}
            onChange={(e) => setNewTaskDesc(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 min-w-[200px] px-2 py-1 text-sm border border-slate-300 rounded-md"
          />
          <select
            value={newTaskAssignee}
            onChange={(e) => setNewTaskAssignee(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-300 rounded-md"
          >
            <option value="">Assign to…</option>
            {(options?.users || []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
          <select
            value={newTaskPriority}
            onChange={(e) => setNewTaskPriority(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-300 rounded-md"
          >
            <option value="LOW">LOW</option>
            <option value="NORMAL">NORMAL</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
          <input
            type="date"
            value={newTaskDue}
            onChange={(e) => setNewTaskDue(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-300 rounded-md"
          />
          <button
            type="submit"
            disabled={!newTaskDesc.trim()}
            className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </div>

      {/* Prev / Next nav + Close & next + destructive delete */}
      <div className="mt-4 pt-3 border-t border-slate-300 flex items-center gap-2">
        <button
          onClick={onGotoPrev}
          disabled={!prev}
          className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          title={prev ? `Go to ${labelForBlock(prev)}` : "First project"}
        >
          ← Previous project
        </button>
        <button
          onClick={onGotoNext}
          disabled={!next}
          className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          title={next ? `Go to ${labelForBlock(next)}` : "Last project"}
        >
          Next project →
        </button>
        <button
          onClick={onCloseAndNext}
          className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          title="Close this block and jump to the next one"
        >
          Close &amp; next
        </button>
        <button
          onClick={onDeleteProject}
          className="ml-auto px-2 py-1 text-[11px] text-slate-500 hover:text-rose-600 hover:underline"
          title="Permanently delete this project — cannot be undone"
        >
          🗑 Delete project
        </button>
      </div>
    </div>
  );
}

function Dropdown({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-0.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm border border-slate-300 rounded-md bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TaskRow({
  task,
  options,
  onPatch,
  onDelete,
}: {
  task: ActionItem;
  options: Options | null;
  onPatch: (patch: any) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md bg-white border border-slate-200 px-2 py-1.5">
      <input
        type="checkbox"
        checked={task.status === "DONE"}
        onChange={(e) => onPatch({ status: e.target.checked ? "DONE" : "OPEN" })}
      />
      <span className={`text-xs ${task.status === "DONE" ? "line-through text-slate-400" : "text-slate-800"}`}>
        {task.description}
      </span>
      <select
        value={task.assignee?.id || ""}
        onChange={(e) => onPatch({ assigneeId: e.target.value || null })}
        className="ml-auto px-1.5 py-0.5 text-[11px] border border-slate-300 rounded"
      >
        <option value="">Unassigned</option>
        {(options?.users || []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.email}
          </option>
        ))}
      </select>
      <select
        value={task.priority}
        onChange={(e) => onPatch({ priority: e.target.value })}
        className={`px-1.5 py-0.5 text-[11px] rounded ${TASK_PRIORITY_CHIP[task.priority] || ""}`}
      >
        <option value="LOW">LOW</option>
        <option value="NORMAL">NORMAL</option>
        <option value="HIGH">HIGH</option>
        <option value="URGENT">URGENT</option>
      </select>
      <input
        type="date"
        value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
        onChange={(e) => onPatch({ dueDate: e.target.value || null })}
        className="px-1.5 py-0.5 text-[11px] border border-slate-300 rounded"
      />
      <button
        onClick={onDelete}
        className="w-5 h-5 inline-flex items-center justify-center rounded text-rose-600 hover:bg-rose-100 text-sm font-bold"
        title="Delete this task"
      >
        ×
      </button>
    </li>
  );
}
