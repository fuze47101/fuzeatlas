"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment } from "react";
import { ProjectInlineDetail } from "@/components/ProjectInlineDetail";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";

interface ProjectRow {
  id: string;
  name: string;
  brandName: string | null;
  stage: string;
  projectedValue: number | null;
  currency: string | null;
  fuzeTier: string | null;
  annualVolumeMeters: number | null;
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

export default function AdminProjectsListPageOuter() {
  return (
    <HydrationFrame name="/admin/projects">
      <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">Loading projects…</div>}>
        <AdminProjectsListPage />
      </Suspense>
    </HydrationFrame>
  );
}

function AdminProjectsListPage() {
  useMountLog("projects-list");
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const closedOnly = searchParams?.get("status") === "closed";
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailExpanded, setDetailExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !["ADMIN", "EMPLOYEE", "TESTING_MANAGER", "SALES_MANAGER"].includes(user.role)) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  useEffect(() => {
    setBusy(true);
    const url = closedOnly
      ? "/api/admin/projects/weekly-list?status=closed"
      : "/api/projects";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setErr(d.error || "Load failed");
        else {
          // weekly-list returns a richer shape; map to ProjectRow.
          const rows = (d.projects || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            brandName: p.brandName || p.brand?.name || null,
            stage: p.stage,
            projectedValue: p.projectedValue ?? null,
            currency: p.currency ?? null,
            fuzeTier: p.fuzeTier ?? null,
            annualVolumeMeters: p.annualVolumeMeters ?? null,
          }));
          setProjects(rows);
        }
      })
      .catch((e) => setErr(e?.message || "Load failed"))
      .finally(() => setBusy(false));
  }, [closedOnly]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{closedOnly ? "Completed projects" : "Projects"}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {closedOnly
              ? "Projects that have been marked complete. Read-only archive."
              : "Open projects across every brand. Click a row for the sample grid."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!closedOnly && (
            <Link href="/admin/projects?status=closed" className="text-xs text-indigo-600 hover:underline">
              View completed →
            </Link>
          )}
          {closedOnly && (
            <Link href="/admin/projects" className="text-xs text-indigo-600 hover:underline">
              ← Back to active
            </Link>
          )}
          <span className="text-xs text-slate-500">{projects.length} project(s)</span>
        </div>
      </div>

      {err && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {err}
        </div>
      )}

      {actionError && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 flex items-center justify-between">
          <span>{actionError}</span>
          <button className="underline" onClick={() => setActionError(null)}>dismiss</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Brand</th>
              <th className="px-3 py-2 text-left">Stage</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-right">Projected ($)</th>
              <th className="px-3 py-2 text-right">Volume (m)</th>
              <th className="px-3 py-2 text-right">{closedOnly ? "Reopen" : "Done"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((p) => (
              <Fragment key={p.id}>
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <button
                    onClick={() => setDetailExpanded((cur) => (cur === p.id ? null : p.id))}
                    className="flex items-center gap-1.5 text-indigo-600 hover:underline font-medium text-left"
                    title="Click to expand inline"
                  >
                    <span className="text-xs text-slate-500">
                      {detailExpanded === p.id ? "▼" : "▶"}
                    </span>
                    {p.name}
                  </button>
                </td>
                <td className="px-3 py-2">{p.brandName || "—"}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${STAGE_COLORS[p.stage] || "bg-slate-100 text-slate-700"}`}>
                    {p.stage}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{p.fuzeTier || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {p.projectedValue != null
                    ? `$${Math.round(p.projectedValue).toLocaleString()}`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                  {p.annualVolumeMeters != null ? p.annualVolumeMeters.toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {closedOnly ? (
                    <button
                      onClick={async () => {
                        setProjects((arr) => arr.filter((x) => x.id !== p.id));
                        setActionError(null);
                        try {
                          const r = await fetch(`/api/admin/projects/${p.id}/reopen`, { method: "POST" });
                          const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
                          if (!r.ok || !d.ok) {
                            setActionError(d.error || `Reopen failed (HTTP ${r.status})`);
                            console.error("[projects] reopen failed:", d);
                          }
                        } catch (e: any) {
                          setActionError(e?.message || "Network error");
                          console.error("[projects] reopen threw:", e);
                        }
                      }}
                      className="px-2 py-0.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      Reopen
                    </button>
                  ) : (
                    <input
                      type="checkbox"
                      checked={false}
                      title="Mark complete — one click, reversible from Completed view"
                      onChange={async () => {
                        const ts = new Date().toISOString();
                        // eslint-disable-next-line no-console
                        console.error("[CLICK]", ts, "handler=projects.markComplete", `id=${p.id}`);
                        if (typeof window !== "undefined") {
                          (window as any).__lastClick = {
                            handler: "projects.markComplete",
                            id: p.id,
                            ts: Date.now(),
                          };
                        }
                        setProjects((arr) => arr.filter((x) => x.id !== p.id));
                        setActionError(null);
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
                            setActionError(d.error || `Mark complete failed (HTTP ${r.status})`);
                            console.error("[projects] markComplete failed:", d);
                          }
                        } catch (e: any) {
                          // eslint-disable-next-line no-console
                          console.error("[CLICK-RESULT]", new Date().toISOString(), "threw:", e?.message);
                          if (typeof window !== "undefined") {
                            (window as any).__lastClickResult = { ok: false, error: e?.message, ts: Date.now() };
                          }
                          setActionError(e?.message || "Network error");
                        }
                      }}
                    />
                  )}
                </td>
              </tr>
              {detailExpanded === p.id && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <ProjectInlineDetail projectId={p.id} surfaceTag={closedOnly ? "projects.closed" : "projects"} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {projects.length === 0 && !busy && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                  {closedOnly ? "No completed projects yet." : "No projects yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
