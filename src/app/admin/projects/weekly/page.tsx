"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
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
          {/* Plain <a> on purpose — forces a full browser navigation
              so this button works even if the Next.js client router
              is broken by a hydration mismatch elsewhere on the page. */}
          <a href="/admin/projects?status=closed" className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50">
            Completed projects →
          </a>
          <a href="/admin/projects/new" className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            + Add project
          </a>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-1.5 text-left w-[260px]">Customer</th>
              <th className="px-3 py-1.5 text-left">Project</th>
              <th className="px-3 py-1.5 text-center w-[60px]">Pri</th>
              <th className="px-3 py-1.5 text-center w-[110px]">Stage</th>
              <th className="px-3 py-1.5 text-right w-[130px]">Last update</th>
              <th className="px-3 py-1.5 text-center w-[60px]">Done</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
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
                <tr key={p.id} className="hover:bg-indigo-50 cursor-pointer" onClick={() => router.push(`/admin/projects/${p.id}?from=weekly`)}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${TYPE_CHIP[p.projectType]}`}>
                        {p.projectType === "BRAND" ? "🏷" : p.projectType === "FACTORY" ? "🏭" : p.projectType === "DISTRIBUTOR" ? "🤝" : "🔬"}
                      </span>
                      <span className="text-sm font-medium text-slate-800 truncate">{customerLabel || "—"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-indigo-700 truncate">{p.name}</td>
                  <td className="px-3 py-2 text-center">
                    {p.priority && (
                      <span className={`inline-flex rounded px-1 py-0.5 text-[10px] font-bold ${PRIORITY_CHIP[p.priority]}`}>{p.priority}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] ${STAGE_CHIP[p.stage] || "bg-slate-100"}`}>{p.stage}</span>
                  </td>
                  <td className={`px-3 py-2 text-right text-[11px] ${staleColor(days)}`}>
                    {days == null ? "—" : `${days}d`}
                  </td>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={false}
                      title="Mark complete"
                      onChange={async () => {
                        // eslint-disable-next-line no-console
                        console.log("[CLICK]", new Date().toISOString(), "handler=weekly.markComplete", `id=${p.id}`);
                        if (typeof window !== "undefined") {
                          (window as any).__lastClick = { handler: "weekly.markComplete", id: p.id, ts: Date.now() };
                        }
                        setProjects((arr) => arr.filter((x) => x.id !== p.id));
                        setError(null);
                        try {
                          const r = await fetch(`/api/admin/projects/${p.id}/weekly-update`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ markComplete: true, closingNotes: "Marked complete inline" }),
                          });
                          const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
                          if (!r.ok || !d.ok) {
                            setError(d.error || `Mark complete failed (HTTP ${r.status})`);
                            await refresh();
                          }
                        } catch (e: any) {
                          setError(e?.message || "Network error");
                          await refresh();
                        }
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                  No active projects. Create one with the <strong>+ Add project</strong> button above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

