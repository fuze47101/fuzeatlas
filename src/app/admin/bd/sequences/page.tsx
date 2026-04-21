"use client";
/**
 * /admin/bd/sequences — BD Wizard Phase 3 long-funnel dashboard.
 *
 * Shows the rep (or admin with ?all=1) every active BD sequence they have
 * in flight. Each row summarizes: brand, contact, step progress, the
 * next-step chip, and the ready-action chip when cron has advanced a step
 * to status="ready".
 *
 * Actions per row:
 *   - Open — deep-links to the wizard for the ready step (or the sequence
 *     detail page if no step is ready right now).
 *   - Pause / Resume — toggles sequence status.
 *   - Exit — stops the sequence with a reason (manual_stop, replied,
 *     meeting_booked, unqualified, replaced).
 *
 * The dashboard refreshes every 60s so new "ready" steps tick in as cron
 * processes them without a page reload.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";

interface SeqStep {
  id: string;
  stepIndex: number;
  channel: string;
  status: string;
  scheduledFor: string | null;
  readyAt: string | null;
  sentAt: string | null;
  skippedAt: string | null;
}
interface SeqBrand {
  id: string;
  name: string;
  textileCategory: string | null;
  pipelineStage: string | null;
}
interface SeqContact {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  jobTitle: string | null;
}
interface SeqRep {
  id: string;
  name: string | null;
  email: string;
}
interface Sequence {
  id: string;
  status: string;
  cadenceKey: string;
  exitReason: string | null;
  startedAt: string;
  completedAt: string | null;
  totalSteps: number;
  sentSteps: number;
  skippedSteps: number;
  readyCount: number;
  brand: SeqBrand;
  contact: SeqContact;
  rep: SeqRep;
  steps: SeqStep[];
  nextStep: { id: string; channel: string; status: string; scheduledFor: string | null } | null;
}

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  linkedin_connect: "LI connect",
  linkedin_dm: "LI DM",
  paid: "Paid tag",
  tradeshow: "Tradeshow",
};
const CHANNEL_EMOJI: Record<string, string> = {
  email: "✉️",
  linkedin_connect: "🤝",
  linkedin_dm: "💬",
  paid: "📣",
  tradeshow: "🎪",
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-300",
  paused: "bg-amber-100 text-amber-800 border-amber-300",
  completed: "bg-slate-100 text-slate-700 border-slate-300",
  exited: "bg-rose-100 text-rose-800 border-rose-300",
};

function relDays(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.round(ms / 86400000);
  if (days < -1) return `${Math.abs(days)}d ago`;
  if (days === -1) return "yesterday";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}
function contactDisplay(c: SeqContact): string {
  return c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "contact";
}

export default function BDSequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "paused" | "completed" | "exited">(
    "active",
  );
  const [showAll, setShowAll] = useState(false); // admin toggle
  const [isAdmin, setIsAdmin] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    const qs = new URLSearchParams({ status: statusFilter });
    if (showAll) qs.set("all", "1");
    try {
      const res = await fetch(`/api/admin/bd/sequences?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed: ${res.status}`);
      setSequences(data.sequences || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showAll]);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const me = await meRes.json();
        if (meRes.ok && me.ok) {
          setIsAdmin(me.user.role === "ADMIN" || me.user.role === "EMPLOYEE");
        }
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Poll every 60s so new "ready" chips show up as cron ticks them
  useEffect(() => {
    const t = setInterval(() => {
      load();
    }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function patchSequence(id: string, payload: any) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/bd/sequence/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed: ${res.status}`);
      await load();
    } catch (e: any) {
      alert(e?.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function pause(id: string) {
    await patchSequence(id, { action: "pause" });
  }
  async function resume(id: string) {
    await patchSequence(id, { action: "resume" });
  }
  async function exit(id: string) {
    const reason = prompt(
      "Exit reason (replied / meeting_booked / unqualified / manual_stop / replaced):",
      "manual_stop",
    );
    if (!reason) return;
    await patchSequence(id, { action: "exit", reason });
  }

  const counts = useMemo(() => {
    const byStatus = { active: 0, paused: 0, completed: 0, exited: 0 } as Record<string, number>;
    sequences.forEach((s) => {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    });
    const readySteps = sequences.reduce((n, s) => n + (s.readyCount || 0), 0);
    return { byStatus, readySteps };
  }, [sequences]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">BD Wizard</div>
          <h1 className="text-2xl font-semibold text-slate-900">Sequences</h1>
          <p className="mt-1 text-sm text-slate-600">
            Long-funnel outbound. Cron advances steps hourly. Ready steps park on{" "}
            <Link href="/acm/tasks" className="text-indigo-600 underline-offset-2 hover:underline">
              /acm/tasks
            </Link>{" "}
            for your review — nothing auto-sends.
          </p>
        </div>
        <Link
          href="/admin/bd/wizard"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
        >
          Open BD Wizard →
        </Link>
      </div>

      {/* Summary pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {(["active", "paused", "completed", "exited"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 capitalize transition ${
              statusFilter === s
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400"
            }`}
          >
            {s}{" "}
            {counts.byStatus[s] ? (
              <span className="ml-1 opacity-80">({counts.byStatus[s]})</span>
            ) : null}
          </button>
        ))}
        {counts.readySteps > 0 && (
          <span className="ml-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-amber-900">
            🔔 {counts.readySteps} step{counts.readySteps === 1 ? "" : "s"} awaiting your review
          </span>
        )}
        {isAdmin && (
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show all reps
          </label>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          Loading sequences…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : sequences.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          <div className="text-4xl">🪁</div>
          <div className="mt-3 text-base font-medium text-slate-700">
            No {statusFilter} sequences
          </div>
          <div className="mt-1 text-sm">
            Kick one off by sending your first email through the{" "}
            <Link
              href="/admin/bd/wizard"
              className="text-indigo-600 underline-offset-2 hover:underline"
            >
              BD Wizard
            </Link>
            . Every first send spins up a 6-step cadence automatically.
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Brand / Contact</th>
                <th className="px-4 py-3 text-left">Progress</th>
                <th className="px-4 py-3 text-left">Next</th>
                {showAll && isAdmin && <th className="px-4 py-3 text-left">Rep</th>}
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sequences.map((s) => {
                const readyStep = s.steps.find((st) => st.status === "ready");
                const pct = s.totalSteps
                  ? Math.round(((s.sentSteps + s.skippedSteps) / s.totalSteps) * 100)
                  : 0;
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/brands/${s.brand.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-700"
                      >
                        {s.brand.name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {contactDisplay(s.contact)}
                        {s.contact.jobTitle ? ` · ${s.contact.jobTitle}` : ""}
                      </div>
                      {s.brand.textileCategory && (
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          {s.brand.textileCategory}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">
                          {s.sentSteps + s.skippedSteps}/{s.totalSteps}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-0.5">
                        {s.steps.map((st) => (
                          <span
                            key={st.id}
                            title={`Step ${st.stepIndex + 1} · ${CHANNEL_LABEL[st.channel] || st.channel} · ${st.status}`}
                            className={`inline-block h-4 w-4 rounded text-center text-[9px] leading-4 ${
                              st.status === "sent"
                                ? "bg-emerald-500 text-white"
                                : st.status === "skipped"
                                  ? "bg-slate-300 text-slate-600"
                                  : st.status === "ready"
                                    ? "bg-amber-400 text-amber-900"
                                    : st.status === "failed"
                                      ? "bg-rose-400 text-white"
                                      : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {CHANNEL_EMOJI[st.channel] || "·"}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {readyStep ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                          🔔 {CHANNEL_LABEL[readyStep.channel] || readyStep.channel} ready
                        </span>
                      ) : s.nextStep ? (
                        <span className="text-xs text-slate-600">
                          {CHANNEL_EMOJI[s.nextStep.channel]}{" "}
                          {CHANNEL_LABEL[s.nextStep.channel] || s.nextStep.channel}
                          <span className="ml-1 text-slate-400">
                            {relDays(s.nextStep.scheduledFor)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    {showAll && isAdmin && (
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {s.rep.name || s.rep.email}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                          STATUS_TONE[s.status] || "border-slate-300 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {s.status}
                      </span>
                      {s.exitReason && (
                        <div className="mt-0.5 text-[10px] text-slate-400">{s.exitReason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {readyStep && readyStep.channel === "email" ? (
                          <Link
                            href={`/admin/bd/wizard?stepId=${readyStep.id}`}
                            className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                          >
                            Review & send
                          </Link>
                        ) : readyStep ? (
                          <Link
                            href={`/admin/bd/sequences/${s.id}`}
                            className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            Open
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/bd/sequences/${s.id}`}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            View
                          </Link>
                        )}
                        {s.status === "active" && (
                          <>
                            <button
                              disabled={busyId === s.id}
                              onClick={() => pause(s.id)}
                              className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                            >
                              Pause
                            </button>
                            <button
                              disabled={busyId === s.id}
                              onClick={() => exit(s.id)}
                              className="rounded-md border border-rose-300 bg-white px-2 py-1 text-xs text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Exit
                            </button>
                          </>
                        )}
                        {s.status === "paused" && (
                          <button
                            disabled={busyId === s.id}
                            onClick={() => resume(s.id)}
                            className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            Resume
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
