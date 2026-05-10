"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface PendingRow {
  id: string;
  poNumber: string | null;
  status: string;
  requestedAt: string;
  pricingTier: string | null;
  brand: { id: string; name: string } | null;
  fabric: { id: string; fuzeNumber: number | null; customerCode: string | null } | null;
  submission: {
    id: string;
    factoryId: string | null;
    factory: { id: string; name: string; country: string | null } | null;
    fuzeFabricNumber: number | null;
  } | null;
  lines: Array<{ id: string; testType: string }>;
}

interface SubmissionRow {
  id: string;
  submissionDate: string | null;
  status: string;
  fuzeFabricNumber: number | null;
  factory: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function LabQueuePage() {
  const { t } = useI18n();
  const tx = t.labPortal.queue;
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lab-portal/queue")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load");
        setPending(j.pending || []);
        setSubmissions(j.submissions || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/lab-portal" className="hover:text-[#00b4c3]">
            {t.labPortal.crumb}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-amber-600">{pending.length}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statPending}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-slate-900">{submissions.length}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statSubmissions}</div>
        </div>
      </div>

      {/* Pending requests */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">{tx.pendingHeader}</h2>
        </div>
        {pending.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">{tx.noPending}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white text-xs uppercase tracking-wider text-slate-500 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-bold">{tx.colPo}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colBrand}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colFactory}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colFabric}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colTier}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colTests}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colStatus}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colRequested}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono font-semibold text-[#00b4c3]">
                      {p.poNumber || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{p.brand?.name || "—"}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {p.submission?.factory?.name || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      FUZE {p.submission?.fuzeFabricNumber || p.fabric?.fuzeNumber || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{p.pricingTier || "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{p.lines?.length || 0}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                        {p.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{formatDate(p.requestedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent submissions context */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">{tx.submissionsHeader}</h2>
        </div>
        {submissions.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">{tx.noSubmissions}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white text-xs uppercase tracking-wider text-slate-500 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-bold">{tx.colFabric}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colBrand}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colFactory}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colSubmissionDate}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colSubmissionStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-700">
                      FUZE {s.fuzeFabricNumber || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{s.brand?.name || "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{s.factory?.name || "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{formatDate(s.submissionDate)}</td>
                    <td className="px-4 py-2 text-slate-700">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
