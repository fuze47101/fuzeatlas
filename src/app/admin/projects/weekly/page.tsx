"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { ProjectInlineDetail } from "@/components/ProjectInlineDetail";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

type Project = {
  id: string;
  name: string;
  stage: string;
  projectType: "BRAND" | "FACTORY" | "DISTRIBUTOR" | "INTERNAL";
  priority: Priority | null;
  weeklyStatus: string | null;
  lastUpdatedAt: string | null;
  closedAt: string | null;
  brand: { id: string; name: string; subtype: string | null } | null;
  factory: { id: string; name: string } | null;
  distributor: { id: string; name: string } | null;
  owner: { id: string; name: string | null; email: string | null } | null;
  kickoffMeetingNoteId: string | null;
};

const ALLOWED = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"]);

const PRIORITY_CHIP: Record<string, string> = {
  URGENT: "bg-rose-600 text-white",
  HIGH: "bg-amber-500 text-white",
  NORMAL: "bg-slate-300 text-slate-800",
  LOW: "bg-slate-100 text-slate-500",
};
const STAGE_CHIP: Record<string, string> = {
  DEVELOPMENT: "bg-sky-100 text-sky-800",
  SAMPLING: "bg-indigo-100 text-indigo-800",
  TESTING: "bg-purple-100 text-purple-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  COMMERCIALIZATION: "bg-emerald-200 text-emerald-900",
  PRODUCTION: "bg-emerald-300 text-emerald-900",
  COMPLETE: "bg-slate-200 text-slate-600",
};
const TYPE_CHIP: Record<string, string> = {
  BRAND: "bg-blue-50 text-blue-800 border-blue-200",
  FACTORY: "bg-amber-50 text-amber-800 border-amber-200",
  DISTRIBUTOR: "bg-purple-50 text-purple-800 border-purple-200",
  INTERNAL: "bg-slate-50 text-slate-800 border-slate-200",
};

// NOTE: this returns null pre-mount so the SSR pass and the first
// client render produce identical HTML — Date.now() reads must be
// gated to after mount or React reports a hydration mismatch and
// silently aborts handler attachment.
function daysSince(iso: string | null, nowMs: number | null): number | null {
  if (!iso || nowMs == null) return null;
  return Math.floor((nowMs - new Date(iso).getTime()) / 86400000);
}
function staleColor(days: number | null): string {
  if (days == null) return "text-rose-700 font-semibold";
  if (days >= 14) return "text-rose-700 font-semibold";
  if (days >= 7) return "text-amber-700 font-semibold";
  return "text-slate-600";
}

export default function WeeklyUpdatePageOuter() {
  return (
    <HydrationFrame name="/admin/projects/weekly">
      <WeeklyUpdatePage />
    </HydrationFrame>
  );
}

function WeeklyUpdatePage() {
  useMountLog("weekly");
  const router = useRouter();
  const { user, loading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailExpanded, setDetailExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // nowMs is null on the server + first client render → daysSince()
  // returns null + the UI shows "never updated" briefly. After mount,
  // a fresh Date.now() replaces it and the staleness color kicks in.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);

  useEffect(() => {
    if (loading) return;
    if (!user || !ALLOWED.has(user.role)) router.replace("/home");
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/projects/weekly-list");
      const d = await r.json();
      if (d.ok) setProjects(d.projects);
      else setError(d.error);
    } catch (e: any) {
      setError(e?.message || "load failed");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stale = useMemo(
    () => projects.filter((p) => {
      const d = daysSince(p.lastUpdatedAt, nowMs);
      return d == null || d >= 7;
    }).length,
    [projects, nowMs],
  );

  function nextStaleAfter(currentId: string): string | null {
    const idx = projects.findIndex((p) => p.id === currentId);
    for (let i = idx + 1; i < projects.length; i++) {
      const d = daysSince(projects[i].lastUpdatedAt, nowMs);
      if (d == null || d >= 7) return projects[i].id;
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
        <strong>Diagnostic mode</strong> — click logging enabled. Open DevTools Console to verify
        clicks fire. <code>window.__lastClick</code> + <code>window.__lastClickResult</code> capture the latest event.
      </div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Weekly Project Update</h1>
          <p className="mt-1 text-sm text-slate-600">
            {projects.length} active projects · <span className={stale > 0 ? "text-rose-700 font-medium" : ""}>{stale} stale (no update in 7+ days)</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/projects?status=closed" className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50">
            Completed projects →
          </Link>
          <Link href="/admin/projects/new" className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            + Add project
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="space-y-3">
        {projects.map((p) => {
          const days = daysSince(p.lastUpdatedAt, nowMs);
          const customerLabel = p.projectType === "BRAND"
            ? p.brand?.name
            : p.projectType === "FACTORY"
              ? p.factory?.name
              : p.projectType === "DISTRIBUTOR"
                ? p.distributor?.name
                : "Internal";
          return (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <button
                  onClick={() => setDetailExpanded((cur) => (cur === p.id ? null : p.id))}
                  className="flex items-center gap-1.5 text-base font-semibold text-indigo-700 hover:underline"
                  title="Click to expand inline"
                >
                  <span className="text-xs text-slate-500">
                    {detailExpanded === p.id ? "▼" : "▶"}
                  </span>
                  {p.name}
                </button>
                {p.priority && (
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_CHIP[p.priority]}`}>
                    {p.priority}
                  </span>
                )}
                <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${TYPE_CHIP[p.projectType]}`}>
                  {p.projectType} · {customerLabel || "—"}
                  {p.brand?.subtype && <span className="ml-1 opacity-75">[{p.brand.subtype}]</span>}
                </span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${STAGE_CHIP[p.stage] || "bg-slate-100"}`}>
                  {p.stage}
                </span>
                {p.owner?.name && (
                  <span className="text-xs text-slate-500">owner: {p.owner.name}</span>
                )}
                <span className={`ml-auto text-xs ${staleColor(days)}`}>
                  {days == null ? "never updated" : `${days}d since last update`}
                </span>
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer" title="Mark complete — one click, no confirmation. Reversible from Completed view.">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={async () => {
                      // DIAGNOSTIC: log click before anything else.
                      const ts = new Date().toISOString();
                      // eslint-disable-next-line no-console
                      console.error("[CLICK]", ts, "handler=weekly.markComplete", `id=${p.id}`);
                      if (typeof window !== "undefined") {
                        (window as any).__lastClick = {
                          handler: "weekly.markComplete",
                          id: p.id,
                          ts: Date.now(),
                        };
                      }
                      setProjects((arr) => arr.filter((x) => x.id !== p.id));
                      setError(null);
                      try {
                        const r = await fetch(`/api/admin/projects/${p.id}/weekly-update`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ markComplete: true, closingNotes: "Marked complete inline" }),
                        });
                        // eslint-disable-next-line no-console
                        console.error("[CLICK-RESULT]", new Date().toISOString(), `ok=${r.ok}`, `status=${r.status}`);
                        if (typeof window !== "undefined") {
                          (window as any).__lastClickResult = { ok: r.ok, status: r.status, ts: Date.now() };
                        }
                        const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
                        if (!r.ok || !d.ok) {
                          setError(d.error || `Mark complete failed (HTTP ${r.status})`);
                          console.error("[weekly] markComplete failed:", d);
                          await refresh();
                          return;
                        }
                      } catch (e: any) {
                        // eslint-disable-next-line no-console
                        console.error("[CLICK-RESULT]", new Date().toISOString(), "threw:", e?.message);
                        if (typeof window !== "undefined") {
                          (window as any).__lastClickResult = { ok: false, error: e?.message, ts: Date.now() };
                        }
                        setError(e?.message || "Network error");
                        await refresh();
                      }
                    }}
                  />
                  Done
                </label>
                <button
                  onClick={() => setExpanded((cur) => (cur === p.id ? null : p.id))}
                  className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  {expanded === p.id ? "Cancel" : "Update"}
                </button>
              </div>

              {detailExpanded === p.id && (
                <ProjectInlineDetail projectId={p.id} surfaceTag="weekly" />
              )}
              {expanded === p.id && (
                <UpdateForm
                  projectId={p.id}
                  onSaved={async (markedComplete) => {
                    await refresh();
                    const nextId = !markedComplete ? nextStaleAfter(p.id) : null;
                    setExpanded(nextId);
                    if (nextId) {
                      setTimeout(() => {
                        document.querySelector(`[data-pid="${nextId}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
                      }, 100);
                    }
                  }}
                  onCancel={() => setExpanded(null)}
                />
              )}
              <div data-pid={p.id} className="h-0 w-0" />
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No active projects. Create one with the <strong>+ Add project</strong> button above.
          </div>
        )}
      </div>
    </div>
  );
}

function UpdateForm({
  projectId,
  onSaved,
  onCancel,
}: {
  projectId: string;
  onSaved: (markedComplete: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState("");
  const [extraDesc, setExtraDesc] = useState("");
  const [extraPriority, setExtraPriority] = useState<Priority>("NORMAL");
  const [extraDue, setExtraDue] = useState("");
  const [markComplete, setMarkComplete] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const extraTasks = extraDesc.trim()
        ? [{ description: extraDesc.trim(), priority: extraPriority, dueDate: extraDue || undefined }]
        : [];
      const r = await fetch(`/api/admin/projects/${projectId}/weekly-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyStatusMd: status,
          extraTasks,
          markComplete,
          closingNotes: markComplete ? closingNotes : undefined,
        }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error); return; }
      await onSaved(Boolean(d.markedComplete));
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-slate-200 p-3 space-y-3 bg-slate-50">
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{error}</div>
      )}
      <div>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-1">
          Status notes — use @username to assign action items
        </label>
        <textarea
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          rows={3}
          placeholder="e.g. Samples shipped Monday. @Tina to confirm ICP results by Friday URGENT. Brand asked for second tier comparison."
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
        />
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-indigo-700">+ Add an explicit task</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={extraDesc}
            onChange={(e) => setExtraDesc(e.target.value)}
            placeholder="Task description"
            className="flex-1 min-w-[200px] px-2 py-1 text-xs border border-slate-300 rounded-md"
          />
          <select
            value={extraPriority}
            onChange={(e) => setExtraPriority(e.target.value as Priority)}
            className="px-1.5 py-1 text-xs border border-slate-300 rounded-md"
          >
            <option value="LOW">LOW</option>
            <option value="NORMAL">NORMAL</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
          <input
            type="date"
            value={extraDue}
            onChange={(e) => setExtraDue(e.target.value)}
            className="px-1.5 py-1 text-xs border border-slate-300 rounded-md"
          />
        </div>
      </details>
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={markComplete}
          onChange={(e) => setMarkComplete(e.target.checked)}
        />
        Mark project complete
      </label>
      {markComplete && (
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-1">
            Closing notes (optional)
          </label>
          <textarea
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
            rows={2}
            placeholder="Summary of outcome — what closed this project, what shipped, what we learned."
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-700 hover:underline">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy || (!status.trim() && !extraDesc.trim() && !markComplete)}
          className="px-4 py-1.5 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save & next"}
        </button>
      </div>
    </div>
  );
}
