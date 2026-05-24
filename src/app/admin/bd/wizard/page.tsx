"use client";
/**
 * /admin/bd/wizard — The BD Wizard (Phase 1 MVP).
 *
 * Andrew's overhaul vision (locked 2026-04-20):
 *  - Replace the open-scrolling BD pipeline with a guided wizard.
 *  - Auto-assign next highest-confidence LEAD on entry.
 *  - One-click multi-AI enrichment (already wired on /api/brands/[id]/research).
 *  - Per-contact LinkedIn vs Email toggle.
 *  - 2-3 rep customization questions BEFORE the draft.
 *  - Anti-AI-detection scrubber on the draft before rep sees it.
 *  - Auto-assign brand to the rep on send.
 *  - Auto-note + lastActivityAt bump.
 *  - BCC-the-rep summary.
 *
 * Phases not in this MVP:
 *  - Resume-where-you-left-off state persistence
 *  - Long-funnel orchestration (LinkedIn → Email → Paid → Tradeshow)
 *  - Secondary follow-up wizard
 *  - Dashboards + ACM hand-off
 *
 * Doc: docs/BD_WIZARD_OVERHAUL.md
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { EmailTemplatePicker } from "@/components/EmailTemplatePicker";
import BulkEnrichButton from "@/components/BulkEnrichButton";
import { renderTemplate } from "@/lib/email-template-vars";
import { assessContact, partitionContacts } from "@/lib/contact-quality";

// ────────────── types ──────────────
interface WizardContact {
  id: string;
  name: string | null;
  email: string | null;
  personalEmail: string | null;
  linkedinUrl: string | null;
  jobTitle: string | null;
  seniority: string | null;
  emailStatus: string | null;
  outreachStatus: string | null;
  lastContactedAt: string | null;
}

interface WizardBrand {
  id: string;
  name: string;
  website: string | null;
  linkedInProfile: string | null;
  backgroundInfo: string | null;
  fuzeRelevance: string | null;
  validationStatus: string | null;
  textileCategory: string | null;
  researchData: any | null;
  researchDate: string | null;
  contacts: WizardContact[];
}

type Step = "pick" | "contact" | "customize" | "draft" | "sent";

// ────────────── component ──────────────
export default function BDWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Phase 3: wizard can be deep-linked from a sequence step. When
  // ?stepId=<id> is present we preload the step's draft and jump
  // straight to the "draft" step with follow-up framing. The send
  // call will include stepId so the sequence marks this step sent.
  const [sequenceStepId, setSequenceStepId] = useState<string | null>(null);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [isFollowUp, setIsFollowUp] = useState(false);

  const [step, setStep] = useState<Step>("pick");
  const [brand, setBrand] = useState<WizardBrand | null>(null);
  const [queueDepth, setQueueDepth] = useState<number>(0);
  const [reason, setReason] = useState<string>("");
  // When the queue is empty, the next-brand API returns a diagnostic
  // breakdown (totalLead, leadAssigned, leadNoContacts, etc.) so we
  // can show Ryan exactly why the queue is dry instead of just
  // "queue is empty." dominantReason drives the recommended-action
  // button.
  const [emptySummary, setEmptySummary] = useState<any>(null);
  // Bulk-enrichment is now owned by the shared <BulkEnrichButton />
  // component (src/components/BulkEnrichButton.tsx). Pages that surface
  // it pass an onPipelineReady callback to react when the queue is
  // healthy.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Contact selection
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [channel, setChannel] = useState<"email" | "linkedin">("email");
  const [tone, setTone] = useState<"direct" | "warm" | "curious">("direct");

  // Customization Q&A
  const [qA1, setQA1] = useState(""); // what caught your attention about this brand
  const [qA2, setQA2] = useState(""); // what specific problem do you think FUZE solves for them
  const [qA3, setQA3] = useState(""); // anything personal/recent you know about the contact

  // Draft
  const [drafting, setDrafting] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  // Barth ticket May 2026 — attachments are now supported on the
  // wizard's email channel. LI is excluded (LinkedIn DMs don't carry
  // file attachments through their API surface).
  const [attachments, setAttachments] = useState<File[]>([]);
  const [diagnosed, setDiagnosed] = useState<string[]>([]);
  // Metadata from the draft API: which AI ran, whether we auto-researched
  // the brand for this draft, and whether the generated body actually
  // referenced every seed answer the rep provided. Lets the draft step
  // show the rep when the AI ignored their input so they can regenerate.
  const [draftMeta, setDraftMeta] = useState<null | {
    provider?: string;
    research?: { hadPriorResearch?: boolean; autoResearched?: boolean; hasIntel?: boolean };
    answerCoverage?: { total?: number; referenced?: number; ratio?: number; underused?: boolean };
  }>(null);

  // Send
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);
  // #101 — when the send endpoint returns 409 already_contacted, we
  // surface a confirm dialog ("Ryan emailed Viktor 3h ago — send anyway?")
  // and let the rep override with force:true on the retry.
  const [duplicateWarn, setDuplicateWarn] = useState<null | {
    otherRepName: string | null;
    previousSubject: string | null;
    hoursAgo: number;
    previousSentAt: string;
  }>(null);

  // Enrichment
  const [enriching, setEnriching] = useState(false);

  // #101 — Bounce (dead-domain kill). Bouncing the brand flips
  // validationStatus=dead, invalidates all contacts on the dead hostname,
  // and releases the reservation so nobody gets auto-assigned to a dead
  // brand. The wizard then auto-advances to the next brand.
  const [bouncing, setBouncing] = useState(false);

  // ─── Profile preflight ───
  const [profileOk, setProfileOk] = useState<boolean | null>(null);
  const [profileFrom, setProfileFrom] = useState<string | null>(null);

  const selectedContact = useMemo(
    () => brand?.contacts.find((c) => c.id === selectedContactId) || null,
    [brand, selectedContactId],
  );

  // Bug B fix (Scott ticket cmot3i3pk, May 2026): when the rep picks a
  // contact that has no email but does have a LinkedIn URL, auto-flip
  // the channel to LinkedIn so they aren't stuck on a draft step that
  // can't ever send. Also surface a banner explaining what happened so
  // they don't think the channel was set arbitrarily.
  const [channelAutoSwitched, setChannelAutoSwitched] = useState(false);
  function handleContactSelect(contactId: string) {
    setSelectedContactId(contactId);
    const c = brand?.contacts.find((x) => x.id === contactId);
    if (!c) {
      setChannelAutoSwitched(false);
      return;
    }
    if (!c.email && c.linkedinUrl && channel === "email") {
      setChannel("linkedin");
      setChannelAutoSwitched(true);
    } else {
      setChannelAutoSwitched(false);
    }
  }
  // ────────────── effects ──────────────
  useEffect(() => {
    async function checkProfile() {
      try {
        const res = await fetch("/api/me");
        const data = await res.json();
        if (res.ok && data.ok) {
          setProfileFrom(data.user.outboundFromEmail || null);
          setProfileOk(Boolean(data.user.outboundFromEmail));
        }
      } catch {
        setProfileOk(false);
      }
    }
    checkProfile();
    const stepIdParam = searchParams.get("stepId");
    const brandIdParam = searchParams.get("brandId");
    const contactIdParam = searchParams.get("contactId");
    if (stepIdParam) {
      loadFromSequenceStep(stepIdParam);
    } else if (brandIdParam) {
      // Deep-link from /brands/[id] 📧 Email button — skip the next-brand
      // queue and load this specific brand + contact directly.
      loadBrandById(brandIdParam, contactIdParam);
    } else {
      loadNextBrand();
    }

    // #101 — Release the reservation when the rep closes the tab or
    // navigates away without sending. sendBeacon is the only reliable way
    // to hit an endpoint during unload; regular fetch gets cancelled.
    const onBeforeUnload = () => {
      const id = brandRef.current?.id;
      if (!id) return;
      try {
        const blob = new Blob([JSON.stringify({ brandId: id })], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/admin/bd/wizard/release", blob);
      } catch {
        // best-effort — reservation TTL will catch stragglers
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // #101 — Keep a ref to the current brand so the beforeunload handler
  // (which only runs through the useEffect closure once) can read the
  // latest value without needing to re-subscribe on every brand change.
  const brandRef = useRef<WizardBrand | null>(null);
  useEffect(() => {
    brandRef.current = brand;
  }, [brand]);

  /**
   * Jump straight into the wizard for a specific brand + optional contact.
   * Entry point from /brands/[id]'s 📧 Email button — replaces the retired
   * EmailComposeModal. Lands the rep on the "contact" step (or "customize"
   * if a contactId was provided) instead of the pick-from-queue flow.
   */
  async function loadBrandById(brandId: string, contactId?: string | null) {
    setLoading(true);
    setError("");
    setReason("");
    try {
      const res = await fetch(`/api/admin/bd/wizard/brand/${encodeURIComponent(brandId)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Failed to load brand");
        setBrand(null);
        return;
      }
      setBrand(data.brand);
      setQueueDepth(0);
      setReason(`Launched from the brand page — not pulled from the next-brand queue.`);
      // Reset wizard state for a clean run
      setSelectedContactId(null);
      setChannel("email");
      setQA1("");
      setQA2("");
      setQA3("");
      setSubject("");
      setBodyText("");
      setDiagnosed([]);
      setDraftMeta(null);
      setSendResult(null);
      setSendError(null);
      setSequenceStepId(null);
      setIsFollowUp(false);

      // If a specific contact was requested and exists on this brand, lock
      // to it so the wizard pre-selects them. But still route through the
      // "pick" step when the brand hasn't been enriched yet — the enrichment
      // CTA only lives on that step, and a deep-linked cold brand would
      // otherwise go straight to draft generation with no research, yielding
      // generic copy. If research is already cached, skip ahead as intended.
      const hasResearch = Boolean(data.brand.researchData);
      if (contactId) {
        const match = (data.brand.contacts || []).find((c: any) => c.id === contactId);
        if (match) {
          setSelectedContactId(contactId);
          setStep(hasResearch ? "customize" : "pick");
          return;
        }
      }
      setStep(hasResearch ? "contact" : "pick");
    } catch (e: any) {
      setError(e?.message || "Failed to load brand");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Preload the wizard from a BDSequenceStep. Skips the normal "next-brand"
   * queue pull and drops the rep directly on the Draft step with the stored
   * draftSubject/draftBody as the starting point. Send will include the
   * stepId so the sequence marks it sent instead of creating a new one.
   */
  async function loadFromSequenceStep(stepId: string) {
    setLoading(true);
    setSequenceLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/bd/sequence/step/${encodeURIComponent(stepId)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Failed to load sequence step");
        setBrand(null);
        return;
      }
      const s = data.step;
      const ch = s.channel === "linkedin_dm" ? "linkedin" : s.channel === "email" ? "email" : null;
      if (!ch) {
        setError(
          `Step channel is "${s.channel}" — not sendable from the wizard. Go to the sequences dashboard to mark it done.`,
        );
        return;
      }
      // Stash the brand + contact in our state, jump to the draft step.
      setBrand(s.sequence.brand);
      setSelectedContactId(s.sequence.contact.id);
      setChannel(ch);
      setSubject(s.draftSubject || "");
      setBodyText(s.draftBody || "");
      setDiagnosed([]);
      setSequenceStepId(s.id);
      setIsFollowUp(true);
      setStep("draft");
      setReason(
        `Follow-up step ${s.stepIndex + 1} of the active sequence — review and send, or go back to regenerate.`,
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load sequence step");
    } finally {
      setLoading(false);
      setSequenceLoading(false);
    }
  }

  // ────────────── actions ──────────────
  /**
   * #101 — Drop the soft reservation the current rep holds on `brandId`.
   * Fire-and-forget: we don't block UI on this, but we await it inside
   * loadNextBrand + bounceBrand so the next server read sees a clean slate.
   * Safe to call with a brandId we don't actually hold — the server no-ops.
   */
  async function releaseReservation(brandId: string): Promise<void> {
    if (!brandId) return;
    try {
      await fetch("/api/admin/bd/wizard/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
    } catch {
      // best-effort — the TTL will clean up anyway
    }
  }

  async function loadNextBrand(skipId?: string) {
    setLoading(true);
    setError("");
    setReason("");
    // If we already have a brand loaded, drop our reservation on it
    // before picking the next one. Otherwise the brand stays locked to
    // us for the full 30-min TTL and nobody else can pick it up.
    if (skipId) {
      await releaseReservation(skipId);
    }
    try {
      const url = skipId
        ? `/api/admin/bd/wizard/next-brand?skip=${encodeURIComponent(skipId)}`
        : "/api/admin/bd/wizard/next-brand";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to load next brand");
        setBrand(null);
        return;
      }
      setBrand(data.brand);
      setQueueDepth(data.queueDepth || 0);
      setReason(data.reason || "");
      setEmptySummary(data.summary || null);
      // reset step state
      setStep("pick");
      setSelectedContactId(null);
      setChannel("email");
      setQA1("");
      setQA2("");
      setQA3("");
      setSubject("");
      setBodyText("");
      setDiagnosed([]);
      setDraftMeta(null);
      setSendResult(null);
      setSendError(null);
      setSequenceStepId(null);
      setIsFollowUp(false);
    } catch (e: any) {
      setError(e?.message || "Failed to load next brand");
    } finally {
      setLoading(false);
    }
  }

  async function runEnrichment() {
    if (!brand) return;
    setEnriching(true);
    setError("");
    try {
      const res = await fetch(`/api/brands/${brand.id}/research`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Enrichment failed");
        return;
      }
      // Reload the brand from the wizard's own endpoint so we pick up the
      // fresh researchData + researchDate the enrichment call persisted,
      // plus any contact fields that may have been updated during discovery.
      try {
        const refreshed = await fetch(`/api/admin/bd/wizard/brand/${encodeURIComponent(brand.id)}`);
        const refreshedData = await refreshed.json();
        if (refreshed.ok && refreshedData.ok && refreshedData.brand) {
          setBrand(refreshedData.brand);
          return;
        }
      } catch {
        // Fall through to the optimistic patch below if the refetch fails
      }
      // Fallback: optimistic merge so the UI at least unblocks.
      setBrand((b) => (b ? { ...b, researchData: data.research || b.researchData || {} } : b));
    } catch (e: any) {
      setError(e?.message || "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  async function generateDraft() {
    if (!brand || !selectedContact) return;
    setDrafting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/bd/wizard/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brand.id,
          contactId: selectedContact.id,
          channel,
          tone,
          isFollowUp,
          answers: {
            "What caught your attention about this brand": qA1,
            "What specific problem do you think FUZE solves for them": qA2,
            "Anything personal or recent you know about this contact": qA3,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Draft failed");
        return;
      }
      setSubject(data.subject || "");
      setBodyText(data.body || "");
      setDiagnosed(data.diagnosed || []);
      setDraftMeta({
        provider: data.provider,
        research: data.research,
        answerCoverage: data.answerCoverage,
      });
      setStep("draft");
    } catch (e: any) {
      setError(e?.message || "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  // Structured send-failure surface. When the send route rejects for a
  // setup reason (no API key, no outbound From, unverified domain, bad
  // recipient) it returns { ok:false, error, code, setupPath, details }.
  // We store the whole thing so the UI can render a "Fix setup" CTA that
  // jumps the rep straight to the page that resolves the problem —
  // instead of the old bare "email send failed" string.
  const [sendError, setSendError] = useState<null | {
    message: string;
    code?: string;
    setupPath?: string;
    details?: string;
  }>(null);

  async function sendDraft(force: boolean = false) {
    if (!brand || !selectedContact) return;
    // Defensive: coerce `force` to a real boolean. If a button binds
    // `onClick={sendDraft}` (instead of `onClick={() => sendDraft()}`)
    // React hands us a synthetic event here, which is truthy but carries
    // circular refs. That then gets stringified into the POST body below
    // and Safari throws "JSON.stringify cannot serialize cyclic
    // structures". Clamping here keeps the payload clean no matter what.
    const forceBool = force === true;
    setSending(true);
    setError("");
    setSendError(null);
    if (!forceBool) setDuplicateWarn(null);
    try {
      const draftPayload = {
        brandId: brand.id,
        contactId: selectedContact.id,
        channel,
        subject,
        body: bodyText,
        stepId: sequenceStepId || undefined,
        force: forceBool || undefined,
      };
      // If the rep attached files (email channel only), upgrade the
      // request to multipart so we can stream binary bytes through
      // Resend without base64-double-encoding in the browser.
      let res: Response;
      if (channel === "email" && attachments.length > 0) {
        const form = new FormData();
        form.append("payload", JSON.stringify(draftPayload));
        for (const file of attachments) form.append("attachments", file, file.name);
        res = await fetch("/api/admin/bd/wizard/send", { method: "POST", body: form });
      } else {
        res = await fetch("/api/admin/bd/wizard/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload),
        });
      }
      const data = await res.json();
      if (res.status === 409 && data?.code === "already_contacted") {
        // Another rep beat us to this contact in the last 24h. Don't
        // flip sendError (that's the setup/fix banner) — show a
        // dedicated confirm dialog instead so the rep can consciously
        // say "yes, send anyway" without thinking this is a setup bug.
        setDuplicateWarn({
          otherRepName: data?.otherRep?.name || null,
          previousSubject: data?.previousSubject || null,
          hoursAgo: Number(data?.hoursAgo) || 1,
          previousSentAt: data?.previousSentAt || new Date().toISOString(),
        });
        return;
      }
      if (!res.ok || !data.ok) {
        const msg = data?.error || "Send failed";
        setError(msg);
        setSendError({
          message: msg,
          code: data?.code,
          setupPath: data?.setupPath,
          details: data?.details,
        });
        return;
      }
      setSendResult(data);
      setStep("sent");
      setDuplicateWarn(null);
    } catch (e: any) {
      const msg = e?.message || "Send failed";
      setError(msg);
      setSendError({ message: msg });
    } finally {
      setSending(false);
    }
  }

  /**
   * #101 — Bounce the brand (dead-domain kill switch). Calls bounce-brand
   * which flips validationStatus=dead, invalidates every contact email on
   * the dead hostname, drops a timeline note, and releases ownership.
   * We then auto-advance to the next brand in the queue so the rep keeps
   * working instead of staring at the dead one.
   */
  async function bounceBrand(reason: string = "") {
    if (!brand) return;
    setBouncing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/bd/wizard/bounce-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brand.id,
          reason,
          domainProbe: null, // BrandHeader owns the probe; server re-reads brand.website anyway
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Failed to bounce brand");
        return;
      }
      // Skip forward to the next candidate. Pass the current brand's id
      // as skipId so next-brand can exclude it explicitly (and because
      // the validationStatus=dead filter would already exclude it, but
      // belt-and-suspenders).
      await loadNextBrand(brand.id);
    } catch (e: any) {
      setError(e?.message || "Failed to bounce brand");
    } finally {
      setBouncing(false);
    }
  }

  // ────────────── render ──────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <Header
          queueDepth={queueDepth}
          onSkip={() => brand && loadNextBrand(brand.id)}
          currentBrandId={brand?.id}
        />

        {profileOk === false && <ProfileWarning current={profileFrom} />}

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border p-10 text-center text-slate-500">
            Loading your next brand…
          </div>
        ) : error && !brand ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
            {error}
          </div>
        ) : !brand ? (
          <div className="bg-white rounded-2xl shadow-sm border p-10 text-center">
            <div className="text-5xl mb-3">
              {emptySummary?.dominantReason === "no_contacts" ? "📇"
                : emptySummary?.dominantReason === "all_assigned" ? "🤝"
                : emptySummary?.dominantReason === "all_dead" ? "💀"
                : emptySummary?.dominantReason === "all_reserved" ? "⏳"
                : "🎉"}
            </div>
            <div className="text-xl font-semibold text-slate-800 mb-1">
              {emptySummary?.dominantReason === "no_contacts"
                ? "Pipeline needs enrichment."
                : emptySummary?.dominantReason === "all_assigned"
                ? "All brands already claimed."
                : emptySummary?.dominantReason === "all_dead"
                ? "Most LEAD brands are flagged dead."
                : emptySummary?.dominantReason === "all_reserved"
                ? "All brands reserved by other reps."
                : "Queue is empty."}
            </div>
            <div className="text-sm text-slate-500 max-w-xl mx-auto">
              {reason ||
                "No unassigned LEAD brands with contacts. Run a discovery batch or import a CSV to refill the queue."}
            </div>

            {/* Diagnostic breakdown — shows the rep exactly where
                LEAD brands are bleeding off so they don't think the
                pipeline is genuinely empty when it's just blocked. */}
            {emptySummary && emptySummary.totalLead > 0 && (
              <div className="mt-6 max-w-xl mx-auto">
                <div className="grid grid-cols-2 gap-2 text-xs text-left bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total LEAD brands</span>
                    <span className="font-semibold text-slate-900">{emptySummary.totalLead}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Missing contacts</span>
                    <span className={`font-semibold ${emptySummary.leadNoContacts > 0 ? "text-amber-600" : "text-slate-900"}`}>{emptySummary.leadNoContacts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Already claimed</span>
                    <span className="font-semibold text-slate-900">{emptySummary.leadAssigned}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Reserved (other rep)</span>
                    <span className="font-semibold text-slate-900">{emptySummary.leadReserved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Dead / dup / irrelevant</span>
                    <span className="font-semibold text-slate-900">{emptySummary.leadDead + emptySummary.leadDuplicate + emptySummary.leadIrrelevant}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action cards — each card explains what the action does
                so the rep doesn't have to guess. The primary card
                (recommended action) depends on the dominant exclusion
                reason; secondary cards are still available as
                alternatives. */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto text-left">
              {emptySummary?.dominantReason === "no_contacts" ? (
                <>
                  {/* PRIMARY — brands needing enrichment */}
                  <a
                    href="/admin/brand-pipeline?filter=no-contacts"
                    className="group block p-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 transition"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">📇</span>
                      <span className="font-bold text-emerald-900">
                        Brands Needing Enrichment ({emptySummary.leadNoContacts})
                      </span>
                      <span className="ml-auto text-[10px] uppercase font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Opens the list of brands already in your pipeline that are missing contacts. Use this to see what needs enrichment. Bulk-enrich with the admin command below — that's the cheapest fix since these brands are already in the pipeline.
                    </p>
                  </a>

                  {/* SECONDARY — run discovery */}
                  <Link
                    href="/admin/brand-discovery"
                    className="group block p-4 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50 transition"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🌎</span>
                      <span className="font-bold text-slate-900">Run Discovery</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Adds new brands to the pipeline via multi-AI search (Anthropic + OpenAI + Grok). Each new brand auto-attaches up to 8 senior contacts via Apollo. Use this to top up with fresh prospects — it doesn't fix the existing 1083 empty brands.
                    </p>
                  </Link>
                </>
              ) : (
                <>
                  {/* PRIMARY — run discovery */}
                  <Link
                    href="/admin/brand-discovery"
                    className="group block p-4 rounded-xl border-2 border-sky-300 bg-sky-50 hover:bg-sky-100 transition"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🌎</span>
                      <span className="font-bold text-sky-900">Run Discovery</span>
                      <span className="ml-auto text-[10px] uppercase font-bold text-sky-700 bg-white px-1.5 py-0.5 rounded">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-sky-800 leading-relaxed">
                      Adds new brands to the pipeline via multi-AI search (Anthropic + OpenAI + Grok). Each new brand auto-attaches up to 8 senior contacts via Apollo. Pick a category + region, takes ~30-60 seconds.
                    </p>
                  </Link>

                  {/* SECONDARY — open pipeline */}
                  <Link
                    href="/admin/brand-pipeline"
                    className="group block p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🔥</span>
                      <span className="font-bold text-slate-900">Open Pipeline</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      See every brand across all stages (LEAD, PRESENTATION, BRAND_TESTING, etc.) with filters. Use this to manually claim a specific brand, change a stage, or check on a deal that's not in your active wizard queue.
                    </p>
                  </Link>
                </>
              )}
            </div>

            {/* In-UI bulk-enrichment trigger — uses the shared
                BulkEnrichButton component so the same logic runs from
                the wizard, brand-discovery, and brand-pipeline pages. */}
            {emptySummary?.dominantReason === "no_contacts" && (
              <div className="mt-6 max-w-3xl mx-auto">
                <BulkEnrichButton
                  variant="banner"
                  onPipelineReady={() => loadNextBrand()}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            <BrandHeader brand={brand} onBounce={bounceBrand} bouncing={bouncing} />

            <Stepper currentStep={step} />

            {step === "pick" && (
              <PickStep
                brand={brand}
                enriching={enriching}
                onEnrich={runEnrichment}
                onAdvance={() => setStep("contact")}
              />
            )}

            {step === "contact" && (
              <ContactStep
                brand={brand}
                selectedContactId={selectedContactId}
                onSelect={handleContactSelect}
                channel={channel}
                onChannelChange={(c) => {
                  setChannel(c);
                  // Manually changing the channel implies the user has
                  // seen / dismissed the auto-switch banner.
                  setChannelAutoSwitched(false);
                }}
                channelAutoSwitched={channelAutoSwitched}
                tone={tone}
                onToneChange={setTone}
                onBack={() => setStep("pick")}
                onNext={() => setStep("customize")}
              />
            )}

            {step === "customize" && (
              <CustomizeStep
                qA1={qA1}
                qA2={qA2}
                qA3={qA3}
                onQA1Change={setQA1}
                onQA2Change={setQA2}
                onQA3Change={setQA3}
                drafting={drafting}
                onBack={() => setStep("contact")}
                onGenerate={generateDraft}
              />
            )}

            {step === "draft" && selectedContact && (
              <DraftStep
                channel={channel}
                subject={subject}
                bodyText={bodyText}
                diagnosed={diagnosed}
                draftMeta={draftMeta}
                contact={selectedContact}
                brand={brand}
                sending={sending}
                drafting={drafting}
                onSubjectChange={setSubject}
                onBodyChange={setBodyText}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                onBack={() => setStep("customize")}
                onRegenerate={generateDraft}
                onSend={sendDraft}
              />
            )}

            {step === "sent" && selectedContact && (
              <SentStep
                brand={brand}
                contact={selectedContact}
                sendResult={sendResult}
                onNext={() => loadNextBrand(brand.id)}
              />
            )}

            {/* Structured send-failure (#96). When the send route rejects
               with a setup code we show an actionable CTA (fix the key,
               set your outbound From, verify your sending domain) instead
               of the old generic "email send failed" line. Falls back to
               the plain error string for non-setup failures. */}
            {sendError && brand && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none mt-0.5">⛔</span>
                  <div className="flex-1">
                    <div className="font-semibold">{sendError.message}</div>
                    {sendError.details && (
                      <div className="mt-1 text-xs opacity-80">{sendError.details}</div>
                    )}
                    {sendError.setupPath && (
                      <Link
                        href={sendError.setupPath}
                        className="inline-block mt-2 rounded-md bg-rose-600 text-white text-xs font-medium px-3 py-1 hover:bg-rose-700"
                      >
                        {sendError.code === "no_resend_key"
                          ? "Open email settings →"
                          : sendError.code === "no_outbound_from"
                            ? "Open your profile →"
                            : sendError.code === "domain_unverified"
                              ? "Verify your sending domain →"
                              : "Fix setup →"}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
            {error && !sendError && brand && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* #101 — Duplicate-send confirm dialog. The send route returns
               409 already_contacted when another rep emailed the same
               contact in the last 24h. Instead of silently blocking or
               auto-sending a dupe, we pop a modal with the context so the
               rep can say "yes, send anyway" (force:true) or bail out. */}
            {duplicateWarn && selectedContact && (
              <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-xl border border-amber-200 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto p-6 my-auto">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl leading-none">⚠️</div>
                    <div className="flex-1">
                      <div className="text-base font-semibold text-slate-900">
                        Already contacted recently
                      </div>
                      <div className="mt-2 text-sm text-slate-700">
                        <span className="font-medium">
                          {duplicateWarn.otherRepName || "Another rep"}
                        </span>{" "}
                        emailed{" "}
                        <span className="font-medium">
                          {selectedContact.name || selectedContact.email}
                        </span>{" "}
                        about <span className="font-medium">{duplicateWarn.hoursAgo}h ago</span>.
                      </div>
                      {duplicateWarn.previousSubject && (
                        <div className="mt-2 text-xs text-slate-500">
                          Previous subject:{" "}
                          <span className="italic">"{duplicateWarn.previousSubject}"</span>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        Sending again this soon can look spammy and hurt your domain reputation.
                        Only override if you know this is a deliberate second touch.
                      </div>
                      <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setDuplicateWarn(null)}
                          className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                          disabled={sending}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => void sendDraft(true)}
                          disabled={sending}
                          className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                        >
                          {sending ? "Sending…" : "Send anyway"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ────────────── sub-components ──────────────
function Header({
  queueDepth,
  onSkip,
  currentBrandId,
}: {
  queueDepth: number;
  onSkip: () => void;
  currentBrandId?: string;
}) {
  const { t } = useI18n();
  const T = t.bdWizard;
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <Link href="/home" className="text-xs text-slate-500 hover:text-slate-700">
          {T.homeLink}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">{T.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {T.pageSubtitle}
          {queueDepth > 0 && <span className="ml-2 text-slate-400">{T.inQueueTemplate.replace("{n}", String(queueDepth))}</span>}
        </p>
      </div>
      {currentBrandId && (
        <button
          onClick={onSkip}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-white"
        >
          {T.skipBrand}
        </button>
      )}
    </div>
  );
}

function ProfileWarning({ current }: { current: string | null }) {
  const { t } = useI18n();
  const T = t.bdWizard;
  return (
    <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <div className="text-2xl">⚠️</div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-amber-900">
          {T.setFromAddressHeader}
        </div>
        <div className="text-xs text-amber-700 mt-1">
          {T.setFromAddressBody}
          {current ? (
            <>
              {" "}
              {T.currentlyLabel} <span className="font-mono">{current}</span>
            </>
          ) : null}
        </div>
      </div>
      <Link
        href="/settings/profile"
        className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-700"
      >
        {T.openProfile}
      </Link>
    </div>
  );
}

function BrandHeader({
  brand,
  onBounce,
  bouncing,
}: {
  brand: WizardBrand;
  onBounce?: (reason?: string) => Promise<void> | void;
  bouncing?: boolean;
}) {
  const rel = (brand.fuzeRelevance || "").toLowerCase();
  const relColor =
    rel === "high"
      ? "bg-emerald-100 text-emerald-700"
      : rel === "medium"
        ? "bg-amber-100 text-amber-700"
        : rel === "low"
          ? "bg-slate-100 text-slate-600"
          : "bg-slate-50 text-slate-400";

  // Auto-probe the brand website on mount so dead / parked domains are
  // flagged inline. Active Line Corp regression: activelinecorp.com
  // rendered like a normal link on the header but was dead, and every
  // downstream action (enrichment, research, email-domain inference)
  // silently failed on it.
  const [domainProbe, setDomainProbe] = useState<any>(null);
  const [probing, setProbing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const website = brand.website;
    if (!website) {
      setDomainProbe(null);
      return;
    }
    (async () => {
      setProbing(true);
      try {
        const res = await fetch(`/api/util/domain-check?url=${encodeURIComponent(website)}`);
        const data = await res.json();
        if (!cancelled && data?.ok) setDomainProbe(data.result);
      } catch {
        // silent — the badge just won't render
      } finally {
        if (!cancelled) setProbing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brand.id, brand.website]);

  async function retestDomain() {
    if (!brand.website) return;
    setProbing(true);
    try {
      const res = await fetch(
        `/api/util/domain-check?url=${encodeURIComponent(brand.website)}&fresh=1`,
      );
      const data = await res.json();
      if (data?.ok) setDomainProbe(data.result);
    } finally {
      setProbing(false);
    }
  }

  const statusBadge = (() => {
    if (!domainProbe) return null;
    switch (domainProbe.status) {
      case "reachable":
        return { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "live" };
      case "parked":
        return { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "parked" };
      case "unreachable":
        return { cls: "bg-red-50 text-red-700 border-red-200", label: "dead link" };
      case "blocked":
        return { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "blocked / 4xx" };
      default:
        return { cls: "bg-slate-50 text-slate-600 border-slate-200", label: domainProbe.status };
    }
  })();

  const deadOrParked =
    domainProbe && (domainProbe.status === "unreachable" || domainProbe.status === "parked");

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5 mb-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{brand.name}</h2>
            {brand.fuzeRelevance && (
              <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${relColor}`}>
                relevance: {rel}
              </span>
            )}
            {brand.validationStatus && (
              <span className="text-[11px] rounded-full px-2 py-0.5 bg-sky-50 text-sky-700">
                {brand.validationStatus}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            {brand.website && (
              <span className="inline-flex items-center gap-1.5">
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`hover:text-sky-600 ${deadOrParked ? "line-through text-red-600" : ""}`}
                >
                  {brand.website.replace(/^https?:\/\//, "")}
                </a>
                {probing && !statusBadge && (
                  <span className="text-[10px] text-slate-400">checking…</span>
                )}
                {statusBadge && (
                  <span
                    className={`text-[10px] rounded-full px-1.5 py-0.5 border ${statusBadge.cls}`}
                    title={domainProbe?.message || ""}
                  >
                    {statusBadge.label}
                    {domainProbe?.httpStatus ? ` · ${domainProbe.httpStatus}` : ""}
                  </span>
                )}
                <button
                  onClick={retestDomain}
                  disabled={probing}
                  className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-50"
                  title="Re-check this domain now"
                >
                  ↻
                </button>
              </span>
            )}
            {brand.linkedInProfile && (
              <a
                href={brand.linkedInProfile}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-600"
              >
                LinkedIn
              </a>
            )}
            {brand.textileCategory && <span>{brand.textileCategory}</span>}
          </div>
        </div>
        <Link
          href={`/brands/${brand.id}`}
          className="text-xs text-sky-600 hover:text-sky-700 hover:underline"
        >
          Open full brand page →
        </Link>
      </div>

      {deadOrParked && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800 flex items-start gap-2">
          <div className="text-base leading-none">⚠️</div>
          <div className="flex-1">
            <div className="font-semibold">
              {domainProbe.status === "parked"
                ? "This domain looks parked / for-sale."
                : "This domain is dead."}
            </div>
            <div className="mt-0.5 text-red-700">
              {domainProbe.message} Every contact email enriched from this domain is almost
              certainly going to bounce. Best move: bounce the whole brand — we'll mark those emails
              invalid, release the brand from your queue, and pull up the next one.
            </div>
            {onBounce && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    const ok = window.confirm(
                      `Bounce "${brand.name}"?\n\n` +
                        `This will mark the brand dead, invalidate every contact email on ${domainProbe.hostname || "this domain"}, and skip to the next brand.\n\n` +
                        `(You can always reopen it from /admin/brand-pipeline if this was wrong.)`,
                    );
                    if (ok) void onBounce(domainProbe.message || "");
                  }}
                  disabled={bouncing}
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {bouncing ? "Bouncing…" : "Bounce this brand →"}
                </button>
                <span className="text-[10px] text-red-600/80">
                  Invalidates contact emails on {domainProbe.hostname || "dead domain"} · skips to
                  next
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {brand.backgroundInfo && (
        <p className="text-sm text-slate-600 mt-3 leading-relaxed">
          {brand.backgroundInfo.slice(0, 400)}
          {brand.backgroundInfo.length > 400 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

function Stepper({ currentStep }: { currentStep: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "pick", label: "Brand" },
    { key: "contact", label: "Contact" },
    { key: "customize", label: "Customize" },
    { key: "draft", label: "Draft" },
    { key: "sent", label: "Send" },
  ];
  const idx = steps.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-2 mb-5">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
              i < idx
                ? "bg-emerald-500 text-white"
                : i === idx
                  ? "bg-sky-600 text-white"
                  : "bg-slate-200 text-slate-500"
            }`}
          >
            {i < idx ? "✓" : i + 1}
          </div>
          <div
            className={`text-xs ${i === idx ? "font-semibold text-slate-800" : "text-slate-500"}`}
          >
            {s.label}
          </div>
          {i < steps.length - 1 && <div className="w-6 h-px bg-slate-300 mx-1" />}
        </div>
      ))}
    </div>
  );
}

function PickStep({
  brand,
  enriching,
  onEnrich,
  onAdvance,
}: {
  brand: WizardBrand;
  enriching: boolean;
  onEnrich: () => void;
  onAdvance: () => void;
}) {
  const hasResearch = Boolean(brand.researchData);
  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
        Step 1 — Confirm brand
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatTile label="Contacts" value={brand.contacts.length} />
        <StatTile label="With Email" value={brand.contacts.filter((c) => c.email).length} />
        <StatTile
          label="Research"
          value={hasResearch ? "Cached" : "Missing"}
          muted={!hasResearch}
        />
      </div>

      {!hasResearch && (
        <div className="mt-4 bg-sky-50 border border-sky-200 rounded-lg p-4 text-sm text-sky-800">
          This brand hasn't been enriched yet. Running multi-AI research now gives the wizard real
          intel to personalize off of.
          <div className="mt-3">
            <button
              onClick={onEnrich}
              disabled={enriching}
              className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {enriching ? "Enriching…" : "Run multi-AI enrichment"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={onAdvance}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          Pick contact →
        </button>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  muted,
}: {
  label: string;
  value: number | string;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 text-center border ${
        muted ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200"
      }`}
    >
      <div className={`text-2xl font-bold ${muted ? "text-slate-400" : "text-slate-900"}`}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function ContactStep({
  brand,
  selectedContactId,
  onSelect,
  channel,
  onChannelChange,
  channelAutoSwitched,
  tone,
  onToneChange,
  onBack,
  onNext,
}: {
  brand: WizardBrand;
  selectedContactId: string | null;
  onSelect: (id: string) => void;
  channel: "email" | "linkedin";
  onChannelChange: (c: "email" | "linkedin") => void;
  channelAutoSwitched: boolean;
  tone: "direct" | "warm" | "curious";
  onToneChange: (t: "direct" | "warm" | "curious") => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const selected = brand.contacts.find((c) => c.id === selectedContactId);
  const canContinue =
    selected &&
    (channel === "email" ? !!selected.email : !!selected.linkedinUrl || !!selected.name);

  // Split the contact list into real vs. hidden-placeholder. Active Line
  // Corp had 19 contacts where half were John/Jane/Sarah Doe templates —
  // we bucket those below the fold so the rep isn't scrolling through fake
  // people trying to find a real decision-maker.
  const { visible, hidden } = useMemo(() => partitionContacts(brand.contacts), [brand.contacts]);
  const [showHidden, setShowHidden] = useState(false);

  const renderContactRow = (
    c: WizardContact & { _quality?: ReturnType<typeof assessContact> },
    isHidden = false,
  ) => {
    const q = c._quality || assessContact(c as any);
    const isSelected = c.id === selectedContactId;
    const displayName = c.name || c.email || c.jobTitle || "(unnamed contact)";
    const badgeCls =
      q.verdict === "placeholder"
        ? "bg-red-100 text-red-700"
        : q.verdict === "suspicious"
          ? "bg-amber-100 text-amber-800"
          : q.verdict === "role_account"
            ? "bg-slate-100 text-slate-600"
            : null;
    const badgeLabel =
      q.verdict === "placeholder"
        ? "placeholder"
        : q.verdict === "suspicious"
          ? "suspicious"
          : q.verdict === "role_account"
            ? "role mailbox"
            : null;
    return (
      <button
        key={c.id}
        onClick={() => onSelect(c.id)}
        className={`w-full text-left rounded-xl border p-3 transition-all ${
          isSelected
            ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
            : isHidden
              ? "border-red-200 bg-red-50/40 hover:border-red-300"
              : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
        }`}
        title={q.reasons.length ? q.reasons.join(" · ") : undefined}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className={isHidden ? "line-through text-slate-400" : ""}>{displayName}</span>
              {badgeLabel && (
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${badgeCls}`}>
                  {badgeLabel}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {c.jobTitle || "—"}
              {c.seniority && <span className="ml-2">• {c.seniority}</span>}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
              {c.email && <span>✉ {c.email}</span>}
              {c.linkedinUrl && <span>in LinkedIn</span>}
              {c.outreachStatus && c.outreachStatus !== "not_contacted" && (
                <span className="text-amber-600">↻ {c.outreachStatus}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {c.emailStatus === "verified" && q.verdict !== "placeholder" && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                verified
              </span>
            )}
            <span className="text-[10px] text-slate-400">quality {q.score}</span>
          </div>
        </div>
        {isHidden && q.reasons.length > 0 && (
          <div className="mt-1 text-[10px] text-red-700">Flagged: {q.reasons[0]}</div>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4 flex items-center justify-between">
        <span>Step 2 — Pick contact + channel</span>
        {hidden.length > 0 && (
          <span className="text-[11px] font-normal text-slate-500 normal-case tracking-normal">
            {hidden.length} hidden as placeholders
          </span>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {brand.contacts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <div className="text-3xl mb-2">👻</div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              No contacts on this brand yet
            </div>
            <div className="text-xs text-slate-500 max-w-sm mx-auto mb-3">
              The wizard needs at least one contact to email. Add a contact on the brand page, or
              skip to the next brand in the queue.
            </div>
            <div className="flex gap-2 justify-center">
              <Link
                href={`/brands/${brand.id}`}
                className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700"
              >
                Open brand page
              </Link>
              <button
                onClick={onBack}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs hover:bg-white"
              >
                ← Back
              </button>
            </div>
          </div>
        ) : visible.length === 0 && hidden.length > 0 && !showHidden ? (
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center">
            <div className="text-3xl mb-2">🚩</div>
            <div className="text-sm font-semibold text-amber-800 mb-1">
              Every contact here looks like a placeholder
            </div>
            <div className="text-xs text-amber-700 max-w-sm mx-auto mb-3">
              {hidden.length} contacts — all flagged (John/Jane Doe, example emails, etc.). Run
              enrichment to pull real people, or view the hidden list anyway.
            </div>
            <button
              onClick={() => setShowHidden(true)}
              className="px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 text-xs hover:bg-amber-100"
            >
              Show hidden contacts
            </button>
          </div>
        ) : (
          <>
            {visible.map((c) => renderContactRow(c, false))}
            {hidden.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => setShowHidden((v) => !v)}
                  className="text-[11px] text-slate-500 hover:text-slate-700 underline"
                >
                  {showHidden ? "Hide" : "Show"} {hidden.length} flagged placeholder
                  {hidden.length > 1 ? "s" : ""}
                </button>
                {showHidden && (
                  <div className="mt-2 space-y-2">
                    {hidden.map((c) => renderContactRow(c, true))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">Channel</div>
            <div className="flex gap-2">
              {(["email", "linkedin"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => onChannelChange(c)}
                  disabled={c === "email" && !selected.email}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all ${
                    channel === c
                      ? "border-sky-600 bg-sky-50 text-sky-800 font-semibold"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {c === "email" ? "Email" : "LinkedIn"}
                </button>
              ))}
            </div>
            {channel === "email" && !selected.email && (
              <div className="text-[11px] text-red-600 mt-1">
                This contact has no email. Choose LinkedIn or pick another contact.
              </div>
            )}
            {/* Bug B fix (Scott ticket cmot3i3pk, May 2026): auto-switch
                banner — explains why the channel flipped to LinkedIn
                when the picked contact had no email. */}
            {channelAutoSwitched && channel === "linkedin" && selected && !selected.email && selected.linkedinUrl && (
              <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <strong>Switched to LinkedIn channel.</strong>{" "}
                {(selected.name || "This contact")} has no email on file —
                only a LinkedIn URL. Reach out via LI DM, or click{" "}
                <a
                  href={`/contacts/${selected.id}`}
                  className="underline hover:text-amber-950"
                >
                  open the contact
                </a>{" "}
                to add an email address and switch back to email.
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">Tone</div>
            <div className="flex gap-2">
              {(["direct", "warm", "curious"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onToneChange(t)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm capitalize transition-all ${
                    tone === t
                      ? "border-sky-600 bg-sky-50 text-sky-800 font-semibold"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
        >
          Customize →
        </button>
      </div>
    </div>
  );
}

function CustomizeStep({
  qA1,
  qA2,
  qA3,
  onQA1Change,
  onQA2Change,
  onQA3Change,
  drafting,
  onBack,
  onGenerate,
}: {
  qA1: string;
  qA2: string;
  qA3: string;
  onQA1Change: (s: string) => void;
  onQA2Change: (s: string) => void;
  onQA3Change: (s: string) => void;
  drafting: boolean;
  onBack: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
        Step 3 — Personalize
      </div>
      <p className="text-xs text-slate-500 mb-5">
        Three short questions. Whatever you type here goes into the draft directly, so the outbound
        reads like you wrote it. Skip any that don't apply, but the more you give the more personal
        it lands.
      </p>

      <div className="space-y-4">
        <QField
          label="What caught your attention about this brand?"
          hint="One line. Anything you saw that's specific — a product, a recent move, a LinkedIn post."
          value={qA1}
          onChange={onQA1Change}
        />
        <QField
          label="What specific problem do you think FUZE solves for them?"
          hint="Tie it to their category. Antimicrobial for athletic wear reads differently than for hospital linens."
          value={qA2}
          onChange={onQA2Change}
        />
        <QField
          label="Anything personal or recent about this contact?"
          hint="Optional. A post they wrote, a mutual connection, a conference, a prior role. Skip if nothing."
          value={qA3}
          onChange={onQA3Change}
        />
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
        >
          ← Back
        </button>
        <button
          onClick={onGenerate}
          disabled={drafting}
          className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
        >
          {drafting ? "Drafting…" : "Generate draft →"}
        </button>
      </div>
    </div>
  );
}

function QField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-800">{label}</label>
      <p className="text-[11px] text-slate-500 mt-0.5 mb-2">{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
    </div>
  );
}

function DraftStep({
  channel,
  subject,
  bodyText,
  diagnosed,
  draftMeta,
  contact,
  brand,
  sending,
  drafting,
  onSubjectChange,
  onBodyChange,
  attachments,
  onAttachmentsChange,
  onBack,
  onRegenerate,
  onSend,
}: {
  channel: "email" | "linkedin";
  subject: string;
  bodyText: string;
  diagnosed: string[];
  draftMeta: null | {
    provider?: string;
    research?: { hadPriorResearch?: boolean; autoResearched?: boolean; hasIntel?: boolean };
    answerCoverage?: { total?: number; referenced?: number; ratio?: number; underused?: boolean };
  };
  contact: WizardContact;
  brand: WizardBrand | null;
  sending: boolean;
  drafting: boolean;
  onSubjectChange: (s: string) => void;
  onBodyChange: (s: string) => void;
  attachments: File[];
  onAttachmentsChange: (next: File[]) => void;
  onBack: () => void;
  onRegenerate: () => void;
  onSend: () => void;
}) {
  // Helper for the attachment picker — enforces the same 25 MB total
  // cap that the server enforces, so the rep gets immediate feedback.
  const [attachErr, setAttachErr] = useState<string>("");
  function addAttachments(files: FileList | File[]) {
    const incoming = Array.from(files).filter((f) => f && f.size > 0);
    const next = [...attachments, ...incoming];
    const total = next.reduce((s, f) => s + f.size, 0);
    if (total > 25 * 1024 * 1024) {
      setAttachErr("Attachments exceed 25 MB total — Resend won't accept them.");
      return;
    }
    setAttachErr("");
    onAttachmentsChange(next);
  }
  // Build the substitution context once per render — split contact.name into
  // first/last so {firstName} works for older Contact rows that only have the
  // single `name` field populated.
  const contactName = contact.name || "";
  const firstName = (contact as any).firstName || contactName.split(" ")[0] || "";
  const lastName = (contact as any).lastName || contactName.split(" ").slice(1).join(" ") || "";
  const tplVars = {
    firstName,
    lastName,
    fullName: contactName,
    title: contact.jobTitle,
    email: contact.email,
    company: brand?.name || null,
  };

  // ── Compliance preflight (#96) ──
  // Fetch a send-readiness report whenever the contact or channel changes.
  // If anything is BLOCK severity (no RESEND key, no outbound From, bad
  // recipient, placeholder contact) the Send button is disabled and the
  // issues render at the top with an actionable "Fix" callout.
  const [preflight, setPreflight] = useState<null | {
    ready: boolean;
    issues: Array<{
      severity: "block" | "warn" | "info";
      code: string;
      title: string;
      fix: string;
      docsPath?: string;
    }>;
    config: any;
  }>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setPreflightLoading(true);
      try {
        const r = await fetch(
          `/api/admin/bd/wizard/preflight?contactId=${encodeURIComponent(contact.id)}&channel=${channel}`,
          { cache: "no-store" },
        );
        const data = await r.json();
        if (!cancelled && data?.ok) setPreflight(data);
      } catch {
        // Swallow — preflight is advisory. The send route will still block.
      } finally {
        if (!cancelled) setPreflightLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [contact.id, channel]);
  const hasBlockingIssue = Boolean(preflight && !preflight.ready);

  // ── BD Wizard quick-pick slots (#100) ──
  // Load the current user's numbered 1-10 template slots once per mount
  // so the rep can one-click-inject a favourite opener into this draft.
  // Fire-and-forget — if the endpoint errors, the strip just doesn't
  // render and the rep can keep using the regular Templates dropdown.
  const [bdSlots, setBdSlots] = useState<
    Array<{
      slot: number;
      template: { id: string; title: string; subject: string; body: string } | null;
    }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/email-templates/bd-slots", { cache: "no-store" });
        const data = await r.json();
        if (!cancelled && data?.ok) setBdSlots(data.slots || []);
      } catch {
        // Non-blocking — silent.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const hasAnySlot = bdSlots.some((s) => s.template);

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Step 4 — Review & send
        </div>
        <div className="flex items-center gap-3">
          {/* Template picker — Viktor 4/17 (#24). Inserts a saved template
             into subject+body with {firstName}/{company} substitution. */}
          <EmailTemplatePicker
            contextVars={tplVars}
            onApply={({ subject: s, body: b }) => {
              if (channel === "email" && s) onSubjectChange(s);
              if (b) onBodyChange(b);
            }}
          />
          <div className="text-[11px] text-slate-500">
            → {contact.name || contact.email}
            {channel === "email" && contact.email ? ` <${contact.email}>` : ""}
          </div>
        </div>
      </div>

      {/* BD Wizard quick-pick 1-10 strip (#100). Only renders when the rep
         has assigned at least one template to a numbered slot (manage in
         Settings → Email Templates). Clicking a button runs the template
         through the same {firstName}/{company} substitution the EmailTemplatePicker
         uses, and overwrites the subject + body inputs. Empty slots render
         as faded disabled buttons so the keyboard-muscle-memory layout is
         stable even when a slot isn't filled. */}
      {hasAnySlot && channel === "email" && (
        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">
              Your quick-pick templates
            </div>
            <Link
              href="/settings/email-templates"
              className="text-[11px] text-sky-700 hover:underline"
            >
              Manage slots →
            </Link>
          </div>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-1.5">
            {bdSlots.map(({ slot, template }) => {
              const disabled = !template;
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!template) return;
                    const rendered = renderTemplate(
                      { subject: template.subject, body: template.body },
                      tplVars as any,
                    );
                    if (rendered.subject) onSubjectChange(rendered.subject);
                    if (rendered.body) onBodyChange(rendered.body);
                    // Fire-and-forget usage tracking — mirror the
                    // EmailTemplatePicker behaviour so "most-used first"
                    // stays accurate.
                    fetch(`/api/email-templates/${template.id}/use`, {
                      method: "POST",
                    }).catch(() => undefined);
                  }}
                  title={
                    template
                      ? `${template.title}\n${template.subject}`
                      : "Empty slot — assign one in Settings → Email Templates"
                  }
                  className={`rounded-md border px-2 py-1.5 text-[11px] font-medium leading-tight transition ${
                    disabled
                      ? "bg-white/60 border-dashed border-slate-300 text-slate-400 cursor-not-allowed"
                      : "bg-white border-sky-300 text-slate-800 hover:bg-sky-100 hover:border-sky-400"
                  }`}
                >
                  <span className="block text-[10px] font-bold text-sky-700">{slot}</span>
                  <span className="block truncate">{template ? template.title : "empty"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Draft provenance banner — tells the rep which engine produced this
         draft, whether we auto-researched the brand, and whether the AI
         actually incorporated all the Step-3 seed answers. If coverage is
         underused, nudge them to regenerate. */}
      {draftMeta && (
        <div className="mb-4 space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {draftMeta.provider === "fallback" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                template fallback (no AI keys)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-900 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                drafted by {draftMeta.provider || "ai"}
              </span>
            )}
            {draftMeta.research?.autoResearched && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-900 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                auto-researched just now
              </span>
            )}
            {!draftMeta.research?.hasIntel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">
                no brand intel (draft is generic)
              </span>
            )}
            {draftMeta.answerCoverage && draftMeta.answerCoverage.total! > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                  draftMeta.answerCoverage.underused
                    ? "bg-rose-100 text-rose-900"
                    : "bg-emerald-100 text-emerald-900"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    draftMeta.answerCoverage.underused ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                />
                used {draftMeta.answerCoverage.referenced} of {draftMeta.answerCoverage.total}{" "}
                prompt answers
              </span>
            )}
          </div>
          {draftMeta.answerCoverage?.underused && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-rose-900">
              <span className="font-semibold">Heads up:</span> the draft didn&apos;t visibly
              incorporate every prompt answer you filled in. Click{" "}
              <button
                type="button"
                onClick={onRegenerate}
                disabled={drafting}
                className="underline font-medium disabled:opacity-60"
              >
                Regenerate
              </button>{" "}
              to try again, or edit the body directly to add the missing angle.
            </div>
          )}
        </div>
      )}

      {diagnosed.length > 0 && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
          <span className="font-semibold">We cleaned up:</span> {diagnosed.join(", ")}. Review the
          result below — edit freely.
        </div>
      )}

      {/* ── Preflight / compliance panel (#96) ──
         Renders the backend's send-readiness report. "block" issues
         stop the Send button; "warn" issues show as yellow advisories.
         Each issue carries a plain-language `fix` and, when relevant,
         a docsPath link so the rep can go resolve it in one click. */}
      {preflightLoading && !preflight && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Checking send readiness…
        </div>
      )}
      {preflight && preflight.issues.length > 0 && (
        <div className="mb-4 space-y-2">
          {preflight.issues.map((iss) => {
            const isBlock = iss.severity === "block";
            return (
              <div
                key={iss.code}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  isBlock
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">{isBlock ? "⛔" : "⚠️"}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{iss.title}</div>
                    <div className="mt-0.5 opacity-90">{iss.fix}</div>
                    {iss.docsPath && (
                      <Link
                        href={iss.docsPath}
                        className={`inline-block mt-1.5 underline font-medium ${
                          isBlock ? "text-rose-900" : "text-amber-900"
                        }`}
                      >
                        Open {iss.docsPath} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {preflight && preflight.ready && preflight.issues.length === 0 && channel === "email" && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <span className="font-semibold">✓ Ready to send.</span>
          {preflight.config?.outboundFromEmail ? (
            <>
              {" "}
              From <span className="font-mono">{preflight.config.outboundFromEmail}</span>
              {preflight.config?.dmarc === true && preflight.config?.spf === true
                ? " · SPF + DMARC verified"
                : ""}
            </>
          ) : null}
        </div>
      )}

      {channel === "email" && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>
      )}

      <label className="block text-xs font-medium text-slate-600 mb-1">
        {channel === "email" ? "Message body" : "LinkedIn DM text"}
      </label>
      {/*
        Typewriter/monospace font was rendering the draft looking nothing
        like what the recipient would actually see. Use the native email
        stack (same one major clients pick when you set no font) so the
        rep is previewing the real thing. Line-height + leading-relaxed
        matches Gmail/Outlook default rendering.
      */}
      <textarea
        value={bodyText}
        onChange={(e) => onBodyChange(e.target.value)}
        rows={14}
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
      <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
        <span>{bodyText.length} chars</span>
        {channel === "linkedin" && bodyText.length > 600 && (
          <span className="text-amber-600">LinkedIn may truncate past 600 chars.</span>
        )}
      </div>

      {/* Attachments — email channel only. LinkedIn DM API doesn't
          support file attachments. Drag/drop or click to add files;
          25 MB total cap. */}
      {channel === "email" && (
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Attachments
          </label>
          <div
            className="border-2 border-dashed border-slate-300 rounded-lg px-3 py-3 text-center cursor-pointer hover:border-emerald-400 transition-colors"
            onClick={() => document.getElementById("bd-wizard-attach-input")?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("border-emerald-400", "bg-emerald-50/40");
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50/40");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50/40");
              if (e.dataTransfer.files?.length) addAttachments(e.dataTransfer.files);
            }}
          >
            <span className="text-xs text-slate-500">
              Drop files or click to attach (PDF, DOCX, images — 25 MB total)
            </span>
          </div>
          <input
            id="bd-wizard-attach-input"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addAttachments(e.target.files);
              e.target.value = "";
            }}
          />
          {attachErr && (
            <div className="mt-1 text-xs text-red-600">{attachErr}</div>
          )}
          {attachments.length > 0 && (
            <ul className="mt-2 space-y-1">
              {attachments.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1"
                >
                  <span className="truncate text-slate-700">
                    📎 {file.name}{" "}
                    <span className="text-slate-400">
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onAttachmentsChange(attachments.filter((_, j) => j !== i))
                    }
                    className="ml-2 text-slate-400 hover:text-red-600"
                    aria-label={`Remove ${file.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
          >
            ↻ Regenerate
          </button>
          <button
            onClick={() => onSend()}
            disabled={
              sending ||
              !bodyText.trim() ||
              (channel === "email" && !subject.trim()) ||
              hasBlockingIssue
            }
            title={hasBlockingIssue ? "Resolve the setup issues above before sending." : undefined}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending
              ? "Sending…"
              : hasBlockingIssue
                ? "Fix setup to send"
                : channel === "email"
                  ? "Send email"
                  : "Log LinkedIn DM"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SentStep({
  brand,
  contact,
  sendResult,
  onNext,
}: {
  brand: WizardBrand;
  contact: WizardContact;
  sendResult: any;
  onNext: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
      <div className="text-5xl mb-3">✅</div>
      <div className="text-lg font-semibold text-slate-900">
        {sendResult?.channel === "email" ? "Email sent" : "LinkedIn DM logged"}
      </div>
      <div className="text-sm text-slate-500 mt-1">
        to {contact.name || contact.email} at{" "}
        <Link href={`/brands/${brand.id}`} className="text-sky-600 hover:underline">
          {brand.name}
        </Link>
      </div>
      {sendResult?.autoAssignedToRep && (
        <div className="mt-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg inline-block px-3 py-1.5">
          Auto-assigned to you as account owner.
        </div>
      )}
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href={`/brands/${brand.id}`}
          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
        >
          View brand page
        </Link>
        <button
          onClick={onNext}
          className="px-5 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700"
        >
          Next brand →
        </button>
      </div>
    </div>
  );
}
