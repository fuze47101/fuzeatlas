"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

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

export default function AdminProjectsListPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !["ADMIN", "EMPLOYEE", "TESTING_MANAGER", "SALES_MANAGER"].includes(user.role)) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  useEffect(() => {
    setBusy(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setErr(d.error || "Load failed");
        else setProjects(d.projects || []);
      })
      .catch((e) => setErr(e?.message || "Load failed"))
      .finally(() => setBusy(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-600">
            Open + closed projects across every brand. Click a row for the sample grid.
          </p>
        </div>
        <div className="text-xs text-slate-500">{projects.length} project(s)</div>
      </div>

      {err && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {err}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/admin/projects/${p.id}`} className="text-indigo-600 hover:underline font-medium">
                    {p.name}
                  </Link>
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
              </tr>
            ))}
            {projects.length === 0 && !busy && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
