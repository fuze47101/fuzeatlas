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
 */
export function partitionContacts<T extends AssessContactInput & { id?: string }>(
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
    if (_quality.shouldHideByDefault) hidden.push(out);
    else visible.push(out);
  }
  return { visible, hidden };
}
