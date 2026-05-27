"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

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
  poNumber: string | null;
}
interface SampleRow {
  fabricId: string;
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  washCount: number | null;
  cells: Record<string, CellData>;
}

const STATUS_STYLE: Record<string, string> = {
  PASS: "bg-emerald-100 text-emerald-800",
  FAIL: "bg-rose-100 text-rose-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  REQUESTED: "bg-sky-100 text-sky-800",
  PENDING: "bg-sky-100 text-sky-800",
  NOT_TESTED: "bg-slate-100 text-slate-500",
  COMPLETE: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-600",
};

export default function AdminProjectGridPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!id) return;
    setBusy(true);
    fetch(`/api/admin/projects/${id}/grid`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setErr(d.error || "Load failed");
        else {
          setProject(d.project);
          setColumns(d.columns || []);
          setSamples(d.samples || []);
        }
      })
      .catch((e) => setErr(e?.message || "Load failed"))
      .finally(() => setBusy(false));
  }, [id]);

  if (busy) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (err)
    return (
      <div className="p-6">
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {err}
        </div>
      </div>
    );
  if (!project) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-2">
        <Link href="/admin/projects" className="text-xs text-indigo-600 hover:underline">
          ← All projects
        </Link>
      </div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {project.brandName ? `${project.brandName} · ` : ""}
            {project.factoryName ? `${project.factoryName} · ` : ""}
            {project.stage}
            {project.fuzeTier ? ` · ${project.fuzeTier}` : ""}
            {project.annualVolumeMeters != null
              ? ` · ${project.annualVolumeMeters.toLocaleString()} m/yr`
              : ""}
            {project.projectedValue != null
              ? ` · $${Math.round(project.projectedValue).toLocaleString()} projected`
              : ""}
            {project.expectedProductionDate
              ? ` · prod ${new Date(project.expectedProductionDate).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/fabrics/new?projectId=${id}`}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
          >
            + Add sample
          </Link>
          <Link
            href={`/test-requests/new?projectId=${id}`}
            className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            + Add test request
          </Link>
        </div>
      </div>

      {columns.length === 0 && samples.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No samples yet. Click "Add sample" to start tracking.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wide">
                  Sample
                </th>
                <th className="px-2 py-2 text-left font-semibold text-slate-600 uppercase tracking-wide">
                  Wash
                </th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="px-2 py-2 text-left font-semibold text-slate-600 uppercase tracking-wide"
                    title={c.label}
                  >
                    <div className="text-[10px]">{c.testType}</div>
                    {c.testMethod && (
                      <div className="text-[9px] font-normal text-slate-500">{c.testMethod}</div>
                    )}
                    {c.organisms && (
                      <div className="text-[9px] font-normal text-slate-500">{c.organisms}</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {samples.map((s) => (
                <tr key={`${s.fabricId}-${s.washCount ?? "x"}`}>
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                    <Link
                      href={`/fabrics/${s.fabricId}/edit`}
                      className="text-indigo-600 hover:underline"
                    >
                      FUZE {s.fuzeNumber ?? s.fabricId.slice(-6)}
                    </Link>
                    {s.customerCode && (
                      <div className="text-[10px] text-slate-500">{s.customerCode}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-slate-600">
                    {s.washCount != null ? `${s.washCount}w` : "—"}
                  </td>
                  {columns.map((c) => {
                    const cell = s.cells[c.key];
                    if (!cell)
                      return (
                        <td key={c.key} className="px-2 py-2">
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-slate-50 text-slate-400">
                            —
                          </span>
                        </td>
                      );
                    return (
                      <td key={c.key} className="px-2 py-2 whitespace-nowrap">
                        {cell.testRunId ? (
                          <Link
                            href={`/admin/test-repository?testRunId=${cell.testRunId}`}
                            className="inline-flex flex-col items-start"
                          >
                            <span
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[cell.status] || "bg-slate-100 text-slate-700"}`}
                            >
                              {cell.status}
                            </span>
                            {cell.value && (
                              <span className="text-[10px] text-slate-500 mt-0.5">
                                {cell.value}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[cell.status] || "bg-slate-100 text-slate-700"}`}
                          >
                            {cell.status}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
