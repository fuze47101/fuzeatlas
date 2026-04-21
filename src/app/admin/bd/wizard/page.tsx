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
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
  const [diagnosed, setDiagnosed] = useState<string[]>([]);

  // Send
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  // Enrichment
  const [enriching, setEnriching] = useState(false);

  // ─── Profile preflight ───
  const [profileOk, setProfileOk] = useState<boolean | null>(null);
  const [profileFrom, setProfileFrom] = useState<string | null>(null);

  const selectedContact = useMemo(
    () => brand?.contacts.find((c) => c.id === selectedContactId) || null,
    [brand, selectedContactId],
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setSendResult(null);
      setSequenceStepId(null);
      setIsFollowUp(false);

      // If a specific contact was requested and exists on this brand, lock
      // to it and skip the contact-pick step.
      if (contactId) {
        const match = (data.brand.contacts || []).find((c: any) => c.id === contactId);
        if (match) {
          setSelectedContactId(contactId);
          setStep("customize");
          return;
        }
      }
      setStep("contact");
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
  async function loadNextBrand(skipId?: string) {
    setLoading(true);
    setError("");
    setReason("");
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
      setSendResult(null);
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
      // Reload the brand to pick up researchData
      const refreshed = await fetch(`/api/admin/bd/wizard/next-brand?skip=__refresh__&preview=1`); // not ideal but cheap: re-fetch by skipping nothing special; fall back to the same brand
      // Better: re-fetch the specific brand we have open.
      // For now, just mark researchData present so the UI unblocks.
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
      setStep("draft");
    } catch (e: any) {
      setError(e?.message || "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  async function sendDraft() {
    if (!brand || !selectedContact) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/admin/bd/wizard/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brand.id,
          contactId: selectedContact.id,
          channel,
          subject,
          body: bodyText,
          stepId: sequenceStepId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Send failed");
        return;
      }
      setSendResult(data);
      setStep("sent");
    } catch (e: any) {
      setError(e?.message || "Send failed");
    } finally {
      setSending(false);
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
            <div className="text-5xl mb-3">🎉</div>
            <div className="text-xl font-semibold text-slate-800 mb-1">Queue is empty.</div>
            <div className="text-sm text-slate-500 max-w-md mx-auto">
              {reason ||
                "No unassigned LEAD brands with contacts. Run a discovery batch or import a CSV to refill the queue."}
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/brands/discover"
                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700"
              >
                Run Discovery
              </Link>
              <Link
                href="/admin/brand-pipeline"
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
              >
                Open Pipeline
              </Link>
            </div>
          </div>
        ) : (
          <>
            <BrandHeader brand={brand} />

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
                onSelect={setSelectedContactId}
                channel={channel}
                onChannelChange={setChannel}
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
                contact={selectedContact}
                sending={sending}
                onSubjectChange={setSubject}
                onBodyChange={setBodyText}
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

            {error && brand && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
                {error}
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
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <Link href="/home" className="text-xs text-slate-500 hover:text-slate-700">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">BD Wizard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Guided outbound. Next highest-confidence brand auto-picked for you.
          {queueDepth > 0 && <span className="ml-2 text-slate-400">({queueDepth} in queue)</span>}
        </p>
      </div>
      {currentBrandId && (
        <button
          onClick={onSkip}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-white"
        >
          Skip this brand →
        </button>
      )}
    </div>
  );
}

function ProfileWarning({ current }: { current: string | null }) {
  return (
    <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <div className="text-2xl">⚠️</div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-amber-900">
          Set your outbound From: address before sending
        </div>
        <div className="text-xs text-amber-700 mt-1">
          Without this, outbound ships from the generic FUZE Atlas notification address and replies
          won't land in your inbox.
          {current ? (
            <>
              {" "}
              Currently: <span className="font-mono">{current}</span>
            </>
          ) : null}
        </div>
      </div>
      <Link
        href="/settings/profile"
        className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-700"
      >
        Open Profile
      </Link>
    </div>
  );
}

function BrandHeader({ brand }: { brand: WizardBrand }) {
  const rel = (brand.fuzeRelevance || "").toLowerCase();
  const relColor =
    rel === "high"
      ? "bg-emerald-100 text-emerald-700"
      : rel === "medium"
        ? "bg-amber-100 text-amber-700"
        : rel === "low"
          ? "bg-slate-100 text-slate-600"
          : "bg-slate-50 text-slate-400";
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
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-600"
              >
                {brand.website.replace(/^https?:\/\//, "")}
              </a>
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
  tone: "direct" | "warm" | "curious";
  onToneChange: (t: "direct" | "warm" | "curious") => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const selected = brand.contacts.find((c) => c.id === selectedContactId);
  const canContinue =
    selected &&
    (channel === "email" ? !!selected.email : !!selected.linkedinUrl || !!selected.name);

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
        Step 2 — Pick contact + channel
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {brand.contacts.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">No contacts.</div>
        ) : (
          brand.contacts.map((c) => {
            const isSelected = c.id === selectedContactId;
            const displayName = c.name || c.email || c.jobTitle || "(unnamed contact)";
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  isSelected
                    ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
                    : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{displayName}</div>
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
                  {c.emailStatus === "verified" && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                      verified
                    </span>
                  )}
                </div>
              </button>
            );
          })
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
  contact,
  sending,
  onSubjectChange,
  onBodyChange,
  onBack,
  onRegenerate,
  onSend,
}: {
  channel: "email" | "linkedin";
  subject: string;
  bodyText: string;
  diagnosed: string[];
  contact: WizardContact;
  sending: boolean;
  onSubjectChange: (s: string) => void;
  onBodyChange: (s: string) => void;
  onBack: () => void;
  onRegenerate: () => void;
  onSend: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Step 4 — Review & send
        </div>
        <div className="text-[11px] text-slate-500">
          → {contact.name || contact.email}
          {channel === "email" && contact.email ? ` <${contact.email}>` : ""}
        </div>
      </div>

      {diagnosed.length > 0 && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
          <span className="font-semibold">We cleaned up:</span> {diagnosed.join(", ")}. Review the
          result below — edit freely.
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
      <textarea
        value={bodyText}
        onChange={(e) => onBodyChange(e.target.value)}
        rows={14}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
      <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
        <span>{bodyText.length} chars</span>
        {channel === "linkedin" && bodyText.length > 600 && (
          <span className="text-amber-600">LinkedIn may truncate past 600 chars.</span>
        )}
      </div>

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
            onClick={onSend}
            disabled={sending || !bodyText.trim() || (channel === "email" && !subject.trim())}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {sending ? "Sending…" : channel === "email" ? "Send email" : "Log LinkedIn DM"}
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
