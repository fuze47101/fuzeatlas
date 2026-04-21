"use client";
/**
 * /admin/bd/sequences/[id] — single sequence detail view.
 *
 * Shows every step in the cadence with its current state, plus per-step
 * actions: Review & send (for ready email steps), Mark sent (for manual
 * channels the rep completed outside Atlas), Skip (decline to send).
 *
 * Sequence-level actions live in the header: Pause, Resume, Exit.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Step {
  id: string;
  stepIndex: number;
  channel: string;
  status: string;
  scheduledFor: string | null;
  readyAt: string | null;
  sentAt: string | null;
  skippedAt: string | null;
  failedAt: string | null;
  failReason: string | null;
  draftSubject: string | null;
  draftBody: string | null;
  crmTaskId: string | null;
}
interface Seq {
  id: string;
  status: string;
  cadenceKey: string;
  exitReason: string | null;
  startedAt: string;
  completedAt: string | null;
  totalSteps: number;
  sentSteps: number;
  skippedSteps: number;
  brand: { id: string; name: string; textileCategory: string | null; pipelineStage: string | null };
  contact: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    jobTitle: string | null;
  };
  rep: { id: string; name: string | null; email: string };
  steps: Step[];
}

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  linkedin_connect: "LinkedIn connect",
  linkedin_dm: "LinkedIn DM",
  paid: "Paid retargeting",
  tradeshow: "Tradeshow invite",
};
const CHANNEL_EMOJI: Record<string, string> = {
  email: "✉️",
  linkedin_connect: "🤝",
  linkedin_dm: "💬",
  paid: "📣",
  tradeshow: "🎪",
};
const STATUS_TONE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  ready: "bg-amber-100 text-amber-900 border-amber-300",
  sent: "bg-emerald-100 text-emerald-800 border-emerald-300",
  skipped: "bg-slate-200 text-slate-600 border-slate-300",
  failed: "bg-rose-100 text-rose-800 border-rose-300",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function contactDisplay(c: Seq["contact"]): string {
  return c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "contact";
}

export default function SequenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const [seq, setSeq] = useState<Seq | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyStepId, setBusyStepId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/bd/sequence/${id}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed: ${res.status}`);
      setSeq(data.sequence);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patchSeq(payload: any) {
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
    }
  }

  // Phase 4: manual "Reply received" trigger. Exits the sequence with
  // reason=replied, creates the rep CrmTask + Notification, then routes
  // into the reply wizard with the sequence context.
  async function markRepliedManual() {
    if (!seq) return;
    const summary = prompt(
      `What did ${contactDisplay(seq.contact)} say? (short summary — the reply wizard uses this to draft a response)`,
      "",
    );
    if (summary === null) return; // cancelled
    try {
      const res = await fetch(`/api/admin/bd/sequence/${id}/mark-replied`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "manual", replySummary: summary || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed: ${res.status}`);
      router.push(`/admin/bd/wizard/reply?sequenceId=${id}`);
    } catch (e: any) {
      alert(e?.message || "Could not mark replied");
    }
  }

  async function stepAction(
    stepId: string,
    action: "send" | "skip" | "mark_sent",
    reason?: string,
  ) {
    setBusyStepId(stepId);
    try {
      const path =
        action === "send"
          ? `/api/admin/bd/sequence/step/${stepId}/send`
          : `/api/admin/bd/sequence/step/${stepId}/skip`;
      const body: any =
        action === "skip" ? { reason } : action === "mark_sent" ? { action: "mark_sent" } : {};
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed: ${res.status}`);
      await load();
    } catch (e: any) {
      alert(e?.message || "Step action failed");
    } finally {
      setBusyStepId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center text-slate-500">
        Loading sequence…
      </div>
    );
  }
  if (error || !seq) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error || "Sequence not found"}
        </div>
        <div className="mt-4">
          <Link
            href="/admin/bd/sequences"
            className="text-indigo-600 underline-offset-2 hover:underline"
          >
            ← Back to sequences
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 text-xs text-slate-500">
        <Link href="/admin/bd/sequences" className="hover:underline">
          ← All sequences
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">BD Sequence</div>
          <h1 className="text-2xl font-semibold text-slate-900">
            <Link href={`/brands/${seq.brand.id}`} className="hover:text-indigo-700">
              {seq.brand.name}
            </Link>{" "}
            <span className="text-slate-400">→</span> {contactDisplay(seq.contact)}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {seq.contact.jobTitle ? `${seq.contact.jobTitle} · ` : ""}
            Started {fmtDate(seq.startedAt)} by {seq.rep.name || seq.rep.email} · cadence:{" "}
            {seq.cadenceKey}
          </p>
        </div>
        <div className="flex gap-2">
          {(seq.status === "active" || seq.status === "paused") && (
            <button
              onClick={markRepliedManual}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              title="Prospect replied — exit this sequence and draft a response"
            >
              Reply received
            </button>
          )}
          {seq.status === "exited" && seq.exitReason === "replied" && (
            <Link
              href={`/admin/bd/wizard/reply?sequenceId=${seq.id}`}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              Open reply wizard
            </Link>
          )}
          {seq.status === "active" && (
            <>
              <button
                onClick={() => patchSeq({ action: "pause" })}
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50"
              >
                Pause
              </button>
              <button
                onClick={() => {
                  const reason = prompt(
                    "Exit reason (replied / meeting_booked / unqualified / manual_stop / replaced):",
                    "manual_stop",
                  );
                  if (reason) patchSeq({ action: "exit", reason });
                }}
                className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-800 hover:bg-rose-50"
              >
                Exit
              </button>
            </>
          )}
          {seq.status === "paused" && (
            <button
              onClick={() => patchSeq({ action: "resume" })}
              className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50"
            >
              Resume
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            Status: <span className="font-medium capitalize">{seq.status}</span>
            {seq.exitReason && (
              <span className="ml-2 text-xs text-slate-500">({seq.exitReason})</span>
            )}
          </div>
          <div>
            Progress:{" "}
            <span className="font-medium">
              {seq.sentSteps + seq.skippedSteps}/{seq.totalSteps}
            </span>{" "}
            <span className="text-slate-400">
              ({seq.sentSteps} sent · {seq.skippedSteps} skipped)
            </span>
          </div>
          {seq.completedAt && <div>Completed: {fmtDate(seq.completedAt)}</div>}
        </div>
      </div>

      <ol className="space-y-3">
        {seq.steps.map((s) => (
          <li key={s.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{CHANNEL_EMOJI[s.channel] || "·"}</span>
                  <span className="font-medium text-slate-900">
                    Step {s.stepIndex + 1} · {CHANNEL_LABEL[s.channel] || s.channel}
                  </span>
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                      STATUS_TONE[s.status] || "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Scheduled: {fmtDate(s.scheduledFor)}
                  {s.sentAt && <> · Sent: {fmtDate(s.sentAt)}</>}
                  {s.readyAt && !s.sentAt && <> · Ready: {fmtDate(s.readyAt)}</>}
                  {s.skippedAt && <> · Skipped: {fmtDate(s.skippedAt)}</>}
                </div>
                {s.failReason && (
                  <div className="mt-1 text-xs text-rose-700">Note: {s.failReason}</div>
                )}
                {(s.draftSubject || s.draftBody) && (
                  <details className="mt-2 text-sm text-slate-700">
                    <summary className="cursor-pointer text-xs text-indigo-600 hover:underline">
                      {s.status === "sent" ? "View sent message" : "View draft"}
                    </summary>
                    {s.draftSubject && (
                      <div className="mt-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">Subject:</span>{" "}
                        {s.draftSubject}
                      </div>
                    )}
                    {s.draftBody && (
                      <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-800">
                        {s.draftBody}
                      </pre>
                    )}
                  </details>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                {s.status === "ready" && s.channel === "email" && (
                  <Link
                    href={`/admin/bd/wizard?stepId=${s.id}`}
                    className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Review & send
                  </Link>
                )}
                {s.status === "ready" &&
                  (s.channel === "linkedin_dm" ||
                    s.channel === "linkedin_connect" ||
                    s.channel === "tradeshow") && (
                    <button
                      disabled={busyStepId === s.id}
                      onClick={() => stepAction(s.id, "mark_sent")}
                      className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      Mark sent
                    </button>
                  )}
                {(s.status === "pending" || s.status === "ready") && (
                  <button
                    disabled={busyStepId === s.id}
                    onClick={() => {
                      const reason = prompt("Skip reason (optional):") || undefined;
                      stepAction(s.id, "skip", reason);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
