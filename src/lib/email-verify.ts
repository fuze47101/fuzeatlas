// @ts-nocheck
import dns from "node:dns/promises";

/**
 * Email-deliverability gate (BUG 2 — Barth 2026-06-05).
 *
 * Barth imported a contact list whose emails all bounced. The import
 * paths and AI enrichment paths accepted any string that matched the
 * basic format regex — no MX check, no Apollo-status propagation —
 * so the contacts surfaced as "ready to email" and outreach to them
 * silently bounced.
 *
 * This helper has two layers:
 *
 *  1. SYNCHRONOUS classify() — fast format + obvious-junk filter.
 *     Returns one of: "invalid" | "risky" | "unknown" without doing
 *     network I/O. Suitable for inline use inside POST handlers.
 *
 *  2. ASYNCHRONOUS verifyDeliverable() — runs an MX lookup on the
 *     domain (no SMTP RCPT — that has its own anti-abuse landmines
 *     and most providers throttle it from cloud egress IPs). Returns
 *     a richer { status, validity, reason } so we can stamp the
 *     Contact's emailStatus + emailValidity columns with a real
 *     signal.
 *
 * Also exposes mergeApolloStatus() — when an enrichment source
 * already gave us an `email_status` (e.g. Apollo's
 * verified/unavailable/extrapolated), prefer that signal because it
 * reflects the upstream provider's own verification work.
 */

const FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Domains we never trust as sendable contact emails — generic role
// inboxes and obvious junk catches.
const ROLE_LOCALS = new Set([
  "info", "sales", "marketing", "support", "hello", "contact",
  "admin", "office", "team", "noreply", "no-reply", "donotreply",
  "billing", "press", "media", "general", "feedback",
]);

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com",
  "yopmail.com", "trashmail.com", "throwaway.email", "fakeinbox.com",
  "sharklasers.com", "getairmail.com", "mailcatch.com",
]);

export type EmailClassification = {
  status: "verified" | "unverified" | "risky" | "invalid";
  validity: "valid" | "invalid" | "risky" | "unknown";
  reason: string;
};

/**
 * Sync-only classifier — no network. Returns a coarse signal that
 * import paths can stamp immediately without slowing down a bulk
 * write loop.
 */
export function classify(email?: string | null): EmailClassification {
  if (!email || typeof email !== "string") {
    return { status: "invalid", validity: "invalid", reason: "missing" };
  }
  const trimmed = email.trim().toLowerCase();
  if (!FORMAT_RE.test(trimmed)) {
    return { status: "invalid", validity: "invalid", reason: "bad-format" };
  }
  const [local, domain] = trimmed.split("@");
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { status: "invalid", validity: "invalid", reason: "disposable-domain" };
  }
  if (ROLE_LOCALS.has(local)) {
    return { status: "risky", validity: "risky", reason: "role-address" };
  }
  return { status: "unverified", validity: "unknown", reason: "pending-mx-check" };
}

/**
 * Async verifier — runs an MX record lookup on the domain. Returns
 * "verified" only when at least one MX record resolves; "invalid"
 * when DNS says no MX (no inbound mail accepted).
 *
 * Does NOT do SMTP RCPT (false negatives + abuse signal from cloud
 * IPs). Combine with provider verification (Apollo email_status,
 * Hubspot deliverability hints, etc) via mergeApolloStatus().
 */
export async function verifyDeliverable(
  email?: string | null,
): Promise<EmailClassification> {
  const initial = classify(email);
  if (initial.status === "invalid") return initial;
  const domain = email!.trim().toLowerCase().split("@")[1];
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return { status: "invalid", validity: "invalid", reason: "no-mx" };
    }
    // Role/disposable filters from classify() already returned by now.
    if (initial.reason === "role-address") return initial;
    return { status: "verified", validity: "valid", reason: `mx-ok-${records.length}` };
  } catch (e: any) {
    // ENODATA / ENOTFOUND → domain doesn't accept mail.
    if (e?.code === "ENODATA" || e?.code === "ENOTFOUND") {
      return { status: "invalid", validity: "invalid", reason: `dns-${e.code.toLowerCase()}` };
    }
    // Other errors (network blip, throttle) — keep unverified, don't
    // brand the contact as invalid on a single transient failure.
    return { status: "unverified", validity: "unknown", reason: `dns-error-${e?.code || "unknown"}` };
  }
}

/**
 * Apollo / upstream-provider trump rule. If the provider already
 * marked the address as verified or unavailable, that beats our MX
 * check (Apollo has SMTP-level verification ours doesn't try). Maps
 * Apollo's vocabulary onto our Contact.emailStatus column.
 */
export function mergeApolloStatus(
  apolloStatus: string | null | undefined,
  fallback: EmailClassification,
): EmailClassification {
  if (!apolloStatus) return fallback;
  const a = apolloStatus.toLowerCase();
  if (a === "verified" || a === "valid") {
    return { status: "verified", validity: "valid", reason: "apollo-verified" };
  }
  if (a === "unavailable" || a === "invalid" || a === "bounced") {
    return { status: "invalid", validity: "invalid", reason: `apollo-${a}` };
  }
  if (a === "guessed" || a === "extrapolated") {
    return { status: "risky", validity: "risky", reason: `apollo-${a}` };
  }
  if (a === "likely_to_engage") {
    return { status: "unverified", validity: "unknown", reason: `apollo-${a}` };
  }
  return fallback;
}

/**
 * Convenience — given a fresh email + an optional apollo signal,
 * return a single classification ready to write to the Contact row.
 * Use this in import/enrichment paths.
 */
export async function classifyForImport(opts: {
  email?: string | null;
  apolloStatus?: string | null;
}): Promise<EmailClassification> {
  const apolloFirst = mergeApolloStatus(
    opts.apolloStatus,
    { status: "unverified", validity: "unknown", reason: "pending" },
  );
  if (apolloFirst.reason !== "pending") return apolloFirst;
  return verifyDeliverable(opts.email);
}

/**
 * Used by outreach send guards (BUG 2 spec — refuse sending to
 * known-invalid addresses). Returns true when the contact's
 * persisted status forbids send.
 */
export function isSendForbidden(emailStatus?: string | null): boolean {
  if (!emailStatus) return false;
  return ["invalid", "bounced", "hard_bounce", "unavailable"].includes(emailStatus.toLowerCase());
}
