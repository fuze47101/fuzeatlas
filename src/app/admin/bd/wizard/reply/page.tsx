"use client";
/**
 * /admin/bd/wizard/reply — BD Wizard Phase 4.
 *
 * Secondary follow-up wizard. The rep lands here after:
 *   • A prospect replies to an outbound and BCC-to-Atlas auto-detects it
 *     (handled by /api/inbound/email) — a notification fires with a link
 *     here and a CrmTask shows up at the top of /acm/tasks.
 *   • The rep clicks "Reply received" on /admin/bd/sequences/[id] manually.
 *
 * Locked decisions (2026-04-20 via AskUserQuestion):
 *   • Trigger: BOTH BCC auto-detect + manual override
 *   • Context shown: original cold email + rep's free-text summary of the reply
 *   • Action: draft + log to Note timeline only. No meeting booking, no
 *     auto-task spawn beyond the single "Reply received" task.
 *
 * Flow:
 *   1. GET /api/admin/bd/sequence/[id]
 *      → find the last step with status="sent" that has a draftBody — that's
 *      the cold email the prospect is replying to.
 *   2. Rep types "what did they say?" summary.
 *   3. POST /api/admin/bd/wizard/draft with isReply=true, replySummary,
 *      previousSubject, previousBody → short conversational reply.
 *   4. Rep edits + hits Send → POST /api/admin/outreach/send which logs
 *      to the Note timeline and bumps brand.lastActivityAt.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";

interface ReplyStep {
  id: string;
  stepIndex: number;
  channel: string;
  status: string;
  sentAt: string | null;
  draftSubject: string | null;
  draftBody: string | null;
}

interface ReplySequence {
  id: string;
  status: string;
  exitReason: string | null;
  brand: { id: string; name: string; textileCategory: string | null };
  contact: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    jobTitle: string | null;
  };
  rep: { id: string; name: string | null; email: string };
  steps: ReplyStep[];
}

export default function BDReplyWizardPage() {
  const { t } = useI18n();
  const T = t.bdWizardReply;
  const searchParams = useSearchParams();
  const sequenceId = searchParams.get("sequenceId");

  const [seq, setSeq] = useState<ReplySequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [replySummary, setReplySummary] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [diagnosed, setDiagnosed] = useState<string[]>([]);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  // ─── Load sequence ───
  useEffect(() => {
    if (!sequenceId) {
      setError(T.errMissingSeqId);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/admin/bd/sequence/${sequenceId}`);
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || T.errSeqLoad);
        setSeq(data.sequence);

        // Prefill replySummary from the most recent BRAND_ACTIVITY notification
        // whose metadata points at this sequence. This surfaces the BCC snippet
        // so the rep doesn't have to retype what the prospect said.
        try {
          const notifRes = await fetch(`/api/notifications?limit=20`);
          const notifData = await notifRes.json();
          if (notifData.ok && Array.isArray(notifData.notifications)) {
            const match = notifData.notifications.find(
              (n: any) => n?.metadata?.sequenceId === sequenceId && n?.metadata?.replySnippet,
            );
            if (match?.metadata?.replySnippet) {
              setReplySummary(match.metadata.replySnippet);
            }
          }
        } catch {
          /* non-fatal — rep will type it */
        }
      } catch (err: any) {
        setError(err?.message || T.errSeqLoad);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequenceId]);

  // ─── Pick the original email to quote ───
  const originalEmail = useMemo<ReplyStep | null>(() => {
    if (!seq) return null;
    // Walk steps in reverse order, find the most recent sent email step.
    const emailSteps = seq.steps
      .filter((s) => s.channel === "email" && s.status === "sent" && s.draftBody)
      .sort((a, b) => b.stepIndex - a.stepIndex);
    return emailSteps[0] || null;
  }, [seq]);

  const contactName =
    seq?.contact?.name ||
    [seq?.contact?.firstName, seq?.contact?.lastName].filter(Boolean).join(" ") ||
    seq?.contact?.email ||
    T.fallbackContact;
  const brandName = seq?.brand?.name || T.fallbackBrand;

  // ─── Draft ───
  async function handleDraft() {
    if (!seq || !replySummary.trim()) {
      setError(T.errSummarizeFirst);
      return;
    }
    setError("");
    setDrafting(true);
    try {
      const res = await fetch(`/api/admin/bd/wizard/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: seq.brand.id,
          contactId: seq.contact.id,
          channel: "email",
          tone: "direct",
          isReply: true,
          replySummary: replySummary.trim(),
          previousSubject: originalEmail?.draftSubject || null,
          previousBody: originalEmail?.draftBody || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || T.errDraftFailed);
      setSubject(data.subject);
      setBodyText(data.body);
      setDiagnosed(data.diagnosed || []);
    } catch (err: any) {
      setError(err?.message || T.errDraftFailed);
    } finally {
      setDrafting(false);
    }
  }

  // ─── Send ───
  async function handleSend() {
    if (!seq || !subject.trim() || !bodyText.trim()) {
      setError(T.errSubjectBodyRequired);
      return;
    }
    if (!seq.contact.email) {
      setError(T.errNoEmail);
      return;
    }
    setError("");
    setSending(true);
    try {
      const res = await fetch(`/api/admin/outreach/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: seq.contact.id,
          channel: "email",
          subject: subject.trim(),
          body: bodyText.trim(),
          brandId: seq.brand.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || T.errSendFailed);
      setSendResult(data);
    } catch (err: any) {
      setError(err?.message || T.errSendFailed);
    } finally {
      setSending(false);
    }
  }

  // ─── Render ───
  if (loading) {
    return <div className="max-w-4xl mx-auto p-8 text-gray-500">{T.loadingSeq}</div>;
  }
  if (error && !seq) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">{error}</div>
        <Link href="/admin/bd/sequences" className="text-blue-600 underline mt-4 inline-block">
          {T.backToSequences}
        </Link>
      </div>
    );
  }
  if (!seq) return null;

  if (sendResult) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-4">
        <h1 className="text-2xl font-semibold">{T.sentTitle}</h1>
        <div className="rounded border border-green-300 bg-green-50 p-4 text-green-900">
          {T.sentBodyTpl.replace("{contact}", contactName).replace("{brand}", brandName)}
        </div>
        <div className="flex gap-3">
          <Link
            href={`/brands/${seq.brand.id}`}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {T.openBrandTpl.replace("{brand}", brandName)}
          </Link>
          <Link
            href="/admin/bd/sequences"
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
          >
            {T.allSequences}
          </Link>
          <Link
            href="/acm/tasks"
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
          >
            {T.acmTasks}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500">{T.kicker}</div>
        <h1 className="text-2xl font-semibold mt-1">{T.draftTitleTpl.replace("{contact}", contactName)}</h1>
        <div className="text-sm text-gray-600 mt-1">
          {brandName}
          {seq.contact.jobTitle ? ` · ${seq.contact.jobTitle}` : ""}
          {seq.contact.email ? ` · ${seq.contact.email}` : ""}
        </div>
        {seq.status === "exited" && seq.exitReason === "replied" ? (
          <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 inline-block">
            {T.exitedRepliedBadge}
          </div>
        ) : (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
            {T.stillActiveBadge}
          </div>
        )}
      </div>

      {/* ─── Original cold (read-only) ─── */}
      <section className="rounded border border-gray-200 bg-gray-50 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
          {T.originalColdLabel}
        </div>
        {originalEmail ? (
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">{T.subjectPrefix}</span>{" "}
              {originalEmail.draftSubject || T.noSubject}
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 bg-white border border-gray-200 rounded p-3 max-h-64 overflow-y-auto">
              {originalEmail.draftBody}
            </pre>
            {originalEmail.sentAt ? (
              <div className="text-xs text-gray-500">
                {T.sentAtTpl.replace("{when}", new Date(originalEmail.sentAt).toLocaleString())}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-gray-500">{T.noPriorSent}</div>
        )}
      </section>

      {/* ─── What did they say? ─── */}
      <section className="space-y-2">
        <label className="block text-sm font-medium">
          {T.summaryLabel}
        </label>
        <textarea
          value={replySummary}
          onChange={(e) => setReplySummary(e.target.value)}
          rows={5}
          className="w-full rounded border border-gray-300 p-3 text-sm font-sans"
          placeholder={T.summaryPlaceholder}
        />
        <div className="text-xs text-gray-500">
          {T.summaryHint}
        </div>
      </section>

      {/* ─── Draft button ─── */}
      <div className="flex gap-3">
        <button
          onClick={handleDraft}
          disabled={drafting || !replySummary.trim()}
          className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {drafting ? T.draftingBtn : bodyText ? T.regenerateBtn : T.generateBtn}
        </button>
        <Link
          href="/admin/bd/sequences"
          className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
        >
          {T.cancelBtn}
        </Link>
      </div>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800 text-sm">
          {error}
        </div>
      ) : null}

      {/* ─── Draft editor ─── */}
      {bodyText ? (
        <section className="space-y-3 border-t border-gray-200 pt-6">
          <h2 className="text-lg font-semibold">{T.reviewTitle}</h2>
          <div className="space-y-2">
            <label className="block text-sm font-medium">{T.subjectFieldLabel}</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">{T.bodyFieldLabel}</label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={10}
              className="w-full rounded border border-gray-300 p-3 text-sm font-sans"
            />
          </div>
          {diagnosed.length > 0 ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              {T.scrubberFlagTpl.replace("{list}", diagnosed.join(", "))}
            </div>
          ) : null}
          <div className="flex gap-3">
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-4 py-2 rounded bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {sending ? T.sendingBtn : T.sendBtnTpl.replace("{recipient}", seq.contact.email || contactName)}
            </button>
            <button
              onClick={() => {
                setSubject("");
                setBodyText("");
                setDiagnosed([]);
              }}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
            >
              {T.clearDraft}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
