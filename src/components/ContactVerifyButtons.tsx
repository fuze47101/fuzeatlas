// @ts-nocheck
"use client";

/**
 * ContactVerifyButtons — shared 3-button row that lives on the contact
 * detail page AND inside each card on the brand Contacts tab.
 *
 * Buttons: Fresh Research / Confirm Email / Confirm LinkedIn.
 * Each fires the matching /api/contacts/[id]/* endpoint, shows a spinner
 * while running, then renders a colored result chip. Last-verified
 * timestamps come from contact.raw.{emailVerifiedAt, linkedinCheckedAt}.
 *
 * onMutated() lets the parent splice the updated fields into its local
 * state without a full refetch. Per the standing diagnostic rule, every
 * handler logs [CLICK] / [FETCH-RESULT] and writes window.__lastClickResult.
 */
import { useEffect, useState } from "react";

type ContactLike = {
  id: string;
  email?: string | null;
  linkedinUrl?: string | null;
  emailValidity?: string | null;
  linkedinValidity?: string | null;
  raw?: any;
};

type Updates = {
  emailValidity?: string | null;
  emailStatus?: string | null;
  linkedinValidity?: string | null;
  raw?: any;
  email?: string | null;
  linkedinUrl?: string | null;
};

export default function ContactVerifyButtons({
  contact,
  variant = "card",
  onMutated,
}: {
  contact: ContactLike;
  variant?: "card" | "page";
  onMutated?: (u: Updates) => void;
}) {
  const [running, setRunning] = useState<null | "research" | "email" | "linkedin">(null);
  const [results, setResults] = useState<{
    research?: { ok: boolean; summary?: string };
    email?: { validity: string; detail: string };
    linkedin?: { validity: string; detail: string };
  }>({});

  useEffect(() => {
    console.log(`[PAGE-MOUNT] ContactVerifyButtons contact=${contact.id} variant=${variant}`);
  }, [contact.id, variant]);

  async function fire(kind: "research" | "email" | "linkedin") {
    const route =
      kind === "research"
        ? "research"
        : kind === "email"
        ? "verify-email"
        : "verify-linkedin";
    console.log(`[CLICK] verify-${kind} contact=${contact.id}`);
    setRunning(kind);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({ ok: false, error: "bad-json" }));
      console.log(`[FETCH-RESULT] verify-${kind}`, j);
      if (typeof window !== "undefined") (window as any).__lastClickResult = j;

      if (!j.ok) {
        setResults((r) => ({
          ...r,
          [kind]:
            kind === "research"
              ? { ok: false, summary: j.error || "Apollo lookup failed" }
              : { validity: "unknown", detail: j.error || "Verification failed" },
        }));
        return;
      }

      if (kind === "research") {
        const ev = j.emailVerify || {};
        setResults((r) => ({
          ...r,
          research: {
            ok: true,
            summary:
              `Refreshed${j.summary?.emailWritten ? " · new email" : ""}` +
              `${j.summary?.linkedinWritten ? " · new LinkedIn" : ""}`,
          },
          // Research also re-verifies the email — surface that chip too.
          email: ev?.ok
            ? { validity: ev.emailValidity, detail: ev.detail || "" }
            : r.email,
        }));
        onMutated?.({
          email: undefined, // server determines; parent should reload if it cares
          emailValidity: ev?.emailValidity,
          emailStatus: ev?.emailStatus,
          raw: ev?.verifiedAt
            ? { ...(contact.raw || {}), emailVerifiedAt: ev.verifiedAt, lastResearchAt: j.researchedAt }
            : { ...(contact.raw || {}), lastResearchAt: j.researchedAt },
        });
      } else if (kind === "email") {
        setResults((r) => ({
          ...r,
          email: { validity: j.emailValidity, detail: j.detail || "" },
        }));
        onMutated?.({
          emailValidity: j.emailValidity,
          emailStatus: j.emailStatus,
          raw: { ...(contact.raw || {}), emailVerifiedAt: j.verifiedAt },
        });
      } else {
        setResults((r) => ({
          ...r,
          linkedin: {
            validity: j.linkedinValidity,
            detail: j.reason ? `HTTP ${j.httpStatus ?? "?"} · ${j.reason}` : "",
          },
        }));
        onMutated?.({
          linkedinValidity: j.linkedinValidity,
          raw: { ...(contact.raw || {}), linkedinCheckedAt: j.checkedAt },
        });
      }
    } catch (e: any) {
      console.log(`[FETCH-RESULT] verify-${kind} error`, e?.message);
      setResults((r) => ({
        ...r,
        [kind]:
          kind === "research"
            ? { ok: false, summary: e?.message || "network error" }
            : { validity: "unknown", detail: e?.message || "network error" },
      }));
    } finally {
      setRunning(null);
    }
  }

  const isPage = variant === "page";
  const btnBase = isPage
    ? "px-3 py-2 text-sm rounded-lg font-semibold"
    : "px-2 py-1 text-[11px] rounded font-semibold";
  const chipBase = isPage
    ? "text-[11px] px-2 py-0.5 rounded-full font-medium"
    : "text-[10px] px-1.5 py-0.5 rounded font-medium";

  const emailFromRaw = contact.raw?.emailVerifiedAt
    ? fmtAgo(contact.raw.emailVerifiedAt)
    : null;
  const liFromRaw = contact.raw?.linkedinCheckedAt
    ? fmtAgo(contact.raw.linkedinCheckedAt)
    : null;

  return (
    <div className={isPage ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-1.5"}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); fire("research"); }}
        disabled={running !== null}
        className={`${btnBase} bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Re-pull this contact from Apollo using name + entity domain"
      >
        {running === "research" ? "Researching…" : "🔄 Fresh Research"}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); fire("email"); }}
        disabled={running !== null || !contact.email}
        className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed`}
        title={contact.email ? `MX-check ${contact.email}` : "No email to verify"}
      >
        {running === "email" ? "Checking…" : "✅ Confirm Email"}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); fire("linkedin"); }}
        disabled={running !== null || !contact.linkedinUrl}
        className={`${btnBase} bg-sky-600 text-white hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed`}
        title={contact.linkedinUrl ? "HEAD-fetch the LinkedIn URL" : "No LinkedIn URL to verify"}
      >
        {running === "linkedin" ? "Checking…" : "🔗 Confirm LinkedIn"}
      </button>

      {/* Result chips — live state from this session's runs */}
      {results.email && (
        <span className={`${chipBase} ${emailChip(results.email.validity)}`}
              title={results.email.detail}>
          {emailChipLabel(results.email.validity)}
        </span>
      )}
      {results.linkedin && (
        <span className={`${chipBase} ${linkedinChip(results.linkedin.validity)}`}
              title={results.linkedin.detail}>
          {linkedinChipLabel(results.linkedin.validity)}
        </span>
      )}
      {results.research && (
        <span className={`${chipBase} ${results.research.ok ? "bg-indigo-100 text-indigo-700" : "bg-red-100 text-red-700"}`}
              title={results.research.summary || ""}>
          {results.research.ok ? "Refreshed" : "Research failed"}
        </span>
      )}

      {/* Last-verified-at — pulled from contact.raw, not from this session's chips */}
      {(emailFromRaw || liFromRaw) && (
        <span className="text-[10px] text-slate-400 ml-1">
          {emailFromRaw && <>email {emailFromRaw}</>}
          {emailFromRaw && liFromRaw && " · "}
          {liFromRaw && <>linkedin {liFromRaw}</>}
        </span>
      )}
    </div>
  );
}

function emailChip(v: string): string {
  if (v === "valid") return "bg-emerald-100 text-emerald-700";
  if (v === "invalid") return "bg-red-100 text-red-700";
  if (v === "risky") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-600";
}
function emailChipLabel(v: string): string {
  if (v === "valid") return "Deliverable";
  if (v === "invalid") return "Bounces — bad address";
  if (v === "risky") return "Risky";
  return "Unknown";
}
function linkedinChip(v: string): string {
  if (v === "valid") return "bg-emerald-100 text-emerald-700";
  if (v === "invalid") return "bg-red-100 text-red-700";
  return "bg-slate-200 text-slate-600";
}
function linkedinChipLabel(v: string): string {
  if (v === "valid") return "Resolves";
  if (v === "invalid") return "Not found";
  return "Unknown";
}
function fmtAgo(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    if (!t) return "";
    const ms = Date.now() - t;
    const m = Math.floor(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch {
    return "";
  }
}
