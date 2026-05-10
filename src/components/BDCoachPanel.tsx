"use client";

/**
 * <BDCoachPanel /> — Phase 11B.
 *
 * Drop into the BD wizard's DraftStep. Calls /api/admin/bd/wizard/coach
 * with the current draft on demand. Renders 1-3 suggestions, each with
 * a one-click apply or dismiss-with-reason. Feedback writes a
 * CoachFeedback row.
 *
 * The parent component provides the draft state + an `onApply` handler
 * that mutates the draft when a suggestion is accepted.
 */

import { useState } from "react";

interface Suggestion {
  kind: "subject" | "opener" | "closer" | "cta";
  original: string;
  suggested: string;
  reasoning: string;
  confidence: number;
}

interface BasedOn {
  sent: number;
  openRate: number;
  replyRate: number;
}

interface CoachResponse {
  ok: boolean;
  suggestions: Suggestion[];
  notes?: string[];
  basedOn?: BasedOn;
}

export default function BDCoachPanel({
  brandId,
  contactId,
  channel,
  draftSubject,
  draftBody,
  onApply,
}: {
  brandId: string;
  contactId?: string | null;
  channel: "email" | "linkedin";
  draftSubject: string;
  draftBody: string;
  onApply: (kind: Suggestion["kind"], original: string, suggested: string) => void;
}) {
  const [data, setData] = useState<CoachResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  async function runCoach() {
    setLoading(true);
    setError(null);
    setDismissed(new Set());
    try {
      const res = await fetch("/api/admin/bd/wizard/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, contactId, channel, draftSubject, draftBody }),
      });
      const j = await res.json();
      if (!j.ok) setError(j.error || "Coach failed");
      else setData(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function recordFeedback(s: Suggestion, idx: number, applied: boolean, reason?: string) {
    fetch("/api/admin/bd/wizard/coach/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestionId: `${brandId}|${idx}|${Date.now()}`,
        kind: s.kind,
        applied,
        feedback: reason || null,
      }),
    }).catch(() => {});
  }

  return (
    <aside className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-indigo-900">🤖 BD Coach</h3>
        <button
          onClick={runCoach}
          disabled={loading || !draftBody.trim()}
          className="px-2 py-1 text-xs font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Thinking…" : data ? "Re-run" : "Critique draft"}
        </button>
      </div>

      {error && <p className="text-xs text-red-700 mb-2">{error}</p>}

      {data?.basedOn && data.basedOn.sent > 0 && (
        <p className="text-[11px] text-indigo-600 mb-3 italic">
          Trained on your last {data.basedOn.sent} sends — open {(data.basedOn.openRate * 100).toFixed(0)}%, reply {(data.basedOn.replyRate * 100).toFixed(0)}%.
        </p>
      )}

      {data?.notes?.map((n, i) => (
        <p key={i} className="text-xs text-amber-700 mb-2">{n}</p>
      ))}

      {data?.suggestions.length === 0 && !data.notes?.length && (
        <p className="text-xs text-slate-500">Draft looks tight. No suggestions.</p>
      )}

      <div className="space-y-3">
        {data?.suggestions.map((s, idx) =>
          dismissed.has(idx) ? null : (
            <div key={idx} className="rounded-lg border border-indigo-200 bg-white p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase">
                  {s.kind}
                </span>
                <span className="text-[10px] text-slate-400">
                  {(s.confidence * 100).toFixed(0)}% confident
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-slate-500 font-bold">Original:</span>{" "}
                  <span className="text-slate-700 line-through">{s.original}</span>
                </div>
                <div>
                  <span className="text-emerald-700 font-bold">Suggested:</span>{" "}
                  <span className="text-slate-900 font-medium">{s.suggested}</span>
                </div>
                <p className="text-[11px] text-slate-500 italic mt-1">{s.reasoning}</p>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    onApply(s.kind, s.original, s.suggested);
                    recordFeedback(s, idx, true);
                    setDismissed((d) => new Set([...d, idx]));
                  }}
                  className="px-2 py-1 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    recordFeedback(s, idx, false, "dismissed");
                    setDismissed((d) => new Set([...d, idx]));
                  }}
                  className="px-2 py-1 border border-slate-300 text-slate-700 text-xs rounded hover:bg-slate-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </aside>
  );
}
