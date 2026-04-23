// @ts-nocheck
/**
 * ═══════════════════════════════════════════════════════════════════════
 * Contact-quality scoring & placeholder detection
 *
 * Active Line Corp regression: the brand showed 19 contacts / 16 "verified"
 * emails, but half of them were obvious placeholders (John Doe, Jane Doe,
 * Sarah Doe, First Last, Test User). Those come from multiple sources:
 *   - Apollo / enrichment providers that pad results with example rows
 *   - CSV imports where someone templated cells
 *   - AI research hallucinations when the model can't find real people
 *   - Generic role-box emails (info@, sales@, noreply@)
 *
 * This module provides one function: `assessContact()`, which scores a
 * contact's likely realness and returns reasons for display. It's used:
 *   - On the BD Wizard contact picker to bucket suspicious contacts below
 *     the fold instead of mixing them with the real list.
 *   - On any ingestion path (Apollo sync, CSV import, AI research save) to
 *     refuse the worst offenders at write-time.
 *
 * It is INTENTIONALLY conservative: the rep can always un-filter and see
 * everything. We'd rather under-flag than drop a real contact.
 * ═══════════════════════════════════════════════════════════════════════
 */

export type ContactVerdict = "real" | "suspicious" | "placeholder" | "role_account";

export interface ContactQualityResult {
  verdict: ContactVerdict;
  /** 0-100 — higher = more confident the contact is real. */
  score: number;
  reasons: string[];
  /** True if the UI should hide this contact by default. */
  shouldHideByDefault: boolean;
}

// ── Placeholder name patterns ──
// Compiled once at module load. Each entry: the lowercase fragment to look
// for + the reason we show the rep. Order matters — most-specific first.
const PLACEHOLDER_NAME_SIGNATURES: Array<{ re: RegExp; reason: string }> = [
  {
    re: /^(john|jane|sarah|jim|jill|joe|jill|bob|alice)\s+doe\b/i,
    reason: "classic John/Jane Doe placeholder",
  },
  { re: /\bdoe\b.*\bdoe\b/i, reason: "duplicate 'Doe' usage" },
  { re: /^first\s+last$/i, reason: "literal 'First Last'" },
  { re: /^full\s+name$/i, reason: "literal 'Full Name'" },
  { re: /^sample\s+(user|contact|person|name)$/i, reason: "literal 'Sample ...' template" },
  {
    re: /^test\s+(user|contact|person|one|two|account|name)?\s*$/i,
    reason: "literal 'Test ...' template",
  },
  { re: /^(unknown|anonymous|noname|placeholder|example)\b/i, reason: "marker placeholder word" },
  { re: /^n\/?a\b|^tbd\b|^tba\b/i, reason: "N/A / TBD placeholder" },
  { re: /\blorem\s+ipsum\b/i, reason: "Lorem ipsum" },
  { re: /^[a-z]{1,2}\s+[a-z]{1,2}$/i, reason: "suspiciously short two-letter name" },
  { re: /^xxx+|^zzz+/i, reason: "x/z-repeated placeholder" },
  { re: /^contact\s+\d+$/i, reason: "numbered contact slug" },
];

// ── Role-based email prefixes ──
// These are real mailboxes but not individuals. We keep them as "role_account"
// instead of "placeholder" so the wizard can still route there for comms that
// explicitly target a team inbox.
const ROLE_EMAIL_PREFIXES = new Set([
  "info",
  "hello",
  "sales",
  "support",
  "contact",
  "inquiries",
  "inquiry",
  "help",
  "admin",
  "office",
  "team",
  "marketing",
  "press",
  "media",
  "privacy",
  "legal",
  "careers",
  "jobs",
  "hr",
  "accounts",
  "accounting",
  "billing",
  "finance",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "notifications",
  "notification",
  "newsletter",
  "newsletters",
  "abuse",
  "postmaster",
  "webmaster",
  "mail",
  "orders",
  "service",
  "services",
  "customerservice",
  "customer-service",
]);

const PLACEHOLDER_EMAIL_LOCAL_PARTS = new Set([
  "example",
  "test",
  "testing",
  "sample",
  "user",
  "johndoe",
  "janedoe",
  "first.last",
  "firstname.lastname",
  "foo",
  "bar",
  "baz",
  "asdf",
  "qwerty",
  "placeholder",
]);

const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "email.com",
  "mail.com",
  "domain.com",
  "yourcompany.com",
  "yourdomain.com",
  "company.com",
  "acme.com",
  "acmecorp.com",
  "placeholder.com",
]);

function splitEmail(email: string | null | undefined): { local: string; domain: string } | null {
  if (!email) return null;
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(String(email).trim());
  if (!m) return null;
  return { local: m[1].toLowerCase(), domain: m[2].toLowerCase() };
}

function displayName(c: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  if (c.name && c.name.trim()) return c.name.trim();
  const first = (c.firstName || "").trim();
  const last = (c.lastName || "").trim();
  const joined = [first, last].filter(Boolean).join(" ");
  return joined;
}

export interface AssessContactInput {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  title?: string | null;
}

export function assessContact(c: AssessContactInput): ContactQualityResult {
  const reasons: string[] = [];
  const name = displayName(c);
  const nameLc = name.toLowerCase();
  const email = (c.email || "").trim().toLowerCase();
  const split = splitEmail(email);

  let score = 100;
  let verdict: ContactVerdict = "real";

  // ── Missing name ──
  if (!name) {
    reasons.push("no name on record");
    score -= 30;
  }

  // ── Placeholder name? ──
  for (const sig of PLACEHOLDER_NAME_SIGNATURES) {
    if (nameLc && sig.re.test(nameLc)) {
      reasons.push(`name matches placeholder pattern (${sig.reason})`);
      score -= 80;
      verdict = "placeholder";
      break;
    }
  }

  // ── Same first + last name (e.g. "John John") ──
  if (
    c.firstName &&
    c.lastName &&
    c.firstName.trim().toLowerCase() === c.lastName.trim().toLowerCase()
  ) {
    reasons.push("first name and last name identical");
    score -= 30;
    if (verdict === "real") verdict = "suspicious";
  }

  // ── Email sanity ──
  if (split) {
    // Role mailbox?
    if (ROLE_EMAIL_PREFIXES.has(split.local)) {
      reasons.push(`role mailbox (${split.local}@)`);
      score -= 15;
      // Role account isn't a lie — downgrade but don't crush.
      if (verdict === "real") verdict = "role_account";
    }
    // Known placeholder local-part
    if (PLACEHOLDER_EMAIL_LOCAL_PARTS.has(split.local)) {
      reasons.push(`placeholder email local-part (${split.local}@)`);
      score -= 60;
      verdict = "placeholder";
    }
    // Known placeholder domain
    if (PLACEHOLDER_EMAIL_DOMAINS.has(split.domain)) {
      reasons.push(`placeholder email domain (@${split.domain})`);
      score -= 70;
      verdict = "placeholder";
    }
    // Local-part contains "doe"
    if (/(^|\W)(john|jane|sarah)\.?doe(\W|$)/.test(split.local)) {
      reasons.push("email local-part encodes John/Jane/Sarah Doe");
      score -= 60;
      verdict = "placeholder";
    }
    // Local-part is just a single letter, "firstlast", or "firstname.lastname"
    if (/^(firstlast|firstnamelastname|first\.last|firstname\.lastname)$/.test(split.local)) {
      reasons.push("template email local-part");
      score -= 50;
      verdict = "placeholder";
    }
  } else if (email) {
    reasons.push("malformed email address");
    score -= 20;
    if (verdict === "real") verdict = "suspicious";
  }

  // ── Job title sanity ──
  const title = ((c.jobTitle || c.title || "") + "").toLowerCase();
  if (title) {
    if (/example|placeholder|test title|lorem/.test(title)) {
      reasons.push("placeholder title");
      score -= 30;
      if (verdict !== "placeholder") verdict = "suspicious";
    }
  }

  // ── Clamp ──
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  // ── Final verdict bucketing ──
  // Placeholder/role survive from the pattern hits above. Otherwise derive
  // from score so anything with weak signals still funnels into "suspicious".
  if (verdict === "real" && score < 60) verdict = "suspicious";

  const shouldHideByDefault = verdict === "placeholder";

  return { verdict, score, reasons, shouldHideByDefault };
}

/**
 * Partition a list of contacts into (visible, hidden) buckets. `visible`
 * includes real + suspicious + role_account; `hidden` is only the hard
 * placeholders. The UI can offer a "show X hidden" toggle to bring them back.
 *
 * Respects persisted `hiddenFromWizard`: if an admin has explicitly hidden
 * a contact (or un-hidden one that would otherwise be auto-flagged), that
 * takes precedence over the computed verdict.
 */
export function partitionContacts<
  T extends AssessContactInput & { id?: string; hiddenFromWizard?: boolean | null },
>(
  contacts: T[],
): {
  visible: Array<T & { _quality: ContactQualityResult }>;
  hidden: Array<T & { _quality: ContactQualityResult }>;
} {
  const visible: Array<T & { _quality: ContactQualityResult }> = [];
  const hidden: Array<T & { _quality: ContactQualityResult }> = [];
  for (const c of contacts) {
    const _quality = assessContact(c);
    const out = { ...c, _quality };
    // Admin override wins in both directions: explicitly hidden goes to
    // `hidden` even if score is fine; explicitly not-hidden (false) stays
    // visible even if the quality check would normally bury it. Null /
    // undefined falls back to the computed verdict.
    const isHidden =
      c.hiddenFromWizard === true
        ? true
        : c.hiddenFromWizard === false
          ? false
          : _quality.shouldHideByDefault;
    if (isHidden) hidden.push(out);
    else visible.push(out);
  }
  return { visible, hidden };
}

// ───────────────────────────────────────────────────────────────────────
// Format-level validators — shape/regex checks only. These DON'T probe
// live deliverability (no SMTP handshakes, no LinkedIn requests). They
// catch the overwhelmingly common failure modes (malformed strings, wrong
// domain, non-profile LinkedIn URLs) without introducing network calls
// or rate-limit concerns. Live verification is a future upgrade.
// ───────────────────────────────────────────────────────────────────────

export type EmailValidity = "valid" | "invalid" | "risky" | "unknown";

/**
 * Cheap format-level email validation.
 *  - valid   → passes shape + has a real-looking TLD, not a known placeholder
 *  - risky   → looks fine but is a role mailbox, has a suspect local-part, or
 *              the domain has a single-label TLD (`.local`, `.test`, etc.)
 *  - invalid → doesn't parse, known placeholder domain, or has forbidden
 *              characters
 *  - unknown → empty string / null
 */
export function validateEmailFormat(email: string | null | undefined): {
  validity: EmailValidity;
  reason?: string;
} {
  if (!email || !email.trim()) return { validity: "unknown", reason: "no email on file" };
  const trimmed = email.trim().toLowerCase();

  // RFC-ish regex. Intentionally permissive — we're not a mail server, we
  // just want to reject obvious trash. Must have one @, at least one dot
  // in the domain, no whitespace, no angle brackets.
  const shape = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
  if (!shape.test(trimmed)) {
    return { validity: "invalid", reason: "does not match email shape" };
  }

  const split = splitEmail(trimmed);
  if (!split) return { validity: "invalid", reason: "cannot split local/domain" };

  if (PLACEHOLDER_EMAIL_DOMAINS.has(split.domain)) {
    return { validity: "invalid", reason: `placeholder domain (@${split.domain})` };
  }
  if (PLACEHOLDER_EMAIL_LOCAL_PARTS.has(split.local)) {
    return { validity: "invalid", reason: `placeholder local-part (${split.local}@)` };
  }

  // Single-label TLDs — `.local`, `.test`, `.localhost`, `.internal` are
  // reserved / test-only.
  const tld = split.domain.split(".").pop() || "";
  if (["local", "test", "localhost", "internal", "invalid"].includes(tld)) {
    return { validity: "invalid", reason: `reserved TLD (.${tld})` };
  }

  // Risky — role mailbox or obvious test-y signal but not outright junk.
  if (ROLE_EMAIL_PREFIXES.has(split.local)) {
    return { validity: "risky", reason: `role mailbox (${split.local}@)` };
  }
  if (/^(firstlast|firstnamelastname|first\.last|firstname\.lastname)$/.test(split.local)) {
    return { validity: "risky", reason: "template-style local-part" };
  }

  return { validity: "valid" };
}

export type LinkedInValidity = "valid" | "invalid" | "unknown";

/**
 * Shape-level LinkedIn profile URL validation. Accepts `/in/<slug>` and
 * localized variants (e.g. `/pub/<slug>`, `/mwlite/in/<slug>`, country
 * subdomains like `uk.linkedin.com`). Rejects company pages (`/company/`)
 * because reps mis-paste those as "contact" URLs surprisingly often.
 */
export function validateLinkedInUrl(url: string | null | undefined): {
  validity: LinkedInValidity;
  reason?: string;
} {
  if (!url || !url.trim()) return { validity: "unknown", reason: "no URL on file" };
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { validity: "invalid", reason: "not a parseable URL" };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith("linkedin.com")) {
    return { validity: "invalid", reason: `not a linkedin.com host (${host})` };
  }
  const path = parsed.pathname.toLowerCase();
  // Accept `/in/<slug>`, `/pub/<slug>`, `/mwlite/in/<slug>`. Reject
  // company/school pages that reps paste by accident.
  if (/^\/(in|pub)\/[a-z0-9\-_%]+/i.test(path)) return { validity: "valid" };
  if (/^\/mwlite\/in\/[a-z0-9\-_%]+/i.test(path)) return { validity: "valid" };
  if (path.startsWith("/company/") || path.startsWith("/school/") || path.startsWith("/showcase/")) {
    return { validity: "invalid", reason: "company/school URL, not a person profile" };
  }
  return { validity: "invalid", reason: "LinkedIn URL is not a person profile path" };
}

// ───────────────────────────────────────────────────────────────────────
// Persistence-ready assessment — lifts assessContact() + both format
// validators into one call. The API routes snapshot this shape onto the
// Contact row so the UI doesn't recompute and admins can sweep the DB.
// ───────────────────────────────────────────────────────────────────────

export interface PersistableHygiene {
  hygieneScore: number;
  hygieneVerdict: ContactVerdict;
  hygieneFlags: string; // JSON-stringified reasons
  hygieneCheckedAt: Date;
  emailValidity: EmailValidity;
  linkedinValidity: LinkedInValidity;
  /** Derived: suggested `hiddenFromWizard` value. Caller chooses whether to
   *  honor it (scan command does; brand-page lazy refresh does not, so it
   *  doesn't auto-hide contacts reps are actively looking at). */
  suggestedHidden: boolean;
}

export function computeHygieneSnapshot(c: AssessContactInput & {
  linkedinUrl?: string | null;
}): PersistableHygiene {
  const q = assessContact(c);
  const email = validateEmailFormat(c.email);
  const link = validateLinkedInUrl(c.linkedinUrl);
  // Roll format-level findings into the reasons list so a scan report can
  // explain why something got flagged purely on format.
  const reasons = [...q.reasons];
  if (email.validity === "invalid" && email.reason) {
    reasons.push(`email: ${email.reason}`);
  } else if (email.validity === "risky" && email.reason) {
    reasons.push(`email risky: ${email.reason}`);
  }
  if (link.validity === "invalid" && link.reason && c.linkedinUrl) {
    // Only surface LinkedIn shape errors if the contact actually has a URL
    // on file — "no URL" isn't a defect, it's just unknown.
    reasons.push(`linkedin: ${link.reason}`);
  }
  // If email is definitively invalid, bump the verdict up to suspicious.
  // Don't auto-promote to placeholder though — that's reserved for clear
  // patterns, not malformed strings.
  let verdict = q.verdict;
  if (verdict === "real" && email.validity === "invalid") verdict = "suspicious";

  const suggestedHidden = q.shouldHideByDefault || email.validity === "invalid";

  return {
    hygieneScore: q.score,
    hygieneVerdict: verdict,
    hygieneFlags: JSON.stringify(reasons),
    hygieneCheckedAt: new Date(),
    emailValidity: email.validity,
    linkedinValidity: link.validity,
    suggestedHidden,
  };
}
