// @ts-nocheck
"use client";

/**
 * /admin/feedback — triage page for user-submitted feedback.
 *
 * Filters by status + category. Inline edit of triage notes, resolution, and status.
 * Marking FIXED with a resolution note sends an email to the requester (server side).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Status =
  | "NEW"
  | "TRIAGED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "FIXED"
  | "REJECTED"
  | "DUPLICATE"
  | "CLOSED";

const STATUS_ORDER: Status[] = [
  "NEW",
  "TRIAGED",
  "ACCEPTED",
  "IN_PROGRESS",
  "FIXED",
  "REJECTED",
  "DUPLICATE",
  "CLOSED",
];

const STATUS_STYLE: Record<Status, string> = {
  NEW: "bg-red-100 text-red-800 border-red-200",
  TRIAGED: "bg-amber-100 text-amber-800 border-amber-200",
  ACCEPTED: "bg-blue-100 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800 border-cyan-200",
  FIXED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-slate-200 text-slate-700 border-slate-300",
  DUPLICATE: "bg-slate-100 text-slate-600 border-slate-200",
  CLOSED: "bg-slate-100 text-slate-500 border-slate-200",
};

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  PROBLEM: { label: "Broken", icon: "💥" },
  ERROR: { label: "Error", icon: "⚠️" },
  BROKEN_LINK: { label: "Broken link", icon: "🔗" },
  CONFUSING: { label: "Confusing", icon: "❓" },
  MISSING: { label: "Missing", icon: "🧩" },
  SUGGESTION: { label: "Suggestion", icon: "💡" },
  OTHER: { label: "Other", icon: "💬" },
};

interface FeedbackReport {
  id: string;
  createdAt: string;
  status: Status;
  category: string;
  title: string;
  description: string;
  url?: string;
  portal?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userAgent?: string;
  viewport?: string;
  screenshotUrl?: string;
  triageNotes?: string;
  resolution?: string;
  resolutionUrl?: string;
  notifiedAt?: string;
  resolvedAt?: string;
  priority?: number;
}

export default function AdminFeedbackPage() {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    try {
      const res = await fetch(`/api/admin/feedback?${params.toString()}`);
      const j = await res.json();
      if (j.ok) {
        setReports(j.reports || []);
        setByStatus(j.byStatus || {});
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const updateReport = async (id: string, patch: any) => {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await res.json();
      if (j.ok) {
        setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...j.report } : r)));
        if (j.notified) {
          // inline flash
          window.alert("Fixed ✅ — email sent to the requester.");
        }
      } else {
        window.alert("Failed: " + (j.error || "unknown"));
      }
    } catch (err: any) {
      window.alert("Failed: " + err.message);
    } finally {
      setSaving(null);
    }
  };

  const openCount =
    (byStatus.NEW || 0) +
    (byStatus.TRIAGED || 0) +
    (byStatus.ACCEPTED || 0) +
    (byStatus.IN_PROGRESS || 0);

  const statusChips = useMemo(
    () =>
      STATUS_ORDER.map((s) => ({
        status: s,
        count: byStatus[s] || 0,
      })),
    [byStatus],
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/admin" className="hover:text-[#00b4c3]">
            Admin
          </Link>
          <span>/</span>
          <span>Feedback</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">🐛 User Feedback</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {openCount} open · {byStatus.FIXED || 0} fixed · {reports.length} shown
            </p>
          </div>
          <button
            onClick={load}
            className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-black"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setStatusFilter("")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
            statusFilter === ""
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
        >
          All ({reports.length})
        </button>
        {statusChips.map((c) => (
          <button
            key={c.status}
            onClick={() => setStatusFilter(c.status)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              statusFilter === c.status
                ? `${STATUS_STYLE[c.status]} ring-2 ring-offset-1 ring-slate-900`
                : STATUS_STYLE[c.status]
            }`}
          >
            {c.status.replace("_", " ")} ({c.count})
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setCategoryFilter("")}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
            categoryFilter === ""
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
          }`}
        >
          All categories
        </button>
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setCategoryFilter(k)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
              categoryFilter === k
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-slate-400 text-center py-16">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-slate-500">Nothing matches this filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const expanded = expandedId === r.id;
            const cat = CATEGORY_LABELS[r.category] || { label: r.category, icon: "💬" };
            return (
              <div
                key={r.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition"
                >
                  <span className="text-xl">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_STYLE[r.status]}`}
                      >
                        {r.status.replace("_", " ")}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {cat.label}
                      </span>
                      {r.portal && <span className="text-[10px] text-slate-400">{r.portal}</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                      {r.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {r.userName || r.userEmail || "Anonymous"}
                      {r.userRole ? ` · ${r.userRole}` : ""} ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {r.screenshotUrl && <span className="text-xs text-slate-400">📎</span>}
                  <span className="text-slate-400 text-sm">{expanded ? "▾" : "▸"}</span>
                </button>

                {/* Expanded body */}
                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-4">
                    {/* Description */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                        What they said
                      </p>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap bg-white border border-slate-200 rounded-lg p-3">
                        {r.description}
                      </p>
                    </div>

                    {/* Context */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Page URL</p>
                        <p className="text-slate-700 break-all mt-0.5">{r.url || "—"}</p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Reporter</p>
                        <p className="text-slate-700 mt-0.5">
                          {r.userName || "—"}
                          {r.userEmail ? ` · ${r.userEmail}` : ""}
                          {r.userRole ? ` · ${r.userRole}` : ""}
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          Viewport / Browser
                        </p>
                        <p className="text-slate-700 mt-0.5 truncate">
                          {r.viewport || "—"}
                          {r.userAgent ? ` · ${r.userAgent.slice(0, 60)}` : ""}
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          Notified requester
                        </p>
                        <p className="text-slate-700 mt-0.5">
                          {r.notifiedAt
                            ? `✅ ${new Date(r.notifiedAt).toLocaleString()}`
                            : "Not yet"}
                        </p>
                      </div>
                    </div>

                    {/* Screenshot */}
                    {r.screenshotUrl && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Screenshot
                        </p>
                        <a href={r.screenshotUrl} target="_blank" rel="noreferrer">
                          <img
                            src={r.screenshotUrl}
                            alt="Report screenshot"
                            className="max-h-80 rounded-lg border border-slate-200 bg-white"
                          />
                        </a>
                      </div>
                    )}

                    {/* Triage notes */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">
                        Triage notes (internal)
                      </label>
                      <textarea
                        defaultValue={r.triageNotes || ""}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val !== (r.triageNotes || "")) {
                            updateReport(r.id, { triageNotes: val });
                          }
                        }}
                        rows={2}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        placeholder="Internal only — why this is valid / what to do / who owns it"
                      />
                    </div>

                    {/* Resolution (shown to user on FIXED) */}
                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 uppercase">
                        Resolution (shown to user in the notification email)
                      </label>
                      <textarea
                        defaultValue={r.resolution || ""}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val !== (r.resolution || "")) {
                            updateReport(r.id, { resolution: val });
                          }
                        }}
                        rows={2}
                        className="w-full mt-1 px-3 py-2 border border-emerald-300 bg-emerald-50/40 rounded-lg text-xs"
                        placeholder='E.g. "Factory dropdown now shows all approved factories. Try again on the same page."'
                      />
                    </div>

                    {/* Status actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Change status →
                      </span>
                      {STATUS_ORDER.filter((s) => s !== r.status).map((s) => {
                        const isFix = s === "FIXED";
                        return (
                          <button
                            key={s}
                            onClick={() => {
                              if (isFix && !r.resolution) {
                                const note = window.prompt(
                                  "Add a one-line resolution note (shown to the user in the email):",
                                );
                                if (note === null) return;
                                updateReport(r.id, {
                                  status: s,
                                  resolution: note || r.resolution || "",
                                });
                              } else {
                                updateReport(r.id, { status: s });
                              }
                            }}
                            disabled={saving === r.id}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold border ${STATUS_STYLE[s]} hover:opacity-80 disabled:opacity-40`}
                          >
                            {s.replace("_", " ")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
