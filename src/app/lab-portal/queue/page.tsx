"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";
import EmptyState from "@/components/EmptyState";

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
  // NEED-7 — accept/reject in-flight tracking.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
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

  useEffect(() => {
    load();
  }, [load]);

  async function acceptAssignment(id: string) {
    setBusyId(id);
    setError(null);
    setFlash(null);
    try {
      const r = await fetch(`/api/lab-portal/test-requests/${id}/accept`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setError(j?.error || `Accept failed (HTTP ${r.status}).`);
        return;
      }
      setFlash("Assignment accepted — expected completion calculated.");
      setTimeout(() => setFlash(null), 4000);
      await load();
    } catch (e: any) {
      setError(e?.message || "Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function rejectAssignment(id: string) {
    const reason = prompt(
      "Why is your lab declining this request?\n\n(Brand + admin see this and reassign accordingly.)",
    );
    if (!reason || !reason.trim()) return;
    setBusyId(id);
    setError(null);
    setFlash(null);
    try {
      const r = await fetch(`/api/lab-portal/test-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setError(j?.error || `Reject failed (HTTP ${r.status}).`);
        return;
      }
      setFlash("Assignment declined — admin notified for reassignment.");
      setTimeout(() => setFlash(null), 4000);
      await load();
    } catch (e: any) {
      setError(e?.message || "Network error.");
    } finally {
      setBusyId(null);
    }
  }

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
      {flash ? (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          {flash}
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
          <div className="p-5">
            <EmptyState
              icon="🧪"
              title="Inbox zero"
              body="No pending test requests. New assignments will show up here with Accept / Reject buttons."
            />
          </div>
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
                  <th className="text-left px-4 py-2 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((p) => {
                  const awaitingAck = p.status === "ASSIGNED_TO_LAB";
                  return (
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
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            awaitingAck
                              ? "bg-orange-100 text-orange-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {p.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{formatDate(p.requestedAt)}</td>
                      <td className="px-4 py-2">
                        {awaitingAck ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => acceptAssignment(p.id)}
                              disabled={busyId === p.id}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50"
                            >
                              {busyId === p.id ? "…" : "Accept"}
                            </button>
                            <button
                              onClick={() => rejectAssignment(p.id)}
                              disabled={busyId === p.id}
                              className="px-2 py-1 rounded bg-white border border-red-300 text-red-700 hover:bg-red-50 text-[11px] font-bold disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
